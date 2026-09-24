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
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;
import java.util.function.Function;
import kr.malssumharu.qt.domain.BibleRange;
import kr.malssumharu.qt.domain.BibleRange.ChapterVerse;
import kr.malssumharu.qt.domain.ProviderId;
import kr.malssumharu.qt.service.DynamoDbQtDayStore;
import kr.malssumharu.qt.service.QtDayStore;
import kr.malssumharu.qt.service.StoredDay;
import kr.malssumharu.qt.support.FakeDynamoDb;
import kr.malssumharu.qt.support.Fixtures;
import kr.malssumharu.qt.support.MockUpstream;
import kr.malssumharu.qt.support.MockUpstream.Reply;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
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
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/**
 * 배포 모드(QT_TABLE_NAME)에서 취득 플래그가 켜져 있어도 조회 경로(REST·Lambda 함수 모두)는
 * 방문자 요청 때 절대 제공처로 요청하지 않는다. 제공처는 정상 페이지를 내려 주도록 미끼로 세워 두고 요청 수 0을 확인한다.
 * 제공처에 요청하는 것은 수집 함수(qtCollect)뿐이다.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT, properties = {
        "qt.storage.table-name=qt-table",
        "qt.acquisition.enabled=true",
        "qt.collector.enabled=enabled"
})
@Import(DeployedQueryNeverFetchesTest.TestBeans.class)
class DeployedQueryNeverFetchesTest {

    private static final LocalDate TODAY = LocalDate.of(2026, 9, 24);
    private static final MockUpstream UPSTREAM = MockUpstream.start();
    private static final FakeDynamoDb FAKE = new FakeDynamoDb();
    private static final JsonMapper JSON = JsonMapper.builder().build();

    static {
        // 배포 모드 컨텍스트가 DynamoDB 클라이언트를 만들 때 필요한 리전(네트워크 호출 없음)
        System.setProperty("aws.region", "ap-northeast-2");
    }

    @TestConfiguration
    static class TestBeans {
        @Bean
        @Primary
        Clock fixedClock() {
            return Clock.fixed(Instant.parse("2026-09-24T01:00:00Z"), ZoneOffset.UTC);
        }

        @Bean
        @Primary
        QtDayStore fakeBackedStore() {
            return new DynamoDbQtDayStore(FAKE.client(), "qt-table", Duration.ofDays(400));
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

    @Autowired
    QtDayStore store; // @Primary = FakeDynamoDb 기반

    @BeforeAll
    static void bait() {
        // 제공처가 정상 페이지를 주는 상황: 조회가 요청했다면 RANGE_CONFIRMED가 나왔을 것이다
        UPSTREAM.on("GET", "/bible/today", Reply.html(Fixtures.maeilPage(TODAY, "요한복음(John) 3:1 - 3:21")));
        UPSTREAM.on("GET", "/qt/view/bible.asp", Reply.eucKrHtml(Fixtures.durannoPage(TODAY, "역대상  14 : 1~17")));
    }

    @AfterAll
    static void stop() {
        UPSTREAM.close();
    }

    @BeforeEach
    void reset() {
        FAKE.clear();
        UPSTREAM.clearRequests();
    }

    private JsonNode rest() throws Exception {
        HttpResponse<String> r = HttpClient.newHttpClient().send(
                HttpRequest.newBuilder(URI.create("http://localhost:" + port + "/api/qt/today")).build(),
                HttpResponse.BodyHandlers.ofString());
        assertThat(r.statusCode()).isEqualTo(200);
        return JSON.readTree(r.body());
    }

    private JsonNode lambda() throws Exception {
        APIGatewayV2HTTPEvent event;
        try (var in = getClass().getResourceAsStream("/lambda-events/get-today.json")) {
            event = JSON.readValue(new String(in.readAllBytes(), StandardCharsets.UTF_8), APIGatewayV2HTTPEvent.class);
        }
        APIGatewayV2HTTPResponse response = qtToday.apply(event);
        assertThat(response.getStatusCode()).isEqualTo(200);
        return JSON.readTree(response.getBody());
    }

    @Test
    void whenNothingIsCollectedYetBothQueryPathsReportItAndNeverRequestTheProviders() throws Exception {
        for (JsonNode root : List.of(rest(), lambda(), rest(), lambda())) {
            for (JsonNode p : root.get("providers")) {
                assertThat(p.get("availabilityStatus").asString()).isEqualTo("RANGE_UNAVAILABLE");
                assertThat(p.get("reasonCode").asString()).isEqualTo("NOT_COLLECTED_YET");
                assertThat(p.get("passage").isNull()).isTrue();
            }
        }
        assertThat(UPSTREAM.requests()).isEmpty();
    }

    @Test
    void whenCollectedBothQueryPathsServeTheStoredItemWithoutRequestingTheProviders() throws Exception {
        store.save(new StoredDay(ProviderId.MAEIL_SEONGYEONG, TODAY,
                List.of(new BibleRange("JHN", new ChapterVerse(3, 1), new ChapterVerse(3, 21))),
                "요한복음 3:1 - 3:21", Instant.parse("2026-09-24T00:30:00Z"), "maeil-seongyeong-adapter/1"));

        for (JsonNode root : List.of(rest(), lambda())) {
            JsonNode maeil = root.get("providers").get(0);
            assertThat(maeil.get("availabilityStatus").asString()).isEqualTo("RANGE_CONFIRMED");
            assertThat(maeil.get("verifiedAt").asString()).isEqualTo("2026-09-24T00:30:00Z");
            assertThat(root.get("providers").get(1).get("reasonCode").asString()).isEqualTo("NOT_COLLECTED_YET");
        }
        assertThat(UPSTREAM.requests()).isEmpty();
    }
}
