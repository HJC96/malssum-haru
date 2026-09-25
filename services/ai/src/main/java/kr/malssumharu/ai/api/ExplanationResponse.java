package kr.malssumharu.ai.api;

import java.time.Instant;
import java.util.List;
import kr.malssumharu.ai.domain.ExplanationStatus;
import kr.malssumharu.ai.domain.ReasonCode;
import kr.malssumharu.ai.domain.VerseRange;
import kr.malssumharu.ai.explain.ExplanationContent;

public record ExplanationResponse(
        String schemaVersion,
        String providerId,
        String providerDate,
        String lang,
        ExplanationStatus status,
        ReasonCode reasonCode,
        Passage passage,
        SourceTranslation sourceTranslation,
        ExplanationContent content,
        Meta meta,
        ReportPath report) {

    public record Passage(List<Range> ranges) {
        public Passage { ranges = List.copyOf(ranges); }
    }

    public record Range(String bookId, Point start, Point end) { }
    public record Point(int chapter, int verse) { }

    public record SourceTranslation(String id, String name, String license, String language) { }

    public record Meta(boolean aiGenerated, int revision, Instant updatedAt, String modelId,
                       String policyVersion, String cacheKey) { }

    public record ReportPath(String path) { }
}
