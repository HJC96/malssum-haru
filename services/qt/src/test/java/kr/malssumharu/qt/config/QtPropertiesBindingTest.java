package kr.malssumharu.qt.config;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.Map;
import kr.malssumharu.qt.domain.ProviderId;
import org.junit.jupiter.api.Test;
import org.springframework.boot.context.properties.bind.Binder;
import org.springframework.boot.context.properties.source.ConfigurationPropertySources;
import org.springframework.core.env.MapPropertySource;
import org.springframework.core.env.SystemEnvironmentPropertySource;

/** Lambda 환경 변수 이름 규칙(하이픈 불가)으로도 취득 플래그와 kill switch를 설정할 수 있다. */
class QtPropertiesBindingTest {

    private static QtProperties bindEnv(Map<String, Object> env) {
        var source = new SystemEnvironmentPropertySource("systemEnvironment", env);
        return new Binder(ConfigurationPropertySources.from(source)).bindOrCreate("qt", QtProperties.class);
    }

    @Test
    void noEnvironmentVariablesMeansAcquisitionOff() {
        QtProperties props = new Binder(ConfigurationPropertySources.from(new MapPropertySource("empty", Map.of())))
                .bindOrCreate("qt", QtProperties.class);

        assertThat(props.acquisitionEnabled(ProviderId.MAEIL_SEONGYEONG)).isFalse();
        assertThat(props.acquisitionEnabled(ProviderId.SAENGMYEONG_UI_SAM)).isFalse();
        assertThat(props.disabled(ProviderId.MAEIL_SEONGYEONG)).isFalse();
    }

    @Test
    void lambdaStyleEnvironmentVariablesBindAcquisitionFlagAndKillSwitch() {
        QtProperties props = bindEnv(Map.of(
                "QT_ACQUISITION_ENABLED", "true",
                "QT_PROVIDERS_MAEILSEONGYEONG_DISABLED", "true"));

        assertThat(props.acquisitionEnabled(ProviderId.SAENGMYEONG_UI_SAM)).isTrue();
        assertThat(props.disabled(ProviderId.MAEIL_SEONGYEONG)).isTrue();
        assertThat(props.disabled(ProviderId.SAENGMYEONG_UI_SAM)).isFalse();
    }

    @Test
    void perProviderAcquisitionOverrideBindsFromEnvironmentVariable() {
        QtProperties props = bindEnv(Map.of("QT_PROVIDERS_SAENGMYEONGUISAM_ACQUISITION", "true"));

        assertThat(props.acquisitionEnabled(ProviderId.SAENGMYEONG_UI_SAM)).isTrue();
        assertThat(props.acquisitionEnabled(ProviderId.MAEIL_SEONGYEONG)).isFalse();
    }

    @Test
    void hyphenatedPropertyKeysStillWork() {
        var source = new MapPropertySource("props", Map.of("qt.providers.maeil-seongyeong.disabled", "true"));
        QtProperties props = new Binder(ConfigurationPropertySources.from(source)).bindOrCreate("qt", QtProperties.class);

        assertThat(props.disabled(ProviderId.MAEIL_SEONGYEONG)).isTrue();
    }
}
