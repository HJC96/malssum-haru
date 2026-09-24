package kr.malssumharu.qt.support;

import java.lang.reflect.Proxy;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;
import software.amazon.awssdk.services.dynamodb.DynamoDbClient;
import software.amazon.awssdk.services.dynamodb.model.AttributeValue;
import software.amazon.awssdk.services.dynamodb.model.GetItemRequest;
import software.amazon.awssdk.services.dynamodb.model.GetItemResponse;
import software.amazon.awssdk.services.dynamodb.model.PutItemRequest;
import software.amazon.awssdk.services.dynamodb.model.PutItemResponse;

/**
 * DynamoDbClient 대역(테이블 하나, 키 = providerId + providerDate). 실제 DynamoDB의 조건부 쓰기·TTL 삭제·일관성은
 * 흉내 내지 않는다. PutItem은 같은 키를 덮어쓰고 GetItem은 정확한 키만 돌려준다.
 */
public final class FakeDynamoDb {

    private final Map<String, Map<String, AttributeValue>> items = new ConcurrentHashMap<>();
    public final AtomicInteger gets = new AtomicInteger();
    public final AtomicInteger puts = new AtomicInteger();
    public volatile RuntimeException failWith;
    public volatile String expectedTable = "qt-table";
    public volatile boolean closed;

    public DynamoDbClient client() {
        return (DynamoDbClient) Proxy.newProxyInstance(
                DynamoDbClient.class.getClassLoader(), new Class<?>[] {DynamoDbClient.class}, (proxy, method, args) -> {
                    switch (method.getName()) {
                        case "getItem" -> {
                            if (!(args[0] instanceof GetItemRequest request)) {
                                throw new UnsupportedOperationException(method.toString());
                            }
                            gets.incrementAndGet();
                            check(request.tableName());
                            Map<String, AttributeValue> found = items.get(keyOf(request.key()));
                            return GetItemResponse.builder().item(found == null ? Map.of() : found).build();
                        }
                        case "putItem" -> {
                            if (!(args[0] instanceof PutItemRequest request)) {
                                throw new UnsupportedOperationException(method.toString());
                            }
                            puts.incrementAndGet();
                            check(request.tableName());
                            items.put(keyOf(request.item()), new HashMap<>(request.item()));
                            return PutItemResponse.builder().build();
                        }
                        case "close" -> {
                            closed = true;
                            return null;
                        }
                        case "serviceName" -> {
                            return "dynamodb";
                        }
                        default -> throw new UnsupportedOperationException(method.toString());
                    }
                });
    }

    private void check(String table) {
        if (failWith != null) {
            throw failWith;
        }
        if (!expectedTable.equals(table)) {
            throw new IllegalStateException("unexpected table");
        }
    }

    private static String keyOf(Map<String, AttributeValue> map) {
        return map.get("providerId").s() + "|" + map.get("providerDate").s();
    }

    public void clear() {
        items.clear();
    }

    public int itemCount() {
        return items.size();
    }

    public Map<String, AttributeValue> rawItem(String providerId, String providerDate) {
        return items.get(providerId + "|" + providerDate);
    }

    public void putRaw(Map<String, AttributeValue> item) {
        items.put(keyOf(item), item);
    }
}
