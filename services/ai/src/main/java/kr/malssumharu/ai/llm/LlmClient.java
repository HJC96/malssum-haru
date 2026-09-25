package kr.malssumharu.ai.llm;

/**
 * LLM 호출 경계. 실제 제공자·모델·키는 사용자가 정한다. 이 저장소에는 실제 구현이 없고,
 * 기본은 {@link UnconfiguredLlmClient}(항상 실패), 테스트는 목(mock)을 쓴다.
 * 구현은 호출 시간 제한을 스스로 걸지 않아도 된다(서비스가 별도로 시간 제한과 취소를 건다).
 */
public interface LlmClient {

    LlmResult generate(LlmRequest request) throws LlmException;
}
