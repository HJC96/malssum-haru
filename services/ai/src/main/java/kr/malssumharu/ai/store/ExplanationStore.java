package kr.malssumharu.ai.store;

import java.time.Duration;
import java.time.Instant;
import java.util.Optional;
import kr.malssumharu.ai.domain.ExplanationStatus;
import kr.malssumharu.ai.domain.ReasonCode;
import kr.malssumharu.ai.explain.ExplanationContent;

public interface ExplanationStore {
    Optional<ExplanationRecord> find(String key);
    Optional<String> claim(String key, Instant now, Duration lease);
    boolean available(String key, String claimToken, ExplanationContent content, Instant now, String modelId, String policyVersion);
    boolean failed(String key, String claimToken, ReasonCode reason, Instant now, Instant retryAt);
    ExplanationStatus report(String key, int revision, boolean severe, int threshold, Instant now);
    boolean hide(String key, Instant now);
    boolean replace(String key, int expectedRevision, ExplanationContent content, Instant now, String modelId, String policyVersion);
    boolean invalidate(String key);
}
