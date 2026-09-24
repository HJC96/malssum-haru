package kr.malssumharu.qt.api;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeSet;
import kr.malssumharu.qt.support.Fixtures;
import kr.malssumharu.qt.support.MockUpstream.Reply;
import kr.malssumharu.qt.support.Rig;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/**
 * docs/contracts/qt-today.md '테스트 가능한 기준' 1~6 (7은 FixtureRulesTest). PRD AC11, AC18(제공처 날짜).
 * 제공처는 로컬 목 서버이고 인터넷에 의존하지 않는다.
 */
class QtTodayContractTest {

    private static final LocalDate TODAY = LocalDate.of(2026, 9, 24);
    private static final JsonMapper JSON = JsonMapper.builder().build();
    private static final String SENTINEL = "SENTINEL";

    private Rig rig;
    private MockMvc mvc;

    @BeforeEach
    void setUp() {
        rig = new Rig();
        mvc = MockMvcBuilders.standaloneSetup(new QtTodayController(rig.service)).build();
    }

    @AfterEach
    void tearDown() {
        rig.close();
    }

    private void maeilOk(String reference) {
        rig.upstream.on("GET", "/bible/today", Reply.html(Fixtures.maeilPage(TODAY, reference)));
    }

    private void durannoOk(String reference) {
        rig.upstream.on("GET", "/qt/view/bible.asp", Reply.eucKrHtml(Fixtures.durannoPage(TODAY, reference)));
    }

    private JsonNode call() throws Exception {
        String body = mvc.perform(get("/api/qt/today"))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        return JSON.readTree(body);
    }

    private static JsonNode provider(JsonNode root, String id) {
        for (JsonNode p : root.get("providers")) {
            if (p.get("providerId").asString().equals(id)) {
                return p;
            }
        }
        throw new AssertionError("provider not in response: " + id);
    }

    // 기준 1
    @Test
    void bothProvidersSucceedAsRangeConfirmedInContractOrder() throws Exception {
        maeilOk("요한복음(John) 3:1 - 3:21");
        durannoOk("역대상  14 : 1~17");

        JsonNode root = call();

        assertThat(root.get("schemaVersion").asString()).isEqualTo("1");
        assertThat(Instant.parse(root.get("generatedAt").asString())).isEqualTo(Rig.NOON_SEOUL_0924);
        assertThat(root.get("providers")).hasSize(2);
        assertThat(root.get("providers").get(0).get("providerId").asString()).isEqualTo("maeil-seongyeong");
        assertThat(root.get("providers").get(1).get("providerId").asString()).isEqualTo("saengmyeong-ui-sam");

        JsonNode maeil = provider(root, "maeil-seongyeong");
        assertThat(maeil.get("availabilityStatus").asString()).isEqualTo("RANGE_CONFIRMED");
        assertThat(maeil.get("reasonCode").isNull()).isTrue();
        assertThat(maeil.get("providerDate").asString()).isEqualTo("2026-09-24");
        assertThat(maeil.get("providerTimeZone").asString()).isEqualTo("Asia/Seoul");
        assertThat(maeil.get("providerName").get("ko").asString()).isEqualTo("매일성경");
        JsonNode range = maeil.get("passage").get("ranges").get(0);
        assertThat(range.get("bookId").asString()).isEqualTo("JHN");
        assertThat(range.get("start").get("chapter").asInt()).isEqualTo(3);
        assertThat(range.get("start").get("verse").asInt()).isEqualTo(1);
        assertThat(range.get("end").get("chapter").asInt()).isEqualTo(3);
        assertThat(range.get("end").get("verse").asInt()).isEqualTo(21);
        assertThat(maeil.get("officialUrl").asString()).isEqualTo("https://sum.su.or.kr:8888/bible/today");
        assertThat(maeil.get("officialUrlKind").asString()).isEqualTo("today-page");
        assertThat(maeil.get("sourceVersion").asString()).isEqualTo("maeil-seongyeong-adapter/1");
        assertThat(maeil.get("bodyStatus").asString()).isEqualTo("NOT_PROVIDED");
        assertThat(Instant.parse(maeil.get("verifiedAt").asString())).isEqualTo(Rig.NOON_SEOUL_0924);
        assertThat(maeil.get("notice").get("ko").asString()).isNotBlank();

        JsonNode saeng = provider(root, "saengmyeong-ui-sam");
        assertThat(saeng.get("availabilityStatus").asString()).isEqualTo("RANGE_CONFIRMED");
        assertThat(saeng.get("passage").get("ranges").get(0).get("bookId").asString()).isEqualTo("1CH");
        assertThat(saeng.get("officialUrl").asString())
                .isEqualTo("https://www.duranno.com/qt/view/bible.asp?qtDate=2026-09-24");
        assertThat(saeng.get("officialUrlKind").asString()).isEqualTo("date-specific");
        assertThat(saeng.get("displayReference").asString()).contains("14");
    }

    // 기준 2
    @Test
    void oneProviderParseFailureDoesNotAffectTheOtherAndStaysHttp200() throws Exception {
        rig.upstream.on("GET", "/bible/today", Reply.html("<html><body>구조가 완전히 바뀐 페이지</body></html>"));
        rig.upstream.on("POST", "/Ajax/Bible/BodyMatterDetail", Reply.status(500));
        durannoOk("역대상  14 : 1~17");

        JsonNode root = call();

        JsonNode maeil = provider(root, "maeil-seongyeong");
        assertThat(maeil.get("availabilityStatus").asString()).isEqualTo("RANGE_UNAVAILABLE");
        assertThat(maeil.get("reasonCode").asString()).isIn("PARSE_FAILED", "DYNAMIC_CONTENT_UNAVAILABLE");
        assertThat(maeil.get("passage").isNull()).isTrue();
        assertThat(maeil.get("officialUrl").asString()).isNotBlank();
        assertThat(provider(root, "saengmyeong-ui-sam").get("availabilityStatus").asString())
                .isEqualTo("RANGE_CONFIRMED");
    }

    @Test
    void parseFailureOfTheOtherProviderIsIsolatedSymmetrically() throws Exception {
        maeilOk("요한복음 3:1 - 3:21");
        rig.upstream.on("GET", "/qt/view/bible.asp", Reply.eucKrHtml(Fixtures.load("duranno-shell.html")));

        JsonNode root = call();

        assertThat(provider(root, "maeil-seongyeong").get("availabilityStatus").asString()).isEqualTo("RANGE_CONFIRMED");
        JsonNode saeng = provider(root, "saengmyeong-ui-sam");
        assertThat(saeng.get("availabilityStatus").asString()).isEqualTo("RANGE_UNAVAILABLE");
        assertThat(saeng.get("reasonCode").asString()).isEqualTo("PARSE_FAILED");
        assertThat(saeng.get("passage").isNull()).isTrue();
    }

    // 기준 3
    @Test
    void providerDateDifferentFromSeoulTodayIsDateMismatchWithoutPassage() throws Exception {
        LocalDate yesterday = TODAY.minusDays(1);
        rig.upstream.on("GET", "/bible/today", Reply.html(Fixtures.maeilPage(yesterday, "요한복음 3:1 - 3:21")));
        rig.upstream.on("GET", "/qt/view/bible.asp",
                Reply.eucKrHtml(Fixtures.durannoPage(yesterday, "역대상  13 : 1~14")));

        JsonNode root = call();

        for (JsonNode p : root.get("providers")) {
            assertThat(p.get("availabilityStatus").asString()).isEqualTo("RANGE_UNAVAILABLE");
            assertThat(p.get("reasonCode").asString()).isEqualTo("DATE_MISMATCH");
            assertThat(p.get("passage").isNull()).isTrue();
            assertThat(p.get("displayReference").isNull()).isTrue();
            assertThat(p.get("verifiedAt").isNull()).isTrue();
            assertThat(p.get("providerDate").asString()).isEqualTo("2026-09-23");
            assertThat(p.get("officialUrl").asString()).startsWith("https://");
        }
        assertThat(rig.store.size()).isZero();
    }

    @Test
    void seoulDayBoundaryDecidesWhichDateIsRequestedAndCompared() throws Exception {
        // 2026-09-23 23:59 KST = 14:59 UTC: 서울 오늘은 09-23
        rig.clock.set(Instant.parse("2026-09-23T14:59:00Z"));
        rig.upstream.on("GET", "/bible/today", Reply.html(Fixtures.maeilPage(TODAY, "요한복음 3:1 - 3:21")));
        rig.upstream.on("GET", "/qt/view/bible.asp",
                Reply.eucKrHtml(Fixtures.durannoPage(LocalDate.of(2026, 9, 23), "역대상  13 : 1~14")));

        JsonNode root = call();

        assertThat(rig.upstream.requests()).contains("GET /qt/view/bible.asp?qtDate=2026-09-23");
        assertThat(provider(root, "saengmyeong-ui-sam").get("availabilityStatus").asString()).isEqualTo("RANGE_CONFIRMED");
        assertThat(provider(root, "saengmyeong-ui-sam").get("officialUrl").asString()).endsWith("qtDate=2026-09-23");
        // 매일성경 페이지는 사용자의 UTC 날짜(09-24)로 앞서 있어도 서울 오늘(09-23)과 다르면 채택하지 않는다
        assertThat(provider(root, "maeil-seongyeong").get("reasonCode").asString()).isEqualTo("DATE_MISMATCH");

        // 15:00 UTC = 00:00 KST: 서울 오늘이 09-24로 바뀐다
        rig.clock.set(Instant.parse("2026-09-23T15:00:00Z"));
        rig.upstream.clearRequests();
        rig.clock.advance(java.time.Duration.ofHours(1));
        rig.upstream.on("GET", "/qt/view/bible.asp", Reply.eucKrHtml(Fixtures.durannoPage(TODAY, "역대상  14 : 1~17")));
        root = call();
        assertThat(rig.upstream.requests()).contains("GET /qt/view/bible.asp?qtDate=2026-09-24");
        assertThat(provider(root, "maeil-seongyeong").get("availabilityStatus").asString()).isEqualTo("RANGE_CONFIRMED");
    }

    // 기준 4
    @Test
    void unreachableOrErroringOfficialLinkIsLinkError() throws Exception {
        rig.upstream.on("GET", "/bible/today", Reply.status(500));
        // 생명의삶은 응답 자체가 없다(라우트 없음 → 404)

        JsonNode root = call();

        JsonNode maeil = provider(root, "maeil-seongyeong");
        assertThat(maeil.get("availabilityStatus").asString()).isEqualTo("LINK_ERROR");
        assertThat(maeil.get("reasonCode").asString()).isEqualTo("UPSTREAM_HTTP_ERROR");
        assertThat(maeil.get("passage").isNull()).isTrue();
        assertThat(maeil.get("officialUrl").asString()).isEqualTo("https://sum.su.or.kr:8888/bible/today");
        JsonNode saeng = provider(root, "saengmyeong-ui-sam");
        assertThat(saeng.get("availabilityStatus").asString()).isEqualTo("LINK_ERROR");
        assertThat(saeng.get("officialUrl").asString()).startsWith("https://");
    }

    @Test
    void connectionFailureIsLinkErrorWithUnreachableReason() throws Exception {
        Rig dead = new Rig();
        MockMvc deadMvc = MockMvcBuilders.standaloneSetup(new QtTodayController(dead.service)).build();
        dead.upstream.close();

        JsonNode root = JSON.readTree(
                deadMvc.perform(get("/api/qt/today")).andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
        dead.executor.shutdownNow();

        for (JsonNode p : root.get("providers")) {
            assertThat(p.get("availabilityStatus").asString()).isEqualTo("LINK_ERROR");
            assertThat(p.get("reasonCode").asString()).isEqualTo("LINK_UNREACHABLE");
        }
    }

    @Test
    void slowProviderTimesOutWhileTheOtherReturnsNormally() throws Exception {
        try (Rig slow = new Rig(true, Map.of(), java.time.Duration.ofMillis(200), java.time.Duration.ofSeconds(20))) {
            MockMvc slowMvc = MockMvcBuilders.standaloneSetup(new QtTodayController(slow.service)).build();
            slow.upstream.on("GET", "/bible/today", Reply.html(Fixtures.maeilPage(TODAY, "요 3:1-3")).delayed(2000));
            slow.upstream.on("GET", "/qt/view/bible.asp", Reply.eucKrHtml(Fixtures.durannoPage(TODAY, "역대상  14 : 1~17")));

            JsonNode root = JSON.readTree(
                    slowMvc.perform(get("/api/qt/today")).andExpect(status().isOk()).andReturn().getResponse().getContentAsString());

            JsonNode maeil = provider(root, "maeil-seongyeong");
            assertThat(maeil.get("availabilityStatus").asString()).isEqualTo("LINK_ERROR");
            assertThat(maeil.get("reasonCode").asString()).isEqualTo("UPSTREAM_TIMEOUT");
            assertThat(provider(root, "saengmyeong-ui-sam").get("availabilityStatus").asString())
                    .isEqualTo("RANGE_CONFIRMED");
        }
    }

    // 기준 5
    @Test
    void responseHasNoBibleTextOrCommentaryFieldsAndLeaksNoProviderText() throws Exception {
        // 제공처 응답에 해설·본문 자리를 채워 두고, 어느 것도 응답에 새지 않는지 확인한다
        rig.upstream.on("GET", "/bible/today", Reply.html(
                Fixtures.maeilPage(TODAY, "요한복음 3:1 - 3:21") + "<p>" + SENTINEL + "_BODY_TEXT</p>"));
        rig.upstream.on("GET", "/qt/view/bible.asp", Reply.eucKrHtml(
                Fixtures.durannoPage(TODAY, "역대상  14 : 1~17") + "<p>" + SENTINEL + "_BODY_TEXT</p>"));

        String raw = mvc.perform(get("/api/qt/today")).andReturn().getResponse().getContentAsString();
        JsonNode root = JSON.readTree(raw);

        assertThat(raw).doesNotContain(SENTINEL).doesNotContain("FIXTURE_");
        Set<String> allowedProviderKeys = Set.of("providerId", "providerName", "providerTimeZone", "providerDate",
                "availabilityStatus", "reasonCode", "passage", "displayReference", "officialUrl", "officialUrlKind",
                "verifiedAt", "sourceVersion", "bodyStatus", "notice");
        assertThat(keys(root)).containsExactlyInAnyOrder("schemaVersion", "generatedAt", "providers");
        for (JsonNode p : root.get("providers")) {
            assertThat(keys(p)).isEqualTo(new TreeSet<>(allowedProviderKeys));
            assertThat(keys(p.get("passage"))).containsExactly("ranges");
            assertThat(keys(p.get("passage").get("ranges").get(0))).containsExactlyInAnyOrder("bookId", "start", "end");
        }
        // bodyStatus는 "NOT_PROVIDED" 상태 값일 뿐 본문 필드가 아니다. 그 밖에 본문·해설을 암시하는 필드명은 없다
        assertThat(allFieldNames(root)).contains("bodyStatus")
                .filteredOn(n -> !n.equals("bodyStatus"))
                .noneMatch(n -> n.matches("(?i).*(body|text|verse_text|content|commentary|meditation|question|summary).*"));
        for (JsonNode p : root.get("providers")) {
            assertThat(p.get("bodyStatus").asString()).isEqualTo("NOT_PROVIDED");
        }
    }

    // 기준 6
    @Test
    void everyEntryHasANonEmptyHttpsOfficialUrlInEveryStatus() throws Exception {
        // 확인됨 / 파싱 실패 / 링크 오류 / 취득 불허 / 비활성 을 모두 만든다
        maeilOk("요한복음 3:1 - 3:21");
        rig.upstream.on("GET", "/qt/view/bible.asp", Reply.status(500));
        assertAllHttps(call());

        rig.upstream.on("GET", "/bible/today", Reply.html("<html></html>"));
        rig.upstream.on("POST", "/Ajax/Bible/BodyMatterDetail", Reply.status(500));
        rig.clock.advance(java.time.Duration.ofMinutes(3)); // 실패 캐시 만료
        assertAllHttps(call());

        try (Rig off = new Rig(false, Map.of(), java.time.Duration.ofMillis(300), java.time.Duration.ofSeconds(20))) {
            MockMvc offMvc = MockMvcBuilders.standaloneSetup(new QtTodayController(off.service)).build();
            assertAllHttps(JSON.readTree(offMvc.perform(get("/api/qt/today")).andReturn().getResponse().getContentAsString()));
        }
        try (Rig disabled = new Rig(true, Map.of(
                "maeil-seongyeong", new kr.malssumharu.qt.config.QtProperties.ProviderSettings(true, null, null),
                "saengmyeong-ui-sam", new kr.malssumharu.qt.config.QtProperties.ProviderSettings(true, null, null)),
                java.time.Duration.ofMillis(300), java.time.Duration.ofSeconds(20))) {
            MockMvc dMvc = MockMvcBuilders.standaloneSetup(new QtTodayController(disabled.service)).build();
            assertAllHttps(JSON.readTree(dMvc.perform(get("/api/qt/today")).andReturn().getResponse().getContentAsString()));
        }
    }

    private static void assertAllHttps(JsonNode root) {
        assertThat(root.get("providers")).hasSize(2);
        for (JsonNode p : root.get("providers")) {
            String url = p.get("officialUrl").asString();
            assertThat(url).isNotBlank().startsWith("https://");
            assertThat(java.net.URI.create(url).getHost()).isNotBlank();
            assertThat(p.get("officialUrlKind").asString()).isIn("date-specific", "today-page");
        }
    }

    private static Set<String> keys(JsonNode node) {
        Set<String> keys = new TreeSet<>();
        for (Iterator<String> it = node.propertyNames().iterator(); it.hasNext(); ) {
            keys.add(it.next());
        }
        return keys;
    }

    private static List<String> allFieldNames(JsonNode node) {
        List<String> names = new ArrayList<>();
        collect(node, names);
        return names;
    }

    private static void collect(JsonNode node, List<String> names) {
        if (node.isObject()) {
            node.properties().forEach(e -> {
                names.add(e.getKey());
                collect(e.getValue(), names);
            });
        } else if (node.isArray()) {
            node.forEach(child -> collect(child, names));
        }
    }
}
