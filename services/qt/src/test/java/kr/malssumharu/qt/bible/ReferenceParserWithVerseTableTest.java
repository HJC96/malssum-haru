package kr.malssumharu.qt.bible;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import kr.malssumharu.qt.domain.BibleRange;
import kr.malssumharu.qt.domain.BibleRange.ChapterVerse;
import kr.malssumharu.qt.domain.ReasonCode;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

/** 66권 장·절 수 표(잠정)가 연결된 파서. 표가 연결되기 전의 한계(창세기 1:1-99 통과)가 사라졌는지 확인한다. */
class ReferenceParserWithVerseTableTest {

    private final ReferenceParser parser = new ReferenceParser(ResourceVerseCountTable.load());

    private static BibleRange range(String book, int c1, int v1, int c2, int v2) {
        return new BibleRange(book, new ChapterVerse(c1, v1), new ChapterVerse(c2, v2));
    }

    @ParameterizedTest
    @ValueSource(strings = {"창세기 1:1-99", "창세기 1:32", "창세기 51:1", "시편 151:1", "시편 23:7", "유다서 2:1",
            "요한복음 3:37", "요한복음 22:1-3", "창세기 1:1-2:26", "요한복음 3:40-4:3"})
    void impossibleRangesForThatBookAreInvalidReference(String text) {
        assertThatThrownBy(() -> parser.parse(text))
                .isInstanceOfSatisfying(ReferenceException.class,
                        e -> assertThat(e.reason()).isEqualTo(ReasonCode.INVALID_REFERENCE));
    }

    @Test
    void realRangesAtTheEdgesOfEachChapterPass() throws Exception {
        assertThat(parser.parse("창세기 1:1-31")).containsExactly(range("GEN", 1, 1, 1, 31));
        assertThat(parser.parse("시편 119:1-176")).containsExactly(range("PSA", 119, 1, 119, 176));
        assertThat(parser.parse("유다서 1:1-25")).containsExactly(range("JUD", 1, 1, 1, 25));
        assertThat(parser.parse("요한복음 3:1-21")).containsExactly(range("JHN", 3, 1, 3, 21));
        assertThat(parser.parse("역대상  14 : 1~17")).containsExactly(range("1CH", 14, 1, 14, 17));
        assertThat(parser.parse("사사기(Judges) 11:1 - 11:11")).containsExactly(range("JDG", 11, 1, 11, 11));
        assertThat(parser.parse("창세기 1:1-2:3")).containsExactly(range("GEN", 1, 1, 2, 3));
    }

    @Test
    void wholeChapterReferencesGetTheirEndVerseFromTheTable() throws Exception {
        assertThat(parser.parse("시편 23편")).containsExactly(range("PSA", 23, 1, 23, 6));
        assertThat(parser.parse("시편 23")).containsExactly(range("PSA", 23, 1, 23, 6));
        assertThat(parser.parse("창세기 1~3장")).containsExactly(range("GEN", 1, 1, 3, 24));
        assertThat(parser.parse("유다서 1장")).containsExactly(range("JUD", 1, 1, 1, 25));
    }

    @Test
    void wholeChapterBeyondTheBookIsStillInvalid() {
        assertThatThrownBy(() -> parser.parse("시편 151편")).isInstanceOf(ReferenceException.class);
        assertThatThrownBy(() -> parser.parse("유다서 2장")).isInstanceOf(ReferenceException.class);
        assertThatThrownBy(() -> parser.parse("창세기 49~51장")).isInstanceOf(ReferenceException.class);
    }
}
