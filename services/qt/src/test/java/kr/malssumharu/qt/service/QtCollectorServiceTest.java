package kr.malssumharu.qt.service;

import static org.assertj.core.api.Assertions.assertThat;

import java.net.URI;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import kr.malssumharu.qt.api.QtTodayResponse;
import kr.malssumharu.qt.bible.ReferenceParser;
import kr.malssumharu.qt.bible.VerseCountTable;
import kr.malssumharu.qt.config.QtProperties;
import kr.malssumharu.qt.config.QtProperties.ProviderSettings;
import kr.malssumharu.qt.domain.AvailabilityStatus;
import kr.malssumharu.qt.domain.OfficialUrlKind;
import kr.malssumharu.qt.domain.ProviderId;
import kr.malssumharu.qt.domain.ReasonCode;
import kr.malssumharu.qt.http.JdkHttpFetcher;
import kr.malssumharu.qt.provider.AdapterOutcome;
import kr.malssumharu.qt.provider.MaeilSeongyeongAdapter;
import kr.malssumharu.qt.provider.QtProviderAdapter;
import kr.malssumharu.qt.provider.SaengmyeongUiSamAdapter;
import kr.malssumharu.qt.service.QtCollectorService.Result;
import kr.malssumharu.qt.support.FakeDynamoDb;
import kr.malssumharu.qt.support.Fixtures;
import kr.malssumharu.qt.support.MockUpstream;
import kr.malssumharu.qt.support.MockUpstream.Reply;
import kr.malssumharu.qt.support.MutableClock;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

/** 수집기: 서울 오늘 기준 upsert, 스위치가 꺼지면 무요청·무저장, 어제 자료 미저장. */
class QtCollectorServiceTest {

    private static final LocalDate TODAY = LocalDate.of(2026, 9, 24);
    private static final Instant NOON = Instant.parse("2026-09-24T01:00:00Z");

    private MockUpstream upstream;
    private FakeDynamoDb fake;
    private DynamoDbQtDayStore store;
    private MutableClock clock;
    private ExecutorService executor;
    private QtProviderAdapter maeil;
    private QtProviderAdapter saeng;

    @BeforeEach
    void setUp() {
        upstream = MockUpstream.start();
        fake = new FakeDynamoDb();
        store = new DynamoDbQtDayStore(fake.client(), "qt-table", Duration.ofDays(400));
        clock = new MutableClock(NOON);
        executor = Executors.newVirtualThreadPerTaskExecutor();
        var http = new JdkHttpFetcher(Duration.ofMillis(500), Duration.ofMillis(800), "test-agent", 512 * 1024);
        var parser = new ReferenceParser(VerseCountTable.NONE);
        maeil = new MaeilSeongyeongAdapter(http, upstream.origin(), parser);
        saeng = new SaengmyeongUiSamAdapter(http, upstream.origin(), parser);
        serve(TODAY);
    }

    @AfterEach
    void tearDown() {
        executor.shutdownNow();
        upstream.close();
    }

    private void serve(LocalDate date) {
        upstream.on("GET", "/bible/today", Reply.html(Fixtures.maeilPage(date, "요한복음(John) 3:1 - 3:21")));
        upstream.on("GET", "/qt/view/bible.asp", Reply.eucKrHtml(Fixtures.durannoPage(date, "역대상  14 : 1~17")));
    }

    private QtProperties props(boolean collector, boolean acquisition, Map<String, ProviderSettings> providers) {
        return new QtProperties(
                new QtProperties.Acquisition(acquisition),
                new QtProperties.Http(Duration.ofMillis(500), Duration.ofMillis(800), Duration.ofSeconds(10), "test-agent", 1024),
                new QtProperties.Cache(Duration.ofMinutes(30), Duration.ofMinutes(2)),
                new QtProperties.Storage("qt-table", 400),
                new QtProperties.Collector(collector ? "enabled" : "disabled"),
                providers);
    }

    private QtCollectorService collector(QtProperties props) {
        return new QtCollectorService(List.of(saeng, maeil), props, store, clock, executor);
    }

    private static QtCollectorService.ProviderReport report(QtCollectorService.Report r, ProviderId id) {
        return r.providers().stream().filter(p -> p.providerId().equals(id.id())).findFirst().orElseThrow();
    }

    @Test
    void storesBothProvidersUnderTheSeoulTodayKeyInContractOrder() {
        var report = collector(props(true, true, Map.of())).collect();

        assertThat(report.seoulDate()).isEqualTo(TODAY);
        assertThat(report.providers()).extracting(p -> p.providerId())
                .containsExactly("maeil-seongyeong", "saengmyeong-ui-sam");
        assertThat(report.providers()).allSatisfy(p -> assertThat(p.result()).isEqualTo(Result.STORED));
        assertThat(fake.itemCount()).isEqualTo(2);
        assertThat(store.find(ProviderId.MAEIL_SEONGYEONG, TODAY).orElseThrow().displayReference()).contains("3:1");
        assertThat(store.find(ProviderId.SAENGMYEONG_UI_SAM, TODAY)).isPresent();
    }

    @Test
    void collectedItemsAreServedByTheStoredModeQueryAsRangeConfirmed() {
        collector(props(true, true, Map.of())).collect();
        upstream.clearRequests();

        var query = new QtTodayService(List.of(maeil, saeng), props(true, true, Map.of()), store, clock, executor);
        QtTodayResponse r = query.today();

        assertThat(r.providers()).allSatisfy(p -> {
            assertThat(p.availabilityStatus()).isEqualTo(AvailabilityStatus.RANGE_CONFIRMED);
            assertThat(p.providerDate()).isEqualTo(TODAY);
        });
        assertThat(upstream.requests()).isEmpty();
    }

    @Test
    void anAlreadyStoredTodayItemIsSkippedNoMatterHowMuchTimePassed() {
        var service = collector(props(true, true, Map.of()));
        service.collect();
        upstream.clearRequests();

        clock.advance(Duration.ofHours(10));
        var second = service.collect();

        assertThat(second.providers()).allSatisfy(p -> assertThat(p.result()).isEqualTo(Result.ALREADY_COLLECTED));
        assertThat(upstream.requests()).isEmpty();
        assertThat(fake.puts.get()).isEqualTo(2);
        assertThat(fake.itemCount()).isEqualTo(2);
    }

    @Test
    void onlyTheProviderThatFailedIsRetriedOnTheNextSchedule() {
        var service = collector(props(true, true, Map.of()));
        upstream.on("GET", "/qt/view/bible.asp", Reply.status(503));
        var first = service.collect();
        assertThat(report(first, ProviderId.MAEIL_SEONGYEONG).result()).isEqualTo(Result.STORED);
        assertThat(report(first, ProviderId.SAENGMYEONG_UI_SAM).result()).isEqualTo(Result.FAILED);
        upstream.clearRequests();
        serve(TODAY);

        clock.advance(Duration.ofMinutes(10));
        var second = service.collect();

        assertThat(report(second, ProviderId.MAEIL_SEONGYEONG).result()).isEqualTo(Result.ALREADY_COLLECTED);
        assertThat(report(second, ProviderId.SAENGMYEONG_UI_SAM).result()).isEqualTo(Result.STORED);
        assertThat(upstream.countRequests("GET /bible/today")).isZero(); // 이미 저장된 제공처에는 요청하지 않는다
        assertThat(upstream.countRequests("GET /qt/view/bible.asp")).isEqualTo(1);
        assertThat(fake.itemCount()).isEqualTo(2);
    }

    @Test
    void concurrentCollectorRunsStillLeaveExactlyOneItemPerKey() throws Exception {
        var service = collector(props(true, true, Map.of()));
        var pool = Executors.newFixedThreadPool(4);
        var go = new java.util.concurrent.CountDownLatch(1);
        var futures = new java.util.ArrayList<java.util.concurrent.Future<?>>();
        for (int i = 0; i < 4; i++) {
            futures.add(pool.submit(() -> {
                go.await();
                return service.collect();
            }));
        }
        go.countDown();
        for (var f : futures) {
            f.get();
        }
        pool.shutdownNow();

        assertThat(fake.itemCount()).isEqualTo(2);
        assertThat(upstream.countRequests("GET /bible/today")).isEqualTo(1);
        assertThat(upstream.countRequests("GET /qt/view/bible.asp")).isEqualTo(1);
    }

    @Test
    void collectorDisabledMakesNoProviderRequestAndStoresNothing() {
        var report = collector(props(false, true, Map.of())).collect();

        assertThat(report.providers()).allSatisfy(p -> assertThat(p.result()).isEqualTo(Result.SKIPPED_COLLECTOR_DISABLED));
        assertThat(upstream.requests()).isEmpty();
        assertThat(fake.puts.get()).isZero();
        assertThat(fake.gets.get()).isZero();
    }

    @Test
    void acquisitionFlagOffMakesNoProviderRequestAndStoresNothing() {
        var report = collector(props(true, false, Map.of())).collect();

        assertThat(report.providers()).allSatisfy(p -> assertThat(p.result()).isEqualTo(Result.SKIPPED_ACQUISITION_OFF));
        assertThat(upstream.requests()).isEmpty();
        assertThat(fake.puts.get()).isZero();
    }

    @Test
    void disabledProviderIsSkippedAndTheOtherIsStillCollected() {
        var report = collector(props(true, true, Map.of("maeil-seongyeong", new ProviderSettings(false, null, null, "disabled")))).collect();

        assertThat(report(report, ProviderId.MAEIL_SEONGYEONG).result()).isEqualTo(Result.SKIPPED_PROVIDER_DISABLED);
        assertThat(report(report, ProviderId.SAENGMYEONG_UI_SAM).result()).isEqualTo(Result.STORED);
        assertThat(upstream.countRequests("GET /bible/today")).isZero();
        assertThat(fake.itemCount()).isEqualTo(1);
    }

    @Test
    void providerStillShowingYesterdayIsRejectedAndNothingIsStored() {
        serve(TODAY.minusDays(1));

        var report = collector(props(true, true, Map.of())).collect();

        assertThat(report.providers()).allSatisfy(p -> {
            assertThat(p.result()).isEqualTo(Result.FAILED);
            assertThat(p.reason()).isEqualTo("DATE_MISMATCH");
        });
        assertThat(fake.puts.get()).isZero();
        assertThat(store.find(ProviderId.MAEIL_SEONGYEONG, TODAY)).isEmpty();
        assertThat(store.find(ProviderId.MAEIL_SEONGYEONG, TODAY.minusDays(1))).isEmpty();
    }

    @Test
    void aFailedRunNeverDeletesOrOverwritesTodaysExistingItemOfTheOtherProvider() {
        var service = collector(props(true, true, Map.of()));
        upstream.on("GET", "/qt/view/bible.asp", Reply.status(500));
        service.collect();
        StoredDay before = store.find(ProviderId.MAEIL_SEONGYEONG, TODAY).orElseThrow();

        clock.advance(Duration.ofMinutes(31));
        var second = service.collect();

        assertThat(report(second, ProviderId.SAENGMYEONG_UI_SAM).reason()).isEqualTo("UPSTREAM_HTTP_ERROR");
        assertThat(store.find(ProviderId.MAEIL_SEONGYEONG, TODAY)).contains(before);
        assertThat(store.find(ProviderId.SAENGMYEONG_UI_SAM, TODAY)).isEmpty();
    }

    @Test
    void oneProviderFailingDoesNotStopTheOther() {
        upstream.on("GET", "/qt/view/bible.asp", Reply.eucKrHtml(Fixtures.load("duranno-shell.html")));

        var report = collector(props(true, true, Map.of())).collect();

        assertThat(report(report, ProviderId.MAEIL_SEONGYEONG).result()).isEqualTo(Result.STORED);
        assertThat(report(report, ProviderId.SAENGMYEONG_UI_SAM).result()).isEqualTo(Result.FAILED);
        assertThat(report(report, ProviderId.SAENGMYEONG_UI_SAM).reason()).isEqualTo("PARSE_FAILED");
        assertThat(fake.itemCount()).isEqualTo(1);
    }

    @Test
    void seoulMidnightBoundaryCollectsUnderTheNewDateKeyAndKeepsYesterdayUntouched() {
        clock.set(Instant.parse("2026-09-23T14:59:00Z")); // 09-23 23:59 KST
        serve(LocalDate.of(2026, 9, 23));
        var service = collector(props(true, true, Map.of()));
        service.collect();
        assertThat(upstream.requests()).contains("GET /qt/view/bible.asp?qtDate=2026-09-23");
        assertThat(fake.itemCount()).isEqualTo(2);

        clock.set(Instant.parse("2026-09-23T15:01:00Z")); // 09-24 00:01 KST, 아직 제공처는 어제 페이지
        upstream.clearRequests();
        var early = service.collect();
        assertThat(upstream.requests()).contains("GET /qt/view/bible.asp?qtDate=2026-09-24");
        assertThat(early.providers()).allSatisfy(p -> assertThat(p.reason()).isEqualTo("DATE_MISMATCH"));
        assertThat(fake.itemCount()).isEqualTo(2);
        assertThat(store.find(ProviderId.MAEIL_SEONGYEONG, TODAY)).isEmpty();

        serve(TODAY); // 제공처가 새 날짜를 올림
        var later = service.collect();
        assertThat(later.providers()).allSatisfy(p -> assertThat(p.result()).isEqualTo(Result.STORED));
        assertThat(fake.itemCount()).isEqualTo(4);
        assertThat(store.find(ProviderId.MAEIL_SEONGYEONG, LocalDate.of(2026, 9, 23))).isPresent();
    }

    @Test
    void anAdapterThatThrowsIsIsolatedAndItsMessageNeverReachesTheReport() {
        QtProviderAdapter broken = new QtProviderAdapter() {
            public ProviderId id() { return ProviderId.MAEIL_SEONGYEONG; }
            public String sourceVersion() { return "t/1"; }
            public OfficialUrlKind officialUrlKind() { return OfficialUrlKind.TODAY_PAGE; }
            public URI officialUrl(LocalDate d) { return URI.create("https://example.org/qt"); }
            public AdapterOutcome fetch(LocalDate d) { throw new IllegalStateException("SECRET_PROVIDER_TEXT"); }
        };
        var service = new QtCollectorService(List.of(broken, saeng), props(true, true, Map.of()), store, clock, executor);

        var report = service.collect();

        assertThat(report(report, ProviderId.MAEIL_SEONGYEONG).result()).isEqualTo(Result.FAILED);
        assertThat(report(report, ProviderId.MAEIL_SEONGYEONG).reason()).isEqualTo(ReasonCode.INTERNAL_ERROR.name());
        assertThat(report.toString()).doesNotContain("SECRET_PROVIDER_TEXT");
        assertThat(report(report, ProviderId.SAENGMYEONG_UI_SAM).result()).isEqualTo(Result.STORED);
    }

    @Test
    void collectorLogsNeverContainTheReferenceOnSuccessOrFailure() {
        var logger = (ch.qos.logback.classic.Logger) org.slf4j.LoggerFactory.getLogger(QtCollectorService.class);
        var appender = new ch.qos.logback.core.read.ListAppender<ch.qos.logback.classic.spi.ILoggingEvent>();
        appender.start();
        logger.addAppender(appender);
        try {
            var service = collector(props(true, true, Map.of()));
            service.collect();
            upstream.on("GET", "/bible/today", Reply.status(500));
            clock.advance(Duration.ofDays(1));
            service.collect();
        } finally {
            logger.detachAppender(appender);
        }

        assertThat(appender.list).isNotEmpty();
        assertThat(appender.list).allSatisfy(e -> {
            assertThat(e.getFormattedMessage()).doesNotContain("요한복음").doesNotContain("역대상").doesNotContain("3:1");
            assertThat(e.getThrowableProxy()).isNull();
        });
    }
}
