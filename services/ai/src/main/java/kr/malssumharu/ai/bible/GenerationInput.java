package kr.malssumharu.ai.bible;

import java.util.List;
import java.util.Set;
import kr.malssumharu.ai.domain.RangeSet;
import kr.malssumharu.ai.domain.VerseRef;

/**
 * LLM 에 넣을 입력 데이터(WEB 본문). 범위 절(PASSAGE)과 앞뒤 문맥 절(CONTEXT)로 구성된다.
 * 서버 안에서만 쓰며 API 응답·로그에 나가지 않는다.
 */
public record GenerationInput(RangeSet passage, List<InputVerse> verses, Set<VerseRef> allowedRefs, String inputHash) {

    public enum Role {
        PASSAGE, CONTEXT
    }

    public record InputVerse(VerseRef ref, Role role, String text) {
    }
}
