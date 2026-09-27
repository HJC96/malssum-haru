package kr.malssumharu.dailycontent.publish;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import kr.malssumharu.dailycontent.catalog.CandidateCatalog;
import kr.malssumharu.dailycontent.selection.DeterministicSelector;

/** Produces only the v1 payload consumed by web/src/app/dailyWord/loader.ts. */
public final class DailyContentPublisher {
    private static final String TIME_ZONE = "Asia/Seoul";
    private final CandidateCatalog catalog;
    private final ObjectMapper mapper;
    private final DeterministicSelector selector = new DeterministicSelector();

    public DailyContentPublisher(CandidateCatalog catalog, ObjectMapper mapper) {
        this.catalog = catalog;
        this.mapper = mapper.copy().enable(SerializationFeature.INDENT_OUTPUT);
    }

    public PublishedContent render(PublishRequest request) {
        if (request == null || request.targetDate() == null) throw new IllegalArgumentException("targetDate is required");
        LocalDate targetDate = request.targetDate();
        var eligibleOld = eligible(CandidateCatalog.Testament.oldTestament);
        var eligibleNew = eligible(CandidateCatalog.Testament.newTestament);
        var oldCandidate = selector.select(catalog.catalogVersion(), targetDate,
                CandidateCatalog.Testament.oldTestament, eligibleOld);
        var newCandidate = selector.select(catalog.catalogVersion(), targetDate,
                CandidateCatalog.Testament.newTestament, eligibleNew);
        String date = targetDate.toString();
        String contentVersion = contentVersion(date, oldCandidate, newCandidate);
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("schemaVersion", "1");
        payload.put("date", date);
        payload.put("timeZone", TIME_ZONE);
        payload.put("contentVersion", contentVersion);
        payload.put("oldTestament", toPayload(oldCandidate));
        payload.put("newTestament", toPayload(newCandidate));
        try {
            return new PublishedContent(date, mapper.writeValueAsString(payload) + "\n", contentVersion);
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("Could not serialize DailyWordContent v1", exception);
        }
    }

    private String contentVersion(String date, CandidateCatalog.Candidate oldCandidate,
            CandidateCatalog.Candidate newCandidate) {
        String identity = String.join("\n", "daily-word-v1", date, catalog.catalogVersion(),
                oldCandidate.id(), oldCandidate.text(), oldCandidate.explanation().text(),
                newCandidate.id(), newCandidate.text(), newCandidate.explanation().text());
        try {
            byte[] hash = MessageDigest.getInstance("SHA-256").digest(identity.getBytes(StandardCharsets.UTF_8));
            return "daily-word-" + date + "-" + java.util.HexFormat.of().formatHex(hash, 0, 8);
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 is unavailable", exception);
        }
    }

    private List<CandidateCatalog.Candidate> eligible(CandidateCatalog.Testament testament) {
        return catalog.candidates().stream()
                .filter(candidate -> candidate.testament() == testament)
                .filter(CandidateCatalog.Candidate::eligibleForPublication)
                .toList();
    }

    private Map<String, Object> toPayload(CandidateCatalog.Candidate candidate) {
        Map<String, Object> reference = new LinkedHashMap<>();
        reference.put("bookId", candidate.reference().bookId());
        reference.put("chapter", candidate.reference().chapter());
        reference.put("verse", candidate.reference().verse());
        Map<String, Object> source = new LinkedHashMap<>();
        source.put("name", candidate.source().name());
        source.put("url", candidate.source().url());
        Map<String, Object> passage = new LinkedHashMap<>();
        passage.put("reference", reference);
        passage.put("translationId", catalog.translationId());
        passage.put("textLanguage", catalog.translationLanguage());
        passage.put("text", candidate.text());
        passage.put("explanation", candidate.explanation());
        passage.put("source", source);
        return passage;
    }
}
