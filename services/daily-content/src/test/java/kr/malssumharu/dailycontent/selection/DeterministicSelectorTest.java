package kr.malssumharu.dailycontent.selection;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.LocalDate;
import java.util.List;
import kr.malssumharu.dailycontent.catalog.CandidateCatalog;
import org.junit.jupiter.api.Test;

class DeterministicSelectorTest {
    private final DeterministicSelector selector = new DeterministicSelector();

    @Test
    void seededSelectionIsStableAndTestamentAndDateScoped() {
        var pool = List.of("a", "b", "c", "d", "e");
        var first = selector.select("catalog-v1", LocalDate.parse("2026-10-01"),
                CandidateCatalog.Testament.oldTestament,
                pool.stream().map(this::candidate).toList());
        var retry = selector.select("catalog-v1", LocalDate.parse("2026-10-01"),
                CandidateCatalog.Testament.oldTestament,
                pool.stream().map(this::candidate).toList());

        assertThat(first.id()).isEqualTo(retry.id());
    }

    @Test
    void mappingRejectsIncompleteTailInsteadOfUsingModuloBias() {
        long bound = 3;
        long domain = 1L << 32;
        long limit = (domain / bound) * bound;

        assertThat(DeterministicSelector.mapUnsigned32ToIndex(limit - 1, 3)).hasValue(2);
        assertThat(DeterministicSelector.mapUnsigned32ToIndex(limit, 3)).isEmpty();
        assertThat(DeterministicSelector.mapUnsigned32ToIndex(domain - 1, 3)).isEmpty();
    }

    @Test
    void rejectsInvalidBoundsAndRandomValues() {
        assertThatThrownBy(() -> selector.uniformIndex(0, "seed")).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> DeterministicSelector.mapUnsigned32ToIndex(-1, 2))
                .isInstanceOf(IllegalArgumentException.class);
    }

    private CandidateCatalog.Candidate candidate(String id) {
        return new CandidateCatalog.Candidate(id,
                CandidateCatalog.Testament.oldTestament, null, "", null, null, null);
    }
}
