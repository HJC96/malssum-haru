package kr.malssumharu.ai.service;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import kr.malssumharu.ai.api.ExplanationResponse;
import kr.malssumharu.ai.bible.AlignmentPolicy;
import kr.malssumharu.ai.bible.InputAssembler;
import kr.malssumharu.ai.bible.WebBible;
import kr.malssumharu.ai.budget.MonthlyBudget;
import kr.malssumharu.ai.config.AiProperties;
import kr.malssumharu.ai.domain.ExplanationStatus;
import kr.malssumharu.ai.domain.Lang;
import kr.malssumharu.ai.domain.ProviderId;
import kr.malssumharu.ai.domain.ReasonCode;
import kr.malssumharu.ai.domain.VerseRange;
import kr.malssumharu.ai.explain.OutputValidator;
import kr.malssumharu.ai.llm.LlmClient;
import kr.malssumharu.ai.llm.LlmResult;
import kr.malssumharu.ai.prompt.PromptBuilder;
import kr.malssumharu.ai.prompt.PromptPolicy;
import kr.malssumharu.ai.qt.QtRangeClient;
import kr.malssumharu.ai.qt.QtRangeResult;
import kr.malssumharu.ai.ratelimit.WindowRateLimiter;
import kr.malssumharu.ai.store.InMemoryExplanationStore;
import org.junit.jupiter.api.Test;

class AiExplanationServiceTest {
    private static final Instant NOW = Instant.parse("2026-09-25T00:00:00Z");
    private static final String VALID_OUTPUT = """
            {"summary":"The account opens by describing an act of creation.",
             "context":"No neighbouring verse is included in this example.",
             "keyPoints":[{"text":"The opening establishes the scene.","refs":[{"bookId":"GEN","chapter":1,"verse":1}]}],
             "questions":["What does this beginning emphasize?"],"viewpointNotes":[]}
            """;

    @Test void noRangeReturnsUnavailableWithoutCallingLlm() {
        AtomicInteger calls = new AtomicInteger();
        try (Harness h = harness(new QtRangeResult.Unavailable(ReasonCode.NOT_COLLECTED_YET), false,
                (request) -> { calls.incrementAndGet(); return new LlmResult(VALID_OUTPUT, 1); }, 10, 10)) {
            ExplanationResponse response = h.service.explain(ProviderId.MAEIL_SEONGYEONG, Lang.EN, "client");
            assertThat(response.status()).isEqualTo(ExplanationStatus.UNAVAILABLE);
            assertThat(response.reasonCode()).isEqualTo(ReasonCode.NOT_COLLECTED_YET);
            assertThat(response.passage()).isNull();
            assertThat(calls.get()).isZero();
        }
    }

    @Test void staleProviderDateIsNeverExplainedAsToday() {
        AtomicInteger calls = new AtomicInteger();
        var stale = new QtRangeResult.Confirmed("2026-09-24", List.of(new VerseRange("GEN", 1, 1, 1, 1)));
        try (Harness h = harness(stale, true,
                request -> { calls.incrementAndGet(); return new LlmResult(VALID_OUTPUT, 1); }, 10, 10)) {
            ExplanationResponse response = h.service.explain(ProviderId.MAEIL_SEONGYEONG, Lang.EN, "client");
            assertThat(response.status()).isEqualTo(ExplanationStatus.UNAVAILABLE);
            assertThat(response.reasonCode()).isEqualTo(ReasonCode.NO_RANGE);
            assertThat(response.passage()).isNull();
            assertThat(calls.get()).isZero();
        }
    }

    @Test void disabledGenerationFailsClosed() {
        AtomicInteger calls = new AtomicInteger();
        try (Harness h = harness(confirmed(), false,
                request -> { calls.incrementAndGet(); return new LlmResult(VALID_OUTPUT, 1); }, 10, 10)) {
            ExplanationResponse response = h.service.explain(ProviderId.MAEIL_SEONGYEONG, Lang.EN, "client");
            assertThat(response.status()).isEqualTo(ExplanationStatus.UNAVAILABLE);
            assertThat(response.reasonCode()).isEqualTo(ReasonCode.AI_DISABLED);
            assertThat(calls.get()).isZero();
        }
    }

    @Test void zeroBudgetFailsClosedEvenWhenGenerationIsEnabled() {
        AtomicInteger calls = new AtomicInteger();
        try (Harness h = harness(confirmed(), true,
                request -> { calls.incrementAndGet(); return new LlmResult(VALID_OUTPUT, 1); }, 0, 0)) {
            ExplanationResponse response = h.service.explain(ProviderId.MAEIL_SEONGYEONG, Lang.EN, "client");
            assertThat(response.status()).isEqualTo(ExplanationStatus.UNAVAILABLE);
            assertThat(response.reasonCode()).isEqualTo(ReasonCode.BUDGET_EXHAUSTED);
            assertThat(calls.get()).isZero();
        }
    }

    @Test void successfulResultIsReusedAcrossRepeatedRequests() throws Exception {
        AtomicInteger calls = new AtomicInteger();
        try (Harness h = harness(confirmed(), true, request -> {
            calls.incrementAndGet();
            return new LlmResult(VALID_OUTPUT, 1);
        }, 10, 10)) {
            ExplanationResponse first = h.service.explain(ProviderId.MAEIL_SEONGYEONG, Lang.EN, "client");
            assertThat(first.status()).isEqualTo(ExplanationStatus.GENERATING);
            ExplanationResponse next = awaitAvailable(h);
            assertThat(next.status()).isEqualTo(ExplanationStatus.AVAILABLE);
            assertThat(next.content()).isNotNull();
            assertThat(next.meta().revision()).isEqualTo(1);
            assertThat(h.service.explain(ProviderId.SAENGMYEONG_UI_SAM, Lang.EN, "other-client").meta().cacheKey())
                    .isEqualTo(next.meta().cacheKey());
            assertThat(calls.get()).isEqualTo(1);
        }
    }

    @Test void simultaneousRequestsShareOneActiveGeneration() throws Exception {
        AtomicInteger calls = new AtomicInteger();
        CountDownLatch started = new CountDownLatch(1);
        CountDownLatch release = new CountDownLatch(1);
        try (Harness h = harness(confirmed(), true, request -> {
            calls.incrementAndGet();
            started.countDown();
            try { release.await(3, TimeUnit.SECONDS); }
            catch (InterruptedException e) { Thread.currentThread().interrupt(); }
            return new LlmResult(VALID_OUTPUT, 1);
        }, 10, 10)) {
            assertThat(h.service.explain(ProviderId.MAEIL_SEONGYEONG, Lang.EN, "client-a").status())
                    .isEqualTo(ExplanationStatus.GENERATING);
            assertThat(started.await(3, TimeUnit.SECONDS)).isTrue();
            ExplanationResponse concurrent = h.service.explain(ProviderId.MAEIL_SEONGYEONG, Lang.EN, "client-b");
            assertThat(concurrent.status()).isEqualTo(ExplanationStatus.GENERATING);
            assertThat(calls.get()).isEqualTo(1);
            release.countDown();
            assertThat(awaitAvailable(h).status()).isEqualTo(ExplanationStatus.AVAILABLE);
        } finally {
            release.countDown();
        }
    }

    @Test void invalidModelOutputIsHiddenAndMarkedFailed() throws Exception {
        try (Harness h = harness(confirmed(), true, request -> new LlmResult("{}", 1), 10, 10)) {
            ExplanationResponse first = h.service.explain(ProviderId.MAEIL_SEONGYEONG, Lang.EN, "client");
            assertThat(first.status()).isEqualTo(ExplanationStatus.GENERATING);
            long until = System.nanoTime() + TimeUnit.SECONDS.toNanos(3);
            ExplanationResponse result;
            do {
                result = h.service.explain(ProviderId.MAEIL_SEONGYEONG, Lang.EN, "client");
                if (result.status() == ExplanationStatus.FAILED) break;
                Thread.sleep(10);
            } while (System.nanoTime() < until);
            assertThat(result.status()).isEqualTo(ExplanationStatus.FAILED);
            assertThat(result.reasonCode()).isEqualTo(ReasonCode.OUTPUT_INVALID);
            assertThat(result.content()).isNull();
        }
    }

    private static ExplanationResponse awaitAvailable(Harness h) throws InterruptedException {
        long until = System.nanoTime() + TimeUnit.SECONDS.toNanos(5);
        ExplanationResponse response = null;
        while (System.nanoTime() < until) {
            response = h.service.explain(ProviderId.MAEIL_SEONGYEONG, Lang.EN, "poller");
            if (response.status() == ExplanationStatus.AVAILABLE) return response;
            Thread.sleep(10);
        }
        return response;
    }

    private static QtRangeResult.Confirmed confirmed() {
        return new QtRangeResult.Confirmed("2026-09-25", List.of(new VerseRange("GEN", 1, 1, 1, 1)));
    }

    private static Harness harness(QtRangeResult qtResult, boolean enabled, LlmClient llm, long generationLimit, long unitLimit) {
        WebBible web = new WebBible();
        AlignmentPolicy alignment = new AlignmentPolicy(web);
        PromptPolicy policy = new PromptPolicy();
        AiProperties props = new AiProperties(
                new AiProperties.Generation(enabled, generationLimit, 1, Duration.ofSeconds(1), Duration.ZERO,
                        Duration.ofMillis(100), Duration.ZERO, 1, 16),
                new AiProperties.Budget(unitLimit, 1),
                new AiProperties.Qt("http://127.0.0.1:8081", Duration.ofMillis(100), Duration.ofMillis(200)),
                new AiProperties.Llm("mock-model", "settings-1", "none"),
                new AiProperties.Storage(""),
                new AiProperties.RateLimit(50, 50, 50, Duration.ofMinutes(1), false),
                new AiProperties.Report(3), new AiProperties.Admin(false, ""), new AiProperties.Input(0),
                new AiProperties.Cache(Duration.ofMinutes(10)));
        ExecutorService executor = Executors.newSingleThreadExecutor();
        ExecutorService llmExecutor = Executors.newSingleThreadExecutor();
        InMemoryExplanationStore store = new InMemoryExplanationStore();
        var service = new AiExplanationService(props, provider -> qtResult, web, alignment,
                new InputAssembler(web, alignment, 0), policy, new PromptBuilder(policy), new OutputValidator(), llm,
                store, new MonthlyBudget(generationLimit, unitLimit),
                new WindowRateLimiter(50, Duration.ofMinutes(1)), new WindowRateLimiter(50, Duration.ofMinutes(1)),
                new WindowRateLimiter(50, Duration.ofMinutes(1)), executor, llmExecutor,
                Clock.fixed(NOW, ZoneOffset.UTC));
        return new Harness(service, executor, llmExecutor);
    }

    private record Harness(AiExplanationService service, ExecutorService executor, ExecutorService llmExecutor) implements AutoCloseable {
        @Override public void close() { executor.shutdownNow(); llmExecutor.shutdownNow(); }
    }
}
