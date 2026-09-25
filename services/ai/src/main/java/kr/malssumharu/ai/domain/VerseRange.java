package kr.malssumharu.ai.domain;

/** 같은 책 안의 연속 범위(양 끝 포함). 계약 v1의 passage.ranges[] 한 항목과 같다. */
public record VerseRange(String bookId, int startChapter, int startVerse, int endChapter, int endVerse) {

    public VerseRange {
        if (startChapter < 1 || startVerse < 1 || endChapter < startChapter
                || (endChapter == startChapter && endVerse < startVerse) || endVerse < 1) {
            throw new IllegalArgumentException("invalid range");
        }
    }

    public VerseRef start() {
        return new VerseRef(bookId, startChapter, startVerse);
    }

    public VerseRef end() {
        return new VerseRef(bookId, endChapter, endVerse);
    }

    /** 사전 순 안정 표기. 캐시 키에 들어간다. */
    public String canonical() {
        return bookId + " " + startChapter + ":" + startVerse + "-" + endChapter + ":" + endVerse;
    }
}
