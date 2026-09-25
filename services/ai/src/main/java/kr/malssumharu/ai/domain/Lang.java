package kr.malssumharu.ai.domain;

import java.util.Optional;

public enum Lang {
    KO("ko"),
    EN("en");

    private final String wire;

    Lang(String wire) {
        this.wire = wire;
    }

    public String wire() {
        return wire;
    }

    public static Optional<Lang> fromWire(String value) {
        for (Lang l : values()) {
            if (l.wire.equals(value)) {
                return Optional.of(l);
            }
        }
        return Optional.empty();
    }
}
