package kr.malssumharu.ai.domain;

import kr.malssumharu.ai.bible.BibleBooks;

/** 책(USFM 3글자)·장·절. 절 번호는 개역개정 기준 QT 범위와 같은 번호를 쓰는 것으로 검증된 장에서만 서로 대응한다. */
public record VerseRef(String bookId, int chapter, int verse) implements Comparable<VerseRef> {

    @Override
    public int compareTo(VerseRef o) {
        int c = Integer.compare(BibleBooks.order(bookId), BibleBooks.order(o.bookId));
        if (c != 0) {
            return c;
        }
        c = Integer.compare(chapter, o.chapter);
        return c != 0 ? c : Integer.compare(verse, o.verse);
    }

    @Override
    public String toString() {
        return bookId + " " + chapter + ":" + verse;
    }
}
