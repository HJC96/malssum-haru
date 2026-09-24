package kr.malssumharu.qt.service;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import kr.malssumharu.qt.domain.BibleRange;
import kr.malssumharu.qt.domain.BibleRange.ChapterVerse;
import kr.malssumharu.qt.domain.ProviderId;
import kr.malssumharu.qt.support.FakeDynamoDb;
import org.junit.jupiter.api.Test;
import software.amazon.awssdk.services.dynamodb.model.AttributeValue;

/** DynamoDB 저장소의 매핑·키·TTL 계산·덮어쓰기. 실제 DynamoDB가 아니라 대역으로 검증한다(README '미시험' 참고). */
class DynamoDbQtDayStoreTest {

    private static final LocalDate TODAY = LocalDate.of(2026, 9, 24);
    private static final Instant VERIFIED = Instant.parse("2026-09-24T01:00:00Z");

    private final FakeDynamoDb fake = new FakeDynamoDb();
    private final DynamoDbQtDayStore store = new DynamoDbQtDayStore(fake.client(), "qt-table", Duration.ofDays(400));

    private static StoredDay day(ProviderId id, LocalDate date, Instant verifiedAt, BibleRange... ranges) {
        return new StoredDay(id, date, List.of(ranges), "표기", verifiedAt, "adapter/1");
    }

    private static BibleRange range(String book, int c1, int v1, int c2, int v2) {
        return new BibleRange(book, new ChapterVerse(c1, v1), new ChapterVerse(c2, v2));
    }

    @Test
    void roundTripsRangesIncludingSeveralRangesInOneBook() {
        StoredDay original = day(ProviderId.MAEIL_SEONGYEONG, TODAY, VERIFIED,
                range("PSA", 23, 1, 23, 3), range("PSA", 23, 5, 23, 6), range("JHN", 3, 16, 4, 3));

        store.save(original);

        assertThat(store.find(ProviderId.MAEIL_SEONGYEONG, TODAY)).contains(original);
    }

    @Test
    void writesOnlyStructuralAttributesWithTheContractKeysAndTtl() {
        store.save(day(ProviderId.SAENGMYEONG_UI_SAM, TODAY, VERIFIED, range("1CH", 14, 1, 14, 17)));

        Map<String, AttributeValue> item = fake.rawItem("saengmyeong-ui-sam", "2026-09-24");
        assertThat(item.keySet()).containsExactlyInAnyOrder(
                "providerId", "providerDate", "ranges", "displayReference", "verifiedAt", "sourceVersion", "expiresAt");
        assertThat(item.get("ranges").s()).isEqualTo("1CH:14:1-14:17");
        assertThat(item.get("providerDate").s()).isEqualTo("2026-09-24");
        assertThat(item.get("expiresAt").n()).isEqualTo(Long.toString(VERIFIED.plus(Duration.ofDays(400)).getEpochSecond()));
    }

    @Test
    void savingTheSameKeyAgainOverwritesInsteadOfAddingItems() {
        store.save(day(ProviderId.MAEIL_SEONGYEONG, TODAY, VERIFIED, range("JHN", 3, 1, 3, 21)));
        store.save(day(ProviderId.MAEIL_SEONGYEONG, TODAY, VERIFIED.plusSeconds(3600), range("JHN", 3, 1, 3, 21)));

        assertThat(fake.itemCount()).isEqualTo(1);
        assertThat(fake.puts.get()).isEqualTo(2);
        assertThat(store.find(ProviderId.MAEIL_SEONGYEONG, TODAY).orElseThrow().verifiedAt()).isEqualTo(VERIFIED.plusSeconds(3600));
    }

    @Test
    void findReadsTheExactKeyOnlyNeverAnotherDate() {
        store.save(day(ProviderId.MAEIL_SEONGYEONG, TODAY.minusDays(1), VERIFIED.minusSeconds(86400), range("JHN", 2, 1, 2, 5)));

        assertThat(store.find(ProviderId.MAEIL_SEONGYEONG, TODAY)).isEmpty();
        assertThat(store.find(ProviderId.SAENGMYEONG_UI_SAM, TODAY.minusDays(1))).isEmpty();
        assertThat(store.find(ProviderId.MAEIL_SEONGYEONG, TODAY.minusDays(1))).isPresent();
    }

    @Test
    void corruptedItemIsTreatedAsMissingNotGuessed() {
        Map<String, AttributeValue> bad = new HashMap<>();
        bad.put("providerId", AttributeValue.builder().s("maeil-seongyeong").build());
        bad.put("providerDate", AttributeValue.builder().s("2026-09-24").build());
        bad.put("ranges", AttributeValue.builder().s("not-a-range").build());
        fake.putRaw(bad);

        assertThat(store.find(ProviderId.MAEIL_SEONGYEONG, TODAY)).isEmpty();
    }

    @Test
    void closeClosesTheClient() {
        store.close();

        assertThat(fake.closed).isTrue();
    }
}
