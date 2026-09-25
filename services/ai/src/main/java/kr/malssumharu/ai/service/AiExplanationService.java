package kr.malssumharu.ai.service;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.ZoneOffset;
import java.time.ZoneId;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.Future;
import java.util.concurrent.RejectedExecutionException;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
import kr.malssumharu.ai.api.ExplanationResponse;
import kr.malssumharu.ai.bible.AlignmentPolicy;
import kr.malssumharu.ai.bible.GenerationInput;
import kr.malssumharu.ai.bible.InputAssembler;
import kr.malssumharu.ai.bible.WebBible;
import kr.malssumharu.ai.budget.MonthlyBudget;
import kr.malssumharu.ai.config.AiProperties;
import kr.malssumharu.ai.domain.ExplanationStatus;
import kr.malssumharu.ai.domain.Lang;
import kr.malssumharu.ai.domain.ProviderId;
import kr.malssumharu.ai.domain.RangeSet;
import kr.malssumharu.ai.domain.ReasonCode;
import kr.malssumharu.ai.domain.VerseRange;
import kr.malssumharu.ai.explain.ExplanationContent;
import kr.malssumharu.ai.explain.OutputValidator;
import kr.malssumharu.ai.key.CacheKeyParts;
import kr.malssumharu.ai.key.CacheKeys;
import kr.malssumharu.ai.llm.LlmClient;
import kr.malssumharu.ai.llm.LlmException;
import kr.malssumharu.ai.llm.LlmRequest;
import kr.malssumharu.ai.llm.LlmResult;
import kr.malssumharu.ai.prompt.PromptBuilder;
import kr.malssumharu.ai.prompt.PromptPolicy;
import kr.malssumharu.ai.qt.QtRangeClient;
import kr.malssumharu.ai.qt.QtRangeResult;
import kr.malssumharu.ai.ratelimit.WindowRateLimiter;
import kr.malssumharu.ai.store.ExplanationRecord;
import kr.malssumharu.ai.store.ExplanationStore;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Service;

@Service
public class AiExplanationService {
    private static final String OPTIONS = "summary:brief;context:brief;keyPoints:1-8;questions:1-5;quoteBlockWords:8";

    private final AiProperties props;
    private final QtRangeClient qt;
    private final WebBible web;
    private final AlignmentPolicy alignment;
    private final InputAssembler assembler;
    private final PromptPolicy promptPolicy;
    private final PromptBuilder promptBuilder;
    private final OutputValidator outputValidator;
    private final LlmClient llm;
    private final ExplanationStore store;
    private final MonthlyBudget budget;
    private final WindowRateLimiter clientLimiter;
    private final WindowRateLimiter globalLimiter;
    private final WindowRateLimiter reportLimiter;
    private final ExecutorService executor;
    private final ExecutorService llmExecutor;
    private final Clock clock;

    public AiExplanationService(AiProperties props, QtRangeClient qt, WebBible web, AlignmentPolicy alignment,
            InputAssembler assembler, PromptPolicy promptPolicy, PromptBuilder promptBuilder,
            OutputValidator outputValidator, LlmClient llm, ExplanationStore store, MonthlyBudget budget,
            @Qualifier("aiClientLimiter") WindowRateLimiter clientLimiter,
            @Qualifier("aiGlobalLimiter") WindowRateLimiter globalLimiter,
            @Qualifier("aiReportLimiter") WindowRateLimiter reportLimiter,
            @Qualifier("aiGenerationExecutor") ExecutorService executor,
            @Qualifier("aiLlmExecutor") ExecutorService llmExecutor, Clock aiClock) {
        this.props = props;
        this.qt = qt;
        this.web = web;
        this.alignment = alignment;
        this.assembler = assembler;
        this.promptPolicy = promptPolicy;
        this.promptBuilder = promptBuilder;
        this.outputValidator = outputValidator;
        this.llm = llm;
        this.store = store;
        this.budget = budget;
        this.clientLimiter = clientLimiter;
        this.globalLimiter = globalLimiter;
        this.reportLimiter = reportLimiter;
        this.executor = executor;
        this.llmExecutor = llmExecutor;
        this.clock = aiClock;
    }

    public ExplanationResponse explain(ProviderId provider, Lang lang, String clientIdentity) {
        Instant now = clock.instant();
        QtRangeResult qtResult = qt.today(provider);
        if (qtResult instanceof QtRangeResult.Unavailable unavailable) {
            return response(provider, null, lang, ExplanationStatus.UNAVAILABLE, unavailable.reason(), null, null, null);
        }
        QtRangeResult.Confirmed confirmed = (QtRangeResult.Confirmed) qtResult;
        if (!isProviderToday(confirmed.providerDate(), now)) {
            return response(provider, confirmed.providerDate(), lang, ExplanationStatus.UNAVAILABLE,
                    ReasonCode.NO_RANGE, null, null, null);
        }
        final Prepared prepared;
        try {
            prepared = prepare(provider, lang, confirmed);
        } catch (RuntimeException invalidRange) {
            return response(provider, confirmed.providerDate(), lang, ExplanationStatus.UNAVAILABLE,
                    ReasonCode.TEXT_NOT_ALIGNED, confirmed.ranges(), null, null);
        }
        AlignmentPolicy.Result aligned = alignment.check(prepared.ranges);
        if (!aligned.aligned()) {
            return response(provider, confirmed.providerDate(), lang, ExplanationStatus.UNAVAILABLE,
                    ReasonCode.TEXT_NOT_ALIGNED, prepared.ranges.ranges(), null, null);
        }
        GenerationInput input = assembler.assemble(prepared.ranges, aligned.verses());
        String key = cacheKey(prepared.ranges, input, lang);
        ExplanationRecord existing = store.find(key).orElse(null);
        if (existing != null && existing.status() == ExplanationStatus.AVAILABLE) {
            return response(provider, confirmed.providerDate(), lang, ExplanationStatus.AVAILABLE, null,
                    prepared.ranges.ranges(), existing, key);
        }
        if (existing != null && existing.status() == ExplanationStatus.IN_REVIEW) {
            return response(provider, confirmed.providerDate(), lang, ExplanationStatus.IN_REVIEW, null,
                    prepared.ranges.ranges(), existing, key);
        }
        if (existing != null && existing.status() == ExplanationStatus.GENERATING
                && existing.leaseUntil() != null && existing.leaseUntil().isAfter(now)) {
            return response(provider, confirmed.providerDate(), lang, ExplanationStatus.GENERATING, null,
                    prepared.ranges.ranges(), null, key);
        }
        if (existing != null && existing.status() == ExplanationStatus.FAILED
                && existing.retryAt() != null && existing.retryAt().isAfter(now)) {
            return response(provider, confirmed.providerDate(), lang, ExplanationStatus.FAILED, existing.reasonCode(),
                    prepared.ranges.ranges(), existing, key);
        }
        if (!props.generation().enabled()) {
            return response(provider, confirmed.providerDate(), lang, ExplanationStatus.UNAVAILABLE,
                    ReasonCode.AI_DISABLED, prepared.ranges.ranges(), null, key);
        }
        if (!clientLimiter.allow("generation", clientIdentity, now)
                || !globalLimiter.allow("generation-global", "all", now)) {
            return response(provider, confirmed.providerDate(), lang, ExplanationStatus.UNAVAILABLE,
                    ReasonCode.RATE_LIMITED, prepared.ranges.ranges(), null, key);
        }
        String claimToken = store.claim(key, now, props.generation().leaseTtl()).orElse(null);
        if (claimToken == null) {
            ExplanationRecord current = store.find(key).orElse(null);
            return response(provider, confirmed.providerDate(), lang,
                    current == null ? ExplanationStatus.GENERATING : current.status(),
                    current == null ? null : current.reasonCode(), prepared.ranges.ranges(), current, key);
        }
        long attempts = Math.max(1, props.generation().maxAttempts());
        long reserveUnits = Math.multiplyExact(Math.max(0, props.budget().estimatedUnitsPerGeneration()), attempts);
        YearMonth month = YearMonth.from(now.atZone(ZoneOffset.UTC));
        if (!budget.reserve(reserveUnits, month)) {
            store.invalidate(key);
            return response(provider, confirmed.providerDate(), lang, ExplanationStatus.UNAVAILABLE,
                    ReasonCode.BUDGET_EXHAUSTED, prepared.ranges.ranges(), null, key);
        }
        try {
            executor.execute(() -> generate(key, claimToken, input, lang, reserveUnits, month));
        } catch (RejectedExecutionException rejected) {
            budget.release(reserveUnits, month);
            store.failed(key, claimToken, ReasonCode.LLM_ERROR, now, now.plus(props.generation().failureBackoff()));
            return response(provider, confirmed.providerDate(), lang, ExplanationStatus.FAILED,
                    ReasonCode.LLM_ERROR, prepared.ranges.ranges(), store.find(key).orElse(null), key);
        }
        ExplanationResponse waited = waitIfRequested(provider, confirmed.providerDate(), lang, prepared.ranges.ranges(), key);
        if (waited != null) return waited;
        return response(provider, confirmed.providerDate(), lang, ExplanationStatus.GENERATING, null,
                prepared.ranges.ranges(), null, key);
    }

    private Prepared prepare(ProviderId provider, Lang lang, QtRangeResult.Confirmed confirmed) {
        if (confirmed.ranges() == null || confirmed.ranges().isEmpty()) throw new IllegalArgumentException("empty range");
        RangeSet ranges = RangeSet.normalize(confirmed.ranges(),
                (book, chapter) -> web.maxVerse(book, chapter));
        return new Prepared(provider, lang, confirmed.providerDate(), ranges);
    }

    private String cacheKey(RangeSet ranges, GenerationInput input, Lang lang) {
        CacheKeyParts parts = new CacheKeyParts(ranges.canonical(), WebBible.TRANSLATION_ID,
                alignment.versificationBasis(), web.dataVersion(), input.inputHash(), lang,
                OPTIONS + ";context=" + assembler.contextVerses(), promptPolicy.version(), props.llm().modelId(),
                props.llm().settingsVersion(), props.llm().referenceMaterialVersion());
        return CacheKeys.compute(parts);
    }

    private void generate(String key, String claimToken, GenerationInput input, Lang lang, long reservedUnits, YearMonth reservedMonth) {
        long billedUnits = 0;
        Instant started = clock.instant();
        ReasonCode failure = ReasonCode.LLM_ERROR;
        try {
            int maxAttempts = Math.max(1, props.generation().maxAttempts());
            LlmRequest request = promptBuilder.build(input, lang, props.llm().modelId());
            for (int attempt = 1; attempt <= maxAttempts; attempt++) {
                try {
                    LlmResult result = callLlm(request);
                    if (result == null || result.usageUnits() < 0) throw new OutputValidator.InvalidOutputException();
                    billedUnits = Math.addExact(billedUnits, result.usageUnits());
                    ExplanationContent content = outputValidator.validate(result.text(), input);
                    store.available(key, claimToken, content, clock.instant(), props.llm().modelId(), promptPolicy.version());
                    budget.settle(reservedUnits, billedUnits, reservedMonth);
                    return;
                } catch (LlmException e) {
                    billedUnits = Math.addExact(billedUnits, Math.max(0, e.billedUnits()));
                    if (!e.retryable() || attempt == maxAttempts) break;
                    if (!props.generation().retryDelay().isZero()) Thread.sleep(props.generation().retryDelay().toMillis());
                }
            }
        } catch (OutputValidator.InvalidOutputException invalid) {
            failure = ReasonCode.OUTPUT_INVALID;
        } catch (InterruptedException interrupted) {
            Thread.currentThread().interrupt();
        } catch (Throwable failureWithoutDetails) {
            // Model and source content must never be logged or copied into an API error.
        }
        budget.settle(reservedUnits, billedUnits, reservedMonth);
        store.failed(key, claimToken, failure, clock.instant(), clock.instant().plus(props.generation().failureBackoff()));
    }

    private ExplanationResponse waitIfRequested(ProviderId provider, String date, Lang lang, List<VerseRange> ranges, String key) {
        long waitMillis = Math.min(5_000, Math.max(0, props.generation().requestWait().toMillis()));
        long deadline = System.nanoTime() + TimeUnit.MILLISECONDS.toNanos(waitMillis);
        while (waitMillis > 0 && System.nanoTime() < deadline) {
            ExplanationRecord current = store.find(key).orElse(null);
            if (current != null && current.status() == ExplanationStatus.AVAILABLE) {
                return response(provider, date, lang, ExplanationStatus.AVAILABLE, null, ranges, current, key);
            }
            if (current != null && current.status() == ExplanationStatus.IN_REVIEW) {
                return response(provider, date, lang, ExplanationStatus.IN_REVIEW, null, ranges, current, key);
            }
            if (current != null && current.status() == ExplanationStatus.FAILED) {
                return response(provider, date, lang, ExplanationStatus.FAILED, current.reasonCode(), ranges, current, key);
            }
            try { Thread.sleep(Math.min(10, Math.max(1, TimeUnit.NANOSECONDS.toMillis(deadline - System.nanoTime())))); }
            catch (InterruptedException e) { Thread.currentThread().interrupt(); break; }
        }
        return null;
    }

    private boolean isProviderToday(String providerDate, Instant now) {
        try {
            return LocalDate.ofInstant(now, ZoneId.of("Asia/Seoul")).toString().equals(providerDate);
        } catch (RuntimeException invalidDate) {
            return false;
        }
    }

    private LlmResult callLlm(LlmRequest request) throws LlmException, InterruptedException {
        Future<LlmResult> future = llmExecutor.submit(() -> llm.generate(request));
        try {
            long timeoutMillis = Math.max(1, props.generation().callTimeout().toMillis());
            return future.get(timeoutMillis, TimeUnit.MILLISECONDS);
        } catch (TimeoutException e) {
            future.cancel(true);
            throw new LlmException(true, 0);
        } catch (ExecutionException e) {
            Throwable cause = e.getCause();
            if (cause instanceof LlmException llmFailure) throw llmFailure;
            throw new LlmException(false, 0);
        }
    }

    public ReportResult report(String cacheKey, int revision, String category, String note, String clientIdentity) {
        if (!validKey(cacheKey) || revision < 1 || category == null
                || !List.of("FACTUAL_ERROR", "WRONG_REFERENCE", "OFFENSIVE", "OTHER").contains(category)
                || note != null && note.length() > 200) {
            return new ReportResult(false, 400, null);
        }
        Instant now = clock.instant();
        if (!reportLimiter.allow("report", clientIdentity, now)) return new ReportResult(false, 429, null);
        ExplanationRecord current = store.find(cacheKey).orElse(null);
        if (current == null || current.status() != ExplanationStatus.AVAILABLE || current.revision() != revision) {
            return new ReportResult(false, 409, current == null ? null : current.status());
        }
        boolean severe = category.equals("FACTUAL_ERROR") || category.equals("WRONG_REFERENCE") || category.equals("OFFENSIVE");
        ExplanationStatus status = store.report(cacheKey, revision, severe, Math.max(1, props.report().severeThreshold()), now);
        return new ReportResult(true, 202, status);
    }

    public boolean hide(String cacheKey) {
        return validKey(cacheKey) && store.hide(cacheKey, clock.instant());
    }

    public boolean invalidate(String cacheKey) {
        return validKey(cacheKey) && store.invalidate(cacheKey);
    }

    public boolean replace(ProviderId provider, Lang lang, String cacheKey, int expectedRevision, ExplanationContent replacement) {
        if (!validKey(cacheKey) || expectedRevision < 1) return false;
        QtRangeResult result = qt.today(provider);
        if (!(result instanceof QtRangeResult.Confirmed confirmed)) return false;
        Prepared prepared;
        try { prepared = prepare(provider, lang, confirmed); }
        catch (RuntimeException invalid) { return false; }
        AlignmentPolicy.Result aligned = alignment.check(prepared.ranges);
        if (!aligned.aligned()) return false;
        GenerationInput input = assembler.assemble(prepared.ranges, aligned.verses());
        String currentKey = cacheKey(prepared.ranges, input, lang);
        if (!cacheKey.equals(currentKey)) return false;
        try { outputValidator.validateContent(replacement, input); }
        catch (RuntimeException invalid) { return false; }
        return store.replace(cacheKey, expectedRevision, replacement, clock.instant(), "operator", promptPolicy.version());
    }

    public ExplanationResponse regenerate(ProviderId provider, Lang lang, String cacheKey, String clientIdentity) {
        if (!validKey(cacheKey)) return response(provider, null, lang, ExplanationStatus.UNAVAILABLE,
                ReasonCode.NO_RANGE, null, null, null);
        QtRangeResult result = qt.today(provider);
        if (!(result instanceof QtRangeResult.Confirmed confirmed)) {
            return response(provider, null, lang, ExplanationStatus.UNAVAILABLE, ReasonCode.NO_RANGE, null, null, null);
        }
        if (!isProviderToday(confirmed.providerDate(), clock.instant())) {
            return response(provider, confirmed.providerDate(), lang, ExplanationStatus.UNAVAILABLE, ReasonCode.NO_RANGE,
                    null, null, null);
        }
        Prepared prepared;
        try { prepared = prepare(provider, lang, confirmed); }
        catch (RuntimeException invalid) {
            return response(provider, confirmed.providerDate(), lang, ExplanationStatus.UNAVAILABLE,
                    ReasonCode.TEXT_NOT_ALIGNED, confirmed.ranges(), null, null);
        }
        AlignmentPolicy.Result aligned = alignment.check(prepared.ranges);
        if (!aligned.aligned()) return response(provider, confirmed.providerDate(), lang, ExplanationStatus.UNAVAILABLE,
                ReasonCode.TEXT_NOT_ALIGNED, prepared.ranges.ranges(), null, null);
        GenerationInput input = assembler.assemble(prepared.ranges, aligned.verses());
        if (!cacheKey.equals(cacheKey(prepared.ranges, input, lang))) {
            return response(provider, confirmed.providerDate(), lang, ExplanationStatus.UNAVAILABLE,
                    ReasonCode.NO_RANGE, prepared.ranges.ranges(), null, null);
        }
        ExplanationRecord record = store.find(cacheKey).orElse(null);
        if (record != null && record.status() == ExplanationStatus.GENERATING) {
            return response(provider, confirmed.providerDate(), lang, ExplanationStatus.GENERATING, null,
                    prepared.ranges.ranges(), null, cacheKey);
        }
        store.invalidate(cacheKey);
        return explain(provider, lang, clientIdentity);
    }

    private static boolean validKey(String key) {
        return key != null && key.matches("[a-f0-9]{64}");
    }

    private ExplanationResponse response(ProviderId provider, String date, Lang lang, ExplanationStatus status,
            ReasonCode reason, List<VerseRange> ranges, ExplanationRecord record, String key) {
        ExplanationContent content = status == ExplanationStatus.AVAILABLE && record != null ? record.content() : null;
        ExplanationResponse.Meta meta = status == ExplanationStatus.AVAILABLE && record != null
                ? new ExplanationResponse.Meta(true, record.revision(), record.updatedAt(), record.modelId(), record.policyVersion(), key)
                : null;
        ExplanationResponse.Passage passage = ranges == null ? null : new ExplanationResponse.Passage(ranges.stream()
                .map(r -> new ExplanationResponse.Range(r.bookId(), new ExplanationResponse.Point(r.startChapter(), r.startVerse()),
                        new ExplanationResponse.Point(r.endChapter(), r.endVerse()))).toList());
        return new ExplanationResponse("1", provider.wire(), date, lang.wire(), status, reason, passage,
                new ExplanationResponse.SourceTranslation(WebBible.TRANSLATION_ID, WebBible.TRANSLATION_NAME,
                        WebBible.LICENSE, WebBible.LANGUAGE), content, meta,
                new ExplanationResponse.ReportPath("/api/ai/reports"));
    }

    public record ReportResult(boolean accepted, int httpStatus, ExplanationStatus status) { }
    private record Prepared(ProviderId provider, Lang lang, String date, RangeSet ranges) { }
}
