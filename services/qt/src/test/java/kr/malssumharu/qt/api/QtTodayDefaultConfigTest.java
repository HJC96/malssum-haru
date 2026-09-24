package kr.malssumharu.qt.api;

import static org.assertj.core.api.Assertions.assertThat;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import org.junit.jupiter.api.Test;
import kr.malssumharu.qt.bible.ResourceVerseCountTable;
import kr.malssumharu.qt.bible.VerseCountTable;
import kr.malssumharu.qt.config.QtProperties;
import kr.malssumharu.qt.domain.ProviderId;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.context.SpringBootTest;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/** 기본 설정(취득 플래그 off): 공개 배포와 같은 상태에서는 제공처에 요청하지 않고 공식 링크만 나간다. */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class QtTodayDefaultConfigTest {

    @Value("${local.server.port}")
    int port;

    @Autowired
    QtProperties props;

    @Autowired
    VerseCountTable verseCounts;

    @Test
    void theApplicationUsesTheGeneratedVerseCountTable() {
        assertThat(verseCounts).isInstanceOf(ResourceVerseCountTable.class);
        assertThat(((ResourceVerseCountTable) verseCounts).versificationSystem()).isEqualTo("nkrv-provisional-1");
    }

    /** 취득 플래그가 실수로 켜져도 테스트가 실제 제공처로 요청하지 않도록 test 설정이 요청 대상을 죽은 로컬 주소로 고정한다(F-12). */
    @Test
    void testContextsNeverPointAtTheRealProviders() {
        for (ProviderId id : ProviderId.values()) {
            assertThat(props.fetchOrigin(id, "https://real.example")).startsWith("http://127.0.0.1:");
        }
        assertThat(props.acquisitionEnabled(ProviderId.MAEIL_SEONGYEONG)).isFalse();
    }

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
