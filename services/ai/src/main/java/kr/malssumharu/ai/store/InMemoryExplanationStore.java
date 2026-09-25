package kr.malssumharu.ai.store;

import java.time.Duration;
import java.time.Instant;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.UUID;
import kr.malssumharu.ai.domain.ExplanationStatus;
import kr.malssumharu.ai.domain.ReasonCode;
import kr.malssumharu.ai.explain.ExplanationContent;

/** Process-local prototype store. It is intentionally not a persistent store and is unsuitable for Lambda. */
public final class InMemoryExplanationStore implements ExplanationStore {
    private final ConcurrentHashMap<String, ExplanationRecord> records = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, Integer> revisionHistory = new ConcurrentHashMap<>();

    @Override
    public Optional<ExplanationRecord> find(String key) {
        return Optional.ofNullable(records.get(key));
    }

    @Override
    public Optional<String> claim(String key, Instant now, Duration lease) {
        final String[] token = {null};
        records.compute(key, (ignored, existing) -> {
            if (existing != null) {
                if (existing.status() == ExplanationStatus.AVAILABLE || existing.status() == ExplanationStatus.IN_REVIEW) return existing;
                if (existing.status() == ExplanationStatus.GENERATING && existing.leaseUntil() != null && existing.leaseUntil().isAfter(now)) return existing;
                if (existing.status() == ExplanationStatus.FAILED && existing.retryAt() != null && existing.retryAt().isAfter(now)) return existing;
            }
            token[0] = UUID.randomUUID().toString();
            int revision = existing == null ? 0 : existing.revision();
            int reports = existing == null ? 0 : existing.severeReports();
            return new ExplanationRecord(key, ExplanationStatus.GENERATING, null, null, revision, now, null,
                    now.plus(lease), token[0], null, null, reports);
        });
        return Optional.ofNullable(token[0]);
    }

    @Override
    public boolean available(String key, String claimToken, ExplanationContent content, Instant now, String modelId, String policyVersion) {
        final boolean[] committed = {false};
        records.compute(key, (ignored, existing) -> {
            if (!owns(existing, claimToken)) return existing;
            int revision = revisionHistory.merge(key, 1, (oldValue, one) -> oldValue + 1);
            int reports = existing == null ? 0 : existing.severeReports();
            committed[0] = true;
            return new ExplanationRecord(key, ExplanationStatus.AVAILABLE, content, null, revision, now, null, null,
                    null, modelId, policyVersion, reports);
        });
        return committed[0];
    }

    @Override
    public boolean failed(String key, String claimToken, ReasonCode reason, Instant now, Instant retryAt) {
        final boolean[] committed = {false};
        records.computeIfPresent(key, (ignored, existing) -> {
            if (!owns(existing, claimToken)) return existing;
            committed[0] = true;
            return new ExplanationRecord(key, ExplanationStatus.FAILED, null, reason,
                    existing.revision(), now, retryAt, null, null, null, null, existing.severeReports());
        });
        return committed[0];
    }

    @Override
    public ExplanationStatus report(String key, int revision, boolean severe, int threshold, Instant now) {
        final ExplanationStatus[] status = {ExplanationStatus.NOT_GENERATED};
        records.computeIfPresent(key, (ignored, existing) -> {
            if (existing.status() != ExplanationStatus.AVAILABLE || existing.revision() != revision) {
                status[0] = existing.status();
                return existing;
            }
            int count = existing.severeReports() + (severe ? 1 : 0);
            ExplanationStatus next = severe && count >= threshold ? ExplanationStatus.IN_REVIEW : ExplanationStatus.AVAILABLE;
            status[0] = next;
            return new ExplanationRecord(key, next, existing.content(), null, existing.revision(), now, null, null,
                    null, existing.modelId(), existing.policyVersion(), count);
        });
        return status[0];
    }

    @Override
    public boolean hide(String key, Instant now) {
        final boolean[] changed = {false};
        records.computeIfPresent(key, (ignored, existing) -> {
            changed[0] = true;
            return new ExplanationRecord(key, ExplanationStatus.IN_REVIEW, existing.content(), null,
                    existing.revision(), now, null, null, null, existing.modelId(), existing.policyVersion(), existing.severeReports());
        });
        return changed[0];
    }

    @Override
    public boolean replace(String key, int expectedRevision, ExplanationContent content, Instant now, String modelId, String policyVersion) {
        final boolean[] changed = {false};
        records.computeIfPresent(key, (ignored, existing) -> {
            if (existing.revision() != expectedRevision) return existing;
            changed[0] = true;
            int nextRevision = expectedRevision + 1;
            revisionHistory.merge(key, nextRevision, Math::max);
            return new ExplanationRecord(key, ExplanationStatus.AVAILABLE, content, null, nextRevision,
                    now, null, null, null, modelId, policyVersion, 0);
        });
        return changed[0];
    }

    @Override
    public boolean invalidate(String key) {
        return records.remove(key) != null;
    }

    private static boolean owns(ExplanationRecord record, String token) {
        return record != null && record.status() == ExplanationStatus.GENERATING
                && token != null && token.equals(record.claimToken());
    }
}
