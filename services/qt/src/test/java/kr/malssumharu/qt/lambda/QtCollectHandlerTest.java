package kr.malssumharu.qt.lambda;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

import com.amazonaws.services.lambda.runtime.Context;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.lang.reflect.Proxy;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
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
 * 수집 Lambda 핸들러({@link QtCollectHandler})를 스케줄 이벤트 {"trigger":"schedule"}로 직접 호출한다.
 * 저장소는 로컬 기본(메모리)이라 저장 결과가 아닌 출력 코드와 제공처 요청 수를 확인한다. 실제 시계 사용: 서울 자정 전후 60초는 건너뛴다.
 */
class QtCollectHandlerTest {

    private static final ZoneId SEOUL = ZoneId.of("Asia/Seoul");
    private static final JsonMapper JSON = JsonMapper.builder().build();
    private static MockUpstream upstream;

    @BeforeAll
    static void start() {
        upstream = MockUpstream.start();
    }

    @AfterAll
    static void stop() {
        upstream.close();
    }

    @BeforeEach
    void props() {
        LocalTime t = java.time.ZonedDateTime.now(SEOUL).toLocalTime();
        assumeTrue(Duration.between(t, LocalTime.MAX).toSeconds() > 60 && t.toSecondOfDay() > 60, "too close to Seoul midnight");
        System.setProperty("MAIN_CLASS", QtApplication.class.getName());
        System.setProperty("qt.providers.maeil-seongyeong.fetch-origin", upstream.origin());
        System.setProperty("qt.providers.saengmyeong-ui-sam.fetch-origin", upstream.origin());
        upstream.clear();
        LocalDate today = LocalDate.now(SEOUL);
        upstream.on("GET", "/bible/today", Reply.html(Fixtures.maeilPage(today, "요한복음(John) 3:1 - 3:21")));
        upstream.on("GET", "/qt/view/bible.asp", Reply.eucKrHtml(Fixtures.durannoPage(today, "역대상  14 : 1~17")));
    }

    @AfterEach
    void clear() {
        for (String k : new String[] {"qt.acquisition.enabled", "qt.collector.enabled",
                "qt.providers.maeil-seongyeong.fetch-origin", "qt.providers.saengmyeong-ui-sam.fetch-origin"}) {
            System.clearProperty(k);
        }
    }

    private static Context ctx() {
        return (Context) Proxy.newProxyInstance(Context.class.getClassLoader(), new Class<?>[] {Context.class},
                (p, m, a) -> m.getReturnType() == int.class ? 512 : m.getReturnType() == long.class ? 0L : m.getReturnType() == String.class ? "test" : null);
    }

    private static JsonNode invoke(String fixture) throws Exception {
        byte[] event;
        try (var in = QtCollectHandlerTest.class.getResourceAsStream("/lambda-events/" + fixture)) {
            event = in.readAllBytes();
        }
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        new QtCollectHandler().handleRequest(new ByteArrayInputStream(event), out, ctx());
        return JSON.readTree(out.toString(StandardCharsets.UTF_8));
    }

    @Test
    void scheduleEventCollectsBothProvidersWhenEnabled() throws Exception {
        System.setProperty("qt.acquisition.enabled", "true");
        System.setProperty("qt.collector.enabled", "enabled");

        JsonNode out = invoke("schedule.json");

        assertThat(out.get("result").asString()).isEqualTo("DONE");
        assertThat(out.get("seoulDate").asString()).isEqualTo(LocalDate.now(SEOUL).toString());
        assertThat(out.get("providers")).hasSize(2);
        assertThat(out.get("providers").get(0).get("providerId").asString()).isEqualTo("maeil-seongyeong");
        for (JsonNode p : out.get("providers")) {
            assertThat(p.get("result").asString()).isEqualTo("STORED");
        }
        assertThat(upstream.countRequests("GET")).isEqualTo(2);
        assertThat(out.toString()).doesNotContain("요한복음");
    }

    @Test
    void collectorDisabledByDefaultMakesNoProviderRequest() throws Exception {
        System.setProperty("qt.acquisition.enabled", "true");

        JsonNode out = invoke("schedule.json");

        for (JsonNode p : out.get("providers")) {
            assertThat(p.get("result").asString()).isEqualTo("SKIPPED_COLLECTOR_DISABLED");
        }
        assertThat(upstream.requests()).isEmpty();
    }

    @Test
    void acquisitionOffMakesNoProviderRequestEvenIfCollectorIsEnabled() throws Exception {
        System.setProperty("qt.collector.enabled", "enabled");

        JsonNode out = invoke("schedule.json");

        for (JsonNode p : out.get("providers")) {
            assertThat(p.get("result").asString()).isEqualTo("SKIPPED_ACQUISITION_OFF");
        }
        assertThat(upstream.requests()).isEmpty();
    }

    @Test
    void anythingOtherThanTheScheduleTriggerIsIgnored() throws Exception {
        System.setProperty("qt.acquisition.enabled", "true");
        System.setProperty("qt.collector.enabled", "enabled");

        JsonNode out = invoke("get-today.json"); // API Gateway 이벤트를 잘못 연결한 경우

        // Spring Cloud Function은 API Gateway 형태의 입력에 응답도 API Gateway 형태(body 문자열)로 감싼다
        JsonNode result = out.has("body") ? JSON.readTree(out.get("body").asString()) : out;
        assertThat(result.get("result").asString()).isEqualTo("IGNORED");
        assertThat(upstream.requests()).isEmpty();
    }
}
