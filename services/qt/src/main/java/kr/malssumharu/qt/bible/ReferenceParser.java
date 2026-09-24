package kr.malssumharu.qt.bible;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;
import java.util.OptionalInt;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import kr.malssumharu.qt.domain.BibleRange;
import kr.malssumharu.qt.domain.BibleRange.ChapterVerse;
import kr.malssumharu.qt.domain.ReasonCode;

/**
 * 제공처가 보여 준 한국어 장절 표기("역대상  14 : 1~17", "사사기(Judges) 11:1 - 11:11", "창 1:1-2:3; 요 3:16")를
 * 책 이름 → USFM bookId, 장:절 범위 목록으로 정규화한다.
 * 장 전체만 적힌 표기는 {@link VerseCountTable}로 끝 절을 알 수 있을 때만 받는다(추정하지 않는다).
 */
public final class ReferenceParser {

    static final int MAX_CHAPTER = 150;
    static final int MAX_VERSE = 176;

    private static final Pattern BOOK_WITH_ORDINAL = Pattern.compile("^([가-힣A-Za-z]+\\s*[1-3]\\s*[가-힣]+)");
    private static final Pattern BOOK_PLAIN = Pattern.compile("^([^\\d\\s:~\\-]+)");
    private static final Pattern WHOLE_CHAPTERS = Pattern.compile("^(\\d+)(?:[~-](\\d+))?[장편]$");
    private static final Pattern CROSS_CHAPTER = Pattern.compile("^(\\d+):(\\d+)[~-](\\d+):(\\d+)$");
    private static final Pattern VERSE_RANGE = Pattern.compile("^(\\d+):(\\d+)[~-](\\d+)$");
    private static final Pattern SINGLE_VERSE = Pattern.compile("^(\\d+):(\\d+)$");
    private static final Pattern BARE_NUMBERS = Pattern.compile("^(\\d+)(?:[~-](\\d+))?$");

    private final VerseCountTable verseCounts;

    public ReferenceParser(VerseCountTable verseCounts) {
        this.verseCounts = verseCounts;
    }

    public List<BibleRange> parse(String raw) throws ReferenceException {
        if (raw == null || raw.isBlank()) {
            throw new ReferenceException(ReasonCode.INVALID_REFERENCE, "empty reference");
        }
        String text = normalize(raw);
        List<BibleRange> ranges = new ArrayList<>();
        String book = null;
        Integer currentChapter = null;

        for (String piece : text.split("[;,/·]")) {
            piece = piece.trim();
            if (piece.isEmpty()) {
                continue;
            }
            String rest = piece;
            if (!Character.isDigit(piece.charAt(0))) {
                BookMatch match = matchBook(piece);
                book = match.bookId;
                rest = match.rest;
                currentChapter = null;
            } else if (book == null) {
                throw new ReferenceException(ReasonCode.INVALID_REFERENCE, "reference has no book");
            }
            currentChapter = parsePiece(book, rest, currentChapter, ranges);
        }
        if (ranges.isEmpty()) {
            throw new ReferenceException(ReasonCode.INVALID_REFERENCE, "no range");
        }
        ranges.sort(Comparator.<BibleRange>comparingInt(r -> BibleBooks.order(r.bookId())).thenComparing(BibleRange::start));
        for (int i = 1; i < ranges.size(); i++) {
            BibleRange prev = ranges.get(i - 1);
            BibleRange cur = ranges.get(i);
            if (prev.bookId().equals(cur.bookId()) && cur.start().compareTo(prev.end()) <= 0) {
                throw new ReferenceException(ReasonCode.INVALID_REFERENCE, "overlapping ranges");
            }
        }
        return List.copyOf(ranges);
    }

    private static String normalize(String raw) {
        return raw.replace(' ', ' ')
                .replace('～', '~').replace('〜', '~').replace('∼', '~')
                .replace('–', '-').replace('—', '-').replace('−', '-').replace('‐', '-')
                .replace('：', ':').replace('，', ',').replace('；', ';')
                .replaceAll("\\(.*?\\)", " ")
                .replaceAll("\\s+", " ")
                .trim();
    }

    private record BookMatch(String bookId, String rest) {
    }

    private static BookMatch matchBook(String piece) throws ReferenceException {
        Matcher ordinal = BOOK_WITH_ORDINAL.matcher(piece);
        if (ordinal.find()) {
            Optional<String> id = BibleBooks.findId(ordinal.group(1));
            if (id.isPresent()) {
                return new BookMatch(id.get(), piece.substring(ordinal.end()).trim());
            }
        }
        Matcher plain = BOOK_PLAIN.matcher(piece);
        if (plain.find()) {
            Optional<String> id = BibleBooks.findId(plain.group(1));
            if (id.isPresent()) {
                return new BookMatch(id.get(), piece.substring(plain.end()).trim());
            }
        }
        throw new ReferenceException(ReasonCode.UNKNOWN_BOOK, "unknown book name");
    }

    /** @return 이 조각 뒤에 이어질 절 조각이 기대야 하는 장(없으면 null) */
    private Integer parsePiece(String book, String rest, Integer currentChapter, List<BibleRange> out)
            throws ReferenceException {
        // "14장 1~17절" → "14:1~17"
        String s = rest.replaceAll("(\\d+)\\s*[장편]\\s*(?=\\d)", "$1:").replace("절", "");
        s = s.replaceAll("\\s+", "");
        if (s.isEmpty()) {
            throw invalid("book without chapter");
        }

        Matcher m = WHOLE_CHAPTERS.matcher(s);
        if (m.matches()) {
            addWholeChapters(book, num(m.group(1)), m.group(2) == null ? num(m.group(1)) : num(m.group(2)), out);
            return null;
        }
        m = CROSS_CHAPTER.matcher(s);
        if (m.matches()) {
            add(out, book, num(m.group(1)), num(m.group(2)), num(m.group(3)), num(m.group(4)));
            return num(m.group(3));
        }
        m = VERSE_RANGE.matcher(s);
        if (m.matches()) {
            int c = num(m.group(1));
            add(out, book, c, num(m.group(2)), c, num(m.group(3)));
            return c;
        }
        m = SINGLE_VERSE.matcher(s);
        if (m.matches()) {
            int c = num(m.group(1));
            int v = num(m.group(2));
            add(out, book, c, v, c, v);
            return c;
        }
        m = BARE_NUMBERS.matcher(s);
        if (m.matches()) {
            int a = num(m.group(1));
            int b = m.group(2) == null ? a : num(m.group(2));
            if (currentChapter != null) {
                // "1:1-5, 8-10"의 뒷조각: 앞 조각과 같은 장 안의 절 범위
                add(out, book, currentChapter, a, currentChapter, b);
                return currentChapter;
            }
            addWholeChapters(book, a, b, out);
            return null;
        }
        throw invalid("unsupported reference form");
    }

    private void addWholeChapters(String book, int firstChapter, int lastChapter, List<BibleRange> out)
            throws ReferenceException {
        OptionalInt last = lastChapter >= 1 && lastChapter <= MAX_CHAPTER
                ? verseCounts.lastVerse(book, lastChapter) : OptionalInt.empty();
        if (last.isEmpty()) {
            throw invalid("whole-chapter reference needs a verse count table");
        }
        add(out, book, firstChapter, 1, lastChapter, last.getAsInt());
    }

    private void add(List<BibleRange> out, String book, int c1, int v1, int c2, int v2) throws ReferenceException {
        for (int c : new int[] {c1, c2}) {
            if (c < 1 || c > MAX_CHAPTER) {
                throw invalid("chapter out of range");
            }
        }
        for (int v : new int[] {v1, v2}) {
            if (v < 1 || v > MAX_VERSE) {
                throw invalid("verse out of range");
            }
        }
        ChapterVerse start = new ChapterVerse(c1, v1);
        ChapterVerse end = new ChapterVerse(c2, v2);
        if (start.compareTo(end) > 0) {
            throw invalid("range start is after end");
        }
        // 표가 그 책을 알면 그 책의 장·절 수로 검증한다(표가 없으면 위의 절대 상한만 적용)
        OptionalInt chapters = verseCounts.chapterCount(book);
        if (chapters.isPresent() && c2 > chapters.getAsInt()) {
            throw invalid("chapter beyond the book's last chapter");
        }
        checkVerse(book, c1, v1);
        checkVerse(book, c2, v2);
        out.add(new BibleRange(book, start, end));
    }

    private void checkVerse(String book, int chapter, int verse) throws ReferenceException {
        OptionalInt last = verseCounts.lastVerse(book, chapter);
        if (last.isPresent() && verse > last.getAsInt()) {
            throw invalid("verse beyond chapter end");
        }
    }

    private static int num(String digits) throws ReferenceException {
        if (digits.length() > 4) {
            throw invalid("number too large");
        }
        return Integer.parseInt(digits);
    }

    private static ReferenceException invalid(String message) {
        return new ReferenceException(ReasonCode.INVALID_REFERENCE, message);
    }
}
