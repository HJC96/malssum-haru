package kr.malssumharu.qt.lambda;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

import com.amazonaws.services.lambda.runtime.Context;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.lang.reflect.Proxy;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import kr.malssumharu.qt.QtApplication;
import kr.malssumharu.qt.support.Fixtures;
import kr.malssumharu.qt.support.MockUpstream;
import kr.malssumharu.qt.support.MockUpstream.Reply;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/**
 * 배포 핸들러({@link QtLambdaHandler}, Spring Cloud Function FunctionInvoker)를 스트림으로 직접 호출한다.
 * 인터넷·AWS 없이 이벤트 JSON 픽스처 → 응답 JSON. 취득 플래그 off/on 모두 확인한다.
 * 이 테스트의 시계는 실제 시계이므로 서울 자정 직전·직후에는 건너뛴다.
 */
class QtLambdaHandlerTest {

    private static final ZoneId SEOUL = ZoneId.of("Asia/Seoul");
    private static final JsonMapper JSON = JsonMapper.builder().build();
    private static MockUpstream upstream;

    @BeforeAll
    static void startUpstream() {
        upstream = MockUpstream.start();
    }

    @AfterAll
    static void stopUpstream() {
        upstream.close();
    }

    @BeforeEach
    void props() {
        System.setProperty("MAIN_CLASS", QtApplication.class.getName());
        System.setProperty("qt.providers.maeil-seongyeong.fetch-origin", upstream.origin());
        System.setProperty("qt.providers.saengmyeong-ui-sam.fetch-origin", upstream.origin());
        upstream.clear();
        LocalDate today = LocalDate.now(SEOUL);
        upstream.on("GET", "/bible/today", Reply.html(Fixtures.maeilPage(today, "요한복음(John) 3:1 - 3:21")));
        upstream.on("GET", "/qt/view/bible.asp", Reply.eucKrHtml(Fixtures.durannoPage(today, "역대상  14 : 1~17")));
    }

    @AfterEach
    void clearProps() {
        System.clearProperty("qt.acquisition.enabled");
        System.clearProperty("qt.providers.maeil-seongyeong.fetch-origin");
        System.clearProperty("qt.providers.saengmyeong-ui-sam.fetch-origin");
    }

    private static void assumeNotNearSeoulMidnight() {
        Instant now = Instant.now();
        LocalTime t = now.atZone(SEOUL).toLocalTime();
        long secondsToMidnight = Duration.between(t, LocalTime.MAX).toSeconds();
        assumeTrue(secondsToMidnight > 60 && t.toSecondOfDay() > 60, "too close to Seoul midnight");
    }

    private static Context nullContext() {
        return (Context) Proxy.newProxyInstance(
                Context.class.getClassLoader(), new Class<?>[] {Context.class}, (proxy, method, args) -> {
                    Class<?> r = method.getReturnType();
                    if (r == int.class) return 512;
                    if (r == long.class) return 0L;
                    if (r == String.class) return "test";
                    return null;
                });
    }

    private static JsonNode invoke(String fixture) throws Exception {
        byte[] event;
        try (var in = QtLambdaHandlerTest.class.getResourceAsStream("/lambda-events/" + fixture)) {
            event = in.readAllBytes();
        }
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        new QtLambdaHandler().handleRequest(new ByteArrayInputStream(event), out, nullContext());
        return JSON.readTree(out.toString(StandardCharsets.UTF_8));
    }

    @Test
    void withAcquisitionOnTheHandlerReturnsTheContractJsonForBothProviders() throws Exception {
        assumeNotNearSeoulMidnight();
        System.setProperty("qt.acquisition.enabled", "true");

        JsonNode response = invoke("get-today.json");

        assertThat(response.get("statusCode").asInt()).isEqualTo(200);
        JsonNode body = JSON.readTree(response.get("body").asString());
        assertThat(body.get("schemaVersion").asString()).isEqualTo("1");
        assertThat(body.get("providers")).hasSize(2);
        assertThat(body.get("providers").get(0).get("providerId").asString()).isEqualTo("maeil-seongyeong");
        assertThat(body.get("providers").get(0).get("availabilityStatus").asString()).isEqualTo("RANGE_CONFIRMED");
        assertThat(body.get("providers").get(0).get("passage").get("ranges").get(0).get("bookId").asString()).isEqualTo("JHN");
        assertThat(body.get("providers").get(1).get("availabilityStatus").asString()).isEqualTo("RANGE_CONFIRMED");
        assertThat(body.get("providers").get(1).get("passage").get("ranges").get(0).get("bookId").asString()).isEqualTo("1CH");
        assertThat(upstream.countRequests("GET")).isEqualTo(2);
    }

    @Test
    void withAcquisitionOffTheHandlerReturnsNotPermittedAndNeverContactsProviders() throws Exception {
        System.setProperty("qt.acquisition.enabled", "false");

        JsonNode response = invoke("get-today.json");

        assertThat(response.get("statusCode").asInt()).isEqualTo(200);
        JsonNode body = JSON.readTree(response.get("body").asString());
        for (JsonNode p : body.get("providers")) {
            assertThat(p.get("availabilityStatus").asString()).isEqualTo("RANGE_NOT_PERMITTED");
            assertThat(p.get("reasonCode").asString()).isEqualTo("PERMISSION_UNCONFIRMED");
            assertThat(p.get("passage").isNull()).isTrue();
            assertThat(p.get("officialUrl").asString()).startsWith("https://");
        }
        assertThat(upstream.requests()).isEmpty();
    }

    @Test
    void defaultConfigurationWithoutAnyPropertyIsAcquisitionOff() throws Exception {
        JsonNode body = JSON.readTree(invoke("get-today.json").get("body").asString());

        assertThat(body.get("providers").get(0).get("availabilityStatus").asString()).isEqualTo("RANGE_NOT_PERMITTED");
        assertThat(upstream.requests()).isEmpty();
    }

    @Test
    void unsupportedMethodAndPathGetHttpErrorsThroughTheHandler() throws Exception {
        assertThat(invoke("post-today.json").get("statusCode").asInt()).isEqualTo(405);
        assertThat(invoke("get-other.json").get("statusCode").asInt()).isEqualTo(404);
    }
}
