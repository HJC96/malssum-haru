package kr.malssumharu.ai.ratelimit;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Duration;
import java.time.Instant;
import java.util.HexFormat;
import java.util.concurrent.ConcurrentHashMap;

/** Fixed-window, process-local limiter. Only a one-way client digest is retained in memory. */
public final class WindowRateLimiter {
    private final int limit;
    private final Duration window;
    private final ConcurrentHashMap<String, Bucket> buckets = new ConcurrentHashMap<>();

    public WindowRateLimiter(int limit, Duration window) {
        this.limit = Math.max(0, limit);
        this.window = window.isNegative() || window.isZero() ? Duration.ofMinutes(1) : window;
    }

    public boolean allow(String operation, String clientIdentity, Instant now) {
        if (limit == 0) return false;
        String key = operation + ":" + digest(clientIdentity == null ? "unknown" : clientIdentity);
        final boolean[] allowed = {false};
        buckets.compute(key, (ignored, previous) -> {
            if (previous == null || !now.isBefore(previous.startedAt.plus(window))) {
                allowed[0] = true;
                return new Bucket(now, 1);
            }
            if (previous.count >= limit) return previous;
            allowed[0] = true;
            return new Bucket(previous.startedAt, previous.count + 1);
        });
        if (buckets.size() > 10_000) buckets.entrySet().removeIf(e -> !now.isBefore(e.getValue().startedAt.plus(window)));
        return allowed[0];
    }

    private static String digest(String value) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }

    private record Bucket(Instant startedAt, int count) { }
}
