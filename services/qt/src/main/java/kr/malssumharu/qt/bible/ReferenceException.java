package kr.malssumharu.qt.bible;

import kr.malssumharu.qt.domain.ReasonCode;

/** 장절 표기를 해석하지 못했다. 메시지에 원문을 넣지 않는다(제공처 문구를 로그에 남기지 않기 위해). */
public class ReferenceException extends Exception {

    private final ReasonCode reason;

    public ReferenceException(ReasonCode reason, String message) {
        super(message);
        this.reason = reason;
    }

    public ReasonCode reason() {
        return reason;
    }
}
