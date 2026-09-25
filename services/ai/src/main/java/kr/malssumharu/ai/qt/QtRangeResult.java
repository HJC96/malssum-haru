package kr.malssumharu.ai.qt;

import java.util.List;
import kr.malssumharu.ai.domain.ReasonCode;
import kr.malssumharu.ai.domain.VerseRange;

/** QT 서비스가 알려 준 오늘의 범위. 확인된 범위가 아니면 Unavailable 이다(추정하지 않는다). */
public sealed interface QtRangeResult {

    record Confirmed(String providerDate, List<VerseRange> ranges) implements QtRangeResult {
    }

    /** reason 은 NO_RANGE(QT 중단·범위 없음) 또는 NOT_COLLECTED_YET(QT 가 아직 수집하지 못함). */
    record Unavailable(ReasonCode reason) implements QtRangeResult {
    }
}
