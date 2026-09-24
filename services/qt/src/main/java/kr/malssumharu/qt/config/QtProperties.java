package kr.malssumharu.qt.config;

import java.time.Duration;
import java.util.Map;
import kr.malssumharu.qt.domain.ProviderId;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.ConstructorBinding;
import org.springframework.boot.context.properties.bind.DefaultValue;

/**
 * qt.* 설정.
 *
 * <ul>
 *   <li>{@code qt.acquisition.enabled} 기본 false. 제공처 자동 취득 허용이 확인되기 전에는 공개 배포에서 켜지 않는다.
 *       로컬 실험은 {@code local-experiment} 프로필로 켠다.
 *   <li>{@code qt.providers.<providerId>.disabled} 운영자 kill switch. 취득 플래그보다 우선한다.
 *   <li>{@code qt.providers.<providerId>.acquisition} 제공처별 취득 허용(비우면 전역 값).
 *   <li>Lambda 환경 변수 예: {@code QT_ACQUISITION_ENABLED}, {@code QT_PROVIDERS_MAEILSEONGYEONG_DISABLED}
 *       (환경 변수 이름에는 하이픈을 쓸 수 없으므로 providerId의 하이픈을 뺀 형태를 쓴다).
 *   <li>{@code qt.providers.<providerId>.fetch-origin} 실제로 요청을 보낼 origin(테스트·스모크용).
 *       사용자에게 나가는 공식 링크에는 영향이 없다.
 * </ul>
 */
@ConfigurationProperties(prefix = "qt")
public record QtProperties(
        @DefaultValue Acquisition acquisition,
        @DefaultValue Http http,
        @DefaultValue Cache cache,
        @DefaultValue Storage storage,
        @DefaultValue Collector collector,
        Map<String, ProviderSettings> providers) {

    @ConstructorBinding
    public QtProperties {
    }

    /** 기존 테스트·로컬 코드용: 저장소·수집기 설정은 기본값(메모리 저장, 수집 꺼짐). */
    public QtProperties(Acquisition acquisition, Http http, Cache cache, Map<String, ProviderSettings> providers) {
        this(acquisition, http, cache, new Storage("", 400), new Collector("disabled"), providers);
    }


    public record Acquisition(@DefaultValue("false") boolean enabled) {
    }

    public record Http(
            @DefaultValue("3s") Duration connectTimeout,
            @DefaultValue("5s") Duration requestTimeout,
            @DefaultValue("15s") Duration overallTimeout,
            @DefaultValue("malssum-haru-qt/0.1 (non-commercial local prototype)") String userAgent,
            @DefaultValue("2097152") int maxBodyBytes) {
    }

    public record Cache(
            @DefaultValue("30m") Duration confirmedTtl,
            @DefaultValue("2m") Duration failureTtl) {
    }

    /**
     * 저장소. {@code table-name}(환경 변수 QT_TABLE_NAME)이 비어 있지 않으면 배포 모드다:
     * DynamoDB에 저장하고 조회 API는 저장소의 서울 오늘 항목만 읽는다. 비어 있으면 메모리 저장 + 요청 시 실시간 취득(로컬).
     */
    public record Storage(@DefaultValue("") String tableName, @DefaultValue("400") int itemTtlDays) {
        public boolean deployed() {
            return tableName != null && !tableName.isBlank();
        }
    }

    /** 수집 함수 스위치. {@code enabled}(환경 변수 QT_COLLECTOR_ENABLED)는 enabled/disabled(또는 true/false). 기본 disabled. */
    public record Collector(@DefaultValue("disabled") String enabled) {
        public boolean isEnabled() {
            return switchOn(enabled);
        }
    }

    /**
     * @param state 환경 변수 QT_PROVIDER_MAEIL_SEONGYEONG 등의 enabled/disabled 값(비면 enabled로 본다)
     */
    public record ProviderSettings(
            @DefaultValue("false") boolean disabled, Boolean acquisition, String fetchOrigin, String state) {

        @ConstructorBinding
        public ProviderSettings {
        }

        public ProviderSettings(boolean disabled, Boolean acquisition, String fetchOrigin) {
            this(disabled, acquisition, fetchOrigin, null);
        }

        boolean isOff() {
            return disabled || (state != null && !state.isBlank() && !switchOn(state));
        }
    }

    static boolean switchOn(String value) {
        return value != null && (value.trim().equalsIgnoreCase("enabled") || value.trim().equalsIgnoreCase("true"));
    }

    /**
     * 키는 하이픈·밑줄·대소문자를 무시하고 비교한다. Lambda 환경 변수 이름에는 하이픈을 쓸 수 없어
     * {@code QT_PROVIDERS_MAEILSEONGYEONG_DISABLED=true} 처럼 설정하면 키가 {@code maeilseongyeong}으로 들어오기 때문이다.
     * 같은 제공처로 정규화되는 항목이 여러 개면(application.yml의 state 자리표시자 + 환경 변수) 합쳐서 본다:
     * 하나라도 끄면 꺼진 것, 취득 덮어쓰기·fetch-origin은 처음 값이 있는 항목을 쓴다.
     */
    private ProviderSettings settings(ProviderId id) {
        if (providers == null) {
            return null;
        }
        String wanted = normalize(id.id());
        boolean off = false;
        Boolean acquisitionOverride = null;
        String origin = null;
        boolean found = false;
        for (Map.Entry<String, ProviderSettings> e : providers.entrySet()) {
            if (!normalize(e.getKey()).equals(wanted) || e.getValue() == null) {
                continue;
            }
            found = true;
            ProviderSettings ps = e.getValue();
            off = off || ps.isOff();
            if (acquisitionOverride == null) {
                acquisitionOverride = ps.acquisition();
            }
            if ((origin == null || origin.isBlank()) && ps.fetchOrigin() != null) {
                origin = ps.fetchOrigin();
            }
        }
        return found ? new ProviderSettings(off, acquisitionOverride, origin, null) : null;
    }

    private static String normalize(String key) {
        return key.replaceAll("[-_]", "").toLowerCase(java.util.Locale.ROOT);
    }

    public boolean disabled(ProviderId id) {
        ProviderSettings s = settings(id);
        return s != null && s.disabled();
    }

    public boolean acquisitionEnabled(ProviderId id) {
        ProviderSettings s = settings(id);
        return s != null && s.acquisition() != null ? s.acquisition() : acquisition.enabled();
    }

    public String fetchOrigin(ProviderId id, String defaultOrigin) {
        ProviderSettings s = settings(id);
        return s != null && s.fetchOrigin() != null && !s.fetchOrigin().isBlank() ? s.fetchOrigin() : defaultOrigin;
    }
}
