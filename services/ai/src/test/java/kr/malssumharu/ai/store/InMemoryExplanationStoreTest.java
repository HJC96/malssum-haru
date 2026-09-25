package kr.malssumharu.ai.store;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import kr.malssumharu.ai.domain.ExplanationStatus;
import kr.malssumharu.ai.domain.ReasonCode;
import kr.malssumharu.ai.domain.VerseRef;
import kr.malssumharu.ai.explain.ExplanationContent;
import org.junit.jupiter.api.Test;

class InMemoryExplanationStoreTest {
    private static final Instant NOW = Instant.parse("2026-09-25T00:00:00Z");
    private static final String KEY = "a".repeat(64);

    @Test void onlyOneConcurrentCallerClaimsGeneration() throws Exception {
        InMemoryExplanationStore store = new InMemoryExplanationStore();
        int count = 24;
        var pool = Executors.newFixedThreadPool(count);
        var gate = new CountDownLatch(1);
        var ready = new CountDownLatch(count);
        var claims = new AtomicInteger();
        for (int i = 0; i < count; i++) {
            pool.submit(() -> {
                ready.countDown();
                try { gate.await(); } catch (InterruptedException e) { Thread.currentThread().interrupt(); return; }
                if (store.claim(KEY, NOW, Duration.ofSeconds(30)).isPresent()) claims.incrementAndGet();
            });
        }
        assertThat(ready.await(5, TimeUnit.SECONDS)).isTrue();
        gate.countDown();
        pool.shutdown();
        assertThat(pool.awaitTermination(5, TimeUnit.SECONDS)).isTrue();
        assertThat(claims.get()).isEqualTo(1);
    }

    @Test void reportsHideAtThresholdAndRevisionsAreMonotonic() {
        InMemoryExplanationStore store = new InMemoryExplanationStore();
        String token = store.claim(KEY, NOW, Duration.ofSeconds(30)).orElseThrow();
        store.available(KEY, token, content("first"), NOW, "mock", "p1");
        assertThat(store.find(KEY).orElseThrow().revision()).isEqualTo(1);
        assertThat(store.report(KEY, 1, true, 2, NOW.plusSeconds(1))).isEqualTo(ExplanationStatus.AVAILABLE);
        assertThat(store.report(KEY, 1, true, 2, NOW.plusSeconds(2))).isEqualTo(ExplanationStatus.IN_REVIEW);
        assertThat(store.find(KEY).orElseThrow().content()).isNotNull();
        assertThat(store.claim(KEY, NOW.plusSeconds(3), Duration.ofSeconds(30))).isEmpty();
        assertThat(store.replace(KEY, 1, content("edited"), NOW.plusSeconds(4), "operator", "p1")).isTrue();
        assertThat(store.find(KEY).orElseThrow().revision()).isEqualTo(2);
        assertThat(store.invalidate(KEY)).isTrue();
        String regenerationToken = store.claim(KEY, NOW.plusSeconds(5), Duration.ofSeconds(30)).orElseThrow();
        store.available(KEY, regenerationToken, content("regenerated"), NOW.plusSeconds(6), "mock", "p1");
        assertThat(store.find(KEY).orElseThrow().revision()).isEqualTo(3);
    }

    @Test void failureBackoffAndExpiredLeaseAreRespected() {
        InMemoryExplanationStore store = new InMemoryExplanationStore();
        String initial = store.claim(KEY, NOW, Duration.ofSeconds(5)).orElseThrow();
        assertThat(store.claim(KEY, NOW.plusSeconds(1), Duration.ofSeconds(5))).isEmpty();
        store.failed(KEY, initial, ReasonCode.LLM_ERROR, NOW.plusSeconds(2), NOW.plusSeconds(8));
        assertThat(store.claim(KEY, NOW.plusSeconds(7), Duration.ofSeconds(5))).isEmpty();
        String retry = store.claim(KEY, NOW.plusSeconds(9), Duration.ofSeconds(5)).orElseThrow();
        assertThat(store.available(KEY, initial, content("late"), NOW.plusSeconds(10), "mock", "p1")).isFalse();
        assertThat(store.find(KEY).orElseThrow().claimToken()).isEqualTo(retry);
    }

    private static ExplanationContent content(String text) {
        return new ExplanationContent(text, "Context overview", List.of(new ExplanationContent.KeyPoint(text,
                List.of(new VerseRef("GEN", 1, 1)))), List.of("Reflect on the passage"), List.of());
    }
}
