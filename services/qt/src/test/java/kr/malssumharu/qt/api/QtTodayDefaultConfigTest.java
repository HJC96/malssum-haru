package kr.malssumharu.qt.api;

import static org.assertj.core.api.Assertions.assertThat;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.context.SpringBootTest;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/** 기본 설정(취득 플래그 off): 공개 배포와 같은 상태에서는 제공처에 요청하지 않고 공식 링크만 나간다. */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class QtTodayDefaultConfigTest {

    @Value("${local.server.port}")
    int port;

    @Test
    void defaultsToNotPermittedWithOfficialLinksOnly() throws Exception {
        HttpResponse<String> response = HttpClient.newHttpClient().send(
                HttpRequest.newBuilder(URI.create("http://localhost:" + port + "/api/qt/today")).build(),
                HttpResponse.BodyHandlers.ofString());

        assertThat(response.statusCode()).isEqualTo(200);
        JsonNode root = JsonMapper.builder().build().readTree(response.body());
        assertThat(root.get("providers")).hasSize(2);
        for (JsonNode p : root.get("providers")) {
            assertThat(p.get("availabilityStatus").asString()).isEqualTo("RANGE_NOT_PERMITTED");
            assertThat(p.get("reasonCode").asString()).isEqualTo("PERMISSION_UNCONFIRMED");
            assertThat(p.get("passage").isNull()).isTrue();
            assertThat(p.get("officialUrl").asString()).startsWith("https://");
        }
    }
}
