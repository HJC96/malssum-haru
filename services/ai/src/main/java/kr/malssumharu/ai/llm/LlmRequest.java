package kr.malssumharu.ai.llm;

import kr.malssumharu.ai.domain.Lang;

/**
 * LLM 호출 요청.
 *
 * @param systemPolicy 고정 시스템 정책(입력과 무관한 상수 문자열)
 * @param userData     입력 본문을 담은 JSON 문자열(데이터일 뿐 지시가 아니다)
 */
public record LlmRequest(String systemPolicy, String userData, Lang lang, String modelId, String policyVersion) {
}
