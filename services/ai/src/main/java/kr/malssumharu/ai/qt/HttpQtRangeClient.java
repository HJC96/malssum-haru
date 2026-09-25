package kr.malssumharu.ai.qt;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import kr.malssumharu.ai.bible.BibleBooks;
import kr.malssumharu.ai.domain.ProviderId;
import kr.malssumharu.ai.domain.ReasonCode;
import kr.malssumharu.ai.domain.VerseRange;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/** {@code GET {qt-base}/api/qt/today}. 요청에 쿼리·쿠키·개인 정보를 싣지 않는다. */
public final class HttpQtRangeClient implements QtRangeClient {

    private static final Logger LOG = LoggerFactory.getLogger(HttpQtRangeClient.class);
    private static final JsonMapper JSON = JsonMapper.builder().build();
    private static final int MAX_BODY_BYTES = 1 << 20;

    private final HttpClient http;
    private final URI uri;
    private final Duration requestTimeout;

    public HttpQtRangeClient(String baseUrl, Duration connectTimeout, Duration requestTimeout) {
        String base = baseUrl.endsWith("/") ? baseUrl.substring(0, baseUrl.length() - 1) : baseUrl;
        this.uri = URI.create(base + "/api/qt/today");
        if (!"http".equals(uri.getScheme()) && !"https".equals(uri.getScheme())) {
            throw new IllegalArgumentException("qt base url must be http(s)");
        }
        this.http = HttpClient.newBuilder().connectTimeout(connectTimeout).build();
        this.requestTimeout = requestTimeout;
    }

    @Override
    public QtRangeResult today(ProviderId provider) {
        try {
            HttpRequest req = HttpRequest.newBuilder(uri).timeout(requestTimeout)
                    .header("Accept", "application/json")
                    .header("User-Agent", "malssum-haru-ai/0.1 (server-to-server)")
                    .GET().build();
            HttpResponse<byte[]> res = http.send(req, HttpResponse.BodyHandlers.ofByteArray());
            if (res.statusCode() != 200 || res.body().length > MAX_BODY_BYTES) {
                LOG.info("qt.range unavailable reason=NO_RANGE cause=http_status_or_size");
                return new QtRangeResult.Unavailable(ReasonCode.NO_RANGE);
            }
            return parse(JSON.readTree(res.body()), provider);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return new QtRangeResult.Unavailable(ReasonCode.NO_RANGE);
        } catch (Exception e) {
            // 예외 메시지에는 URL·응답 조각이 들어갈 수 있어 로그에 남기지 않는다.
            LOG.info("qt.range unavailable reason=NO_RANGE cause={}", e.getClass().getSimpleName());
            return new QtRangeResult.Unavailable(ReasonCode.NO_RANGE);
        }
    }

    /** 계약 v1 응답 트리에서 한 제공처의 범위를 뽑는다. RANGE_CONFIRMED 이고 범위가 유효할 때만 Confirmed. */
    static QtRangeResult parse(JsonNode root, ProviderId provider) {
        JsonNode providers = root.path("providers");
        if (!providers.isArray()) {
            return new QtRangeResult.Unavailable(ReasonCode.NO_RANGE);
        }
        for (JsonNode p : providers) {
            if (!provider.wire().equals(p.path("providerId").asString(""))) {
                continue;
            }
            if (!"RANGE_CONFIRMED".equals(p.path("availabilityStatus").asString(""))) {
                boolean notCollected = "NOT_COLLECTED_YET".equals(p.path("reasonCode").asString(""));
                return new QtRangeResult.Unavailable(notCollected ? ReasonCode.NOT_COLLECTED_YET : ReasonCode.NO_RANGE);
            }
            String date = p.path("providerDate").asString("");
            JsonNode ranges = p.path("passage").path("ranges");
            if (date.isEmpty() || !ranges.isArray() || ranges.isEmpty()) {
                return new QtRangeResult.Unavailable(ReasonCode.NO_RANGE);
            }
            List<VerseRange> out = new ArrayList<>();
            try {
                for (JsonNode r : ranges) {
                    String book = r.path("bookId").asString("");
                    if (!BibleBooks.isKnown(book)) {
                        return new QtRangeResult.Unavailable(ReasonCode.NO_RANGE);
                    }
                    out.add(new VerseRange(book, r.path("start").path("chapter").asInt(0), r.path("start").path("verse").asInt(0),
                            r.path("end").path("chapter").asInt(0), r.path("end").path("verse").asInt(0)));
                }
            } catch (IllegalArgumentException e) {
                return new QtRangeResult.Unavailable(ReasonCode.NO_RANGE);
            }
            return new QtRangeResult.Confirmed(date, List.copyOf(out));
        }
        return new QtRangeResult.Unavailable(ReasonCode.NO_RANGE);
    }
}
