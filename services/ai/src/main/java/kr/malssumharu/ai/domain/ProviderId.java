package kr.malssumharu.ai.domain;

import java.util.Optional;

/** QT 제공처. AI 서비스는 제공처를 QT 범위를 얻는 데만 쓰고 캐시 키에는 넣지 않는다. */
public enum ProviderId {
    MAEIL_SEONGYEONG("maeil-seongyeong"),
    SAENGMYEONG_UI_SAM("saengmyeong-ui-sam");

    private final String wire;

    ProviderId(String wire) {
        this.wire = wire;
    }

    public String wire() {
        return wire;
    }

    public static Optional<ProviderId> fromWire(String value) {
        for (ProviderId p : values()) {
            if (p.wire.equals(value)) {
                return Optional.of(p);
            }
        }
        return Optional.empty();
    }
}
