package kr.malssumharu.dailycontent.cli;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.time.LocalDate;
import java.util.List;
import kr.malssumharu.dailycontent.catalog.CandidateCatalog;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class DailyContentCliTest {
    @TempDir Path tempDir;
    private final ObjectMapper mapper = new ObjectMapper().registerModule(new JavaTimeModule());

    @Test
    void preparesFourteenDaysIdempotentlyAndPreflightsEveryConflict() throws Exception {
        Path catalog = writeApprovedTestCatalog();
        Path output = tempDir.resolve("prepared");
        String[] args = {"--date=2026-10-01", "--days=14", "--catalog=" + catalog, "--output-dir=" + output};

        DailyContentCli.run(args);
        try (var files = Files.list(output)) {
            assertThat(files.count()).isEqualTo(14);
        }
        String first = Files.readString(output.resolve("2026-10-01.json"));
        DailyContentCli.run(args);
        assertThat(Files.readString(output.resolve("2026-10-01.json"))).isEqualTo(first);

        Path fresh = tempDir.resolve("fresh");
        Files.createDirectories(fresh);
        Files.writeString(fresh.resolve("2026-10-02.json"), "different content");
        String[] conflicting = {"--date=2026-10-01", "--days=14", "--catalog=" + catalog, "--output-dir=" + fresh};
        assertThatThrownBy(() -> DailyContentCli.run(conflicting)).hasMessageContaining("Refusing to overwrite");
        assertThat(fresh.resolve("2026-10-01.json")).doesNotExist();
    }

    @Test
    void bundledPendingCatalogCannotPreparePublicFiles() {
        Path output = tempDir.resolve("unapproved");
        assertThatThrownBy(() -> DailyContentCli.run(new String[] {
                "--date=2026-10-01", "--days=14", "--output-dir=" + output
        })).hasMessageContaining("No approved candidates available");
        assertThat(output).doesNotExist();
    }

    private Path writeApprovedTestCatalog() throws Exception {
        var approval = new CandidateCatalog.Approval(CandidateCatalog.ReviewStatus.approved,
                CandidateCatalog.ReviewStatus.approved, CandidateCatalog.ReviewStatus.approved,
                "test-reviewer", LocalDate.parse("2026-09-27"), "https://example.test/rights", "test fixture");
        var candidates = List.of(
                candidate("ot-psa-1-1", CandidateCatalog.Testament.oldTestament, "PSA", "test old verse", approval),
                candidate("nt-jhn-1-1", CandidateCatalog.Testament.newTestament, "JHN", "test new verse", approval));
        Path path = tempDir.resolve("approved-test-catalog.json");
        mapper.writeValue(path.toFile(), new CandidateCatalog("test-only-pool", "kor-rv-1961", "ko", candidates));
        return path;
    }

    private CandidateCatalog.Candidate candidate(String id, CandidateCatalog.Testament testament,
            String book, String text, CandidateCatalog.Approval approval) throws Exception {
        byte[] digest = MessageDigest.getInstance("SHA-256").digest(text.getBytes(StandardCharsets.UTF_8));
        return new CandidateCatalog.Candidate(id, testament,
                new CandidateCatalog.Reference(book, 1, 1), text,
                new CandidateCatalog.Explanation("test explanation", "editorial", "ko"),
                new CandidateCatalog.Source("Test source", "https://example.test/source", java.util.HexFormat.of().formatHex(digest)),
                approval);
    }
}
