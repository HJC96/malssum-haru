package kr.malssumharu.dailycontent.catalog;

import java.time.LocalDate;
import java.util.List;

public record CandidateCatalog(
        String catalogVersion,
        String translationId,
        String translationLanguage,
        List<Candidate> candidates) {

    public CandidateCatalog {
        candidates = List.copyOf(candidates);
    }

    public enum Testament {
        oldTestament,
        newTestament
    }

    public enum ReviewStatus {
        pending,
        approved,
        rejected
    }

    public record Candidate(
            String id,
            Testament testament,
            Reference reference,
            String text,
            Explanation explanation,
            Source source,
            Approval approval) {
        public boolean eligibleForPublication() {
            return approval != null
                    && approval.textStatus() == ReviewStatus.approved
                    && approval.explanationStatus() == ReviewStatus.approved
                    && approval.rightsStatus() == ReviewStatus.approved
                    && approval.reviewedBy() != null
                    && !approval.reviewedBy().isBlank()
                    && approval.reviewedAt() != null
                    && approval.rightsEvidenceUrl() != null
                    && !approval.rightsEvidenceUrl().isBlank();
        }
    }

    public record Reference(String bookId, int chapter, int verse) {}

    public record Explanation(String text, String kind, String language) {}

    public record Source(String name, String url, String textSha256) {}

    /** Editorial review and rights review are independent gates for public release. */
    public record Approval(
            ReviewStatus textStatus,
            ReviewStatus explanationStatus,
            ReviewStatus rightsStatus,
            String reviewedBy,
            LocalDate reviewedAt,
            String rightsEvidenceUrl,
            String notes) {}
}
