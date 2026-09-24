package kr.malssumharu.qt.provider;

import java.time.LocalDate;
import java.util.List;
import kr.malssumharu.qt.domain.AvailabilityStatus;
import kr.malssumharu.qt.domain.BibleRange;
import kr.malssumharu.qt.domain.ReasonCode;

/** 어댑터가 제공처 페이지에서 읽은 결과. 날짜가 서울 오늘과 맞는지는 서비스가 판정한다. */
public sealed interface AdapterOutcome {

    /** providerDate는 제공처가 그 자료를 오늘 것으로 표시한 날짜다. */
    record Found(LocalDate providerDate, String displayReference, List<BibleRange> ranges) implements AdapterOutcome {

        /**
         * 서울 오늘의 확인 결과로 쓸 수 있으면 null, 아니면 이유를 담은 실패.
         * 제공처 날짜가 서울 오늘과 다르면 DATE_MISMATCH(어제 자료를 오늘로 쓰지 않는다).
         */
        public Failed rejectionFor(LocalDate seoulToday) {
            if (!seoulToday.equals(providerDate)) {
                return Failed.unavailable(ReasonCode.DATE_MISMATCH, providerDate);
            }
            if (ranges == null || ranges.isEmpty()) {
                return Failed.unavailable(ReasonCode.PARSE_FAILED, providerDate);
            }
            return null;
        }
    }

    /** status는 RANGE_UNAVAILABLE 또는 LINK_ERROR. providerDate는 읽었다면 채운다. */
    record Failed(AvailabilityStatus status, ReasonCode reason, LocalDate providerDate) implements AdapterOutcome {
        public static Failed unavailable(ReasonCode reason, LocalDate providerDate) {
            return new Failed(AvailabilityStatus.RANGE_UNAVAILABLE, reason, providerDate);
        }

        public static Failed linkError(ReasonCode reason) {
            return new Failed(AvailabilityStatus.LINK_ERROR, reason, null);
        }
    }
}
