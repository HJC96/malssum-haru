package kr.malssumharu.qt.provider;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Duration;
import java.time.LocalDate;
import java.util.Map;
import kr.malssumharu.qt.domain.AvailabilityStatus;
import kr.malssumharu.qt.domain.BibleRange;
import kr.malssumharu.qt.domain.BibleRange.ChapterVerse;
import kr.malssumharu.qt.domain.ReasonCode;
import kr.malssumharu.qt.support.Fixtures;
import kr.malssumharu.qt.support.MockUpstream.Reply;
import kr.malssumharu.qt.support.Rig;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class MaeilSeongyeongAdapterTest {

    private static final LocalDate TODAY = LocalDate.of(2026, 9, 24);
    private static final String PAGE = "GET /bible/today";
    private static final String DETAIL = "POST /Ajax/Bible/BodyMatterDetail";

    private Rig rig;

    @BeforeEach
    void setUp() {
        rig = new Rig();
    }

    @AfterEach
    void tearDown() {
        rig.close();
    }

    private void page(String path, Reply reply) {
        String[] parts = path.split(" ", 2);
        rig.upstream.on(parts[0], parts[1], reply);
    }

    @Test
    void readsDateAndRangeFromServerRenderedHtmlWithoutCallingTheJsonPath() {
        page(PAGE, Reply.html(Fixtures.maeilPage(TODAY, "요한복음(John) 3:1 - 3:21")));

        var outcome = rig.maeil.fetch(TODAY);

        assertThat(outcome).isEqualTo(new AdapterOutcome.Found(
                TODAY,
                "요한복음(John) 3:1 - 3:21",
                java.util.List.of(new BibleRange("JHN", new ChapterVerse(3, 1), new ChapterVerse(3, 21)))));
        assertThat(rig.upstream.countRequests("POST")).isZero();
    }

    @Test
    void officialLinkIsTodayPageBecauseTheProviderIgnoresDateParameters() {
        assertThat(rig.maeil.officialUrl(TODAY).toString()).isEqualTo("https://sum.su.or.kr:8888/bible/today");
        assertThat(rig.maeil.officialUrlKind().wire()).isEqualTo("today-page");
    }

    @Test
    void fallsBackToTheJsonPathWhenTheFirstHtmlHasNoRange() {
        page(PAGE, Reply.html(Fixtures.load("maeil-today-dynamic.html")));
        page(DETAIL, Reply.json(Fixtures.maeilDetailJson(TODAY, "사사기(Judges)", "11:1 - 11:11")));

        var outcome = rig.maeil.fetch(TODAY);

        assertThat(outcome).isInstanceOfSatisfying(AdapterOutcome.Found.class, found -> {
            assertThat(found.providerDate()).isEqualTo(TODAY);
            assertThat(found.ranges()).containsExactly(
                    new BibleRange("JDG", new ChapterVerse(11, 1), new ChapterVerse(11, 11)));
        });
        assertThat(rig.upstream.countRequests("POST /Ajax/Bible/BodyMatterDetail")).isEqualTo(1);
    }

    @Test
    void jsonExtraFieldsFromTheProviderAreIgnored() {
        page(PAGE, Reply.html(Fixtures.load("maeil-today-dynamic.html")));
        // 실제 응답에는 제공처 해설 필드가 섞여 온다. 테스트 코드에서만 자리표시자로 흉내 낸다(fixture 파일에는 넣지 않는다)
        String json = Fixtures.maeilDetailJson(TODAY, "사사기(Judges)", "11:1 - 11:11")
                .replace("}", ",\"Qt_sj\":\"EXTRA_SENTINEL\",\"Qt_a1\":\"EXTRA_SENTINEL\"}");
        page(DETAIL, Reply.json(json));

        assertThat(rig.maeil.fetch(TODAY)).isInstanceOfSatisfying(AdapterOutcome.Found.class,
                found -> assertThat(found.toString()).doesNotContain("EXTRA_SENTINEL"));
    }

    @Test
    void dynamicContentFailureIsReportedNotGuessed() {
        page(PAGE, Reply.html(Fixtures.load("maeil-today-dynamic.html")));
        page(DETAIL, Reply.status(500));

        assertThat(rig.maeil.fetch(TODAY)).isEqualTo(
                AdapterOutcome.Failed.unavailable(ReasonCode.DYNAMIC_CONTENT_UNAVAILABLE, null));
    }

    @Test
    void dynamicContentWithMalformedJsonIsReported() {
        page(PAGE, Reply.html(Fixtures.load("maeil-today-dynamic.html")));
        page(DETAIL, Reply.json("{not json"));

        assertThat(rig.maeil.fetch(TODAY)).isEqualTo(
                AdapterOutcome.Failed.unavailable(ReasonCode.DYNAMIC_CONTENT_UNAVAILABLE, null));
    }

    @Test
    void jsonMissingRequiredFieldsIsReported() {
        page(PAGE, Reply.html(Fixtures.load("maeil-today-dynamic.html")));
        page(DETAIL, Reply.json("{\"Base_de\":\"2026-09-24\"}"));

        assertThat(rig.maeil.fetch(TODAY)).isEqualTo(
                AdapterOutcome.Failed.unavailable(ReasonCode.DYNAMIC_CONTENT_UNAVAILABLE, null));
    }

    @Test
    void changedHtmlStructureWithUnparseableReferenceIsAFailureNotAGuess() {
        page(PAGE, Reply.html(Fixtures.maeilPage(TODAY, "구조가 바뀐 표기 ??")));

        assertThat(rig.maeil.fetch(TODAY)).isInstanceOfSatisfying(AdapterOutcome.Failed.class, failed -> {
            assertThat(failed.status()).isEqualTo(AvailabilityStatus.RANGE_UNAVAILABLE);
            assertThat(failed.reason()).isIn(ReasonCode.UNKNOWN_BOOK, ReasonCode.INVALID_REFERENCE, ReasonCode.PARSE_FAILED);
            assertThat(failed.providerDate()).isEqualTo(TODAY);
        });
    }

    @Test
    void unknownBookIsReportedWithTheReadDate() {
        page(PAGE, Reply.html(Fixtures.maeilPage(TODAY, "없는책(Nothing) 1:1 - 1:3")));

        assertThat(rig.maeil.fetch(TODAY)).isEqualTo(AdapterOutcome.Failed.unavailable(ReasonCode.UNKNOWN_BOOK, TODAY));
    }

    @Test
    void readsTheProviderDisplayedDateEvenWhenItIsNotToday() {
        LocalDate yesterday = TODAY.minusDays(1);
        page(PAGE, Reply.html(Fixtures.maeilPage(yesterday, "요한복음 3:1 - 3:21")));

        assertThat(rig.maeil.fetch(TODAY)).isInstanceOfSatisfying(
                AdapterOutcome.Found.class, found -> assertThat(found.providerDate()).isEqualTo(yesterday));
    }

    @Test
    void httpErrorIsALinkError() {
        page(PAGE, Reply.status(503));

        assertThat(rig.maeil.fetch(TODAY)).isEqualTo(AdapterOutcome.Failed.linkError(ReasonCode.UPSTREAM_HTTP_ERROR));
    }

    @Test
    void notFoundIsALinkError() {
        assertThat(rig.maeil.fetch(TODAY)).isEqualTo(AdapterOutcome.Failed.linkError(ReasonCode.UPSTREAM_HTTP_ERROR));
    }

    @Test
    void timeoutIsALinkErrorWithTimeoutReason() {
        try (Rig slow = new Rig(true, Map.of(), Duration.ofMillis(150), Duration.ofSeconds(20))) {
            slow.upstream.on("GET", "/bible/today", Reply.html(Fixtures.maeilPage(TODAY, "요 3:1-3")).delayed(1500));

            assertThat(slow.maeil.fetch(TODAY)).isEqualTo(AdapterOutcome.Failed.linkError(ReasonCode.UPSTREAM_TIMEOUT));
        }
    }

    @Test
    void connectionRefusedIsALinkErrorWithUnreachableReason() {
        Rig dead = new Rig();
        var adapter = dead.maeil;
        dead.close();

        assertThat(adapter.fetch(TODAY)).isEqualTo(AdapterOutcome.Failed.linkError(ReasonCode.LINK_UNREACHABLE));
    }

    @Test
    void partialRenderWithDateButNoReferenceFallsBackToJsonInsteadOfFailing() {
        String dateOnly = Fixtures.maeilPage(TODAY, "요한복음 3:1 - 3:21").replaceAll("본문 : .*?찬송가", "찬송가");
        page(PAGE, Reply.html(dateOnly));
        page(DETAIL, Reply.json(Fixtures.maeilDetailJson(TODAY, "사사기(Judges)", "11:1 - 11:11")));

        assertThat(rig.maeil.fetch(TODAY)).isInstanceOfSatisfying(AdapterOutcome.Found.class,
                found -> assertThat(found.ranges().getFirst().bookId()).isEqualTo("JDG"));
        assertThat(rig.upstream.countRequests("POST /Ajax/Bible/BodyMatterDetail")).isEqualTo(1);
    }

    @Test
    void partialRenderWithReferenceButNoDateTakesTheDateFromJsonNotFromNowhere() {
        String referenceOnly = Fixtures.maeilPage(TODAY, "요한복음 3:1 - 3:21")
                .replaceAll("\\$\\(\"#base_de\"\\)\\.val\\(\"[^\"]*\"\\);", "")
                .replaceAll("매일성경 +\\d{4}\\.\\d{2}\\.\\d{2}", "매일성경");
        page(PAGE, Reply.html(referenceOnly));
        page(DETAIL, Reply.json(Fixtures.maeilDetailJson(TODAY, "요한복음(John)", "3:1 - 3:21")));

        assertThat(rig.maeil.fetch(TODAY)).isInstanceOfSatisfying(AdapterOutcome.Found.class,
                found -> assertThat(found.providerDate()).isEqualTo(TODAY));

        page(DETAIL, Reply.status(500)); // 날짜를 어디서도 못 얻으면 확정하지 않는다
        assertThat(rig.maeil.fetch(TODAY)).isInstanceOfSatisfying(AdapterOutcome.Failed.class,
                failed -> assertThat(failed.reason()).isEqualTo(ReasonCode.DYNAMIC_CONTENT_UNAVAILABLE));
    }

    @Test
    void impossibleCalendarDateInTheFirstHtmlIsNotAccepted() {
        page(PAGE, Reply.html(Fixtures.maeilPage(TODAY, "요한복음 3:1 - 3:21")
                .replace("\"2026-09-24\"", "\"2026-09-31\"").replace("2026.09.24", "2026.09.31")));
        page(DETAIL, Reply.status(500));

        assertThat(rig.maeil.fetch(TODAY)).isInstanceOfSatisfying(AdapterOutcome.Failed.class,
                failed -> assertThat(failed.status()).isEqualTo(AvailabilityStatus.RANGE_UNAVAILABLE));
    }

    @Test
    void oversizedResponseIsRefusedAsALinkErrorNotParsed() {
        byte[] huge = new byte[600 * 1024]; // Rig의 제한은 512KB
        java.util.Arrays.fill(huge, (byte) 'x');
        page(PAGE, Reply.ok("text/html; charset=utf-8", huge));

        assertThat(rig.maeil.fetch(TODAY)).isEqualTo(AdapterOutcome.Failed.linkError(ReasonCode.UPSTREAM_HTTP_ERROR));
    }
}
