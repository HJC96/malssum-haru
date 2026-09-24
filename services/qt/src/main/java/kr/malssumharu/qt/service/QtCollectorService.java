package kr.malssumharu.qt.service;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
import kr.malssumharu.qt.config.QtProperties;
import kr.malssumharu.qt.domain.ProviderId;
import kr.malssumharu.qt.provider.AdapterOutcome;
import kr.malssumharu.qt.provider.QtProviderAdapter;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

/**
 * 스케줄이 호출하는 수집기. 서울 오늘 기준으로 어댑터를 실행해 확인된 결과만 (providerId, providerDate) 키로 upsert한다.
 *
 * <ul>
 *   <li>수집기 스위치(QT_COLLECTOR_ENABLED)가 꺼졌거나 취득 플래그가 꺼졌거나 제공처가 disabled면
 *       그 제공처에는 어떤 요청도 하지 않고 저장도 하지 않는다.
 *   <li>제공처 날짜가 서울 오늘과 다르거나 장절을 못 읽으면 저장하지 않는다(이미 있는 오늘 항목도 건드리지 않는다).
 *   <li>(providerId, 서울 오늘) 항목이 이미 저장돼 있으면 그 제공처에는 요청하지 않고 건너뛴다(멱등, 하루 요청 최소화).
 *       저장되지 않은 제공처(실패·날짜 불일치)만 다음 스케줄에서 다시 시도한다.
 *   <li>제공처별로 격리한다. 한쪽 실패가 다른 쪽 수집을 막지 않는다.
 * </ul>
 * 로그에는 제공처·결과 코드만 남긴다.
 */
@Service
public class QtCollectorService {

    public enum Result {
        STORED,
        ALREADY_COLLECTED,
        SKIPPED_COLLECTOR_DISABLED,
        SKIPPED_PROVIDER_DISABLED,
        SKIPPED_ACQUISITION_OFF,
        FAILED
    }

    /** reason은 FAILED일 때만 값이 있는 reasonCode 이름. */
    public record ProviderReport(String providerId, Result result, String reason) {
    }

    public record Report(LocalDate seoulDate, List<ProviderReport> providers) {
    }

    private static final Logger log = LoggerFactory.getLogger(QtCollectorService.class);

    private final List<QtProviderAdapter> adapters;
    private final QtProperties props;
    private final QtDayStore store;
    private final Clock clock;
    private final ExecutorService executor;
    private final java.util.Map<ProviderId, java.util.concurrent.locks.ReentrantLock> locks =
            new java.util.concurrent.ConcurrentHashMap<>();

    public QtCollectorService(
            List<QtProviderAdapter> adapters, QtProperties props, QtDayStore store, Clock clock, ExecutorService qtExecutor) {
        this.adapters = adapters.stream().sorted(Comparator.comparing(a -> a.id().ordinal())).toList();
        this.props = props;
        this.store = store;
        this.clock = clock;
        this.executor = qtExecutor;
    }

    public Report collect() {
        Instant now = clock.instant();
        LocalDate seoulToday = LocalDate.ofInstant(now, QtTodayService.SEOUL);

        if (!props.collector().isEnabled()) {
            log.info("collector disabled: no provider requests, nothing stored");
            return new Report(seoulToday, adapters.stream()
                    .map(a -> new ProviderReport(a.id().id(), Result.SKIPPED_COLLECTOR_DISABLED, null)).toList());
        }

        List<Future<ProviderReport>> futures = new ArrayList<>();
        for (QtProviderAdapter adapter : adapters) {
            futures.add(executor.submit(() -> collectIsolated(adapter, seoulToday, now)));
        }
        List<ProviderReport> reports = new ArrayList<>();
        for (int i = 0; i < adapters.size(); i++) {
            reports.add(await(adapters.get(i).id(), futures.get(i)));
        }
        return new Report(seoulToday, reports);
    }

    private ProviderReport await(ProviderId id, Future<ProviderReport> future) {
        try {
            return future.get(props.http().overallTimeout().toMillis(), TimeUnit.MILLISECONDS);
        } catch (TimeoutException e) {
            future.cancel(true);
            return failed(id, "UPSTREAM_TIMEOUT");
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return failed(id, "INTERNAL_ERROR");
        } catch (ExecutionException e) {
            return failed(id, "INTERNAL_ERROR");
        }
    }

    private ProviderReport collectIsolated(QtProviderAdapter adapter, LocalDate seoulToday, Instant now) {
        try {
            return collectOne(adapter, seoulToday, now);
        } catch (Throwable t) {
            log.error("provider={} collect failed type={}", adapter.id().id(), t.getClass().getSimpleName());
            return failed(adapter.id(), "INTERNAL_ERROR");
        }
    }

    private ProviderReport collectOne(QtProviderAdapter adapter, LocalDate seoulToday, Instant now) {
        ProviderId id = adapter.id();
        if (props.disabled(id)) {
            return new ProviderReport(id.id(), Result.SKIPPED_PROVIDER_DISABLED, null);
        }
        if (!props.acquisitionEnabled(id)) {
            return new ProviderReport(id.id(), Result.SKIPPED_ACQUISITION_OFF, null);
        }
        // 같은 실행 환경 안의 동시 수집은 제공처별로 직렬화해 중복 요청을 막는다(환경 사이는 저장소 키가 중복을 막는다)
        var lock = locks.computeIfAbsent(id, k -> new java.util.concurrent.locks.ReentrantLock());
        lock.lock();
        try {
            return collectLocked(adapter, id, seoulToday, now);
        } finally {
            lock.unlock();
        }
    }

    private ProviderReport collectLocked(QtProviderAdapter adapter, ProviderId id, LocalDate seoulToday, Instant now) {
        // 멱등: 서울 오늘 항목이 이미 확인·저장돼 있으면 그 제공처에는 요청하지 않는다. 실패한 제공처만 다음 스케줄에서 재시도한다
        if (store.find(id, seoulToday).isPresent()) {
            return new ProviderReport(id.id(), Result.ALREADY_COLLECTED, null);
        }

        AdapterOutcome outcome = adapter.fetch(seoulToday);
        if (outcome instanceof AdapterOutcome.Failed failed) {
            log.warn("provider={} collect status={} reason={}", id.id(), failed.status(), failed.reason());
            return failed(id, failed.reason().name());
        }
        AdapterOutcome.Found found = (AdapterOutcome.Found) outcome;
        AdapterOutcome.Failed rejection = found.rejectionFor(seoulToday);
        if (rejection != null) {
            log.warn("provider={} collect rejected reason={}", id.id(), rejection.reason());
            return failed(id, rejection.reason().name());
        }
        store.save(new StoredDay(id, found.providerDate(), found.ranges(), found.displayReference(), now, adapter.sourceVersion()));
        log.info("provider={} collect result=STORED", id.id());
        return new ProviderReport(id.id(), Result.STORED, null);
    }

    private static ProviderReport failed(ProviderId id, String reason) {
        return new ProviderReport(id.id(), Result.FAILED, reason);
    }
}
