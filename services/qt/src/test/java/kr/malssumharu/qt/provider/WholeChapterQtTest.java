package kr.malssumharu.qt.provider;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Duration;
import java.time.LocalDate;
import java.util.List;
import kr.malssumharu.qt.bible.ReferenceParser;
import kr.malssumharu.qt.bible.ResourceVerseCountTable;
import kr.malssumharu.qt.domain.BibleRange;
import kr.malssumharu.qt.domain.BibleRange.ChapterVerse;
import kr.malssumharu.qt.domain.ReasonCode;
import kr.malssumharu.qt.http.JdkHttpFetcher;
import kr.malssumharu.qt.support.Fixtures;
import kr.malssumharu.qt.support.MockUpstream;
import kr.malssumharu.qt.support.MockUpstream.Reply;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

/**
 * 66권 표가 연결된 어댑터의 끝단 동작: 장 전체만 표기한 QT는 표로 끝 절을 채워 확정하되 displayReference는 제공처 표기 그대로,
 * 그 책에 없는 장·절은 확정하지 않는다.
 */
class WholeChapterQtTest {

    private static final LocalDate TODAY = LocalDate.of(2026, 9, 24);
    private MockUpstream upstream;
    private SaengmyeongUiSamAdapter saeng;
    private MaeilSeongyeongAdapter maeil;

    @BeforeEach
    void up() {
        upstream = MockUpstream.start();
        var http = new JdkHttpFetcher(Duration.ofMillis(500), Duration.ofMillis(800), "test-agent", 512 * 1024);
        var parser = new ReferenceParser(ResourceVerseCountTable.load());
        saeng = new SaengmyeongUiSamAdapter(http, upstream.origin(), parser);
        maeil = new MaeilSeongyeongAdapter(http, upstream.origin(), parser);
    }

    @AfterEach
    void down() {
        upstream.close();
    }

    @Test
    void wholeChapterFromEitherProviderIsFilledFromTheTableAndKeepsTheProvidersOwnDisplayText() {
        upstream.on("GET", "/qt/view/bible.asp", Reply.eucKrHtml(Fixtures.durannoPage(TODAY, "시편  23편")));
        upstream.on("GET", "/bible/today", Reply.html(Fixtures.maeilPage(TODAY, "시편(Psalms) 23장")));

        for (AdapterOutcome outcome : List.of(saeng.fetch(TODAY), maeil.fetch(TODAY))) {
            assertThat(outcome).isInstanceOfSatisfying(AdapterOutcome.Found.class, found -> {
                assertThat(found.ranges()).containsExactly(
                        new BibleRange("PSA", new ChapterVerse(23, 1), new ChapterVerse(23, 6)));
                assertThat(found.displayReference()).matches("시편.*23.*");
            });
        }
    }

    @Test
    void referencesToVersesThatDoNotExistInThatBookAreNotConfirmed() {
        upstream.on("GET", "/qt/view/bible.asp", Reply.eucKrHtml(Fixtures.durannoPage(TODAY, "창세기  1 : 1~99")));
        upstream.on("GET", "/bible/today", Reply.html(Fixtures.maeilPage(TODAY, "창세기(Genesis) 51:1 - 51:3")));

        assertThat(saeng.fetch(TODAY)).isEqualTo(AdapterOutcome.Failed.unavailable(ReasonCode.INVALID_REFERENCE, TODAY));
        assertThat(maeil.fetch(TODAY)).isEqualTo(AdapterOutcome.Failed.unavailable(ReasonCode.INVALID_REFERENCE, TODAY));
    }
}
