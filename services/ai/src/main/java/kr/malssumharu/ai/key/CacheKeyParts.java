package kr.malssumharu.ai.key;

import kr.malssumharu.ai.domain.Lang;

/**
 * 공통 해설의 캐시 키 재료(PRD AI03의 요소 전부). 제공처 이름·날짜·브라우저 식별자·개인 정보는 없다.
 *
 * @param rangesCanonical      정규화한 범위 집합의 정규 표기(RangeSet.canonical)
 * @param translationId        입력 번역본(WEB)
 * @param versificationBasis   장절 기준(QT 범위가 따르는 구조 표)
 * @param inputDataVersion     입력 본문 데이터 전체의 버전(WebBible.dataVersion)
 * @param inputHash            이 요청에 실제로 들어가는 본문·문맥 절의 해시
 * @param lang                 출력 언어
 * @param options              콘텐츠 유형·길이·문맥 절 수 등 생성 옵션의 정규 표기
 * @param promptVersion        프롬프트/해설 정책 버전
 * @param modelId              모델
 * @param modelSettingsVersion 생성 설정(온도 등) 버전
 * @param referenceVersion     참고 자료 버전(없으면 "none")
 */
public record CacheKeyParts(
        String rangesCanonical,
        String translationId,
        String versificationBasis,
        String inputDataVersion,
        String inputHash,
        Lang lang,
        String options,
        String promptVersion,
        String modelId,
        String modelSettingsVersion,
        String referenceVersion) {
}
