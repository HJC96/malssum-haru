package kr.malssumharu.qt.service;

import static org.assertj.core.api.Assertions.assertThat;

import java.net.URI;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicInteger;
import kr.malssumharu.qt.api.QtTodayResponse;
import kr.malssumharu.qt.api.QtTodayResponse.ProviderEntry;
import kr.malssumharu.qt.config.QtProperties;
import kr.malssumharu.qt.config.QtProperties.ProviderSettings;
import kr.malssumharu.qt.domain.AvailabilityStatus;
import kr.malssumharu.qt.domain.OfficialUrlKind;
import kr.malssumharu.qt.domain.ProviderId;
import kr.malssumharu.qt.domain.ReasonCode;
import kr.malssumharu.qt.provider.AdapterOutcome;
import kr.malssumharu.qt.provider.QtProviderAdapter;
import kr.malssumharu.qt.support.Fixtures;
import kr.malssumharu.qt.support.MockUpstream.Reply;
import kr.malssumharu.qt.support.MutableClock;
import kr.malssumharu.qt.support.Rig;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

/** 저장·중복·캐시·kill switch·취득 플래그·제공처 격리. PRD AC11(어제 자료를 오늘로 쓰지 않음). */
class QtTodayServiceTest {

    private static final LocalDate TODAY = LocalDate.of(2026, 9, 24);

    private Rig rig;

    @BeforeEach
    void setUp() {
        rig = new Rig();
    }

    @AfterEach
    void tearDown() {
        rig.close();
    }

    private void bothOk(LocalDate date) {
        rig.upstream.on("GET", "/bible/today", Reply.html(Fixtures.maeilPage(date, "요한복음 3:1 - 3:21")));
        rig.upstream.on("GET", "/qt/view/bible.asp", Reply.eucKrHtml(Fixtures.durannoPage(date, "역대상  14 : 1~17")));
    }

    private static ProviderEntry entry(QtTodayResponse r, ProviderId id) {
        return r.providers().stream().filter(p -> p.providerId().equals(id.id())).findFirst().orElseThrow();
    }

    @Test
    void recollectingTheSameProviderDayDoesNotGrowTheStoreNorHitTheProviderAgain() {
        bothOk(TODAY);

        rig.service.today();
        rig.service.today();
        rig.service.today();

        assertThat(rig.store.size()).isEqualTo(2);
        assertThat(rig.upstream.countRequests("GET /bible/today")).isEqualTo(1);
        assertThat(rig.upstream.countRequests("GET /qt/view/bible.asp")).isEqualTo(1);
    }

    @Test
    void reverifyingAfterTheTtlOverwritesTheSameKeyInsteadOfDuplicating() {
        bothOk(TODAY);
        rig.service.today();

        rig.clock.advance(Duration.ofMinutes(31));
        QtTodayResponse again = rig.service.today();

        assertThat(rig.store.size()).isEqualTo(2);
        assertThat(rig.upstream.countRequests("GET /bible/today")).isEqualTo(2);
        assertThat(entry(again, ProviderId.MAEIL_SEONGYEONG).verifiedAt())
                .isEqualTo(Instant.parse("2026-09-24T01:31:00Z"));
    }

    @Test
    void yesterdaysStoredRangeIsNeverReturnedAsTodays() {
        bothOk(TODAY);
        rig.service.today();
        assertThat(rig.store.size()).isEqualTo(2);

        // 서울 기준 다음 날, 제공처는 아직 어제 페이지를 보여 준다
        rig.clock.set(Instant.parse("2026-09-24T16:00:00Z")); // 09-25 01:00 KST
        QtTodayResponse next = rig.service.today();

        for (ProviderEntry p : next.providers()) {
            assertThat(p.availabilityStatus()).isEqualTo(AvailabilityStatus.RANGE_UNAVAILABLE);
            assertThat(p.reasonCode()).isEqualTo(ReasonCode.DATE_MISMATCH);
            assertThat(p.passage()).isNull();
            assertThat(p.providerDate()).isEqualTo(TODAY);
        }
        assertThat(rig.store.size()).isEqualTo(2); // 어제 항목은 그대로, 오늘 키는 생기지 않음
        assertThat(rig.store.find(ProviderId.MAEIL_SEONGYEONG, LocalDate.of(2026, 9, 25))).isEmpty();
    }

    @Test
    void newDayCreatesNewKeysWhenTheProviderPublishesIt() {
        bothOk(TODAY);
        rig.service.today();

        rig.clock.set(Instant.parse("2026-09-24T16:00:00Z"));
        bothOk(LocalDate.of(2026, 9, 25));
        QtTodayResponse next = rig.service.today();

        assertThat(rig.store.size()).isEqualTo(4);
        assertThat(entry(next, ProviderId.MAEIL_SEONGYEONG).providerDate()).isEqualTo(LocalDate.of(2026, 9, 25));
        assertThat(entry(next, ProviderId.MAEIL_SEONGYEONG).availabilityStatus()).isEqualTo(AvailabilityStatus.RANGE_CONFIRMED);
    }

    @Test
    void failuresAreCachedBrieflySoTheProviderIsNotHammered() {
        rig.upstream.on("GET", "/bible/today", Reply.status(500));
        rig.upstream.on("GET", "/qt/view/bible.asp", Reply.status(500));

        rig.service.today();
        rig.service.today();
        rig.service.today();
        assertThat(rig.upstream.countRequests("GET /bible/today")).isEqualTo(1);

        rig.clock.advance(Duration.ofMinutes(3));
        bothOk(TODAY);
        QtTodayResponse recovered = rig.service.today();
        assertThat(rig.upstream.countRequests("GET /bible/today")).isEqualTo(2);
        assertThat(entry(recovered, ProviderId.MAEIL_SEONGYEONG).availabilityStatus()).isEqualTo(AvailabilityStatus.RANGE_CONFIRMED);
    }

    @Test
    void concurrentCallsShareOneUpstreamFetchPerProvider() throws Exception {
        rig.upstream.on("GET", "/bible/today",
                Reply.html(Fixtures.maeilPage(TODAY, "요한복음 3:1 - 3:21")).delayed(200));
        rig.upstream.on("GET", "/qt/view/bible.asp",
                Reply.eucKrHtml(Fixtures.durannoPage(TODAY, "역대상  14 : 1~17")).delayed(200));

        ExecutorService pool = Executors.newFixedThreadPool(8);
        CountDownLatch go = new CountDownLatch(1);
        List<java.util.concurrent.Future<QtTodayResponse>> futures = new java.util.ArrayList<>();
        for (int i = 0; i < 8; i++) {
            futures.add(pool.submit(() -> {
                go.await();
                return rig.service.today();
            }));
        }
        go.countDown();
        for (var f : futures) {
            assertThat(entry(f.get(), ProviderId.MAEIL_SEONGYEONG).availabilityStatus()).isEqualTo(AvailabilityStatus.RANGE_CONFIRMED);
        }
        pool.shutdownNow();

        assertThat(rig.upstream.countRequests("GET /bible/today")).isEqualTo(1);
        assertThat(rig.store.size()).isEqualTo(2);
    }

    @Test
    void acquisitionFlagOffReturnsNotPermittedWithOfficialLinksAndNeverContactsProviders() {
        try (Rig off = new Rig(false, Map.of(), Duration.ofMillis(300), Duration.ofSeconds(20))) {
            bothOkOn(off);

            QtTodayResponse r = off.service.today();

            for (ProviderEntry p : r.providers()) {
                assertThat(p.availabilityStatus()).isEqualTo(AvailabilityStatus.RANGE_NOT_PERMITTED);
                assertThat(p.reasonCode()).isEqualTo(ReasonCode.PERMISSION_UNCONFIRMED);
                assertThat(p.passage()).isNull();
                assertThat(p.providerDate()).isNull();
                assertThat(p.officialUrl()).startsWith("https://");
            }
            assertThat(off.upstream.requests()).isEmpty();
            assertThat(off.store.size()).isZero();
        }
    }

    private static void bothOkOn(Rig r) {
        r.upstream.on("GET", "/bible/today", Reply.html(Fixtures.maeilPage(TODAY, "요한복음 3:1 - 3:21")));
        r.upstream.on("GET", "/qt/view/bible.asp", Reply.eucKrHtml(Fixtures.durannoPage(TODAY, "역대상  14 : 1~17")));
    }

    @Test
    void perProviderAcquisitionOverrideBeatsTheGlobalFlag() {
        try (Rig r = new Rig(false, Map.of("maeil-seongyeong", new ProviderSettings(false, true, null)),
                Duration.ofMillis(300), Duration.ofSeconds(20))) {
            bothOkOn(r);

            QtTodayResponse resp = r.service.today();

            assertThat(entry(resp, ProviderId.MAEIL_SEONGYEONG).availabilityStatus()).isEqualTo(AvailabilityStatus.RANGE_CONFIRMED);
            assertThat(entry(resp, ProviderId.SAENGMYEONG_UI_SAM).availabilityStatus()).isEqualTo(AvailabilityStatus.RANGE_NOT_PERMITTED);
            assertThat(r.upstream.countRequests("GET /qt/view")).isZero();
        }
    }

    @Test
    void operatorKillSwitchDisablesOneProviderAndBeatsTheAcquisitionFlag() {
        try (Rig r = new Rig(true, Map.of("maeil-seongyeong", new ProviderSettings(true, null, null)),
                Duration.ofMillis(300), Duration.ofSeconds(20))) {
            bothOkOn(r);

            QtTodayResponse resp = r.service.today();

            ProviderEntry maeil = entry(resp, ProviderId.MAEIL_SEONGYEONG);
            assertThat(maeil.availabilityStatus()).isEqualTo(AvailabilityStatus.DISABLED);
            assertThat(maeil.reasonCode()).isEqualTo(ReasonCode.OPERATOR_DISABLED);
            assertThat(maeil.passage()).isNull();
            assertThat(maeil.officialUrl()).isEqualTo("https://sum.su.or.kr:8888/bible/today");
            assertThat(entry(resp, ProviderId.SAENGMYEONG_UI_SAM).availabilityStatus()).isEqualTo(AvailabilityStatus.RANGE_CONFIRMED);
            assertThat(r.upstream.countRequests("GET /bible/today")).isZero();
        }
    }

    /** 예외를 던지는 어댑터. */
    private static QtProviderAdapter throwing(ProviderId id) {
        return new QtProviderAdapter() {
            public ProviderId id() { return id; }
            public String sourceVersion() { return "test/1"; }
            public OfficialUrlKind officialUrlKind() { return OfficialUrlKind.TODAY_PAGE; }
            public URI officialUrl(LocalDate d) { return URI.create("https://example.org/qt"); }
            public AdapterOutcome fetch(LocalDate d) { throw new IllegalStateException("boom: adapter bug"); }
        };
    }

    private static QtProviderAdapter hanging(ProviderId id, CountDownLatch release) {
        return new QtProviderAdapter() {
            public ProviderId id() { return id; }
            public String sourceVersion() { return "test/1"; }
            public OfficialUrlKind officialUrlKind() { return OfficialUrlKind.TODAY_PAGE; }
            public URI officialUrl(LocalDate d) { return URI.create("https://example.org/qt"); }
            public AdapterOutcome fetch(LocalDate d) {
                try {
                    release.await();
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                }
                return AdapterOutcome.Failed.unavailable(ReasonCode.PARSE_FAILED, null);
            }
        };
    }

    private QtTodayService serviceWith(List<QtProviderAdapter> adapters, Duration overall) {
        var props = new QtProperties(
                new QtProperties.Acquisition(true),
                new QtProperties.Http(Duration.ofMillis(300), Duration.ofMillis(300), overall, "test-agent", 1024),
                new QtProperties.Cache(Duration.ofMinutes(30), Duration.ofMinutes(2)),
                Map.of());
        return new QtTodayService(adapters, props, rig.store, new MutableClock(Rig.NOON_SEOUL_0924), rig.executor);
    }

    @Test
    void anAdapterThatThrowsBecomesThatProvidersFailureOnly() {
        bothOk(TODAY);
        QtTodayService service = serviceWith(List.of(throwing(ProviderId.MAEIL_SEONGYEONG), rig.saengmyeong), Duration.ofSeconds(5));

        QtTodayResponse r = service.today();

        ProviderEntry broken = entry(r, ProviderId.MAEIL_SEONGYEONG);
        assertThat(broken.availabilityStatus()).isEqualTo(AvailabilityStatus.RANGE_UNAVAILABLE);
        assertThat(broken.reasonCode()).isEqualTo(ReasonCode.INTERNAL_ERROR);
        assertThat(broken.passage()).isNull();
        assertThat(broken.officialUrl()).startsWith("https://");
        assertThat(entry(r, ProviderId.SAENGMYEONG_UI_SAM).availabilityStatus()).isEqualTo(AvailabilityStatus.RANGE_CONFIRMED);
    }

    @Test
    void aHangingAdapterIsCutOffByTheOverallDeadlineWithoutBlockingTheOther() {
        bothOk(TODAY);
        CountDownLatch never = new CountDownLatch(1);
        QtTodayService service = serviceWith(List.of(hanging(ProviderId.MAEIL_SEONGYEONG, never), rig.saengmyeong), Duration.ofMillis(400));

        long start = System.nanoTime();
        QtTodayResponse r = service.today();
        long elapsedMs = (System.nanoTime() - start) / 1_000_000;

        assertThat(elapsedMs).isLessThan(3000);
        ProviderEntry hung = entry(r, ProviderId.MAEIL_SEONGYEONG);
        assertThat(hung.availabilityStatus()).isEqualTo(AvailabilityStatus.LINK_ERROR);
        assertThat(hung.reasonCode()).isEqualTo(ReasonCode.UPSTREAM_TIMEOUT);
        assertThat(entry(r, ProviderId.SAENGMYEONG_UI_SAM).availabilityStatus()).isEqualTo(AvailabilityStatus.RANGE_CONFIRMED);
        never.countDown();
    }

    @Test
    void responseAlwaysListsBothProvidersInContractOrderEvenIfAdaptersAreRegisteredReversed() {
        bothOk(TODAY);

        QtTodayResponse r = rig.service.today(); // Rig는 어댑터를 일부러 뒤집어 등록한다

        assertThat(r.providers()).extracting(ProviderEntry::providerId)
                .containsExactly("maeil-seongyeong", "saengmyeong-ui-sam");
        assertThat(r.schemaVersion()).isEqualTo("1");
    }

    @Test
    void logsNeverContainProviderTextExceptionMessagesOrReferences() {
        // 서비스는 제공처·상태·사유 코드만 로그한다. 어댑터 예외 메시지(원문 조각 가능)를 옮겨 적지 않는다.
        AtomicInteger calls = new AtomicInteger();
        QtProviderAdapter leaky = new QtProviderAdapter() {
            public ProviderId id() { return ProviderId.MAEIL_SEONGYEONG; }
            public String sourceVersion() { return "test/1"; }
            public OfficialUrlKind officialUrlKind() { return OfficialUrlKind.TODAY_PAGE; }
            public URI officialUrl(LocalDate d) { return URI.create("https://example.org/qt"); }
            public AdapterOutcome fetch(LocalDate d) {
                calls.incrementAndGet();
                throw new IllegalStateException("SECRET_PROVIDER_TEXT");
            }
        };
        QtTodayService service = serviceWith(List.of(leaky, rig.saengmyeong), Duration.ofSeconds(5));
        bothOk(TODAY);

        var logger = (ch.qos.logback.classic.Logger) org.slf4j.LoggerFactory.getLogger(QtTodayService.class);
        var appender = new ch.qos.logback.core.read.ListAppender<ch.qos.logback.classic.spi.ILoggingEvent>();
        appender.start();
        logger.addAppender(appender);
        QtTodayResponse r;
        try {
            r = service.today();
        } finally {
            logger.detachAppender(appender);
        }

        assertThat(r.toString()).doesNotContain("SECRET_PROVIDER_TEXT");
        assertThat(calls.get()).isEqualTo(1);
        assertThat(appender.list).isNotEmpty();
        assertThat(appender.list).allSatisfy(e -> {
            assertThat(e.getFormattedMessage()).doesNotContain("SECRET_PROVIDER_TEXT").doesNotContain("요한복음");
            assertThat(e.getThrowableProxy()).isNull(); // 스택트레이스에 예외 메시지가 실리지 않게 한다
        });
    }
}
