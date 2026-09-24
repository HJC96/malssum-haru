package kr.malssumharu.qt.http;

import java.io.IOException;
import java.io.InputStream;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.net.http.HttpTimeoutException;
import java.time.Duration;

public class JdkHttpFetcher implements HttpFetcher {

    private final HttpClient client;
    private final Duration requestTimeout;
    private final String userAgent;
    private final int maxBodyBytes;

    public JdkHttpFetcher(Duration connectTimeout, Duration requestTimeout, String userAgent, int maxBodyBytes) {
        this.client = HttpClient.newBuilder()
                .connectTimeout(connectTimeout)
                .followRedirects(HttpClient.Redirect.NORMAL)
                .build();
        this.requestTimeout = requestTimeout;
        this.userAgent = userAgent;
        this.maxBodyBytes = maxBodyBytes;
    }

    @Override
    public FetchResponse get(URI uri) throws FetchException {
        return send(base(uri).GET().build());
    }

    @Override
    public FetchResponse postJson(URI uri, String jsonBody) throws FetchException {
        return send(base(uri)
                .header("Content-Type", "application/json; charset=utf-8")
                .POST(HttpRequest.BodyPublishers.ofString(jsonBody))
                .build());
    }

    private HttpRequest.Builder base(URI uri) {
        return HttpRequest.newBuilder(uri)
                .timeout(requestTimeout)
                .header("User-Agent", userAgent)
                .header("Accept-Language", "ko");
    }

    private FetchResponse send(HttpRequest request) throws FetchException {
        try {
            HttpResponse<InputStream> response = client.send(request, HttpResponse.BodyHandlers.ofInputStream());
            try (InputStream in = response.body()) {
                byte[] body = in.readNBytes(maxBodyBytes + 1);
                if (body.length > maxBodyBytes) {
                    throw new FetchException(FetchException.Kind.TOO_LARGE, "response too large", null);
                }
                return new FetchResponse(
                        response.statusCode(), body, response.headers().firstValue("Content-Type").orElse(null));
            }
        } catch (HttpTimeoutException e) {
            throw new FetchException(FetchException.Kind.TIMEOUT, "upstream timeout", e);
        } catch (IOException e) {
            // 요청 타임아웃이 본문 읽기 중에 발생하면 IOException으로 감싸져 올 수 있다
            Throwable cause = e.getCause();
            if (cause instanceof HttpTimeoutException || e instanceof java.net.SocketTimeoutException) {
                throw new FetchException(FetchException.Kind.TIMEOUT, "upstream timeout", e);
            }
            throw new FetchException(FetchException.Kind.UNREACHABLE, "upstream unreachable", e);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new FetchException(FetchException.Kind.UNREACHABLE, "interrupted", e);
        }
    }
}
