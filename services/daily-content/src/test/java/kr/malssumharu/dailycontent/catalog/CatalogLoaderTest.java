package kr.malssumharu.dailycontent.catalog;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.security.MessageDigest;
import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class CatalogLoaderTest {
    @TempDir java.nio.file.Path tempDir;
    private final ObjectMapper mapper = new ObjectMapper().registerModule(new JavaTimeModule());

    @Test
    void bundledCatalogHasVersionedMetadataAndFailsClosedPendingHumanApproval() {
        var catalog = new CatalogLoader(mapper).loadClasspath("/catalog/candidate-catalog-v1.json");

        assertThat(catalog.catalogVersion()).isEqualTo("kor-rv-1961-pool-v1");
        assertThat(catalog.candidates()).hasSize(2);
        assertThat(catalog.candidates()).allSatisfy(candidate -> {
            assertThat(candidate.source().textSha256()).hasSize(64);
            assertThat(candidate.eligibleForPublication()).isFalse();
            assertThat(candidate.approval().rightsStatus()).isEqualTo(CandidateCatalog.ReviewStatus.pending);
        });
    }

    @Test
    void rejectsTextThatDoesNotMatchRecordedSha256() throws Exception {
        var candidate = candidate("ot-psa-1", CandidateCatalog.Testament.oldTestament,
                "PSA", "something else", approved());
        candidate = new CandidateCatalog.Candidate(candidate.id(), candidate.testament(), candidate.reference(),
                candidate.text(), candidate.explanation(),
                new CandidateCatalog.Source(candidate.source().name(), candidate.source().url(), "0".repeat(64)),
                candidate.approval());
        var path = writeCatalog(List.of(candidate));

        assertThatThrownBy(() -> new CatalogLoader(mapper).load(path))
                .hasMessageContaining("Verse text hash does not match");
    }

    @Test
    void rejectsDuplicateIdsAndTestamentMismatch() throws Exception {
        var valid = candidate("same", CandidateCatalog.Testament.oldTestament, "PSA", "text", approved());
        var duplicate = candidate("same", CandidateCatalog.Testament.newTestament, "JHN", "text two", approved());
        var duplicatePath = writeCatalog(List.of(valid, duplicate));
        assertThatThrownBy(() -> new CatalogLoader(mapper).load(duplicatePath)).hasMessageContaining("Duplicate candidate id");

        var wrongTestament = candidate("bad-book", CandidateCatalog.Testament.newTestament, "PSA", "text", approved());
        var mismatchPath = writeCatalog(List.of(wrongTestament));
        assertThatThrownBy(() -> new CatalogLoader(mapper).load(mismatchPath)).hasMessageContaining("Testament does not match");
    }

    private java.nio.file.Path writeCatalog(List<CandidateCatalog.Candidate> candidates) throws Exception {
        var catalog = new CandidateCatalog("test-v1", "kor-rv-1961", "ko", candidates);
        var path = tempDir.resolve("catalog.json");
        mapper.writeValue(path.toFile(), catalog);
        return path;
    }

    private CandidateCatalog.Candidate candidate(String id, CandidateCatalog.Testament testament,
            String book, String text, CandidateCatalog.Approval approval) throws Exception {
        return new CandidateCatalog.Candidate(id, testament,
                new CandidateCatalog.Reference(book, 1, 1), text,
                new CandidateCatalog.Explanation("설명", "editorial", "ko"),
                new CandidateCatalog.Source("Test source", "https://example.test/source", sha256(text)), approval);
    }

    private CandidateCatalog.Approval approved() {
        return new CandidateCatalog.Approval(CandidateCatalog.ReviewStatus.approved,
                CandidateCatalog.ReviewStatus.approved, CandidateCatalog.ReviewStatus.approved,
                "reviewer", LocalDate.parse("2026-09-27"), "https://example.test/license", "reviewed");
    }

    private String sha256(String value) throws Exception {
        return java.util.HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                .digest(value.getBytes(StandardCharsets.UTF_8)));
    }
}
