package kr.malssumharu.qt;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.stream.Stream;
import org.junit.jupiter.api.Test;

/**
 * 계약 기준 7: 테스트 fixture에는 성경 본문 전문·제공처 해설을 복사하지 않는다(장절 표기 정도의 구조 정보만).
 *
 * <p>fixture 파일 안의 한글은 페이지 구조를 흉내 내는 데 필요한 고정 단어(매일성경, 본문, 찬송가, 장, 목)뿐이어야 한다.
 * 그 밖의 한글이 한 글자라도 있으면 실패하므로, 공백이 섞인 한국어 문장을 붙여 넣어도(qa-review F-05, 변이 M21) 통과하지 못한다.
 * 장절 표기 자체는 fixture 파일이 아니라 테스트 코드가 자리표시자로 채워 넣는다.
 */
class FixtureRulesTest {

    private static final Path FIXTURES = Path.of("src/test/resources/fixtures");
    private static final int MAX_FILE_BYTES = 1024;
    private static final List<String> ALLOWED_WORDS = List.of("매일성경", "본문", "찬송가", "장", "목");

    @Test
    void fixturesContainOnlyStructuralKoreanWords() throws IOException {
        List<Path> files;
        try (Stream<Path> s = Files.list(FIXTURES)) {
            files = s.toList();
        }
        assertThat(files).isNotEmpty();
        for (Path file : files) {
            assertThat(Files.size(file)).as("%s is too big to be a structure-only fixture", file).isLessThanOrEqualTo(MAX_FILE_BYTES);
            String text = Files.readString(file, StandardCharsets.UTF_8);
            assertThat(hangulOutsideAllowedWords(text))
                    .as("%s contains Korean text beyond the allowed structural words", file)
                    .isEmpty();
        }
    }

    @Test
    void theRuleCatchesKoreanSentencesWithSpacesAndLongSingleWords() {
        assertThat(hangulOutsideAllowedWords("<p>이 문장은 공백이 있는 설명문입니다</p>")).isNotEmpty();
        assertThat(hangulOutsideAllowedWords("<p>가나다라마바사아자차카타파하</p>")).isNotEmpty();
        assertThat(hangulOutsideAllowedWords("<p>본문 본문 장 목 매일성경 찬송가</p>")).isEmpty();
    }

    @Test
    void providerJsonFixtureHoldsOnlyTheThreeStructuralFields() throws IOException {
        String maeilJson = Files.readString(FIXTURES.resolve("maeil-detail.json"));
        assertThat(maeilJson).contains("Base_de", "Bible_name", "Bible_chapter")
                .doesNotContain("Qt_sj", "Qt_Brf", "Qt_a1", "Qt_q1");
    }

    /** 허용 단어를 지운 뒤 남는 한글 글자들(없으면 빈 문자열). */
    private static String hangulOutsideAllowedWords(String text) {
        String rest = text;
        for (String word : ALLOWED_WORDS) {
            rest = rest.replace(word, "");
        }
        StringBuilder sb = new StringBuilder();
        for (char c : rest.toCharArray()) {
            if (c >= '\uAC00' && c <= '\uD7A3') {
                sb.append(c);
            }
        }
        return sb.toString();
    }
}
