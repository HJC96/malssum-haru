package kr.malssumharu.qt.provider;

import java.net.URI;
import java.nio.charset.Charset;
import java.nio.charset.StandardCharsets;
import java.time.DateTimeException;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import kr.malssumharu.qt.bible.ReferenceException;
import kr.malssumharu.qt.bible.ReferenceParser;
import kr.malssumharu.qt.domain.BibleRange;
import kr.malssumharu.qt.domain.OfficialUrlKind;
import kr.malssumharu.qt.domain.ProviderId;
import kr.malssumharu.qt.domain.ReasonCode;
import kr.malssumharu.qt.http.FetchException;
import kr.malssumharu.qt.http.FetchResponse;
import kr.malssumharu.qt.http.HttpFetcher;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/**
 * 매일성경(성서유니온) 오늘 페이지.
 *
 * <p>조사 결과(services/qt/docs/adapter-notes.md): 오늘 날짜와 장절이 첫 HTML에 서버 렌더링되어 있어
 * GET 한 번으로 읽는다. 페이지 JS가 쓰는 JSON 경로(POST /Ajax/Bible/BodyMatterDetail)는 첫 HTML에서
 * 날짜·장절을 못 찾았을 때만 보조로 쓴다. 이 JSON에는 제공처 해설 필드가 섞여 있으므로
 * Base_de, Bible_name, Bible_chapter 세 필드만 읽고 나머지는 즉시 버린다.
 * 날짜 지정 URL이 없어(서버가 날짜 파라미터를 무시) 링크는 today-page 종류다.
 */
public class MaeilSeongyeongAdapter implements QtProviderAdapter {

    public static final String OFFICIAL_URL = "https://sum.su.or.kr:8888/bible/today";
    public static final String DEFAULT_ORIGIN = "https://sum.su.or.kr:8888";
    static final String SOURCE_VERSION = "maeil-seongyeong-adapter/1";
    static final String TODAY_PATH = "/bible/today";
    static final String DETAIL_PATH = "/Ajax/Bible/BodyMatterDetail";

    private static final Pattern PAGE_DATE_SCRIPT =
            Pattern.compile("#base_de\"\\)\\.val\\(\"(\\d{4})-(\\d{2})-(\\d{2})\"\\)");
    private static final Pattern DISPLAY_DATE = Pattern.compile("(\\d{4})\\.(\\d{2})\\.(\\d{2})");
    private static final Pattern REFERENCE_LINE = Pattern.compile("^\\s*본문\\s*:\\s*(.+?)(?:\\s+찬송가.*)?$");
    private static final JsonMapper JSON = JsonMapper.builder().build();

    private final HttpFetcher fetcher;
    private final String fetchOrigin;
    private final ReferenceParser parser;

    public MaeilSeongyeongAdapter(HttpFetcher fetcher, String fetchOrigin, ReferenceParser parser) {
        this.fetcher = fetcher;
        this.fetchOrigin = stripTrailingSlash(fetchOrigin);
        this.parser = parser;
    }

    @Override
    public ProviderId id() {
        return ProviderId.MAEIL_SEONGYEONG;
    }

    @Override
    public String sourceVersion() {
        return SOURCE_VERSION;
    }

    @Override
    public OfficialUrlKind officialUrlKind() {
        return OfficialUrlKind.TODAY_PAGE;
    }

    @Override
    public URI officialUrl(LocalDate seoulToday) {
        return URI.create(OFFICIAL_URL);
    }

    @Override
    public AdapterOutcome fetch(LocalDate seoulToday) {
        PageFetch.Result page = PageFetch.get(fetcher, URI.create(fetchOrigin + TODAY_PATH));
        if (!page.ok()) {
            return page.failure();
        }
        String html = decode(page.response());
        Document doc = Jsoup.parse(html);

        LocalDate date = readPageDate(html, doc);
        String reference = readReference(doc);

        if (date == null || reference == null) {
            // 첫 HTML에 없으면 페이지 JS가 쓰는 JSON 경로로 보조 취득
            Optional<JsonDetail> json = readDetailJson(seoulToday);
            if (json.isEmpty()) {
                return AdapterOutcome.Failed.unavailable(ReasonCode.DYNAMIC_CONTENT_UNAVAILABLE, date);
            }
            date = json.get().date();
            reference = json.get().reference();
        }
        try {
            List<BibleRange> ranges = parser.parse(reference);
            return new AdapterOutcome.Found(date, reference, ranges);
        } catch (ReferenceException e) {
            return AdapterOutcome.Failed.unavailable(e.reason(), date);
        }
    }

    private static Charset charsetOf(FetchResponse response) {
        return response.declaredCharset().orElse(StandardCharsets.UTF_8);
    }

    private static String decode(FetchResponse response) {
        return new String(response.body(), charsetOf(response));
    }

    private static LocalDate readPageDate(String html, Document doc) {
        Matcher script = PAGE_DATE_SCRIPT.matcher(html);
        if (script.find()) {
            return toDate(script.group(1), script.group(2), script.group(3));
        }
        Element info = doc.getElementById("dailybible_info");
        if (info != null) {
            Matcher m = DISPLAY_DATE.matcher(info.text());
            if (m.find()) {
                return toDate(m.group(1), m.group(2), m.group(3));
            }
        }
        return null;
    }

    private static String readReference(Document doc) {
        Element box = doc.getElementById("bibleinfo_box");
        if (box == null) {
            return null;
        }
        Matcher m = REFERENCE_LINE.matcher(box.text());
        return m.matches() ? m.group(1).trim() : null;
    }

    private record JsonDetail(LocalDate date, String reference) {
    }

    private Optional<JsonDetail> readDetailJson(LocalDate seoulToday) {
        try {
            String body = "{ 'qt_ty' : 'QT1' , 'Base_de' : '" + seoulToday + "'}";
            FetchResponse response = fetcher.postJson(URI.create(fetchOrigin + DETAIL_PATH), body);
            if (!response.isSuccess()) {
                return Optional.empty();
            }
            JsonNode root = JSON.readTree(response.body());
            String baseDe = text(root, "Base_de");
            String name = text(root, "Bible_name");
            String chapter = text(root, "Bible_chapter");
            if (baseDe == null || name == null || chapter == null) {
                return Optional.empty();
            }
            LocalDate date = LocalDate.parse(baseDe);
            return Optional.of(new JsonDetail(date, name + " " + chapter));
        } catch (FetchException | RuntimeException e) {
            // JSON 오류 메시지에 본문 조각이 들어갈 수 있어 원인을 기록하지 않는다
            return Optional.empty();
        }
    }

    private static String text(JsonNode root, String field) {
        JsonNode node = root.get(field);
        if (node == null || !node.isString() || node.asString().isBlank()) {
            return null;
        }
        return node.asString();
    }

    private static LocalDate toDate(String y, String m, String d) {
        try {
            return LocalDate.of(Integer.parseInt(y), Integer.parseInt(m), Integer.parseInt(d));
        } catch (DateTimeException e) {
            return null;
        }
    }

    private static String stripTrailingSlash(String s) {
        return s.endsWith("/") ? s.substring(0, s.length() - 1) : s;
    }
}
