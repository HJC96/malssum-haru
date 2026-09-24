package kr.malssumharu.qt.config;

import java.time.Clock;
import java.time.Duration;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import kr.malssumharu.qt.bible.ReferenceParser;
import kr.malssumharu.qt.bible.VerseCountTable;
import kr.malssumharu.qt.domain.ProviderId;
import kr.malssumharu.qt.http.HttpFetcher;
import kr.malssumharu.qt.http.JdkHttpFetcher;
import kr.malssumharu.qt.provider.MaeilSeongyeongAdapter;
import kr.malssumharu.qt.provider.QtProviderAdapter;
import kr.malssumharu.qt.provider.SaengmyeongUiSamAdapter;
import kr.malssumharu.qt.service.DynamoDbQtDayStore;
import kr.malssumharu.qt.service.InMemoryQtDayStore;
import kr.malssumharu.qt.service.QtDayStore;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class QtConfig {

    @Bean
    Clock clock() {
        return Clock.systemUTC();
    }

    /**
     * QT_TABLE_NAME(qt.storage.table-name)이 있으면 DynamoDB, 없으면 메모리(로컬).
     * DynamoDB 클라이언트는 URL-connection HTTP 클라이언트와 환경 변수 자격 증명(Lambda 실행 역할)만 쓴다.
     */
    @Bean
    QtDayStore qtDayStore(QtProperties props) {
        if (!props.storage().deployed()) {
            return new InMemoryQtDayStore();
        }
        var client = software.amazon.awssdk.services.dynamodb.DynamoDbClient.builder()
                .httpClientBuilder(software.amazon.awssdk.http.urlconnection.UrlConnectionHttpClient.builder()
                        .connectionTimeout(Duration.ofSeconds(2))
                        .socketTimeout(Duration.ofSeconds(4)))
                .credentialsProvider(software.amazon.awssdk.auth.credentials.EnvironmentVariableCredentialsProvider.create())
                .overrideConfiguration(o -> o.apiCallTimeout(Duration.ofSeconds(8)))
                .build();
        return new DynamoDbQtDayStore(client, props.storage().tableName(), Duration.ofDays(props.storage().itemTtlDays()));
    }

    /**
     * 66권 장·절 수 표(잠정, 개역개정 전수 미검증). services/qt/scripts/generate_verse_counts.py가 만든 리소스를 읽고,
     * 리소스가 없거나 형식이 어긋나면 시작 시 실패한다.
     */
    @Bean
    VerseCountTable verseCountTable() {
        return kr.malssumharu.qt.bible.ResourceVerseCountTable.load();
    }

    @Bean(destroyMethod = "close")
    ExecutorService qtExecutor() {
        return Executors.newVirtualThreadPerTaskExecutor();
    }

    @Bean
    HttpFetcher httpFetcher(QtProperties props) {
        QtProperties.Http http = props.http();
        return new JdkHttpFetcher(http.connectTimeout(), http.requestTimeout(), http.userAgent(), http.maxBodyBytes());
    }

    @Bean
    ReferenceParser referenceParser(VerseCountTable verseCounts) {
        return new ReferenceParser(verseCounts);
    }

    @Bean
    QtProviderAdapter maeilSeongyeongAdapter(HttpFetcher fetcher, QtProperties props, ReferenceParser parser) {
        return new MaeilSeongyeongAdapter(
                fetcher, props.fetchOrigin(ProviderId.MAEIL_SEONGYEONG, MaeilSeongyeongAdapter.DEFAULT_ORIGIN), parser);
    }

    @Bean
    QtProviderAdapter saengmyeongUiSamAdapter(HttpFetcher fetcher, QtProperties props, ReferenceParser parser) {
        return new SaengmyeongUiSamAdapter(
                fetcher, props.fetchOrigin(ProviderId.SAENGMYEONG_UI_SAM, SaengmyeongUiSamAdapter.DEFAULT_ORIGIN), parser);
    }
}
