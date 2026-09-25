package kr.malssumharu.ai.qt;

import kr.malssumharu.ai.domain.ProviderId;

/**
 * QT 서비스(docs/contracts/qt-today.md)를 서버 간 호출해 제공처의 오늘 범위를 얻는 경계.
 * QT 서비스의 코드·DB 에 직접 의존하지 않고 계약 JSON 으로만 통신한다. 구현은 예외를 밖으로 던지지 않는다.
 */
public interface QtRangeClient {

    QtRangeResult today(ProviderId provider);
}
