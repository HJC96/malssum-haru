package kr.malssumharu.qt.config;

import static org.assertj.core.api.Assertions.assertThat;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.context.SpringBootTest;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/** IaC가 넣는 환경 변수 이름: QT_COLLECTOR_ENABLED, QT_PROVIDER_MAEIL_SEONGYEONG, QT_ITEM_TTL_DAYS. */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT, properties = {
        "QT_COLLECTOR_ENABLED=enabled",
        "QT_PROVIDER_MAEIL_SEONGYEONG=disabled",
        "QT_ITEM_TTL_DAYS=30"
})
class DeploymentEnvironmentNamesTest {

    @Autowired
    QtProperties props;

    @Value("${local.server.port}")
    int port;

    @Test
    void environmentVariableNamesMapToSettings() {
        assertThat(props.collector().isEnabled()).isTrue();
        assertThat(props.storage().itemTtlDays()).isEqualTo(30);
        assertThat(props.storage().deployed()).isFalse();
        assertThat(props.disabled(kr.malssumharu.qt.domain.ProviderId.MAEIL_SEONGYEONG)).isTrue();
        assertThat(props.disabled(kr.malssumharu.qt.domain.ProviderId.SAENGMYEONG_UI_SAM)).isFalse();
    }

    @Test
    void disabledProviderShowsDisabledInTheApiWhileTheOtherFollowsTheAcquisitionFlag() throws Exception {
        HttpResponse<String> response = HttpClient.newHttpClient().send(
                HttpRequest.newBuilder(URI.create("http://localhost:" + port + "/api/qt/today")).build(),
                HttpResponse.BodyHandlers.ofString());

        JsonNode root = JsonMapper.builder().build().readTree(response.body());
        assertThat(root.get("providers").get(0).get("availabilityStatus").asString()).isEqualTo("DISABLED");
        assertThat(root.get("providers").get(0).get("reasonCode").asString()).isEqualTo("OPERATOR_DISABLED");
        assertThat(root.get("providers").get(1).get("availabilityStatus").asString()).isEqualTo("RANGE_NOT_PERMITTED");
        assertThat(response.headers().firstValue("Cache-Control")).contains("public, max-age=60");
    }
}
