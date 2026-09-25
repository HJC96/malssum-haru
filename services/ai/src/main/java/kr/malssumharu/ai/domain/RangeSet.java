package kr.malssumharu.ai.domain;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.OptionalInt;
import java.util.function.BiFunction;
import java.util.stream.Collectors;

/**
 * 정규화한 범위 집합. 성경 순서로 정렬하고 겹치거나 맞닿은 범위는 하나로 합친다.
 * 같은 범위를 다르게 표기(순서, 쪼갠 표기, 중복)해도 같은 정규형이 되어 같은 캐시 키가 나온다.
 */
public record RangeSet(List<VerseRange> ranges) {

    public RangeSet {
        if (ranges.isEmpty()) {
            throw new IllegalArgumentException("empty range set");
        }
        ranges = List.copyOf(ranges);
    }

    /**
     * @param chapterMaxVerse (책, 장) → 그 장의 마지막 절. 장 경계에서 맞닿은 범위를 합치는 데 쓴다(모르면 empty, 합치지 않는다).
     */
    public static RangeSet normalize(List<VerseRange> input, BiFunction<String, Integer, OptionalInt> chapterMaxVerse) {
        List<VerseRange> sorted = new ArrayList<>(input);
        sorted.sort(Comparator.comparing(VerseRange::start).thenComparing(VerseRange::end));
        List<VerseRange> out = new ArrayList<>();
        for (VerseRange r : sorted) {
            if (out.isEmpty()) {
                out.add(r);
                continue;
            }
            VerseRange last = out.get(out.size() - 1);
            if (last.bookId().equals(r.bookId()) && touchesOrOverlaps(last, r, chapterMaxVerse)) {
                VerseRef end = last.end().compareTo(r.end()) >= 0 ? last.end() : r.end();
                out.set(out.size() - 1, new VerseRange(last.bookId(), last.startChapter(), last.startVerse(), end.chapter(), end.verse()));
            } else {
                out.add(r);
            }
        }
        return new RangeSet(out);
    }

    private static boolean touchesOrOverlaps(VerseRange a, VerseRange b, BiFunction<String, Integer, OptionalInt> maxVerse) {
        if (b.start().compareTo(a.end()) <= 0) {
            return true;
        }
        if (b.startChapter() == a.endChapter() && b.startVerse() == a.endVerse() + 1) {
            return true;
        }
        if (b.startChapter() == a.endChapter() + 1 && b.startVerse() == 1) {
            OptionalInt max = maxVerse.apply(a.bookId(), a.endChapter());
            return max.isPresent() && max.getAsInt() == a.endVerse();
        }
        return false;
    }

    public String canonical() {
        return ranges.stream().map(VerseRange::canonical).collect(Collectors.joining(";"));
    }
}
