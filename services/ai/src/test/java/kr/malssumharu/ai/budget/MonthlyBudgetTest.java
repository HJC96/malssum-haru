package kr.malssumharu.ai.budget;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.YearMonth;
import org.junit.jupiter.api.Test;

class MonthlyBudgetTest {
    @Test void zeroLimitsFailClosed() {
        assertThat(new MonthlyBudget(0, 10).reserve(1, YearMonth.of(2026, 9))).isFalse();
        assertThat(new MonthlyBudget(10, 0).reserve(1, YearMonth.of(2026, 9))).isFalse();
    }

    @Test void enforcesGenerationAndUnitLimitsAndRollsOverUtcMonth() {
        MonthlyBudget budget = new MonthlyBudget(2, 5);
        YearMonth september = YearMonth.of(2026, 9);
        assertThat(budget.reserve(3, september)).isTrue();
        assertThat(budget.reserve(3, september)).isFalse();
        assertThat(budget.reserve(2, september)).isTrue();
        assertThat(budget.reserve(1, september)).isFalse();
        assertThat(budget.snapshot(september).generations()).isEqualTo(2);
        assertThat(budget.reserve(1, september.plusMonths(1))).isTrue();
        assertThat(budget.snapshot(september.plusMonths(1)).units()).isEqualTo(1);
    }

    @Test void settlesActualUnitsOrReleasesRejectedWork() {
        MonthlyBudget budget = new MonthlyBudget(3, 10);
        YearMonth month = YearMonth.of(2026, 9);
        assertThat(budget.reserve(4, month)).isTrue();
        budget.settle(4, 2, month);
        assertThat(budget.snapshot(month).units()).isEqualTo(2);
        budget.release(3, month);
        assertThat(budget.snapshot(month).generations()).isZero();
        assertThat(budget.snapshot(month).units()).isZero();
    }
}
