package kr.malssumharu.qt.bible;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Test;
import tools.jackson.databind.json.JsonMapper;

class ResourceVerseCountTableTest {

    private static final JsonMapper JSON = JsonMapper.builder().build();
    private final ResourceVerseCountTable table = ResourceVerseCountTable.load();

    @Test
    void recordsTheDataVersionAndTheProvisionalVersificationSystem() {
        assertThat(table.dataVersion()).isEqualTo("eng.vrs@71c66cb+REV12=17");
        assertThat(table.versificationSystem()).isEqualTo("nkrv-provisional-1");
    }

    @Test
    void has66BooksWith1189ChaptersAnd31103Verses() {
        var all = table.asMap();
        assertThat(all).hasSize(66);
        assertThat(all.values().stream().mapToInt(a -> a.length).sum()).isEqualTo(1189);
        assertThat(all.values().stream().flatMapToInt(java.util.Arrays::stream).sum()).isEqualTo(31103);
    }

    @Test
    void knownValues() {
        assertThat(table.lastVerse("GEN", 1)).hasValue(31);
        assertThat(table.lastVerse("PSA", 23)).hasValue(6);
        assertThat(table.lastVerse("PSA", 119)).hasValue(176);
        assertThat(table.lastVerse("JHN", 3)).hasValue(36);
        assertThat(table.lastVerse("REV", 12)).hasValue(17); // 잠정 데이터의 덮어쓴 값
        assertThat(table.chapterCount("PSA")).hasValue(150);
        assertThat(table.chapterCount("JUD")).hasValue(1);
    }

    @Test
    void unknownBookOrChapterIsEmptyNotZero() {
        assertThat(table.lastVerse("GEN", 0)).isEmpty();
        assertThat(table.lastVerse("GEN", 51)).isEmpty();
        assertThat(table.lastVerse("XXX", 1)).isEmpty();
        assertThat(table.chapterCount("XXX")).isEmpty();
    }

    @Test
    void malformedResourcesFailLoudly() throws Exception {
        assertThatThrownBy(() -> ResourceVerseCountTable.parse(JSON.readTree("{\"dataVersion\":\"v\",\"versificationSystem\":\"s\"}")))
                .isInstanceOf(IllegalStateException.class).hasMessageContaining("books");
        assertThatThrownBy(() -> ResourceVerseCountTable.parse(JSON.readTree("{\"versificationSystem\":\"s\",\"books\":{}}")))
                .isInstanceOf(IllegalStateException.class).hasMessageContaining("dataVersion");
        assertThatThrownBy(() -> ResourceVerseCountTable.parse(
                JSON.readTree("{\"dataVersion\":\"v\",\"versificationSystem\":\"s\",\"books\":{\"GEN\":[31]}}")))
                .isInstanceOf(IllegalStateException.class).hasMessageContaining("66");
        StringBuilder zero = new StringBuilder("{\"dataVersion\":\"v\",\"versificationSystem\":\"s\",\"books\":{");
        var ids = BibleBooks.allIds();
        for (int i = 0; i < ids.size(); i++) {
            zero.append(i == 0 ? "" : ",").append('"').append(ids.get(i)).append("\":[").append(i == 5 ? 0 : 3).append(']');
        }
        zero.append("}}");
        assertThatThrownBy(() -> ResourceVerseCountTable.parse(JSON.readTree(zero.toString())))
                .isInstanceOf(IllegalStateException.class).hasMessageContaining("non-positive");
    }
}
