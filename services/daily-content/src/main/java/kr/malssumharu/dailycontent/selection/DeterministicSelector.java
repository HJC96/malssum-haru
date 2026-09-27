package kr.malssumharu.dailycontent.selection;

import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.LocalDate;
import java.util.List;
import java.util.OptionalInt;
import kr.malssumharu.dailycontent.catalog.CandidateCatalog;

/** Versioned deterministic sampling; repeats across dates are allowed. */
public final class DeterministicSelector {
    public static final String ALGORITHM_VERSION = "sha256-rejection-v1";

    public CandidateCatalog.Candidate select(
            String catalogVersion,
            LocalDate date,
            CandidateCatalog.Testament testament,
            List<CandidateCatalog.Candidate> eligibleCandidates) {
        if (catalogVersion == null || catalogVersion.isBlank()) throw new IllegalArgumentException("catalog version is required");
        if (date == null || testament == null) throw new IllegalArgumentException("date and testament are required");
        if (eligibleCandidates == null || eligibleCandidates.isEmpty()) {
            throw new IllegalStateException("No approved candidates available for " + testament);
        }
        long index = uniformIndex(
                eligibleCandidates.size(),
                "daily-word|" + ALGORITHM_VERSION + "|" + catalogVersion + "|" + date + "|" + testament);
        return eligibleCandidates.get((int) index);
    }

    /** Maps SHA-256-derived unsigned 32-bit values into [0, bound) without modulo bias. */
    public int uniformIndex(int bound, String seed) {
        if (bound < 1) throw new IllegalArgumentException("bound must be positive");
        if (seed == null) throw new IllegalArgumentException("seed is required");
        long domain = 1L << 32;
        for (long counter = 0; ; counter++) {
            long value = firstUnsignedInt(sha256(seed + "|" + counter));
            OptionalInt mapped = mapUnsigned32ToIndex(value, bound);
            if (mapped.isPresent()) return mapped.getAsInt();
        }
    }

    public static OptionalInt mapUnsigned32ToIndex(long value, int bound) {
        if (bound < 1) throw new IllegalArgumentException("bound must be positive");
        long domain = 1L << 32;
        if (value < 0 || value >= domain) throw new IllegalArgumentException("value must be unsigned 32-bit");
        long limit = (domain / bound) * bound;
        return value < limit ? OptionalInt.of((int) (value % bound)) : OptionalInt.empty();
    }

    private byte[] sha256(String value) {
        try {
            return MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8));
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 is unavailable", exception);
        }
    }

    private long firstUnsignedInt(byte[] bytes) {
        return Integer.toUnsignedLong(ByteBuffer.wrap(bytes).getInt());
    }
}
