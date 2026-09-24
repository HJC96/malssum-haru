package kr.malssumharu.qt.bible;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.fail;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.junit.jupiter.api.Test;

/**
 * 서비스 리소스(bible/verse-counts.json)가 web/src/data/nkrvProvisional.ts(planner-core 생성 파일)와 어긋나면 실패한다.
 * 스크립트(generate_verse_counts.py)와 독립적으로 이 테스트가 원본 TS를 직접 다시 파싱해 비교한다.
 * 원본 파일이 없거나 형식이 바뀌어 파싱하지 못해도 조용히 통과하지 않고 명확한 메시지로 실패한다.
 * 어긋나면: python3 services/qt/scripts/generate_verse_counts.py
 */
class VerseCountsSyncTest {

    private static final Path SOURCE = Path.of("..", "..", "web", "src", "data", "nkrvProvisional.ts").normalize();
    private static final String REGENERATE = " -> run: python3 services/qt/scripts/generate_verse_counts.py";
    private static final Pattern BOOK = Pattern.compile(
            "\\{\\s*bookId:\\s*'([1-3A-Z][A-Z0-9]{2})'\\s*,\\s*testament:\\s*'(?:OT|NT)'\\s*,\\s*order:\\s*(\\d+)\\s*,"
                    + "\\s*chapterVerseCounts:\\s*\\[([0-9,\\s]+)\\]\\s*\\}");

    private static String source() {
        try {
            return Files.readString(SOURCE, StandardCharsets.UTF_8);
        } catch (IOException e) {
            return fail("web data file not found or unreadable: " + SOURCE.toAbsolutePath().normalize()
                    + " (the QT service verse-count resource is generated from it)");
        }
    }

    private static Map<String, int[]> parseSource(String text) {
        Map<String, int[]> books = new LinkedHashMap<>();
        Matcher m = BOOK.matcher(text);
        while (m.find()) {
            String[] parts = m.group(3).trim().split("\\s*,\\s*");
            int[] counts = new int[parts.length];
            for (int i = 0; i < parts.length; i++) {
                counts[i] = Integer.parseInt(parts[i]);
            }
            books.put(m.group(1), counts);
        }
        if (books.size() != 66) {
            fail("nkrvProvisional.ts format changed: parsed " + books.size() + " books, expected 66" + REGENERATE);
        }
        return books;
    }

    private static String quoted(String text, String field) {
        Matcher m = Pattern.compile(field + ":\\s*'([^']+)'").matcher(text);
        if (!m.find()) {
            fail("nkrvProvisional.ts format changed: " + field + " not found" + REGENERATE);
        }
        return m.group(1);
    }

    @Test
    void resourceMatchesTheWebDataFileExactly() {
        String text = source();
        Map<String, int[]> web = parseSource(text);
        ResourceVerseCountTable resource = ResourceVerseCountTable.load();

        assertThat(resource.dataVersion()).as("dataVersion" + REGENERATE).isEqualTo(quoted(text, "dataVersion"));
        assertThat(resource.versificationSystem()).as("versificationSystem" + REGENERATE)
                .isEqualTo(quoted(text, "versificationSystem"));

        Map<String, int[]> mine = resource.asMap();
        assertThat(new ArrayList<>(web.keySet())).as("book order" + REGENERATE).isEqualTo(BibleBooks.allIds());
        assertThat(mine.keySet()).as("books" + REGENERATE).isEqualTo(web.keySet());
        List<String> differing = new ArrayList<>();
        for (Map.Entry<String, int[]> e : web.entrySet()) {
            if (!java.util.Arrays.equals(e.getValue(), mine.get(e.getKey()))) {
                differing.add(e.getKey());
            }
        }
        assertThat(differing).as("books whose chapter verse counts differ from web/src/data" + REGENERATE).isEmpty();
    }

    @Test
    void theSourceKeepsItsDocumentedTotals() {
        Map<String, int[]> web = parseSource(source());
        int chapters = web.values().stream().mapToInt(a -> a.length).sum();
        int verses = web.values().stream().flatMapToInt(java.util.Arrays::stream).sum();

        assertThat(chapters).isEqualTo(1189);
        assertThat(verses).isEqualTo(31103);
    }
}
