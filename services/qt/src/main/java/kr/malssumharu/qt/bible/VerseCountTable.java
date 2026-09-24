package kr.malssumharu.qt.bible;

import java.util.OptionalInt;

/**
 * 책·장별 마지막 절을 알려 주는 표. 표가 없으면({@link #NONE}) 장 전체만 표기한 날을 추정하지 않고,
 * 책마다의 장·절 수도 검증하지 못한다(절대 상한만 적용).
 */
@FunctionalInterface
public interface VerseCountTable {

    VerseCountTable NONE = (bookId, chapter) -> OptionalInt.empty();

    /** 그 장의 마지막 절. 표에 없는 책이나 장이면 empty. */
    OptionalInt lastVerse(String bookId, int chapter);

    /** 그 책의 장 수. 표가 그 책을 모르면 empty(그 장이 있는지 검증하지 않는다). */
    default OptionalInt chapterCount(String bookId) {
        return OptionalInt.empty();
    }
}
