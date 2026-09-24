package kr.malssumharu.qt.config;

import java.time.Clock;
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
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class QtConfig {

    @Bean
    Clock clock() {
        return Clock.systemUTC();
    }

    @Bean
    VerseCountTable verseCountTable() {
        // 66권 절 수 표가 확정되기 전에는 장 전체만 표기한 날을 추정하지 않는다
        return VerseCountTable.NONE;
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
