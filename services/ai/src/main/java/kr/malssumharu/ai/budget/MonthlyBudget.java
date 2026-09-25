package kr.malssumharu.ai.budget;

import java.time.YearMonth;
import java.time.ZoneOffset;
import java.util.concurrent.atomic.AtomicReference;

/** In-memory fail-closed monthly generation guard. Not a cross-instance AWS spending limit. */
public final class MonthlyBudget {
    private final long generationLimit;
    private final long unitLimit;
    private final AtomicReference<State> state = new AtomicReference<>(new State(YearMonth.now(ZoneOffset.UTC), 0, 0));

    public MonthlyBudget(long generationLimit, long unitLimit) {
        this.generationLimit = Math.max(0, generationLimit);
        this.unitLimit = Math.max(0, unitLimit);
    }

    public boolean reserve(long estimatedUnits, YearMonth month) {
        if (generationLimit == 0 || unitLimit == 0 || estimatedUnits <= 0) return false;
        while (true) {
            State old = state.get();
            State base = old.month.equals(month) ? old : new State(month, 0, 0);
            if (base.generations >= generationLimit || estimatedUnits > unitLimit - base.units) return false;
            State next = new State(month, base.generations + 1, base.units + estimatedUnits);
            if (state.compareAndSet(old, next)) return true;
        }
    }

    public void settle(long reservedUnits, long actualUnits, YearMonth month) {
        long adjustment = Math.max(0, actualUnits) - Math.max(0, reservedUnits);
        while (true) {
            State old = state.get();
            if (!old.month.equals(month)) return;
            long units = Math.max(0, old.units + adjustment);
            if (state.compareAndSet(old, new State(old.month, old.generations, units))) return;
        }
    }

    public void release(long reservedUnits, YearMonth month) {
        while (true) {
            State old = state.get();
            if (!old.month.equals(month) || old.generations == 0) return;
            State next = new State(old.month, old.generations - 1, Math.max(0, old.units - Math.max(0, reservedUnits)));
            if (state.compareAndSet(old, next)) return;
        }
    }

    public Snapshot snapshot(YearMonth month) {
        State current = state.get();
        if (!current.month.equals(month)) return new Snapshot(0, 0, generationLimit, unitLimit);
        return new Snapshot(current.generations, current.units, generationLimit, unitLimit);
    }

    private record State(YearMonth month, long generations, long units) { }
    public record Snapshot(long generations, long units, long generationLimit, long unitLimit) { }
}
