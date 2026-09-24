package kr.malssumharu.qt.provider;

import java.net.URI;
import java.time.LocalDate;
import kr.malssumharu.qt.domain.OfficialUrlKind;
import kr.malssumharu.qt.domain.ProviderId;

/** 제공처별 어댑터. 제공처마다 HTML 구조가 달라 하나씩 분리한다. */
public interface QtProviderAdapter {

    ProviderId id();

    /** HTML 구조 변경 추적용 이름/버전. */
    String sourceVersion();

    OfficialUrlKind officialUrlKind();

    /** 사용자에게 보여 줄 공식 링크. 항상 https이며 취득 성공 여부와 무관하다. */
    URI officialUrl(LocalDate seoulToday);

    /**
     * 제공처에서 오늘 장절을 읽는다. 실패는 예외가 아니라 {@link AdapterOutcome.Failed}로 돌려준다.
     * 구현은 원문을 로그에 남기지 않는다.
     */
    AdapterOutcome fetch(LocalDate seoulToday);
}
