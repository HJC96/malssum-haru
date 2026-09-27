package kr.malssumharu.dailycontent.catalog;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;

public final class CatalogLoader {
    private final ObjectMapper objectMapper;

    public CatalogLoader(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    public CandidateCatalog loadClasspath(String resource) {
        try (InputStream input = CatalogLoader.class.getResourceAsStream(resource)) {
            if (input == null) throw new IllegalArgumentException("Catalog resource not found: " + resource);
            return validate(objectMapper.readValue(input, CandidateCatalog.class));
        } catch (IOException exception) {
            throw new IllegalArgumentException("Could not read catalog resource: " + resource, exception);
        }
    }

    public CandidateCatalog load(Path path) {
        try (InputStream input = Files.newInputStream(path)) {
            return validate(objectMapper.readValue(input, CandidateCatalog.class));
        } catch (IOException exception) {
            throw new IllegalArgumentException("Could not read candidate catalog: " + path, exception);
        }
    }

    private CandidateCatalog validate(CandidateCatalog catalog) {
        if (catalog == null || blank(catalog.catalogVersion()) || blank(catalog.translationId())
                || !"ko".equals(catalog.translationLanguage()) || catalog.candidates().isEmpty()) {
            throw new IllegalArgumentException("Catalog requires a version, Korean translation, and candidates");
        }
        var ids = new java.util.HashSet<String>();
        var references = new java.util.HashSet<String>();
        for (CandidateCatalog.Candidate candidate : catalog.candidates()) {
            if (candidate == null || blank(candidate.id()) || candidate.testament() == null
                    || candidate.reference() == null || blank(candidate.reference().bookId())
                    || candidate.reference().chapter() < 1 || candidate.reference().verse() < 1
                    || blank(candidate.text()) || candidate.explanation() == null
                    || blank(candidate.explanation().text()) || blank(candidate.explanation().kind())
                    || !"ko".equals(candidate.explanation().language()) || candidate.source() == null
                    || blank(candidate.source().name()) || !isHttpUrl(candidate.source().url())
                    || !isSha256(candidate.source().textSha256())) {
                throw new IllegalArgumentException("Candidate has missing or invalid fields: "
                        + (candidate == null ? "<null>" : candidate.id()));
            }
            if (!sha256(candidate.text()).equalsIgnoreCase(candidate.source().textSha256())) {
                throw new IllegalArgumentException("Verse text hash does not match source metadata: " + candidate.id());
            }
            if (!ids.add(candidate.id())) throw new IllegalArgumentException("Duplicate candidate id: " + candidate.id());
            var reference = candidate.reference();
            if (!references.add(candidate.testament() + ":" + reference.bookId() + ":"
                    + reference.chapter() + ":" + reference.verse())) {
                throw new IllegalArgumentException("Duplicate candidate reference: " + candidate.id());
            }
            boolean oldTestamentBook = switch (reference.bookId()) {
                case "GEN", "EXO", "LEV", "NUM", "DEU", "JOS", "JDG", "RUT", "1SA", "2SA",
                        "1KI", "2KI", "1CH", "2CH", "EZR", "NEH", "EST", "JOB", "PSA", "PRO",
                        "ECC", "SNG", "ISA", "JER", "LAM", "EZK", "DAN", "HOS", "JOL", "AMO",
                        "OBA", "JON", "MIC", "NAM", "HAB", "ZEP", "HAG", "ZEC", "MAL" -> true;
                default -> false;
            };
            if (oldTestamentBook != (candidate.testament() == CandidateCatalog.Testament.oldTestament)) {
                throw new IllegalArgumentException("Testament does not match book for candidate: " + candidate.id());
            }
            if (candidate.approval() == null || candidate.approval().textStatus() == null
                    || candidate.approval().explanationStatus() == null || candidate.approval().rightsStatus() == null) {
                throw new IllegalArgumentException("Candidate must include explicit approval metadata: " + candidate.id());
            }
        }
        return catalog;
    }

    private boolean isHttpUrl(String value) {
        if (blank(value)) return false;
        try {
            var uri = java.net.URI.create(value);
            return "https".equalsIgnoreCase(uri.getScheme()) || "http".equalsIgnoreCase(uri.getScheme());
        } catch (IllegalArgumentException exception) {
            return false;
        }
    }

    private boolean isSha256(String value) {
        return value != null && value.matches("(?i)[0-9a-f]{64}");
    }

    private String sha256(String value) {
        try {
            byte[] bytes = MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8));
            return java.util.HexFormat.of().formatHex(bytes);
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 is unavailable", exception);
        }
    }

    private boolean blank(String value) {
        return value == null || value.isBlank();
    }
}
