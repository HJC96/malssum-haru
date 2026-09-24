package kr.malssumharu.qt.bible;

import java.util.OptionalInt;

/**
 * 장의 마지막 절을 알려 주는 연결점. 66권 절 수 데이터(planner-core/source-rights 영역)가 확정되기 전에는
 * {@link #NONE}만 쓰고, 장 전체만 표기한 날은 INVALID_REFERENCE로 처리한다.
 */
@FunctionalInterface
public interface VerseCountTable {

    VerseCountTable NONE = (bookId, chapter) -> OptionalInt.empty();

    OptionalInt lastVerse(String bookId, int chapter);
}
