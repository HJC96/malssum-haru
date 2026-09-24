package kr.malssumharu.qt.lambda;

import static org.assertj.core.api.Assertions.assertThat;

import com.amazonaws.services.lambda.runtime.events.APIGatewayV2HTTPEvent;
import com.amazonaws.services.lambda.runtime.events.APIGatewayV2HTTPResponse;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.function.Function;
import kr.malssumharu.qt.support.Fixtures;
import kr.malssumharu.qt.support.MockUpstream;
import kr.malssumharu.qt.support.MockUpstream.Reply;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import tools.jackson.databind.json.JsonMapper;

/**
 * Lambda 함수 빈이 같은 컨텍스트의 REST 컨트롤러와 바이트 단위로 같은 본문을 낸다(고정 Clock, 로컬 목 서버).
 * 이벤트 픽스처는 API Gateway HTTP API(payload 2.0) 형태를 손으로 작성한 것이다.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT, properties = "qt.acquisition.enabled=true")
@Import(QtLambdaFunctionsTest.FixedClockConfig.class)
class QtLambdaFunctionsTest {

    private static final LocalDate TODAY = LocalDate.of(2026, 9, 24);
    private static final MockUpstream UPSTREAM = MockUpstream.start();
    private static final JsonMapper JSON = JsonMapper.builder().build();

    @TestConfiguration
    static class FixedClockConfig {
        @Bean
        @Primary
        Clock fixedClock() {
            return Clock.fixed(Instant.parse("2026-09-24T01:00:00Z"), ZoneOffset.UTC);
        }
    }

    @DynamicPropertySource
    static void origins(DynamicPropertyRegistry registry) {
        registry.add("qt.providers.maeil-seongyeong.fetch-origin", UPSTREAM::origin);
        registry.add("qt.providers.saengmyeong-ui-sam.fetch-origin", UPSTREAM::origin);
    }

    @Value("${local.server.port}")
    int port;

    @Autowired
    @Qualifier(QtLambdaFunctions.FUNCTION_NAME)
    Function<APIGatewayV2HTTPEvent, APIGatewayV2HTTPResponse> qtToday;

    @BeforeAll
    static void serve() {
        UPSTREAM.on("GET", "/bible/today", Reply.html(Fixtures.maeilPage(TODAY, "요한복음(John) 3:1 - 3:21")));
        UPSTREAM.on("GET", "/qt/view/bible.asp", Reply.eucKrHtml(Fixtures.durannoPage(TODAY, "역대상  14 : 1~17")));
    }

    @AfterAll
    static void stop() {
        UPSTREAM.close();
    }

    static APIGatewayV2HTTPEvent event(String fixture) throws Exception {
        try (var in = QtLambdaFunctionsTest.class.getResourceAsStream("/lambda-events/" + fixture)) {
            return JSON.readValue(new String(in.readAllBytes(), StandardCharsets.UTF_8), APIGatewayV2HTTPEvent.class);
        }
    }

    @Test
    void lambdaBodyIsIdenticalToTheRestControllerBody() throws Exception {
        HttpResponse<String> rest = HttpClient.newHttpClient().send(
                HttpRequest.newBuilder(URI.create("http://localhost:" + port + "/api/qt/today")).build(),
                HttpResponse.BodyHandlers.ofString());

        APIGatewayV2HTTPResponse lambda = qtToday.apply(event("get-today.json"));

        assertThat(rest.statusCode()).isEqualTo(200);
        assertThat(lambda.getStatusCode()).isEqualTo(200);
        assertThat(lambda.getHeaders()).containsEntry("Content-Type", "application/json");
        assertThat(lambda.getHeaders()).containsEntry("Cache-Control", "public, max-age=60");
        assertThat(rest.headers().firstValue("Cache-Control")).contains("public, max-age=60");
        assertThat(lambda.getIsBase64Encoded()).isFalse();
        assertThat(lambda.getBody()).isEqualTo(rest.body());
        assertThat(lambda.getBody()).contains("\"RANGE_CONFIRMED\"").doesNotContain("GEN-1").doesNotContain("2000-01-01");
    }

    @Test
    void otherMethodsAndPathsAreRejectedWithoutTouchingProviders() throws Exception {
        UPSTREAM.clearRequests();

        APIGatewayV2HTTPResponse post = qtToday.apply(event("post-today.json"));
        APIGatewayV2HTTPResponse other = qtToday.apply(event("get-other.json"));

        assertThat(post.getStatusCode()).isEqualTo(405);
        assertThat(post.getHeaders()).containsEntry("Allow", "GET");
        assertThat(other.getStatusCode()).isEqualTo(404);
        assertThat(UPSTREAM.requests()).isEmpty();
    }
}
