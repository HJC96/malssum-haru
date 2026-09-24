package kr.malssumharu.qt.service;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import kr.malssumharu.qt.domain.BibleRange;
import kr.malssumharu.qt.domain.ProviderId;

/** 확인된 제공처 일별 항목. 장절 구조 정보만 담고 본문·해설은 없다. */
public record StoredDay(
        ProviderId providerId,
        LocalDate providerDate,
        List<BibleRange> ranges,
        String displayReference,
        Instant verifiedAt,
        String sourceVersion) {
}
