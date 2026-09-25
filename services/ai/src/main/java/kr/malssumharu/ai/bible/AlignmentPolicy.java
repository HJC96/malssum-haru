package kr.malssumharu.ai.bible;

import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import kr.malssumharu.ai.domain.RangeSet;
import kr.malssumharu.ai.domain.VerseRange;
import kr.malssumharu.ai.domain.VerseRef;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/**
 * QT 범위(개역개정 기준 절 번호)가 입력 번역본 WEB 의 같은 번호 절과 대응하는지 판정한다.
 *
 * <p>규칙(보수적): 범위의 모든 절이 WEB 에 본문이 있는 절로 존재해야 하고, 범위가 걸친 장이 우리 잠정 구조 표와
 * 절 구조가 다른 장(bible/alignment.json 의 differingChapters)이 아니어야 한다. 하나라도 어긋나면 범위 전체를 생성하지 않는다.
 * 번호가 존재해도 내용이 어긋날 수 있는 장(예: ROM 14/16, 3JN 1)을 막기 위한 두 번째 조건이다.
 * 근거와 목록: docs/verse-alignment.md.
 */
public final class AlignmentPolicy {

    public enum Detail {
        UNKNOWN_BOOK, CHAPTER_MISSING, VERSE_MISSING, VERSE_EMPTY, STRUCTURE_DIFFERS
    }

    public record Result(boolean aligned, Detail detail, List<VerseRef> verses) {
        static Result ok(List<VerseRef> verses) {
            return new Result(true, null, verses);
        }

        static Result no(Detail detail) {
            return new Result(false, detail, List.of());
        }
    }

    private static final JsonMapper JSON = JsonMapper.builder().build();

    private final WebBible web;
    private final Set<String> differing = new HashSet<>();
    private final String structureTableId;

    public AlignmentPolicy(WebBible web) {
        this.web = web;
        try (InputStream in = AlignmentPolicy.class.getResourceAsStream("/bible/alignment.json")) {
            if (in == null) {
                throw new IllegalStateException("missing resource /bible/alignment.json");
            }
            JsonNode doc = JSON.readTree(in.readAllBytes());
            this.structureTableId = doc.get("structureTable").get("id").asString();
            for (JsonNode c : doc.get("differingChapters")) {
                differing.add(c.get("bookId").asString() + ":" + c.get("chapter").asInt());
            }
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    /** 캐시 키의 '장절 기준'. QT 범위는 이 구조 표의 절 번호이고 입력 본문 WEB 과의 대응은 이 정책으로 검증한다. */
    public String versificationBasis() {
        return structureTableId;
    }

    public boolean isStructureDifferent(String bookId, int chapter) {
        return differing.contains(bookId + ":" + chapter);
    }

    public Result check(RangeSet set) {
        List<VerseRef> all = new ArrayList<>();
        for (VerseRange r : set.ranges()) {
            if (!BibleBooks.isKnown(r.bookId())) {
                return Result.no(Detail.UNKNOWN_BOOK);
            }
            for (int c = r.startChapter(); c <= r.endChapter(); c++) {
                if (isStructureDifferent(r.bookId(), c)) {
                    return Result.no(Detail.STRUCTURE_DIFFERS);
                }
                var max = web.maxVerse(r.bookId(), c);
                if (max.isEmpty()) {
                    return Result.no(Detail.CHAPTER_MISSING);
                }
                int lo = c == r.startChapter() ? r.startVerse() : 1;
                int hi = c == r.endChapter() ? r.endVerse() : max.getAsInt();
                for (int v = lo; v <= hi; v++) {
                    var text = web.verseText(r.bookId(), c, v);
                    if (text.isEmpty()) {
                        return Result.no(Detail.VERSE_MISSING);
                    }
                    if (text.get().isBlank()) {
                        return Result.no(Detail.VERSE_EMPTY);
                    }
                    all.add(new VerseRef(r.bookId(), c, v));
                }
            }
        }
        return Result.ok(all);
    }

    /** 표시·테스트용: 구조가 다른 장의 (책:장) 집합. */
    public Set<String> differingChapters() {
        return Set.copyOf(differing);
    }

    public Map<String, Object> describe() {
        return Map.of("structureTable", structureTableId, "differingChapters", differing.size());
    }
}
