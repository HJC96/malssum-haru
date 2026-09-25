package kr.malssumharu.ai.domain;

/** 계약 v1의 응답 상태. 저장소 상태는 store.ExplanationRecord.State 이고 UNAVAILABLE 은 응답에만 있다. */
public enum ExplanationStatus {
    AVAILABLE,
    GENERATING,
    NOT_GENERATED,
    FAILED,
    IN_REVIEW,
    UNAVAILABLE
}
