package kr.malssumharu.qt.bible;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.HashSet;
import org.junit.jupiter.api.Test;

class BibleBooksTest {

    @Test
    void has66BooksInCanonicalOrderWithUniqueUsfmIds() {
        var ids = BibleBooks.allIds();
        assertThat(ids).hasSize(66).doesNotHaveDuplicates();
        assertThat(ids.getFirst()).isEqualTo("GEN");
        assertThat(ids.get(38)).isEqualTo("MAL");
        assertThat(ids.get(39)).isEqualTo("MAT");
        assertThat(ids.getLast()).isEqualTo("REV");
        assertThat(new HashSet<>(ids)).allSatisfy(id -> assertThat(id).matches("[1-3A-Z][A-Z0-9]{2}"));
    }

    @Test
    void resolvesFullNamesAbbreviationsAndParentheticalEnglish() {
        assertThat(BibleBooks.findId("요한복음")).contains("JHN");
        assertThat(BibleBooks.findId("요")).contains("JHN");
        assertThat(BibleBooks.findId("사사기(Judges)")).contains("JDG");
        assertThat(BibleBooks.findId("역대상")).contains("1CH");
        assertThat(BibleBooks.findId("고린도 전서")).contains("1CO");
        assertThat(BibleBooks.findId("계")).contains("REV");
        assertThat(BibleBooks.findId("없는책")).isEmpty();
    }

    @Test
    void everyBookIsReachableByItsAbbreviationOrFullName() {
        for (String id : BibleBooks.allIds()) {
            assertThat(BibleBooks.order(id)).isGreaterThanOrEqualTo(0);
        }
    }
}
