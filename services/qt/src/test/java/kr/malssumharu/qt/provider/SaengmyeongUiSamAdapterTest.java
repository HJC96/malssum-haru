package kr.malssumharu.qt.provider;

import static org.assertj.core.api.Assertions.assertThat;

import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import kr.malssumharu.qt.domain.BibleRange;
import kr.malssumharu.qt.domain.BibleRange.ChapterVerse;
import kr.malssumharu.qt.domain.ReasonCode;
import kr.malssumharu.qt.support.Fixtures;
import kr.malssumharu.qt.support.MockUpstream.Reply;
import kr.malssumharu.qt.support.Rig;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class SaengmyeongUiSamAdapterTest {

    private static final LocalDate TODAY = LocalDate.of(2026, 9, 24);
    private static final String PATH = "/qt/view/bible.asp";

    private Rig rig;

    @BeforeEach
    void setUp() {
        rig = new Rig();
    }

    @AfterEach
    void tearDown() {
        rig.close();
    }

    @Test
    void decodesEucKrAndReadsDateAndRange() {
        rig.upstream.on("GET", PATH, Reply.eucKrHtml(Fixtures.durannoPage(TODAY, "역대상  14 : 1~17")));

        var outcome = rig.saengmyeong.fetch(TODAY);

        assertThat(outcome).isEqualTo(new AdapterOutcome.Found(
                TODAY,
                "역대상 14 : 1~17", // HTML 공백은 정규화된다
                List.of(new BibleRange("1CH", new ChapterVerse(14, 1), new ChapterVerse(14, 17)))));
    }

    @Test
    void requestsTheDateSpecificUrlForTheSeoulDate() {
        rig.upstream.on("GET", PATH, Reply.eucKrHtml(Fixtures.durannoPage(TODAY, "역대상  14 : 1~17")));

        rig.saengmyeong.fetch(TODAY);

        assertThat(rig.upstream.requests()).containsExactly("GET /qt/view/bible.asp?qtDate=2026-09-24");
        assertThat(rig.saengmyeong.officialUrl(TODAY).toString())
                .isEqualTo("https://www.duranno.com/qt/view/bible.asp?qtDate=2026-09-24");
        assertThat(rig.saengmyeong.officialUrlKind().wire()).isEqualTo("date-specific");
    }

    @Test
    void utf8BytesMislabeledAsEucKrAreRecoveredNotMisread() {
        String html = Fixtures.durannoPage(TODAY, "역대상  14 : 1~17");
        rig.upstream.on("GET", PATH,
                Reply.ok("text/html;charset=EUC-KR", html.getBytes(StandardCharsets.UTF_8)));

        assertThat(rig.saengmyeong.fetch(TODAY)).isInstanceOfSatisfying(AdapterOutcome.Found.class,
                found -> assertThat(found.ranges().getFirst().bookId()).isEqualTo("1CH"));
    }

    @Test
    void eucKrBytesMislabeledAsUtf8AreRecovered() {
        rig.upstream.on("GET", PATH, Reply.ok("text/html; charset=utf-8",
                Fixtures.eucKr(Fixtures.durannoPage(TODAY, "역대상  14 : 1~17"))));

        assertThat(rig.saengmyeong.fetch(TODAY)).isInstanceOfSatisfying(AdapterOutcome.Found.class,
                found -> assertThat(found.ranges().getFirst().bookId()).isEqualTo("1CH"));
    }

    @Test
    void undecodableGarbageIsParseFailedNotAWrongPassage() {
        byte[] garbage = new byte[] {(byte) 0xFF, (byte) 0xFE, (byte) 0x80, (byte) 0x81, '<', 'h', '1', '>'};
        rig.upstream.on("GET", PATH, Reply.ok("text/html;charset=EUC-KR", garbage));

        assertThat(rig.saengmyeong.fetch(TODAY))
                .isEqualTo(AdapterOutcome.Failed.unavailable(ReasonCode.PARSE_FAILED, null));
    }

    @Test
    void referenceWithBrokenBookNameIsNeverConfirmed() {
        // 라틴 문자로 깨진 표기(EUC-KR을 ISO-8859-1로 잘못 해독한 결과 등)
        rig.upstream.on("GET", PATH, Reply.eucKrHtml(Fixtures.durannoPage(TODAY, "¿ª´ë»ó  14 : 1~17")));

        assertThat(rig.saengmyeong.fetch(TODAY)).isInstanceOfSatisfying(AdapterOutcome.Failed.class,
                failed -> assertThat(failed.reason()).isIn(ReasonCode.PARSE_FAILED, ReasonCode.UNKNOWN_BOOK));
    }

    @Test
    void shellPageForNonTodayDateIsParseFailed() {
        rig.upstream.on("GET", PATH, Reply.eucKrHtml(Fixtures.load("duranno-shell.html")));

        assertThat(rig.saengmyeong.fetch(TODAY))
                .isEqualTo(AdapterOutcome.Failed.unavailable(ReasonCode.PARSE_FAILED, null));
    }

    @Test
    void changedHtmlStructureIsParseFailed() {
        String changed = Fixtures.durannoPage(TODAY, "역대상  14 : 1~17").replace("<h1><span>", "<h1><b>").replace("</span><em>", "</b><em>");
        rig.upstream.on("GET", PATH, Reply.eucKrHtml(changed));

        assertThat(rig.saengmyeong.fetch(TODAY))
                .isEqualTo(AdapterOutcome.Failed.unavailable(ReasonCode.PARSE_FAILED, null));
    }

    @Test
    void readsTheProviderDisplayedDateEvenWhenItIsNotToday() {
        LocalDate yesterday = TODAY.minusDays(1);
        rig.upstream.on("GET", PATH, Reply.eucKrHtml(Fixtures.durannoPage(yesterday, "역대상  13 : 1~14")));

        assertThat(rig.saengmyeong.fetch(TODAY)).isInstanceOfSatisfying(
                AdapterOutcome.Found.class, found -> assertThat(found.providerDate()).isEqualTo(yesterday));
    }

    @Test
    void impossibleDateIsParseFailed() {
        String html = Fixtures.durannoPage(TODAY, "역대상  14 : 1~17").replace("2026.09.24 <span>", "2026.13.45 <span>");
        rig.upstream.on("GET", PATH, Reply.eucKrHtml(html));

        assertThat(rig.saengmyeong.fetch(TODAY))
                .isEqualTo(AdapterOutcome.Failed.unavailable(ReasonCode.PARSE_FAILED, null));
    }

    @Test
    void httpErrorAndTimeoutAreLinkErrors() {
        rig.upstream.on("GET", PATH, Reply.status(500));
        assertThat(rig.saengmyeong.fetch(TODAY)).isEqualTo(AdapterOutcome.Failed.linkError(ReasonCode.UPSTREAM_HTTP_ERROR));

        try (Rig slow = new Rig(true, Map.of(), Duration.ofMillis(150), Duration.ofSeconds(20))) {
            slow.upstream.on("GET", PATH, Reply.eucKrHtml(Fixtures.durannoPage(TODAY, "역대상  14 : 1~17")).delayed(1500));
            assertThat(slow.saengmyeong.fetch(TODAY)).isEqualTo(AdapterOutcome.Failed.linkError(ReasonCode.UPSTREAM_TIMEOUT));
        }
    }

    @Test
    void calendarImpossibleSeptember31IsParseFailed() {
        String html = Fixtures.durannoPage(TODAY, "역대상  14 : 1~17").replace("2026.09.24 <span>", "2026.09.31 <span>");
        rig.upstream.on("GET", PATH, Reply.eucKrHtml(html));

        assertThat(rig.saengmyeong.fetch(TODAY))
                .isEqualTo(AdapterOutcome.Failed.unavailable(ReasonCode.PARSE_FAILED, null));
    }

    @Test
    void oversizedResponseIsRefusedAsALinkError() {
        byte[] huge = new byte[600 * 1024];
        java.util.Arrays.fill(huge, (byte) 'x');
        rig.upstream.on("GET", PATH, Reply.ok("text/html;charset=EUC-KR", huge));

        assertThat(rig.saengmyeong.fetch(TODAY)).isEqualTo(AdapterOutcome.Failed.linkError(ReasonCode.UPSTREAM_HTTP_ERROR));
    }
}
