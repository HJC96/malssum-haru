package kr.malssumharu.qt.provider;

import java.net.URI;
import java.nio.charset.Charset;
import java.nio.charset.StandardCharsets;
import java.time.DateTimeException;
import java.time.LocalDate;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import kr.malssumharu.qt.bible.ReferenceException;
import kr.malssumharu.qt.bible.ReferenceParser;
import kr.malssumharu.qt.domain.BibleRange;
import kr.malssumharu.qt.domain.OfficialUrlKind;
import kr.malssumharu.qt.domain.ProviderId;
import kr.malssumharu.qt.domain.ReasonCode;
import kr.malssumharu.qt.http.HttpFetcher;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;

/**
 * 생명의삶(두란노) 날짜별 오늘의 말씀.
 *
 * <p>조사 결과(services/qt/docs/adapter-notes.md): 응답은 EUC-KR이고 날짜와 장절은 서버 렌더링이다.
 * 서버 기준 오늘이 아닌 qtDate는 HTTP 200인데 날짜·장절이 없는 껍데기 페이지가 오므로 PARSE_FAILED로 감지한다.
 * 제공처 해설·본문 영역은 읽지 않는다. 날짜 표시와 제목 줄의 장절 표기만 읽는다.
 */
public class SaengmyeongUiSamAdapter implements QtProviderAdapter {

    public static final String OFFICIAL_URL_PREFIX = "https://www.duranno.com/qt/view/bible.asp?qtDate=";
    public static final String DEFAULT_ORIGIN = "https://www.duranno.com";
    static final String SOURCE_VERSION = "saengmyeong-ui-sam-adapter/1";
    static final String PAGE_PATH = "/qt/view/bible.asp?qtDate=";

    private static final Charset EUC_KR = Charset.forName("x-windows-949");
    private static final Pattern DISPLAY_DATE = Pattern.compile("(\\d{4})\\.(\\d{2})\\.(\\d{2})");

    private final HttpFetcher fetcher;
    private final String fetchOrigin;
    private final ReferenceParser parser;

    public SaengmyeongUiSamAdapter(HttpFetcher fetcher, String fetchOrigin, ReferenceParser parser) {
        this.fetcher = fetcher;
        this.fetchOrigin = fetchOrigin.endsWith("/") ? fetchOrigin.substring(0, fetchOrigin.length() - 1) : fetchOrigin;
        this.parser = parser;
    }

    @Override
    public ProviderId id() {
        return ProviderId.SAENGMYEONG_UI_SAM;
    }

    @Override
    public String sourceVersion() {
        return SOURCE_VERSION;
    }

    @Override
    public OfficialUrlKind officialUrlKind() {
        return OfficialUrlKind.DATE_SPECIFIC;
    }

    @Override
    public URI officialUrl(LocalDate seoulToday) {
        return URI.create(OFFICIAL_URL_PREFIX + seoulToday);
    }

    @Override
    public AdapterOutcome fetch(LocalDate seoulToday) {
        PageFetch.Result page = PageFetch.get(fetcher, URI.create(fetchOrigin + PAGE_PATH + seoulToday));
        if (!page.ok()) {
            return page.failure();
        }
        // 선언된 문자셋(기본 EUC-KR)으로 먼저 해독하고, 표기가 깨져 해석되지 않으면 다른 문자셋으로 한 번 더 시도한다
        Charset declared = page.response().declaredCharset().orElse(EUC_KR);
        if (declared.name().equalsIgnoreCase("EUC-KR")) {
            declared = EUC_KR;
        }
        Charset alternative = declared.equals(StandardCharsets.UTF_8) ? EUC_KR : StandardCharsets.UTF_8;

        AdapterOutcome firstFailure = null;
        for (Charset charset : List.of(declared, alternative)) {
            AdapterOutcome outcome = attempt(page.response().body(), charset);
            if (outcome instanceof AdapterOutcome.Found) {
                return outcome;
            }
            if (firstFailure == null) {
                firstFailure = outcome;
            }
        }
        return firstFailure;
    }

    private AdapterOutcome attempt(byte[] body, Charset charset) {
        Parsed parsed = parseWith(body, charset);
        if (parsed == null || looksGarbled(parsed.reference)) {
            return AdapterOutcome.Failed.unavailable(ReasonCode.PARSE_FAILED, parsed == null ? null : parsed.date);
        }
        try {
            List<BibleRange> ranges = parser.parse(parsed.reference);
            return new AdapterOutcome.Found(parsed.date, parsed.reference, ranges);
        } catch (ReferenceException e) {
            return AdapterOutcome.Failed.unavailable(e.reason(), parsed.date);
        }
    }

    private record Parsed(LocalDate date, String reference) {
    }

    private static Parsed parseWith(byte[] body, Charset charset) {
        Document doc = Jsoup.parse(new String(body, charset));
        LocalDate date = null;
        for (Element li : doc.select("ul.date li")) {
            if (li.hasClass("left") || li.hasClass("right")) {
                continue;
            }
            Matcher m = DISPLAY_DATE.matcher(li.text());
            if (m.find()) {
                try {
                    date = LocalDate.of(Integer.parseInt(m.group(1)), Integer.parseInt(m.group(2)), Integer.parseInt(m.group(3)));
                } catch (DateTimeException e) {
                    return null;
                }
                break;
            }
        }
        Element span = doc.selectFirst("div.font-size h1 > span");
        if (date == null || span == null || span.text().isBlank()) {
            return null;
        }
        return new Parsed(date, span.text().trim());
    }

    private static boolean looksGarbled(String reference) {
        if (reference.indexOf('�') >= 0) {
            return true;
        }
        return reference.chars().noneMatch(c -> c >= '가' && c <= '힣');
    }
}
