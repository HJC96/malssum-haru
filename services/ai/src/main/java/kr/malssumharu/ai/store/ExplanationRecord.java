package kr.malssumharu.ai.store;

import java.time.Instant;
import kr.malssumharu.ai.domain.ExplanationStatus;
import kr.malssumharu.ai.domain.ReasonCode;
import kr.malssumharu.ai.explain.ExplanationContent;

public record ExplanationRecord(
        String cacheKey,
        ExplanationStatus status,
        ExplanationContent content,
        ReasonCode reasonCode,
        int revision,
        Instant updatedAt,
        Instant retryAt,
        Instant leaseUntil,
        String claimToken,
        String modelId,
        String policyVersion,
        int severeReports) {
}
