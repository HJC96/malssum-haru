package kr.malssumharu.qt.service;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
import java.util.concurrent.locks.ReentrantLock;
import kr.malssumharu.qt.api.QtTodayResponse;
import kr.malssumharu.qt.api.QtTodayResponse.Localized;
import kr.malssumharu.qt.api.QtTodayResponse.Passage;
import kr.malssumharu.qt.api.QtTodayResponse.Position;
import kr.malssumharu.qt.api.QtTodayResponse.ProviderEntry;
import kr.malssumharu.qt.config.QtProperties;
import kr.malssumharu.qt.domain.AvailabilityStatus;
import kr.malssumharu.qt.domain.BibleRange;
import kr.malssumharu.qt.domain.ProviderId;
import kr.malssumharu.qt.domain.ReasonCode;
import kr.malssumharu.qt.provider.AdapterOutcome;
import kr.malssumharu.qt.provider.QtProviderAdapter;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

/**
 * 두 제공처의 오늘 상태를 계약 응답으로 조립한다.
 *
 * <ul>
 *   <li>서울 시간대 오늘을 Clock으로 계산한다.
 *   <li>제공처마다 병렬·격리: 한쪽의 실패·지연·예외가 다른 쪽과 응답을 막지 않는다.
 *   <li>제공처 날짜 != 서울 오늘이면 DATE_MISMATCH. 어제 자료를 오늘로 반환하지 않는다.
 *   <li>성공은 (providerId, providerDate) 키로 저장(중복 없음), 실패는 짧게 캐시해 제공처에 반복 요청하지 않는다.
 * </ul>
 * 로그에는 제공처·상태·사유만 남기고 제공처 문구는 남기지 않는다.
 */
@Service
public class QtTodayService {

    public static final ZoneId SEOUL = ZoneId.of("Asia/Seoul");
    private static final Logger log = LoggerFactory.getLogger(QtTodayService.class);

    private static final Localized CONFIRMED_NOTICE = new Localized(
            "본문은 공식 페이지에서 읽을 수 있습니다.",
            "Read the text on the official page. The source is Korean only.");

    private record CachedFailure(LocalDate seoulDate, AdapterOutcome.Failed outcome, Instant expiresAt) {
    }

    private final List<QtProviderAdapter> adapters;
    private final QtProperties props;
    private final QtDayStore store;
    private final Clock clock;
    private final ExecutorService executor;
    private final Map<ProviderId, ReentrantLock> locks = new ConcurrentHashMap<>();
    private final Map<ProviderId, CachedFailure> failures = new ConcurrentHashMap<>();

    public QtTodayService(
            List<QtProviderAdapter> adapters,
            QtProperties props,
            QtDayStore store,
            Clock clock,
            ExecutorService qtExecutor) {
        this.adapters = adapters.stream().sorted(java.util.Comparator.comparing(a -> a.id().ordinal())).toList();
        this.props = props;
        this.store = store;
        this.clock = clock;
        this.executor = qtExecutor;
    }

    public QtTodayResponse today() {
        Instant now = clock.instant();
        LocalDate seoulToday = LocalDate.ofInstant(now, SEOUL);

        List<Future<ProviderEntry>> futures = new ArrayList<>();
        for (QtProviderAdapter adapter : adapters) {
            futures.add(executor.submit(() -> resolveIsolated(adapter, seoulToday)));
        }
        List<ProviderEntry> entries = new ArrayList<>();
        for (int i = 0; i < adapters.size(); i++) {
            entries.add(await(adapters.get(i), futures.get(i), seoulToday));
        }
        return new QtTodayResponse(QtTodayResponse.SCHEMA_VERSION, now.truncatedTo(ChronoUnit.SECONDS), entries);
    }

    private ProviderEntry await(QtProviderAdapter adapter, Future<ProviderEntry> future, LocalDate seoulToday) {
        try {
            return future.get(props.http().overallTimeout().toMillis(), TimeUnit.MILLISECONDS);
        } catch (TimeoutException e) {
            future.cancel(true);
            log.warn("provider={} status=LINK_ERROR reason=UPSTREAM_TIMEOUT (overall deadline)", adapter.id().id());
            return failureEntry(adapter, seoulToday, AdapterOutcome.Failed.linkError(ReasonCode.UPSTREAM_TIMEOUT));
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return failureEntry(adapter, seoulToday, AdapterOutcome.Failed.unavailable(ReasonCode.INTERNAL_ERROR, null));
        } catch (ExecutionException e) {
            return failureEntry(adapter, seoulToday, AdapterOutcome.Failed.unavailable(ReasonCode.INTERNAL_ERROR, null));
        }
    }

    /** 어댑터의 어떤 예외도 이 제공처 항목의 실패로만 나타나게 한다. */
    private ProviderEntry resolveIsolated(QtProviderAdapter adapter, LocalDate seoulToday) {
        try {
            return resolve(adapter, seoulToday);
        } catch (Throwable t) {
            log.error("provider={} unexpected failure type={}", adapter.id().id(), t.getClass().getSimpleName());
            return failureEntry(adapter, seoulToday, AdapterOutcome.Failed.unavailable(ReasonCode.INTERNAL_ERROR, null));
        }
    }

    private ProviderEntry resolve(QtProviderAdapter adapter, LocalDate seoulToday) {
        ProviderId id = adapter.id();
        if (props.disabled(id)) {
            return terminalEntry(adapter, seoulToday, AvailabilityStatus.DISABLED, ReasonCode.OPERATOR_DISABLED);
        }
        if (!props.acquisitionEnabled(id)) {
            return terminalEntry(
                    adapter, seoulToday, AvailabilityStatus.RANGE_NOT_PERMITTED, ReasonCode.PERMISSION_UNCONFIRMED);
        }

        if (props.storage().deployed()) {
            return storedEntry(adapter, seoulToday);
        }

        ReentrantLock lock = locks.computeIfAbsent(id, k -> new ReentrantLock());
        lock.lock();
        try {
            Instant now = clock.instant();
            // 서울 오늘 키로만 조회하므로 어제 항목은 절대 반환되지 않는다
            StoredDay stored = store.find(id, seoulToday).orElse(null);
            if (stored != null && now.isBefore(stored.verifiedAt().plus(props.cache().confirmedTtl()))) {
                return confirmedEntry(adapter, seoulToday, stored);
            }
            CachedFailure cached = failures.get(id);
            if (cached != null && cached.seoulDate().equals(seoulToday) && now.isBefore(cached.expiresAt())) {
                return failureEntry(adapter, seoulToday, cached.outcome());
            }

            AdapterOutcome outcome = adapter.fetch(seoulToday);
            return switch (outcome) {
                case AdapterOutcome.Found found -> handleFound(adapter, seoulToday, found, now);
                case AdapterOutcome.Failed failed -> handleFailed(adapter, seoulToday, failed, now);
            };
        } finally {
            lock.unlock();
        }
    }

    /**
     * 배포 모드: 조회는 저장소에서 서울 오늘 키의 항목만 읽는다. 제공처에는 요청하지 않는다.
     * 항목이 없으면 NOT_COLLECTED_YET이며 어제 항목으로 대체하지 않는다.
     */
    private ProviderEntry storedEntry(QtProviderAdapter adapter, LocalDate seoulToday) {
        return store.find(adapter.id(), seoulToday)
                .filter(stored -> seoulToday.equals(stored.providerDate())) // 키가 맞아도 한 번 더 확인
                .map(stored -> confirmedEntry(adapter, seoulToday, stored))
                .orElseGet(() -> failureEntry(
                        adapter, seoulToday, AdapterOutcome.Failed.unavailable(ReasonCode.NOT_COLLECTED_YET, null)));
    }

    private ProviderEntry handleFound(QtProviderAdapter adapter, LocalDate seoulToday, AdapterOutcome.Found found, Instant now) {
        AdapterOutcome.Failed rejection = found.rejectionFor(seoulToday);
        if (rejection != null) {
            return handleFailed(adapter, seoulToday, rejection, now);
        }
        StoredDay stored = new StoredDay(
                adapter.id(), found.providerDate(), found.ranges(), found.displayReference(), now, adapter.sourceVersion());
        store.save(stored);
        failures.remove(adapter.id());
        log.info("provider={} status=RANGE_CONFIRMED", adapter.id().id());
        return confirmedEntry(adapter, seoulToday, stored);
    }

    private ProviderEntry handleFailed(QtProviderAdapter adapter, LocalDate seoulToday, AdapterOutcome.Failed failed, Instant now) {
        failures.put(adapter.id(), new CachedFailure(seoulToday, failed, now.plus(props.cache().failureTtl())));
        log.warn("provider={} status={} reason={}", adapter.id().id(), failed.status(), failed.reason());
        return failureEntry(adapter, seoulToday, failed);
    }

    // ---- 응답 항목 조립 ----

    private ProviderEntry confirmedEntry(QtProviderAdapter adapter, LocalDate seoulToday, StoredDay stored) {
        List<QtTodayResponse.Range> ranges = stored.ranges().stream().map(QtTodayService::toDto).toList();
        return entry(
                adapter,
                seoulToday,
                stored.providerDate(),
                AvailabilityStatus.RANGE_CONFIRMED,
                null,
                new Passage(ranges),
                stored.displayReference(),
                stored.verifiedAt().truncatedTo(ChronoUnit.SECONDS),
                CONFIRMED_NOTICE);
    }

    private ProviderEntry failureEntry(QtProviderAdapter adapter, LocalDate seoulToday, AdapterOutcome.Failed failed) {
        return entry(adapter, seoulToday, failed.providerDate(), failed.status(), failed.reason(), null, null, null, null);
    }

    private ProviderEntry terminalEntry(
            QtProviderAdapter adapter, LocalDate seoulToday, AvailabilityStatus status, ReasonCode reason) {
        return entry(adapter, seoulToday, null, status, reason, null, null, null, null);
    }

    private ProviderEntry entry(
            QtProviderAdapter adapter,
            LocalDate seoulToday,
            LocalDate providerDate,
            AvailabilityStatus status,
            ReasonCode reason,
            Passage passage,
            String displayReference,
            Instant verifiedAt,
            Localized notice) {
        ProviderId id = adapter.id();
        return new ProviderEntry(
                id.id(),
                new Localized(id.nameKo(), id.nameEn()),
                SEOUL.getId(),
                providerDate,
                status,
                reason,
                passage,
                displayReference,
                adapter.officialUrl(seoulToday).toString(),
                adapter.officialUrlKind().wire(),
                verifiedAt,
                adapter.sourceVersion(),
                QtTodayResponse.BODY_NOT_PROVIDED,
                notice);
    }

    private static QtTodayResponse.Range toDto(BibleRange r) {
        return new QtTodayResponse.Range(
                r.bookId(),
                new Position(r.start().chapter(), r.start().verse()),
                new Position(r.end().chapter(), r.end().verse()));
    }
}
