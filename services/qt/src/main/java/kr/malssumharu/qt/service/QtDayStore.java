package kr.malssumharu.qt.service;

import java.time.LocalDate;
import java.util.Optional;
import kr.malssumharu.qt.domain.ProviderId;

/** (providerId, providerDate)가 키다. 같은 키의 재수집은 항목을 늘리지 않고 덮어쓴다. */
public interface QtDayStore {

    Optional<StoredDay> find(ProviderId providerId, LocalDate providerDate);

    void save(StoredDay day);
}
