package kr.malssumharu.qt.bible;

import java.io.IOException;
import java.io.InputStream;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.OptionalInt;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/**
 * 클래스패스 리소스 {@code bible/verse-counts.json}에서 읽는 66권 장·절 수 표.
 * 리소스는 {@code services/qt/scripts/generate_verse_counts.py}가 web/src/data/nkrvProvisional.ts(planner-core 소유)에서 만든다.
 * <b>잠정 데이터다: 개역개정 전수 미검증.</b> 리소스가 없거나 형식이 어긋나면 시작 시 명확한 오류로 실패한다.
 */
public final class ResourceVerseCountTable implements VerseCountTable {

    public static final String RESOURCE = "/bible/verse-counts.json";

    private final String dataVersion;
    private final String versificationSystem;
    private final Map<String, int[]> counts;

    private ResourceVerseCountTable(String dataVersion, String versificationSystem, Map<String, int[]> counts) {
        this.dataVersion = dataVersion;
        this.versificationSystem = versificationSystem;
        this.counts = counts;
    }

    public static ResourceVerseCountTable load() {
        try (InputStream in = ResourceVerseCountTable.class.getResourceAsStream(RESOURCE)) {
            if (in == null) {
                throw new IllegalStateException("verse count resource missing: " + RESOURCE
                        + " (run services/qt/scripts/generate_verse_counts.py)");
            }
            return parse(JsonMapper.builder().build().readTree(in));
        } catch (IOException | RuntimeException e) {
            if (e instanceof IllegalStateException ise) {
                throw ise;
            }
            throw new IllegalStateException("verse count resource unreadable: " + RESOURCE, e);
        }
    }

    static ResourceVerseCountTable parse(JsonNode root) {
        String version = requireText(root, "dataVersion");
        String system = requireText(root, "versificationSystem");
        JsonNode books = root.get("books");
        if (books == null || !books.isObject()) {
            throw new IllegalStateException("verse count resource has no books object");
        }
        List<String> expected = BibleBooks.allIds();
        Map<String, int[]> map = new HashMap<>();
        List<String> order = new java.util.ArrayList<>();
        for (Map.Entry<String, JsonNode> e : books.properties()) {
            JsonNode arr = e.getValue();
            if (!arr.isArray() || arr.isEmpty()) {
                throw new IllegalStateException("bad chapter list for " + e.getKey());
            }
            int[] chapters = new int[arr.size()];
            for (int i = 0; i < chapters.length; i++) {
                chapters[i] = arr.get(i).asInt(0);
                if (chapters[i] < 1) {
                    throw new IllegalStateException("non-positive verse count in " + e.getKey());
                }
            }
            map.put(e.getKey(), chapters);
            order.add(e.getKey());
        }
        if (!order.equals(expected)) {
            throw new IllegalStateException("verse count books must be the 66 canonical bookIds in Bible order");
        }
        return new ResourceVerseCountTable(version, system, Map.copyOf(map));
    }

    private static String requireText(JsonNode root, String field) {
        JsonNode n = root.get(field);
        if (n == null || !n.isString() || n.asString().isBlank()) {
            throw new IllegalStateException("verse count resource missing " + field);
        }
        return n.asString();
    }

    @Override
    public OptionalInt lastVerse(String bookId, int chapter) {
        int[] chapters = counts.get(bookId);
        if (chapters == null || chapter < 1 || chapter > chapters.length) {
            return OptionalInt.empty();
        }
        return OptionalInt.of(chapters[chapter - 1]);
    }

    @Override
    public OptionalInt chapterCount(String bookId) {
        int[] chapters = counts.get(bookId);
        return chapters == null ? OptionalInt.empty() : OptionalInt.of(chapters.length);
    }

    public String dataVersion() {
        return dataVersion;
    }

    public String versificationSystem() {
        return versificationSystem;
    }

    /** 검증용: 책별 장별 절 수의 복사본. */
    public Map<String, int[]> asMap() {
        Map<String, int[]> copy = new HashMap<>();
        counts.forEach((k, v) -> copy.put(k, v.clone()));
        return copy;
    }
}
