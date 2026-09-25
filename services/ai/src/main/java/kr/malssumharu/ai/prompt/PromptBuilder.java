package kr.malssumharu.ai.prompt;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import kr.malssumharu.ai.bible.GenerationInput;
import kr.malssumharu.ai.domain.Lang;
import kr.malssumharu.ai.domain.VerseRange;
import kr.malssumharu.ai.llm.LlmRequest;
import tools.jackson.databind.json.JsonMapper;

/**
 * 요청을 만든다. 시스템 정책은 상수이고, 본문은 JSON 문자열 값으로만 들어간다(따옴표·줄바꿈이 이스케이프되어
 * 본문 안의 문장이 구조를 깨거나 정책 영역으로 넘어올 수 없다). 제공처가 준 텍스트가 생기더라도 같은 방식(데이터 필드)으로만 넣는다.
 */
public final class PromptBuilder {

    private static final JsonMapper JSON = JsonMapper.builder().build();

    private final PromptPolicy policy;

    public PromptBuilder(PromptPolicy policy) {
        this.policy = policy;
    }

    public LlmRequest build(GenerationInput input, Lang lang, String modelId) {
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("outputLanguage", lang.wire());
        List<Map<String, Object>> ranges = new ArrayList<>();
        for (VerseRange r : input.passage().ranges()) {
            ranges.add(Map.of("bookId", r.bookId(),
                    "start", Map.of("chapter", r.startChapter(), "verse", r.startVerse()),
                    "end", Map.of("chapter", r.endChapter(), "verse", r.endVerse())));
        }
        data.put("passage", Map.of("ranges", ranges));
        List<Map<String, Object>> verses = new ArrayList<>();
        for (GenerationInput.InputVerse v : input.verses()) {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("ref", Map.of("bookId", v.ref().bookId(), "chapter", v.ref().chapter(), "verse", v.ref().verse()));
            m.put("role", v.role().name());
            m.put("text", v.text());
            verses.add(m);
        }
        data.put("verses", verses);
        return new LlmRequest(policy.systemText(), JSON.writeValueAsString(data), lang, modelId, policy.version());
    }
}
