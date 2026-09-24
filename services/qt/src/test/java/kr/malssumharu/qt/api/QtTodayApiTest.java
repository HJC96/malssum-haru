package kr.malssumharu.qt.api;

import static org.assertj.core.api.Assertions.assertThat;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import kr.malssumharu.qt.support.Fixtures;
import kr.malssumharu.qt.support.MockUpstream;
import kr.malssumharu.qt.support.MockUpstream.Reply;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/**
 * 실제 애플리케이션 컨텍스트(설정 바인딩, Jackson 직렬화 포함)를 띄워 HTTP로 GET /api/qt/today 를 확인한다.
 * 제공처는 로컬 목 서버로 대체하고, 시계는 고정 Clock(2026-09-24 10:00 KST)을 주입해 서울 자정 경계에서 흔들리지 않는다.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT, properties = {
        "qt.acquisition.enabled=true",
        "qt.http.request-timeout=1s"
})
@Import(QtTodayApiTest.FixedClockConfig.class)
class QtTodayApiTest {

    private static final LocalDate TODAY = LocalDate.of(2026, 9, 24);

    @TestConfiguration
    static class FixedClockConfig {
        @Bean
        @Primary
        Clock fixedClock() {
            return Clock.fixed(Instant.parse("2026-09-24T01:00:00Z"), ZoneOffset.UTC);
        }
    }

    private static final MockUpstream UPSTREAM = MockUpstream.start();
    private static final JsonMapper JSON = JsonMapper.builder().build();

    @DynamicPropertySource
    static void origins(DynamicPropertyRegistry registry) {
        registry.add("qt.providers.maeil-seongyeong.fetch-origin", UPSTREAM::origin);
        registry.add("qt.providers.saengmyeong-ui-sam.fetch-origin", UPSTREAM::origin);
    }

    @Value("${local.server.port}")
    int port;

    @BeforeAll
    static void serveToday() {
        LocalDate today = TODAY;
        UPSTREAM.on("GET", "/bible/today", Reply.html(Fixtures.maeilPage(today, "요한복음(John) 3:1 - 3:21")));
        UPSTREAM.on("GET", "/qt/view/bible.asp", Reply.eucKrHtml(Fixtures.durannoPage(today, "역대상  14 : 1~17")));
    }

    @AfterAll
    static void stop() {
        UPSTREAM.close();
    }

    @Test
    void servesTheContractJsonOverHttp() throws Exception {
        HttpResponse<String> response = HttpClient.newHttpClient().send(
                HttpRequest.newBuilder(URI.create("http://localhost:" + port + "/api/qt/today")).build(),
                HttpResponse.BodyHandlers.ofString());

        assertThat(response.statusCode()).isEqualTo(200);
        assertThat(response.headers().firstValue("Content-Type").orElse("")).startsWith("application/json");
        JsonNode root = JSON.readTree(response.body());
        assertThat(root.get("schemaVersion").asString()).isEqualTo("1");
        assertThat(root.get("generatedAt").asString()).isEqualTo("2026-09-24T01:00:00Z");
        assertThat(root.get("providers")).hasSize(2);
        JsonNode maeil = root.get("providers").get(0);
        JsonNode saeng = root.get("providers").get(1);
        assertThat(maeil.get("providerId").asString()).isEqualTo("maeil-seongyeong");
        assertThat(saeng.get("providerId").asString()).isEqualTo("saengmyeong-ui-sam");
        assertThat(maeil.get("availabilityStatus").asString()).isEqualTo("RANGE_CONFIRMED");
        assertThat(saeng.get("availabilityStatus").asString()).isEqualTo("RANGE_CONFIRMED");
        assertThat(maeil.get("passage").get("ranges").get(0).get("bookId").asString()).isEqualTo("JHN");
        assertThat(saeng.get("passage").get("ranges").get(0).get("end").get("verse").asInt()).isEqualTo(17);
        // 사용자에게 나가는 링크는 목 서버가 아니라 공식 https 주소다
        assertThat(maeil.get("officialUrl").asString()).isEqualTo("https://sum.su.or.kr:8888/bible/today");
        assertThat(saeng.get("officialUrl").asString()).startsWith("https://www.duranno.com/qt/view/bible.asp?qtDate=");
        assertThat(response.body()).doesNotContain("FIXTURE_").doesNotContain("127.0.0.1");
    }

    @Test
    void ignoresQueryParametersAndCarriesNoPersonalPlanData() throws Exception {
        HttpResponse<String> response = HttpClient.newHttpClient().send(
                HttpRequest.newBuilder(URI.create("http://localhost:" + port
                        + "/api/qt/today?plan=GEN-1&read=EXO&date=2000-01-01")).build(),
                HttpResponse.BodyHandlers.ofString());

        assertThat(response.statusCode()).isEqualTo(200);
        // 요청의 계획·읽은 범위·날짜 파라미터는 무시되고 응답에 반영되지 않는다
        assertThat(response.body()).doesNotContain("GEN-1").doesNotContain("2000-01-01");
    }
}
