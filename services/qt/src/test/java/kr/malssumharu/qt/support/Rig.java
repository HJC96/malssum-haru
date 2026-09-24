package kr.malssumharu.qt.support;

import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import kr.malssumharu.qt.bible.ReferenceParser;
import kr.malssumharu.qt.bible.VerseCountTable;
import kr.malssumharu.qt.config.QtProperties;
import kr.malssumharu.qt.http.JdkHttpFetcher;
import kr.malssumharu.qt.provider.MaeilSeongyeongAdapter;
import kr.malssumharu.qt.provider.QtProviderAdapter;
import kr.malssumharu.qt.provider.SaengmyeongUiSamAdapter;
import kr.malssumharu.qt.service.InMemoryQtDayStore;
import kr.malssumharu.qt.service.QtTodayService;
import java.util.List;

/** 서비스·어댑터·로컬 목 서버를 묶는 테스트 조립기. */
public final class Rig implements AutoCloseable {

    /** 2026-09-24 10:00 KST. */
    public static final Instant NOON_SEOUL_0924 = Instant.parse("2026-09-24T01:00:00Z");

    public final MockUpstream upstream = MockUpstream.start();
    public final MutableClock clock = new MutableClock(NOON_SEOUL_0924);
    public final InMemoryQtDayStore store = new InMemoryQtDayStore();
    public final ExecutorService executor = Executors.newVirtualThreadPerTaskExecutor();
    public final QtProviderAdapter maeil;
    public final QtProviderAdapter saengmyeong;
    public final QtTodayService service;

    public Rig() {
        this(true, Map.of(), Duration.ofMillis(800), Duration.ofSeconds(20));
    }

    public Rig(boolean acquisitionEnabled, Map<String, QtProperties.ProviderSettings> providers,
               Duration requestTimeout, Duration overallTimeout) {
        var http = new JdkHttpFetcher(Duration.ofMillis(500), requestTimeout, "test-agent", 512 * 1024);
        var parser = new ReferenceParser(VerseCountTable.NONE);
        maeil = new MaeilSeongyeongAdapter(http, upstream.origin(), parser);
        saengmyeong = new SaengmyeongUiSamAdapter(http, upstream.origin(), parser);
        var props = new QtProperties(
                new QtProperties.Acquisition(acquisitionEnabled),
                new QtProperties.Http(Duration.ofMillis(500), requestTimeout, overallTimeout, "test-agent", 512 * 1024),
                new QtProperties.Cache(Duration.ofMinutes(30), Duration.ofMinutes(2)),
                providers);
        service = new QtTodayService(List.of(saengmyeong, maeil), props, store, clock, executor);
    }

    @Override
    public void close() {
        executor.shutdownNow();
        upstream.close();
    }
}
