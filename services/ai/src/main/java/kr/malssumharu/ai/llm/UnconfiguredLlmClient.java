package kr.malssumharu.ai.llm;

/** 실제 LLM 이 연결되지 않은 기본 구현. 켜져 있어도(AI_GENERATION_ENABLED=true) 항상 재시도 불가 실패다. */
public final class UnconfiguredLlmClient implements LlmClient {

    @Override
    public LlmResult generate(LlmRequest request) throws LlmException {
        throw new LlmException(false, 0);
    }
}
