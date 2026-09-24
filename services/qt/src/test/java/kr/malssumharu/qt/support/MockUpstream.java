package kr.malssumharu.qt.support;

import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.Executors;

/** 제공처를 흉내 내는 로컬 HTTP 서버. 인터넷에 의존하지 않는다. */
public final class MockUpstream implements AutoCloseable {

    public record Reply(int status, String contentType, byte[] body, long delayMillis) {
        public static Reply ok(String contentType, byte[] body) {
            return new Reply(200, contentType, body, 0);
        }

        public static Reply html(String html) {
            return ok("text/html; charset=utf-8", html.getBytes(StandardCharsets.UTF_8));
        }

        public static Reply eucKrHtml(String html) {
            return ok("text/html;charset=EUC-KR; Charset=EUC-KR", Fixtures.eucKr(html));
        }

        public static Reply json(String json) {
            return ok("application/json; charset=utf-8", json.getBytes(StandardCharsets.UTF_8));
        }

        public static Reply status(int status) {
            return new Reply(status, "text/plain", new byte[0], 0);
        }

        public Reply delayed(long millis) {
            return new Reply(status, contentType, body, millis);
        }
    }

    private final HttpServer server;
    private final Map<String, Reply> replies = new ConcurrentHashMap<>();
    private final List<String> requests = new CopyOnWriteArrayList<>();

    private MockUpstream(HttpServer server) {
        this.server = server;
    }

    public static MockUpstream start() {
        try {
            HttpServer server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
            MockUpstream mock = new MockUpstream(server);
            server.createContext("/", exchange -> {
                String path = exchange.getRequestURI().getRawPath();
                String query = exchange.getRequestURI().getRawQuery();
                mock.requests.add(exchange.getRequestMethod() + " " + path + (query == null ? "" : "?" + query));
                exchange.getRequestBody().readAllBytes();
                Reply reply = mock.replies.getOrDefault(exchange.getRequestMethod() + " " + path, Reply.status(404));
                if (reply.delayMillis() > 0) {
                    try {
                        Thread.sleep(reply.delayMillis());
                    } catch (InterruptedException e) {
                        Thread.currentThread().interrupt();
                    }
                }
                if (reply.contentType() != null) {
                    exchange.getResponseHeaders().add("Content-Type", reply.contentType());
                }
                exchange.sendResponseHeaders(reply.status(), reply.body().length == 0 ? -1 : reply.body().length);
                if (reply.body().length > 0) {
                    try (OutputStream out = exchange.getResponseBody()) {
                        out.write(reply.body());
                    }
                }
                exchange.close();
            });
            server.setExecutor(Executors.newCachedThreadPool());
            server.start();
            return mock;
        } catch (IOException e) {
            throw new IllegalStateException(e);
        }
    }

    public String origin() {
        return "http://127.0.0.1:" + server.getAddress().getPort();
    }

    public MockUpstream on(String method, String path, Reply reply) {
        replies.put(method + " " + path, reply);
        return this;
    }

    public void clear() {
        replies.clear();
        requests.clear();
    }

    public void clearRequests() {
        requests.clear();
    }

    /** 경로(쿼리 제외)가 prefix로 시작하는 요청 수. */
    public long countRequests(String prefix) {
        return requests.stream().filter(r -> r.startsWith(prefix)).count();
    }

    public List<String> requests() {
        return List.copyOf(requests);
    }

    @Override
    public void close() {
        server.stop(0);
        ((java.util.concurrent.ExecutorService) server.getExecutor()).shutdownNow();
    }
}
