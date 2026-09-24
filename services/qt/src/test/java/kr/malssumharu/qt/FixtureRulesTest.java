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
 * 이 검사는 fixture가 커지거나 긴 한국어 문장을 담기 시작하면 실패해 복사를 막는다.
 */
class FixtureRulesTest {

    private static final Path FIXTURES = Path.of("src/test/resources/fixtures");
    private static final int MAX_FILE_BYTES = 2048;
    private static final int MAX_HANGUL_RUN = 12;

    @Test
    void fixturesAreTinyStructuralSnippetsWithoutLongKoreanProse() throws IOException {
        List<Path> files;
        try (Stream<Path> s = Files.list(FIXTURES)) {
            files = s.toList();
        }
        assertThat(files).isNotEmpty();
        for (Path file : files) {
            assertThat(Files.size(file)).as("%s is too big to be a structure-only fixture", file).isLessThanOrEqualTo(MAX_FILE_BYTES);
            String text = Files.readString(file, StandardCharsets.UTF_8);
            assertThat(longestHangulRun(text)).as("%s contains prose-length Korean text", file).isLessThanOrEqualTo(MAX_HANGUL_RUN);
        }
    }

    @Test
    void providerJsonFixtureHoldsOnlyTheThreeStructuralFields() throws IOException {
        String maeilJson = Files.readString(FIXTURES.resolve("maeil-detail.json"));
        assertThat(maeilJson).contains("Base_de", "Bible_name", "Bible_chapter")
                .doesNotContain("Qt_sj", "Qt_Brf", "Qt_a1", "Qt_q1");
    }

    /** 공백을 넘어 이어지는 한글 글자 연속(공백·구두점 제외). 어절 몇 개 수준의 구조 표기는 통과한다. */
    private static int longestHangulRun(String text) {
        int best = 0;
        int run = 0;
        for (char c : text.toCharArray()) {
            if (c >= '가' && c <= '힣') {
                run++;
                best = Math.max(best, run);
            } else if (c == ' ') {
                // 한 어절 뒤 공백은 이어 세지 않고 끊는다
                run = 0;
            } else {
                run = 0;
            }
        }
        return best;
    }
}
