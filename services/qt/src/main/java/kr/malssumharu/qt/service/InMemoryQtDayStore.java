package kr.malssumharu.qt.service;

import java.time.LocalDate;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import kr.malssumharu.qt.domain.ProviderId;

/** 로컬용 메모리 저장소. DB 없음(배포 모드는 {@link DynamoDbQtDayStore}). */
public class InMemoryQtDayStore implements QtDayStore {

    private record Key(ProviderId providerId, LocalDate providerDate) {
    }

    private final Map<Key, StoredDay> days = new ConcurrentHashMap<>();

    @Override
    public Optional<StoredDay> find(ProviderId providerId, LocalDate providerDate) {
        return Optional.ofNullable(days.get(new Key(providerId, providerDate)));
    }

    @Override
    public void save(StoredDay day) {
        days.put(new Key(day.providerId(), day.providerDate()), day);
    }

    public int size() {
        return days.size();
    }
}
