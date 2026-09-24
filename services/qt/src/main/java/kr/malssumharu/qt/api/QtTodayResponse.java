package kr.malssumharu.qt.api;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import kr.malssumharu.qt.domain.AvailabilityStatus;
import kr.malssumharu.qt.domain.ReasonCode;

/**
 * 계약 docs/contracts/qt-today.md v1 의 응답 형태. 성경 본문·해설 필드는 의도적으로 없다.
 * null 필드도 그대로 내보낸다(계약 예시가 null을 명시한다).
 */
public record QtTodayResponse(String schemaVersion, Instant generatedAt, List<ProviderEntry> providers) {

    public static final String SCHEMA_VERSION = "1";
    public static final String BODY_NOT_PROVIDED = "NOT_PROVIDED";

    public record ProviderEntry(
            String providerId,
            Localized providerName,
            String providerTimeZone,
            LocalDate providerDate,
            AvailabilityStatus availabilityStatus,
            ReasonCode reasonCode,
            Passage passage,
            String displayReference,
            String officialUrl,
            String officialUrlKind,
            Instant verifiedAt,
            String sourceVersion,
            String bodyStatus,
            Localized notice) {
    }

    public record Localized(String ko, String en) {
    }

    public record Passage(List<Range> ranges) {
    }

    public record Range(String bookId, Position start, Position end) {
    }

    public record Position(int chapter, int verse) {
    }
}
