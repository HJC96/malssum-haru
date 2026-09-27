package kr.malssumharu.dailycontent.publish;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.LocalDate;
import java.util.List;
import kr.malssumharu.dailycontent.catalog.CandidateCatalog;
import org.junit.jupiter.api.Test;

class DailyContentPublisherTest {
    private final ObjectMapper mapper = new ObjectMapper().registerModule(new JavaTimeModule());

    @Test
    void rendersStableV1PayloadWithExactlyOneApprovedPassagePerTestament() throws Exception {
        var publisher = new DailyContentPublisher(catalog(), mapper);
        var request = new PublishRequest(LocalDate.parse("2026-10-01"));

        var first = publisher.render(request);
        var second = publisher.render(request);
        JsonNode json = mapper.readTree(first.json());

        assertThat(first.json()).isEqualTo(second.json());
        assertThat(json.fieldNames()).toIterable().containsExactlyInAnyOrder(
                "schemaVersion", "date", "timeZone", "contentVersion", "oldTestament", "newTestament");
        assertThat(json.path("schemaVersion").asText()).isEqualTo("1");
        assertThat(json.path("date").asText()).isEqualTo("2026-10-01");
        assertThat(json.path("timeZone").asText()).isEqualTo("Asia/Seoul");
        assertThat(json.path("contentVersion").asText()).matches("daily-word-2026-10-01-[a-f0-9]{16}");
        assertThat(json.path("oldTestament").path("reference").path("bookId").asText()).isEqualTo("PSA");
        assertThat(json.path("newTestament").path("reference").path("bookId").asText()).isEqualTo("JHN");
        assertThat(json.path("oldTestament").path("explanation").path("kind").asText()).isEqualTo("editorial");
        assertThat(json.path("newTestament").path("source").path("url").asText()).startsWith("https://");
    }

    @Test
    void failsIfEitherTestamentHasNoRightsApprovedCandidates() throws Exception {
        var unapproved = catalog().candidates().stream().map(candidate -> new CandidateCatalog.Candidate(
                candidate.id(), candidate.testament(), candidate.reference(), candidate.text(), candidate.explanation(),
                candidate.source(), new CandidateCatalog.Approval(CandidateCatalog.ReviewStatus.approved,
                        CandidateCatalog.ReviewStatus.approved, CandidateCatalog.ReviewStatus.pending,
                        "editor", LocalDate.parse("2026-09-27"), "https://example.test/rights", "pending rights"))).toList();
        var publisher = new DailyContentPublisher(
                new CandidateCatalog("test-v1", "kor-rv-1961", "ko", unapproved), mapper);

        assertThatThrownBy(() -> publisher.render(new PublishRequest(LocalDate.parse("2026-10-01"))))
                .hasMessageContaining("No approved candidates available");
    }

    @Test
    void requiresExplicitTargetDate() throws Exception {
        var publisher = new DailyContentPublisher(catalog(), mapper);
        assertThatThrownBy(() -> publisher.render(new PublishRequest(null))).hasMessageContaining("targetDate is required");
    }

    private CandidateCatalog catalog() throws Exception {
        return new CandidateCatalog("test-pool-v1", "kor-rv-1961", "ko", List.of(
                candidate("psa", CandidateCatalog.Testament.oldTestament, "PSA", "여호와는 나의 목자시니"),
                candidate("jhn", CandidateCatalog.Testament.newTestament, "JHN", "하나님이 세상을 사랑하사")));
    }

    private CandidateCatalog.Candidate candidate(String id, CandidateCatalog.Testament testament,
            String book, String text) throws Exception {
        var approval = new CandidateCatalog.Approval(CandidateCatalog.ReviewStatus.approved,
                CandidateCatalog.ReviewStatus.approved, CandidateCatalog.ReviewStatus.approved,
                "test-reviewer", LocalDate.parse("2026-09-27"), "https://example.test/rights", "test approval");
        return new CandidateCatalog.Candidate(id, testament,
                new CandidateCatalog.Reference(book, 1, 1), text,
                new CandidateCatalog.Explanation("설명", "editorial", "ko"),
                new CandidateCatalog.Source("Test source", "https://example.test/source", sha256(text)), approval);
    }

    private String sha256(String value) throws Exception {
        return java.util.HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                .digest(value.getBytes(StandardCharsets.UTF_8)));
    }
}
