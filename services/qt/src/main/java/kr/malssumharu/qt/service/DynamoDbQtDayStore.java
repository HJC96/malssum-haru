package kr.malssumharu.qt.service;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Map;
import java.util.Optional;
import kr.malssumharu.qt.domain.ProviderId;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import software.amazon.awssdk.services.dynamodb.DynamoDbClient;
import software.amazon.awssdk.services.dynamodb.model.AttributeValue;
import software.amazon.awssdk.services.dynamodb.model.GetItemRequest;
import software.amazon.awssdk.services.dynamodb.model.GetItemResponse;
import software.amazon.awssdk.services.dynamodb.model.PutItemRequest;

/**
 * DynamoDB 저장소. 키는 providerId(S) + providerDate(S, YYYY-MM-DD), TTL 속성은 expiresAt(N, epoch 초).
 * 같은 키의 저장은 PutItem 덮어쓰기라 항목이 늘지 않는다. 읽기는 정확한 키만 조회한다(다른 날짜 항목을 찾지 않는다).
 * 장절 구조 정보만 저장하고 본문·해설·개인 데이터 필드는 없다.
 * 실제 DynamoDB로는 시험하지 못했다(README '미시험' 참고).
 */
public class DynamoDbQtDayStore implements QtDayStore, AutoCloseable {

    static final String PROVIDER_ID = "providerId";
    static final String PROVIDER_DATE = "providerDate";
    static final String RANGES = "ranges";
    static final String DISPLAY_REFERENCE = "displayReference";
    static final String VERIFIED_AT = "verifiedAt";
    static final String SOURCE_VERSION = "sourceVersion";
    static final String EXPIRES_AT = "expiresAt";

    private static final Logger log = LoggerFactory.getLogger(DynamoDbQtDayStore.class);

    private final DynamoDbClient client;
    private final String tableName;
    private final Duration itemTtl;

    public DynamoDbQtDayStore(DynamoDbClient client, String tableName, Duration itemTtl) {
        this.client = client;
        this.tableName = tableName;
        this.itemTtl = itemTtl;
    }

    @Override
    public Optional<StoredDay> find(ProviderId providerId, LocalDate providerDate) {
        GetItemResponse response = client.getItem(GetItemRequest.builder()
                .tableName(tableName)
                .key(key(providerId, providerDate))
                .consistentRead(true)
                .build());
        if (!response.hasItem() || response.item().isEmpty()) {
            return Optional.empty();
        }
        Map<String, AttributeValue> item = response.item();
        try {
            return Optional.of(new StoredDay(
                    providerId,
                    LocalDate.parse(str(item, PROVIDER_DATE)),
                    RangeCodec.decode(str(item, RANGES)),
                    str(item, DISPLAY_REFERENCE),
                    Instant.parse(str(item, VERIFIED_AT)),
                    str(item, SOURCE_VERSION)));
        } catch (RuntimeException e) {
            // 손상된 항목은 없는 것으로 본다(추정하지 않는다). 항목 내용은 로그에 남기지 않는다.
            log.warn("provider={} stored item unreadable type={}", providerId.id(), e.getClass().getSimpleName());
            return Optional.empty();
        }
    }

    @Override
    public void save(StoredDay day) {
        Map<String, AttributeValue> item = new java.util.HashMap<>(key(day.providerId(), day.providerDate()));
        item.put(RANGES, s(RangeCodec.encode(day.ranges())));
        item.put(DISPLAY_REFERENCE, s(day.displayReference()));
        item.put(VERIFIED_AT, s(day.verifiedAt().toString()));
        item.put(SOURCE_VERSION, s(day.sourceVersion()));
        item.put(EXPIRES_AT, AttributeValue.builder().n(Long.toString(day.verifiedAt().plus(itemTtl).getEpochSecond())).build());
        client.putItem(PutItemRequest.builder().tableName(tableName).item(item).build());
    }

    private static Map<String, AttributeValue> key(ProviderId id, LocalDate date) {
        return Map.of(PROVIDER_ID, s(id.id()), PROVIDER_DATE, s(date.toString()));
    }

    private static AttributeValue s(String value) {
        return AttributeValue.builder().s(value).build();
    }

    private static String str(Map<String, AttributeValue> item, String name) {
        AttributeValue v = item.get(name);
        if (v == null || v.s() == null) {
            throw new IllegalArgumentException("missing attribute");
        }
        return v.s();
    }

    @Override
    public void close() {
        client.close();
    }
}
