package kr.malssumharu.qt.domain;

/** 같은 책 안의 연속 범위. 장·절은 모두 1 이상이다. */
public record BibleRange(String bookId, ChapterVerse start, ChapterVerse end) {

    public record ChapterVerse(int chapter, int verse) implements Comparable<ChapterVerse> {
        public ChapterVerse {
            if (chapter < 1 || verse < 1) {
                throw new IllegalArgumentException("chapter and verse must be >= 1");
            }
        }

        @Override
        public int compareTo(ChapterVerse o) {
            return chapter != o.chapter ? Integer.compare(chapter, o.chapter) : Integer.compare(verse, o.verse);
        }
    }

    public BibleRange {
        if (start.compareTo(end) > 0) {
            throw new IllegalArgumentException("range start is after end");
        }
    }
}
