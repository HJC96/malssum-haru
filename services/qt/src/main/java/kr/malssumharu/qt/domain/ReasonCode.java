package kr.malssumharu.qt.domain;

/**
 * 계약의 reasonCode. 개방형 열거이며 클라이언트는 모르는 값도 availabilityStatus만으로 동작해야 한다.
 * INTERNAL_ERROR는 계약 초안 밖에서 추가한 값이다(어댑터 예기치 못한 예외 격리용).
 */
public enum ReasonCode {
    PARSE_FAILED,
    DATE_MISMATCH,
    UPSTREAM_TIMEOUT,
    UPSTREAM_HTTP_ERROR,
    DYNAMIC_CONTENT_UNAVAILABLE,
    UNKNOWN_BOOK,
    INVALID_REFERENCE,
    PERMISSION_UNCONFIRMED,
    OPERATOR_DISABLED,
    LINK_UNREACHABLE,
    INTERNAL_ERROR
}
