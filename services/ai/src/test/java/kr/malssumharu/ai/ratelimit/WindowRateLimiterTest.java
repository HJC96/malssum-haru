package kr.malssumharu.ai.ratelimit;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Duration;
import java.time.Instant;
import org.junit.jupiter.api.Test;

class WindowRateLimiterTest {
    @Test void enforcesIndependentFixedWindowsByOperationAndClient() {
        WindowRateLimiter limiter = new WindowRateLimiter(2, Duration.ofMinutes(1));
        Instant start = Instant.parse("2026-09-25T00:00:00Z");
        assertThat(limiter.allow("generation", "client-a", start)).isTrue();
        assertThat(limiter.allow("generation", "client-a", start.plusSeconds(2))).isTrue();
        assertThat(limiter.allow("generation", "client-a", start.plusSeconds(3))).isFalse();
        assertThat(limiter.allow("generation", "client-b", start.plusSeconds(3))).isTrue();
        assertThat(limiter.allow("report", "client-a", start.plusSeconds(3))).isTrue();
        assertThat(limiter.allow("generation", "client-a", start.plusSeconds(60))).isTrue();
    }

    @Test void zeroLimitFailsClosed() {
        assertThat(new WindowRateLimiter(0, Duration.ofMinutes(1))
                .allow("generation", "client", Instant.EPOCH)).isFalse();
    }
}
