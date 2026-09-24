package kr.malssumharu.qt.config;

import static org.assertj.core.api.Assertions.assertThat;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import kr.malssumharu.qt.service.DynamoDbQtDayStore;
import kr.malssumharu.qt.service.InMemoryQtDayStore;
import kr.malssumharu.qt.service.QtDayStore;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.context.SpringBootTest;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/** 배포 환경 변수 이름(QT_*)이 설정으로 매핑되는지, 저장소 선택이 QT_TABLE_NAME으로 갈리는지. AWS에는 접속하지 않는다. */
class QtConfigWiringTest {

    @Test
    void withoutTableNameTheStoreIsInMemory() {
        QtProperties props = new QtProperties(new QtProperties.Acquisition(false),
                new QtProperties.Http(null, null, null, "ua", 1), new QtProperties.Cache(null, null), java.util.Map.of());

        assertThat(new QtConfig().qtDayStore(props)).isInstanceOf(InMemoryQtDayStore.class);
    }

    @Test
    void withTableNameTheStoreIsDynamoDbAndBuildingItMakesNoNetworkCall() throws Exception {
        String old = System.getProperty("aws.region");
        System.setProperty("aws.region", "ap-northeast-2");
        try {
            QtProperties props = new QtProperties(new QtProperties.Acquisition(false),
                    new QtProperties.Http(null, null, null, "ua", 1), new QtProperties.Cache(null, null),
                    new QtProperties.Storage("qt-table", 400), new QtProperties.Collector("enabled"), java.util.Map.of());

            QtDayStore store = new QtConfig().qtDayStore(props);

            assertThat(store).isInstanceOf(DynamoDbQtDayStore.class);
            ((DynamoDbQtDayStore) store).close();
        } finally {
            if (old == null) {
                System.clearProperty("aws.region");
            } else {
                System.setProperty("aws.region", old);
            }
        }
    }
}
