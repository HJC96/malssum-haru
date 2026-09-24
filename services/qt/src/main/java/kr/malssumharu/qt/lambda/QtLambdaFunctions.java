package kr.malssumharu.qt.lambda;

import com.amazonaws.services.lambda.runtime.events.APIGatewayV2HTTPEvent;
import com.amazonaws.services.lambda.runtime.events.APIGatewayV2HTTPResponse;
import java.util.Map;
import java.util.function.Function;
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
    static final String PATH = "/api/qt/today";

    @Bean(FUNCTION_NAME)
    Function<APIGatewayV2HTTPEvent, APIGatewayV2HTTPResponse> qtToday(QtTodayService service, JsonMapper mapper) {
        return event -> handle(event, service, mapper);
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
        return json(200, mapper.writeValueAsString(service.today()), Map.of());
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
