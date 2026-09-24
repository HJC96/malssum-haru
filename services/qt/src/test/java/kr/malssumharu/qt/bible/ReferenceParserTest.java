package kr.malssumharu.qt.bible;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.List;
import java.util.OptionalInt;
import kr.malssumharu.qt.domain.BibleRange;
import kr.malssumharu.qt.domain.BibleRange.ChapterVerse;
import kr.malssumharu.qt.domain.ReasonCode;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.ValueSource;

class ReferenceParserTest {

    private final ReferenceParser parser = new ReferenceParser(VerseCountTable.NONE);

    private static BibleRange range(String book, int c1, int v1, int c2, int v2) {
        return new BibleRange(book, new ChapterVerse(c1, v1), new ChapterVerse(c2, v2));
    }

    @Test
    void parsesDurannoStyleWithIrregularSpaces() throws Exception {
        assertThat(parser.parse("역대상  14 : 1~17")).containsExactly(range("1CH", 14, 1, 14, 17));
    }

    @Test
    void parsesMaeilStyleWithEnglishNameAndFullRange() throws Exception {
        assertThat(parser.parse("사사기(Judges) 11:1 - 11:11")).containsExactly(range("JDG", 11, 1, 11, 11));
    }

    @Test
    void parsesRangeThatCrossesChapters() throws Exception {
        assertThat(parser.parse("창세기 1:1-2:3")).containsExactly(range("GEN", 1, 1, 2, 3));
        assertThat(parser.parse("요한복음 3 : 16 ~ 4 : 3")).containsExactly(range("JHN", 3, 16, 4, 3));
    }

    @Test
    void parsesMultipleRangesAcrossBooksAndSortsInBibleOrder() throws Exception {
        assertThat(parser.parse("요한복음 3:16; 창세기 1:1-5"))
                .containsExactly(range("GEN", 1, 1, 1, 5), range("JHN", 3, 16, 3, 16));
    }

    @Test
    void parsesSeveralVerseRangesInOneChapterAfterComma() throws Exception {
        assertThat(parser.parse("시편 23:1-3, 5-6"))
                .containsExactly(range("PSA", 23, 1, 23, 3), range("PSA", 23, 5, 23, 6));
    }

    @ParameterizedTest
    @CsvSource(delimiter = '|', textBlock = """
            요 3:16                | JHN | 3  | 16 | 3  | 16
            롬 8:1-4               | ROM | 8  | 1  | 8  | 4
            요한1서 3:16-18        | 1JN | 3  | 16 | 3  | 18
            고린도전서 13장 1~13절 | 1CO | 13 | 1  | 13 | 13
            시23:1-6               | PSA | 23 | 1  | 23 | 6
            창세기 1：1～3         | GEN | 1  | 1  | 1  | 3
            """)
    void parsesAbbreviationsKoreanUnitsAndFullWidthPunctuation(
            String text, String book, int c1, int v1, int c2, int v2) throws Exception {
        assertThat(parser.parse(text)).containsExactly(range(book, c1, v1, c2, v2));
    }

    @Test
    void wholeChapterWithoutVerseTableIsRejectedNotGuessed() {
        assertThatThrownBy(() -> parser.parse("시편 23편"))
                .isInstanceOfSatisfying(ReferenceException.class,
                        e -> assertThat(e.reason()).isEqualTo(ReasonCode.INVALID_REFERENCE));
        assertThatThrownBy(() -> parser.parse("창세기 1~3장"))
                .isInstanceOfSatisfying(ReferenceException.class,
                        e -> assertThat(e.reason()).isEqualTo(ReasonCode.INVALID_REFERENCE));
    }

    @Test
    void wholeChapterUsesVerseTableWhenAvailable() throws Exception {
        VerseCountTable table = (book, chapter) -> book.equals("PSA") && chapter == 23 ? OptionalInt.of(6) : OptionalInt.empty();
        assertThat(new ReferenceParser(table).parse("시편 23편")).containsExactly(range("PSA", 23, 1, 23, 6));
    }

    @Test
    void verseBeyondChapterEndIsRejectedWhenTableKnowsTheChapter() {
        VerseCountTable table = (book, chapter) -> OptionalInt.of(6);
        assertThatThrownBy(() -> new ReferenceParser(table).parse("시편 23:1-7"))
                .isInstanceOfSatisfying(ReferenceException.class,
                        e -> assertThat(e.reason()).isEqualTo(ReasonCode.INVALID_REFERENCE));
    }

    @ParameterizedTest
    @ValueSource(strings = {"없는책 1:1-3", "¿ª´ë»ó 14 : 1~17", "�� 1:1"})
    void unknownOrGarbledBookIsUnknownBook(String text) {
        assertThatThrownBy(() -> parser.parse(text))
                .isInstanceOfSatisfying(ReferenceException.class,
                        e -> assertThat(e.reason()).isEqualTo(ReasonCode.UNKNOWN_BOOK));
    }

    @ParameterizedTest
    @ValueSource(strings = {"", "   ", "3:16", "요한복음", "요한복음 3:20-1", "요한복음 0:1", "요한복음 3:0",
            "요한복음 3:16-4", "창세기 1:1-5; 창세기 1:3-8", "요한복음 abc", "요한복음 99999:1"})
    void invalidShapesAreInvalidReference(String text) {
        assertThatThrownBy(() -> parser.parse(text))
                .isInstanceOfSatisfying(ReferenceException.class,
                        e -> assertThat(e.reason()).isIn(ReasonCode.INVALID_REFERENCE, ReasonCode.UNKNOWN_BOOK));
    }

    @Test
    void nullIsInvalid() {
        assertThatThrownBy(() -> parser.parse(null)).isInstanceOf(ReferenceException.class);
    }

    @Test
    void resultIsImmutableAndNonEmpty() throws Exception {
        List<BibleRange> ranges = parser.parse("요 3:1-21");
        assertThat(ranges).hasSize(1);
        assertThatThrownBy(() -> ranges.add(ranges.getFirst())).isInstanceOf(UnsupportedOperationException.class);
    }
}
