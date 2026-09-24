package kr.malssumharu.qt.service;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import kr.malssumharu.qt.api.QtTodayResponse;
import kr.malssumharu.qt.api.QtTodayResponse.ProviderEntry;
import kr.malssumharu.qt.config.QtProperties;
import kr.malssumharu.qt.config.QtProperties.ProviderSettings;
import kr.malssumharu.qt.domain.AvailabilityStatus;
import kr.malssumharu.qt.domain.BibleRange;
import kr.malssumharu.qt.domain.BibleRange.ChapterVerse;
import kr.malssumharu.qt.domain.ProviderId;
import kr.malssumharu.qt.domain.ReasonCode;
import kr.malssumharu.qt.http.JdkHttpFetcher;
import kr.malssumharu.qt.bible.ReferenceParser;
import kr.malssumharu.qt.bible.VerseCountTable;
import kr.malssumharu.qt.provider.MaeilSeongyeongAdapter;
import kr.malssumharu.qt.provider.QtProviderAdapter;
import kr.malssumharu.qt.provider.SaengmyeongUiSamAdapter;
import kr.malssumharu.qt.support.FakeDynamoDb;
import kr.malssumharu.qt.support.MockUpstream;
import kr.malssumharu.qt.support.MutableClock;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

/**
 * 배포 모드(QT_TABLE_NAME 설정): 조회는 저장소의 서울 오늘 항목만 읽고 제공처에는 요청하지 않는다.
 * PRD AC11(어제 자료를 오늘로 쓰지 않음), AC18(서울 날짜).
 */
class QtStoredModeTest {

    private static final LocalDate TODAY = LocalDate.of(2026, 9, 24);
    private static final Instant NOON = Instant.parse("2026-09-24T01:00:00Z");

    private MockUpstream upstream;
    private FakeDynamoDb fake;
    private DynamoDbQtDayStore store;
    private MutableClock clock;
    private ExecutorService executor;
    private List<QtProviderAdapter> adapters;

    @BeforeEach
    void setUp() {
        upstream = MockUpstream.start();
        fake = new FakeDynamoDb();
        store = new DynamoDbQtDayStore(fake.client(), "qt-table", Duration.ofDays(400));
        clock = new MutableClock(NOON);
        executor = Executors.newVirtualThreadPerTaskExecutor();
        var http = new JdkHttpFetcher(Duration.ofMillis(500), Duration.ofMillis(800), "test-agent", 512 * 1024);
        var parser = new ReferenceParser(VerseCountTable.NONE);
        adapters = List.of(
                new MaeilSeongyeongAdapter(http, upstream.origin(), parser),
                new SaengmyeongUiSamAdapter(http, upstream.origin(), parser));
    }

    @AfterEach
    void tearDown() {
        executor.shutdownNow();
        upstream.close();
    }

    private QtTodayService service(boolean acquisition, Map<String, ProviderSettings> providers) {
        var props = new QtProperties(
                new QtProperties.Acquisition(acquisition),
                new QtProperties.Http(Duration.ofMillis(500), Duration.ofMillis(800), Duration.ofSeconds(10), "test-agent", 1024),
                new QtProperties.Cache(Duration.ofMinutes(30), Duration.ofMinutes(2)),
                new QtProperties.Storage("qt-table", 400),
                new QtProperties.Collector("enabled"),
                providers);
        return new QtTodayService(adapters, props, store, clock, executor);
    }

    private void store(ProviderId id, LocalDate date, Instant verifiedAt, BibleRange range) {
        store.save(new StoredDay(id, date, List.of(range), "표기", verifiedAt, "adapter/1"));
    }

    private static ProviderEntry entry(QtTodayResponse r, ProviderId id) {
        return r.providers().stream().filter(p -> p.providerId().equals(id.id())).findFirst().orElseThrow();
    }

    private static BibleRange jhn() {
        return new BibleRange("JHN", new ChapterVerse(3, 1), new ChapterVerse(3, 21));
    }

    @Test
    void readsTodaysStoredItemsWithoutContactingProviders() {
        store(ProviderId.MAEIL_SEONGYEONG, TODAY, NOON, jhn());
        store(ProviderId.SAENGMYEONG_UI_SAM, TODAY, NOON, new BibleRange("1CH", new ChapterVerse(14, 1), new ChapterVerse(14, 17)));

        QtTodayResponse r = service(true, Map.of()).today();

        ProviderEntry maeil = entry(r, ProviderId.MAEIL_SEONGYEONG);
        assertThat(maeil.availabilityStatus()).isEqualTo(AvailabilityStatus.RANGE_CONFIRMED);
        assertThat(maeil.providerDate()).isEqualTo(TODAY);
        assertThat(maeil.verifiedAt()).isEqualTo(NOON);
        assertThat(maeil.passage().ranges().getFirst().bookId()).isEqualTo("JHN");
        assertThat(entry(r, ProviderId.SAENGMYEONG_UI_SAM).availabilityStatus()).isEqualTo(AvailabilityStatus.RANGE_CONFIRMED);
        assertThat(upstream.requests()).isEmpty();
        assertThat(r.generatedAt()).isEqualTo(NOON);
    }

    @Test
    void missingTodayItemIsNotCollectedYetWithOfficialLink() {
        QtTodayResponse r = service(true, Map.of()).today();

        for (ProviderEntry p : r.providers()) {
            assertThat(p.availabilityStatus()).isEqualTo(AvailabilityStatus.RANGE_UNAVAILABLE);
            assertThat(p.reasonCode()).isEqualTo(ReasonCode.NOT_COLLECTED_YET);
            assertThat(p.passage()).isNull();
            assertThat(p.providerDate()).isNull();
            assertThat(p.officialUrl()).startsWith("https://");
        }
        assertThat(upstream.requests()).isEmpty();
    }

    @Test
    void yesterdaysItemIsNeverSubstitutedForToday() {
        store(ProviderId.MAEIL_SEONGYEONG, TODAY.minusDays(1), NOON.minusSeconds(86400), jhn());
        store(ProviderId.SAENGMYEONG_UI_SAM, TODAY.minusDays(1), NOON.minusSeconds(86400), jhn());

        QtTodayResponse r = service(true, Map.of()).today();

        for (ProviderEntry p : r.providers()) {
            assertThat(p.availabilityStatus()).isEqualTo(AvailabilityStatus.RANGE_UNAVAILABLE);
            assertThat(p.reasonCode()).isEqualTo(ReasonCode.NOT_COLLECTED_YET);
            assertThat(p.passage()).isNull();
        }
    }

    @Test
    void seoulMidnightBoundaryFlipsFromTodayToNotCollectedYet() {
        LocalDate d0923 = LocalDate.of(2026, 9, 23);
        store(ProviderId.MAEIL_SEONGYEONG, d0923, Instant.parse("2026-09-23T01:00:00Z"), jhn());
        QtTodayService service = service(true, Map.of());

        clock.set(Instant.parse("2026-09-23T14:59:59Z")); // 09-23 23:59:59 KST
        assertThat(entry(service.today(), ProviderId.MAEIL_SEONGYEONG).availabilityStatus())
                .isEqualTo(AvailabilityStatus.RANGE_CONFIRMED);

        clock.set(Instant.parse("2026-09-23T15:00:00Z")); // 09-24 00:00:00 KST
        ProviderEntry after = entry(service.today(), ProviderId.MAEIL_SEONGYEONG);
        assertThat(after.reasonCode()).isEqualTo(ReasonCode.NOT_COLLECTED_YET);
        assertThat(after.passage()).isNull();
        assertThat(after.officialUrl()).startsWith("https://");
    }

    @Test
    void acquisitionOffStaysNotPermittedAndDoesNotEvenReadTheStore() {
        store(ProviderId.MAEIL_SEONGYEONG, TODAY, NOON, jhn());

        QtTodayResponse r = service(false, Map.of()).today();

        for (ProviderEntry p : r.providers()) {
            assertThat(p.availabilityStatus()).isEqualTo(AvailabilityStatus.RANGE_NOT_PERMITTED);
            assertThat(p.reasonCode()).isEqualTo(ReasonCode.PERMISSION_UNCONFIRMED);
            assertThat(p.passage()).isNull();
        }
        assertThat(fake.gets.get()).isZero();
    }

    @Test
    void disabledProviderIsDisabledAndTheOtherStillReadsFromTheStore() {
        store(ProviderId.MAEIL_SEONGYEONG, TODAY, NOON, jhn());
        store(ProviderId.SAENGMYEONG_UI_SAM, TODAY, NOON, jhn());

        QtTodayResponse r = service(true, Map.of("maeil-seongyeong", new ProviderSettings(false, null, null, "disabled"))).today();

        ProviderEntry maeil = entry(r, ProviderId.MAEIL_SEONGYEONG);
        assertThat(maeil.availabilityStatus()).isEqualTo(AvailabilityStatus.DISABLED);
        assertThat(maeil.reasonCode()).isEqualTo(ReasonCode.OPERATOR_DISABLED);
        assertThat(maeil.passage()).isNull();
        assertThat(entry(r, ProviderId.SAENGMYEONG_UI_SAM).availabilityStatus()).isEqualTo(AvailabilityStatus.RANGE_CONFIRMED);
    }

    @Test
    void storageFailureBecomesInternalErrorForThoseEntriesWithoutLeakingTheMessage() {
        fake.failWith = new IllegalStateException("SECRET_TABLE_DETAIL");

        QtTodayResponse r = service(true, Map.of()).today();

        for (ProviderEntry p : r.providers()) {
            assertThat(p.availabilityStatus()).isEqualTo(AvailabilityStatus.RANGE_UNAVAILABLE);
            assertThat(p.reasonCode()).isEqualTo(ReasonCode.INTERNAL_ERROR);
            assertThat(p.officialUrl()).startsWith("https://");
        }
        assertThat(r.toString()).doesNotContain("SECRET_TABLE_DETAIL");
    }
}
