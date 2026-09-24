package kr.malssumharu.qt.service;

import java.util.ArrayList;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import kr.malssumharu.qt.domain.BibleRange;
import kr.malssumharu.qt.domain.BibleRange.ChapterVerse;

/** 저장용 장절 범위 문자열. 예: {@code JHN:3:1-3:21,PSA:23:1-23:3}. 구조 정보뿐이며 본문은 없다. */
final class RangeCodec {

    private static final Pattern ONE = Pattern.compile("^([1-3A-Z][A-Z0-9]{2}):(\\d{1,3}):(\\d{1,3})-(\\d{1,3}):(\\d{1,3})$");

    private RangeCodec() {
    }

    static String encode(List<BibleRange> ranges) {
        StringBuilder sb = new StringBuilder();
        for (BibleRange r : ranges) {
            if (sb.length() > 0) {
                sb.append(',');
            }
            sb.append(r.bookId()).append(':').append(r.start().chapter()).append(':').append(r.start().verse())
                    .append('-').append(r.end().chapter()).append(':').append(r.end().verse());
        }
        return sb.toString();
    }

    /** 형식이 어긋난 값은 예외(저장소가 그 항목을 못 읽는 것으로 다룬다). */
    static List<BibleRange> decode(String text) {
        if (text == null || text.isBlank()) {
            throw new IllegalArgumentException("empty ranges");
        }
        List<BibleRange> ranges = new ArrayList<>();
        for (String part : text.split(",")) {
            Matcher m = ONE.matcher(part);
            if (!m.matches()) {
                throw new IllegalArgumentException("bad range encoding");
            }
            ranges.add(new BibleRange(
                    m.group(1),
                    new ChapterVerse(Integer.parseInt(m.group(2)), Integer.parseInt(m.group(3))),
                    new ChapterVerse(Integer.parseInt(m.group(4)), Integer.parseInt(m.group(5)))));
        }
        return List.copyOf(ranges);
    }
}
