package kr.malssumharu.ai.llm;

/** LLM 호출 실패. 메시지·원인 문자열은 로그·응답에 쓰지 않는다(요청 본문이 섞일 수 있다). */
public class LlmException extends Exception {

    private final boolean retryable;
    private final long billedUnits;

    public LlmException(boolean retryable, long billedUnits) {
        super("llm call failed", null, false, false);
        this.retryable = retryable;
        this.billedUnits = billedUnits;
    }

    public boolean retryable() {
        return retryable;
    }

    /** 실패했어도 청구됐을 수 있는 단위(모르면 0). 예산에는 이 값이 반영된다. */
    public long billedUnits() {
        return billedUnits;
    }
}
