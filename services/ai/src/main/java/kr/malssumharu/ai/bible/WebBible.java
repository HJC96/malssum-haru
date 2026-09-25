package kr.malssumharu.ai.bible;

import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.util.Map;
import java.util.NavigableMap;
import java.util.Optional;
import java.util.OptionalInt;
import java.util.TreeMap;
import java.util.concurrent.ConcurrentHashMap;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/**
 * 입력 본문 WEB(World English Bible, 퍼블릭 도메인). classpath 의 {@code bible/web/{책}.json} 을 읽는다.
 * 데이터는 원본 USFM 에서 표시 기호만 제거한 것이다(tools/build_web_data.py, 검증은 tools/verify_web_data.py).
 * 본문은 서버 안에서 LLM 입력으로만 쓰고 API 응답에는 싣지 않는다.
 */
public final class WebBible {

    public static final String TRANSLATION_ID = "WEB";
    public static final String TRANSLATION_NAME = "World English Bible";
    public static final String LICENSE = "Public Domain";
    public static final String LANGUAGE = "en";

    private static final JsonMapper JSON = JsonMapper.builder().build();

    private final String resourceRoot;
    private final Map<String, Book> books = new ConcurrentHashMap<>();
    private final JsonNode manifest;

    public WebBible() {
        this("/bible/web/");
    }

    public WebBible(String resourceRoot) {
        this.resourceRoot = resourceRoot;
        this.manifest = JSON.readTree(read(resourceRoot + "manifest.json"));
    }

    /** 데이터 전체의 해시(책별 파일 해시의 해시). 캐시 키의 '입력 데이터 버전'이다. */
    public String dataVersion() {
        return manifest.get("dataSha256").asString();
    }

    public JsonNode manifest() {
        return manifest;
    }

    /** 절이 있으면 본문(빈 문자열일 수 있음: WEB 이 번호만 두고 본문을 비운 절), 없으면 empty. */
    public Optional<String> verseText(String bookId, int chapter, int verse) {
        NavigableMap<Integer, String> ch = chapter(bookId, chapter);
        return ch == null ? Optional.empty() : Optional.ofNullable(ch.get(verse));
    }

    /** 장에 존재하는 가장 큰 절 번호(빈 절 포함). 장이 없으면 empty. */
    public OptionalInt maxVerse(String bookId, int chapter) {
        NavigableMap<Integer, String> ch = chapter(bookId, chapter);
        return ch == null || ch.isEmpty() ? OptionalInt.empty() : OptionalInt.of(ch.lastKey());
    }

    public OptionalInt chapterCount(String bookId) {
        if (!BibleBooks.isKnown(bookId)) {
            return OptionalInt.empty();
        }
        Book b = book(bookId);
        return b.chapters.isEmpty() ? OptionalInt.empty() : OptionalInt.of(b.chapters.lastKey());
    }

    private NavigableMap<Integer, String> chapter(String bookId, int chapter) {
        if (!BibleBooks.isKnown(bookId)) {
            return null;
        }
        return book(bookId).chapters.get(chapter);
    }

    private Book book(String bookId) {
        return books.computeIfAbsent(bookId, id -> {
            JsonNode doc = JSON.readTree(read(resourceRoot + id + ".json"));
            TreeMap<Integer, NavigableMap<Integer, String>> chapters = new TreeMap<>();
            for (JsonNode c : doc.get("chapters")) {
                TreeMap<Integer, String> verses = new TreeMap<>();
                for (Map.Entry<String, JsonNode> e : c.get("verses").properties()) {
                    verses.put(Integer.parseInt(e.getKey()), e.getValue().asString());
                }
                chapters.put(c.get("chapter").asInt(), verses);
            }
            return new Book(chapters);
        });
    }

    private static byte[] read(String path) {
        try (InputStream in = WebBible.class.getResourceAsStream(path)) {
            if (in == null) {
                throw new IllegalStateException("missing resource " + path);
            }
            return in.readAllBytes();
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    private record Book(TreeMap<Integer, NavigableMap<Integer, String>> chapters) {
    }
}
