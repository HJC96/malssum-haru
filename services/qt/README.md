# services/qt: QT 오늘 장절 서비스

매일성경과 생명의삶의 오늘 QT **장절 범위·제공처 날짜·공식 링크**를 하나의 JSON으로 돌려주는 로컬 API.
응답 형식은 [`docs/contracts/qt-today.md`](../../docs/contracts/qt-today.md)(계약 v1)가 기준이다.
성경 본문·제공처 해설은 다루지 않고 응답에도 없다. 개인 계획·읽은 범위와 무관하다.

PRD 검수 기준: AC11(본문을 못 주면 오늘 장절과 공식 링크만, 범위도 없으면 추정 없이 상태와 링크), AC18(제공처 날짜 기준 표시). 구현 계획 M1.

## 실행

Java 21, Maven 3.9.

```sh
cd services/qt
mvn -q test                     # 전체 테스트 (인터넷 불필요)
mvn spring-boot:run             # 기본: 취득 off → RANGE_NOT_PERMITTED + 공식 링크만 (포트 8081)
mvn spring-boot:run -Dspring-boot.run.profiles=local-experiment   # 로컬 실험: 제공처에서 장절을 실제로 읽음
curl -s localhost:8081/api/qt/today
```

## 설정 (`application.yml`)

| 키 | 기본 | 의미 |
| --- | --- | --- |
| `qt.acquisition.enabled` | `false` | 제공처 공식 페이지에서 장절을 읽을지. **자동 취득 허용이 확인되기 전에는 공개 배포에서 켜지 않는다.** off면 제공처에 요청하지 않고 `RANGE_NOT_PERMITTED` / `PERMISSION_UNCONFIRMED` + 공식 링크만 나간다. `local-experiment` 프로필이 켠다 |
| `qt.providers.<providerId>.acquisition` | (전역 값) | 제공처별 취득 허용 덮어쓰기. providerId는 `maeil-seongyeong`, `saengmyeong-ui-sam` |
| `qt.providers.<providerId>.disabled` | `false` | 운영자 kill switch. `DISABLED` / `OPERATOR_DISABLED` + 공식 링크만. 취득 플래그보다 우선한다 |
| `qt.providers.<providerId>.fetch-origin` | 제공처 origin | 요청을 보낼 origin(테스트·스모크용). 사용자에게 나가는 `officialUrl`은 항상 공식 https 주소로 고정이라 영향 없음 |
| `qt.http.connect-timeout` / `request-timeout` / `overall-timeout` | 3s / 5s / 15s | 제공처 요청 제한. overall은 한 제공처의 총 대기 상한 |
| `qt.http.user-agent` | `malssum-haru-qt/0.1 (non-commercial local prototype)` | 제공처에 보내는 User-Agent. 운영 시 연락처를 넣는다 |
| `qt.cache.confirmed-ttl` / `failure-ttl` | 30m / 2m | 확인된 항목 재사용 시간 / 실패 결과 재사용 시간(제공처에 반복 요청하지 않기 위함) |

## 구조

```
kr.malssumharu.qt
  api/        GET /api/qt/today 컨트롤러와 응답 DTO (계약 v1)
  service/    QtTodayService(서울 오늘 계산, 제공처 병렬·격리, 상태 판정), QtDayStore(메모리, 키 = providerId+providerDate)
  provider/   QtProviderAdapter 인터페이스, MaeilSeongyeongAdapter, SaengmyeongUiSamAdapter
  bible/      BibleBooks(66권 USFM), ReferenceParser(한국어 장절 → bookId + 장:절 범위), VerseCountTable(연결점)
  http/       HttpFetcher(JDK HttpClient 구현, 타임아웃·크기 제한)
  domain/     상태·사유 코드·범위 모델
  config/     QtProperties, 빈 구성 (Clock 주입)
  lambda/     AWS Lambda 진입점(QtLambdaHandler, 함수 빈 QtLambdaFunctions), 아래 Lambda 절 참고
```

동작 규칙:
- 서울 시간대 오늘을 주입된 `Clock`으로 계산한다. 제공처가 표시한 날짜가 서울 오늘과 다르면 `RANGE_UNAVAILABLE` / `DATE_MISMATCH`이고 `passage`는 null이다. 저장소는 서울 오늘 키로만 조회하므로 어제 자료가 오늘로 나가지 않는다.
- 한 제공처의 실패·예외·지연은 그 제공처 항목의 상태로만 나타난다. HTTP는 200을 유지한다.
- 링크 확인 실패 매핑: 연결 실패 → `LINK_ERROR`/`LINK_UNREACHABLE`, 타임아웃 → `LINK_ERROR`/`UPSTREAM_TIMEOUT`, HTTP 4xx/5xx → `LINK_ERROR`/`UPSTREAM_HTTP_ERROR`. 공식 페이지 GET이 링크 확인을 겸한다.
- 로그에는 제공처·상태·사유 코드만 남긴다. 제공처 본문, 장절 표기, 예외 메시지·스택트레이스는 남기지 않는다.
- 장 전체만 표기한 날처럼 절 수 표가 필요한 경우는 추정하지 않고 `INVALID_REFERENCE`. 절 수 표(`VerseCountTable`)가 확정되면 빈으로 연결한다.
- `ReasonCode.INTERNAL_ERROR`는 계약 초안에 없던 값으로 추가했다(어댑터 예기치 못한 예외 격리용, 개방형 열거).

제공처 조사 결과는 [`docs/adapter-notes.md`](docs/adapter-notes.md).

## 테스트 (계약 '테스트 가능한 기준' 대응)

`mvn -q test`. HTTP는 JDK `HttpServer` 기반 로컬 목 서버(`src/test/.../support/MockUpstream`)를 쓴다.

| 계약 기준 | 테스트 |
| --- | --- |
| 1 두 제공처 성공 | `QtTodayContractTest.bothProvidersSucceed...`, `QtTodayApiTest`(실제 HTTP) |
| 2 한쪽 파싱 실패 격리, HTTP 200 | `QtTodayContractTest.oneProviderParseFailure...`, `...IsolatedSymmetrically` |
| 3 날짜 불일치 → DATE_MISMATCH | `QtTodayContractTest.providerDateDifferent...`, `seoulDayBoundary...`, `QtTodayServiceTest.yesterdaysStoredRange...` |
| 4 링크 오류 → LINK_ERROR | `QtTodayContractTest.unreachableOrErroring...`, `connectionFailure...`, `slowProvider...` |
| 5 본문·해설 필드 없음 | `QtTodayContractTest.responseHasNoBibleText...`(허용 필드 집합·본문 자리 표시자 누출 검사) |
| 6 officialUrl https·비어 있지 않음 | `QtTodayContractTest.everyEntryHasANonEmptyHttpsOfficialUrl...`(모든 상태) |
| 7 fixture에 본문·해설 없음 | `FixtureRulesTest`(크기·한글 연속 길이 제한), fixture는 구조 조각만 |

추가 실패 시나리오: 매일성경 동적 로딩 실패·JSON 오류·필드 누락·HTML 구조 변경(`MaeilSeongyeongAdapterTest`), 생명의삶 EUC-KR 해독·문자셋 오표기·깨짐·껍데기 페이지·구조 변경·불가능한 날짜(`SaengmyeongUiSamAdapterTest`), 타임아웃·연결 거부·HTTP 오류, 재수집 중복 없음·캐시·동시 호출 단일 요청·kill switch·취득 플래그·어댑터 예외/무응답 격리·로그에 원문 없음(`QtTodayServiceTest`), 장절 정규화(`ReferenceParserTest`, `BibleBooksTest`).

## AWS Lambda 배포 산출물 (T15, 로컬 검증만: 실제 AWS 호출·배포 없음)

같은 `QtTodayService`를 Lambda(API Gateway HTTP API 프록시 이벤트, Java 21)에서 실행하는 진입점이다. Spring Cloud Function AWS 어댑터(`spring-cloud-function-adapter-aws`, Cloud 2025.1.3 BOM = Function 5.0.4)의 `FunctionInvoker`를 쓴다. 근거 문서: <https://docs.spring.io/spring-cloud-function/reference/adapters/aws-intro.html> (2026-09-24 확인).

**platform-cost(IaC)가 참조할 값**

| 항목 | 값 |
| --- | --- |
| 빌드 | `cd services/qt && mvn -B package` (테스트 생략: `-DskipTests`) |
| **배포 산출물** | `services/qt/target/qt-service-0.0.1-SNAPSHOT-aws.jar` (shaded, 의존성 전부 포함, thin 아님, 약 27MB. zip 직접 업로드 한도 50MB 이내) |
| 배포하지 않는 것 | `qt-service-0.0.1-SNAPSHOT.jar`(shade 입력용 일반 jar), `...-exec.jar`(로컬 `java -jar` 실행용 Spring Boot jar) |
| 런타임 | `java21` (Corretto). x86_64·arm64 모두 순수 Java라 무관 |
| **핸들러 문자열** | `kr.malssumharu.qt.lambda.QtLambdaHandler::handleRequest` |
| 이벤트 | API Gateway **HTTP API, payload format 2.0** (`APIGatewayV2HTTPEvent`). 라우트 `GET /api/qt/today`. 그 밖의 경로는 404, 다른 메서드는 405(`Allow: GET`) JSON을 돌려준다 |
| 응답 | HTTP 200, `Content-Type: application/json`, 본문은 계약 v1.1 JSON. 로컬 REST 컨트롤러 본문과 바이트 단위로 같다(`QtLambdaFunctionsTest`) |
| 필수 환경 변수 | 없음. 함수 이름(`qtToday`)은 핸들러 클래스가 고정해 넘긴다 |
| 선택 환경 변수 | `QT_ACQUISITION_ENABLED` (기본 false: 제공처에 요청하지 않고 RANGE_NOT_PERMITTED + 공식 링크. **권리 확인 전에는 true로 두지 않는다**), kill switch `QT_PROVIDERS_MAEILSEONGYEONG_DISABLED=true` / `QT_PROVIDERS_SAENGMYEONGUISAM_DISABLED=true` (Lambda 환경 변수 이름에 하이픈을 쓸 수 없어 providerId의 하이픈을 뺀 형태. `QtPropertiesBindingTest`로 확인), 제공처별 취득 `QT_PROVIDERS_<...>_ACQUISITION` |
| 권장 자원 | 메모리 512MB 이상(로컬 최대 RSS 약 200~235MB, Lambda 메모리는 CPU도 정함), 타임아웃 20초(서비스 내부 총 대기 상한 15초, HTTP API 통합 상한 30초) |
| 네트워크 | 취득이 꺼져 있으면 아웃바운드 없음. 켜지면 두 공식 사이트 https(443, 매일성경은 8888)로 나가는 인터넷 접근 필요(VPC 없이 두면 자동) |
| 상태 | Lambda 실행 환경(컨테이너)마다 메모리 저장소가 따로다. 동시 실행이 N개면 제공처 요청도 환경마다 각각 발생한다(30분/2분 캐시는 환경 안에서만 유효). 공유 캐시는 아직 없다 |

**문서와 다르거나 직접 확인한 점**
- 문서의 기본 핸들러는 `org.springframework.cloud.function.adapter.aws.FunctionInvoker::handleRequest` + 환경 변수 `spring_cloud_function_definition`이다. 우리는 `FunctionInvoker(String)` 생성자를 쓰는 하위 클래스 `QtLambdaHandler`로 함수 이름을 고정했다. 어댑터가 웹 서버 없이 컨텍스트를 띄우는 것(`spring.main.web-application-type=none`)도 소스(5.0.4 sources jar)에서 확인했다. 원래 핸들러 문자열 + 환경 변수 방식도 동작한다.
- 문서는 Spring Boot 3 시대 기준이고 Boot 4 언급이 없다. Boot 4.0.8 + Function 5.0.4(Jackson 3)에서 위 테스트와 shaded jar 직접 호출로 동작을 확인했다.
- 어댑터 pom이 `provided`로 둔 `aws-lambda-java-core/events/serialization`은 직접 의존성으로 추가했다(버전은 어댑터 pom과 동일).
- 어댑터가 끌어오는 WebFlux/Netty는 제외했다(jar 47MB → 27MB). 로컬 웹 앱(Tomcat)과 테스트는 그대로 통과한다.
- Boot 부모 pom의 shade 설정이 `transformers`/`filters`에 합쳐져 오류가 나므로 `combine.self="override"`로 덮어썼다. 문서의 Spring 리소스 병합 transformer와 `Start-Class` 매니페스트를 넣었다(어댑터가 시작 클래스를 매니페스트에서 찾는다).
- 아직 확인하지 못한 것: 실제 Lambda 런타임, API Gateway 연동, SnapStart 복원 후 동작(컨텍스트는 Init 단계에서 만들어져 원리상 가능하지만 시험하지 않았다. 복원 후 JDK HttpClient 연결은 요청마다 새로 맺으므로 문제 소지가 낮으나 미검증).

**로컬 검증** (인터넷·AWS 불필요)
- `QtLambdaFunctionsTest`: 이벤트 픽스처(`src/test/resources/lambda-events/*.json`, API Gateway v2 형태를 손으로 작성)를 함수 빈에 넣어 REST 본문과 동일함을 확인. 405/404도 확인.
- `QtLambdaHandlerTest`: 배포 핸들러 `QtLambdaHandler`를 스트림으로 직접 호출해 취득 플래그 off/on 모두 확인(목 서버, 기본 설정 = off).
- shaded jar 직접 호출: `java -cp target/qt-service-0.0.1-SNAPSHOT-aws.jar scripts/LocalInvoke.java src/test/resources/lambda-events/get-today.json` (기본 취득 off라 제공처에 요청하지 않는다).

**로컬 측정 (참고치일 뿐, Lambda 환경이 아님)** 2026-09-24, Apple Silicon Mac, OpenJDK 21.0.9, `java -cp <aws.jar>` 각 3회. Lambda의 vCPU는 메모리에 비례해 작고 디스크·CDS·아키텍처가 달라 실제 콜드 스타트는 이보다 몇 배 느릴 수 있다.

| 항목 | 기본 JVM 옵션 | `-XX:TieredStopAtLevel=1 -XX:+UseSerialGC -Xmx256m` |
| --- | --- | --- |
| jar 크기 | 27MB (28,084,953 B, 17,304개 파일, 압축 해제 약 61MB) | 동일 |
| 핸들러 생성(Spring 컨텍스트 기동, Lambda Init 단계에 해당) | 약 550ms | 약 470~560ms |
| 첫 호출 | 약 110ms | 약 95~130ms |
| 두 번째 호출 | 1ms 안팎 | 1ms 안팎 |
| JVM 시작 → 두 번째 호출 끝 | 약 680ms | 약 580~710ms |
| 힙 사용 | 약 22~25MB | 약 30~71MB |
| 최대 RSS | 약 233~237MB | 약 200~205MB |

SnapStart를 쓸지는 이 수치가 아니라 Lambda 실측과 platform-cost 비용표로 판단한다.

## 수동 스모크 (실제 제공처 대상, 사용자 승인 전 실행 금지)

**제공처별 자동 취득 권리가 확인되기 전까지 실제 제공처 서버로 요청하는 것을 중단한다.** `scripts/smoke.sh`는 `QT_SMOKE_APPROVED=yes`를 명시하지 않으면 요청 없이 종료 코드 3으로 거부한다. 그 값은 사용자의 승인을 받은 뒤에만 설정한다. 개발·검증은 fixture와 로컬 목 서버로만 한다(`mvn -q test`).

```sh
QT_SMOKE_APPROVED=yes services/qt/scripts/smoke.sh   # PORT=18081 기본
```

승인 후 동작: `local-experiment` 프로필로 서버를 띄워 실제 두 공식 페이지에 각 1회 요청하고 JSON과 제공처별 상태 요약을 출력한다. 종료 코드 0 = 두 제공처 모두 `RANGE_CONFIRMED`, 1 = 그 밖(요약에 상태·사유), 2 = 기동 실패, 3 = 승인 없음. 로그는 `target/smoke.log`. User-Agent 연락처(`qt.http.user-agent`)에는 개인정보를 넣지 않고, 값은 사용자가 정한다.

과거 실행 기록(2026-09-24, 승인 전 초기 조사 때 1회): 매일성경 `RANGE_CONFIRMED`(JDG 11:1-11:11), 생명의삶 `RANGE_CONFIRMED`(1CH 14:1-14:17). 이후 추가 요청은 하지 않았다.
