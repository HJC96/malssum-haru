package kr.malssumharu.qt.http;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.net.URI;
import java.time.Duration;
import kr.malssumharu.qt.support.MockUpstream;
import kr.malssumharu.qt.support.MockUpstream.Reply;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

/** 응답 크기 제한·타임아웃·User-Agent. 인터넷 없이 로컬 목 서버로 확인한다. */
class JdkHttpFetcherTest {

    private MockUpstream upstream;

    @BeforeEach
    void up() {
        upstream = MockUpstream.start();
    }

    @AfterEach
    void down() {
        upstream.close();
    }

    private JdkHttpFetcher fetcher(int maxBytes, Duration requestTimeout) {
        return new JdkHttpFetcher(Duration.ofMillis(500), requestTimeout, "test-agent", maxBytes);
    }

    @Test
    void bodyAtTheLimitIsReturnedAndOneByteOverIsRefused() throws Exception {
        upstream.on("GET", "/exact", Reply.ok("text/plain", new byte[100]));
        upstream.on("GET", "/over", Reply.ok("text/plain", new byte[101]));
        var f = fetcher(100, Duration.ofSeconds(2));

        assertThat(f.get(URI.create(upstream.origin() + "/exact")).body()).hasSize(100);
        assertThatThrownBy(() -> f.get(URI.create(upstream.origin() + "/over")))
                .isInstanceOfSatisfying(FetchException.class, e -> assertThat(e.kind()).isEqualTo(FetchException.Kind.TOO_LARGE));
    }

    @Test
    void slowResponseIsATimeout() {
        upstream.on("GET", "/slow", Reply.ok("text/plain", new byte[1]).delayed(1500));

        assertThatThrownBy(() -> fetcher(100, Duration.ofMillis(200)).get(URI.create(upstream.origin() + "/slow")))
                .isInstanceOfSatisfying(FetchException.class, e -> assertThat(e.kind()).isEqualTo(FetchException.Kind.TIMEOUT));
    }

    @Test
    void connectionRefusedIsUnreachable() {
        String dead = upstream.origin();
        upstream.close();

        assertThatThrownBy(() -> fetcher(100, Duration.ofSeconds(1)).get(URI.create(dead + "/x")))
                .isInstanceOfSatisfying(FetchException.class, e -> assertThat(e.kind()).isEqualTo(FetchException.Kind.UNREACHABLE));
    }

    @Test
    void declaredCharsetIsParsedFromTheContentTypeHeader() throws Exception {
        upstream.on("GET", "/euc", Reply.ok("text/html;charset=EUC-KR; Charset=EUC-KR", new byte[] {'a'}));

        FetchResponse r = fetcher(100, Duration.ofSeconds(2)).get(URI.create(upstream.origin() + "/euc"));

        assertThat(r.declaredCharset()).isPresent();
        assertThat(r.declaredCharset().get().name()).containsIgnoringCase("euc");
    }
}
