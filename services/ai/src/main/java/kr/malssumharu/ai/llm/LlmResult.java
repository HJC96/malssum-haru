package kr.malssumharu.ai.llm;

/**
 * @param text       모델이 돌려준 원문(JSON 문자열이어야 함). 검증 전에는 신뢰하지 않으며 로그에 남기지 않는다.
 * @param usageUnits 이 호출이 쓴 예산 단위(모델 단가가 미정이라 추상 단위)
 */
public record LlmResult(String text, long usageUnits) {
}
