package kr.malssumharu.ai.domain;

/** 계약 v1의 reasonCode(개방형 열거). 로그에는 이 코드만 남긴다. */
public enum ReasonCode {
    NO_RANGE,
    TEXT_NOT_ALIGNED,
    BUDGET_EXHAUSTED,
    RATE_LIMITED,
    AI_DISABLED,
    LLM_ERROR,
    OUTPUT_INVALID,
    NOT_COLLECTED_YET
}
