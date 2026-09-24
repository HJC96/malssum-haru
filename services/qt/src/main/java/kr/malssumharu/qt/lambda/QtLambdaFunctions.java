package kr.malssumharu.qt.lambda;

import com.amazonaws.services.lambda.runtime.events.APIGatewayV2HTTPEvent;
import com.amazonaws.services.lambda.runtime.events.APIGatewayV2HTTPResponse;
import java.util.Map;
import java.util.function.Function;
import kr.malssumharu.qt.service.QtCollectorService;
import kr.malssumharu.qt.service.QtTodayService;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import tools.jackson.databind.json.JsonMapper;

/**
 * AWS Lambda(API Gateway HTTP API, payload format 2.0) 진입점의 함수 빈.
 * REST 컨트롤러와 같은 {@link QtTodayService}·같은 JsonMapper를 쓰므로 응답 본문이 같다.
 * 개인 계획·읽은 범위는 이벤트에서 읽지 않는다(쿼리·본문은 무시).
 */
@Configuration
public class QtLambdaFunctions {

    public static final String FUNCTION_NAME = "qtToday";
    public static final String COLLECT_FUNCTION_NAME = "qtCollect";
    /** 조회 응답 캐시(REST·Lambda 공통). 서울 자정 전후에는 응답의 providerDate·generatedAt으로 클라이언트가 판단한다. */
    public static final String CACHE_CONTROL = "public, max-age=60";
    static final String PATH = "/api/qt/today";

    @Bean(FUNCTION_NAME)
    Function<APIGatewayV2HTTPEvent, APIGatewayV2HTTPResponse> qtToday(QtTodayService service, JsonMapper mapper) {
        return event -> handle(event, service, mapper);
    }

    /**
     * 수집 함수. 입력은 {@code {"trigger":"schedule"}}. 다른 입력(예: API Gateway 이벤트를 잘못 연결한 경우)은
     * 아무것도 하지 않고 IGNORED를 돌려준다. 출력은 제공처별 결과 코드뿐이다.
     */
    @Bean(COLLECT_FUNCTION_NAME)
    Function<Map<String, Object>, Map<String, Object>> qtCollect(QtCollectorService collector) {
        return input -> {
            if (input == null || !"schedule".equals(input.get("trigger"))) {
                return Map.of("result", "IGNORED");
            }
            QtCollectorService.Report report = collector.collect();
            return Map.of(
                    "result", "DONE",
                    "seoulDate", report.seoulDate().toString(),
                    "providers", report.providers().stream()
                            .map(p -> p.reason() == null
                                    ? Map.<String, Object>of("providerId", p.providerId(), "result", p.result().name())
                                    : Map.<String, Object>of("providerId", p.providerId(), "result", p.result().name(), "reason", p.reason()))
                            .toList());
        };
    }

    private static APIGatewayV2HTTPResponse handle(APIGatewayV2HTTPEvent event, QtTodayService service, JsonMapper mapper) {
        String method = event.getRequestContext() != null && event.getRequestContext().getHttp() != null
                ? event.getRequestContext().getHttp().getMethod() : null;
        String path = event.getRawPath();
        if (!PATH.equals(path)) {
            return json(404, "{\"error\":\"not_found\"}", Map.of());
        }
        if (!"GET".equalsIgnoreCase(method)) {
            return json(405, "{\"error\":\"method_not_allowed\"}", Map.of("Allow", "GET"));
        }
        return json(200, mapper.writeValueAsString(service.today()), Map.of("Cache-Control", CACHE_CONTROL));
    }

    private static APIGatewayV2HTTPResponse json(int status, String body, Map<String, String> extraHeaders) {
        java.util.HashMap<String, String> headers = new java.util.HashMap<>(extraHeaders);
        headers.put("Content-Type", "application/json");
        return APIGatewayV2HTTPResponse.builder()
                .withStatusCode(status)
                .withHeaders(headers)
                .withBody(body)
                .withIsBase64Encoded(false)
                .build();
    }
}
