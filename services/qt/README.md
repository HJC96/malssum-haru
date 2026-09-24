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
| `qt.cache.confirmed-ttl` / `failure-ttl` | 30m / 2m | **로컬 모드(메모리 저장) 조회 전용** 메모리 캐시: 확인된 항목 재사용 시간 / 실패 결과 재사용 시간(방문자 요청이 제공처에 반복 요청하지 않게 함). 배포 모드의 조회(저장소만 읽음)와 수집기 skip 규칙에는 적용되지 않는다 |

## 구조

```
kr.malssumharu.qt
  api/        GET /api/qt/today 컨트롤러와 응답 DTO (계약 v1)
  service/    QtTodayService(서울 오늘 계산, 제공처 병렬·격리, 상태 판정, 배포 모드는 저장소 조회), QtCollectorService(수집·upsert),
              QtDayStore(InMemoryQtDayStore 로컬 / DynamoDbQtDayStore 배포, 키 = providerId+providerDate)
  provider/   QtProviderAdapter 인터페이스, MaeilSeongyeongAdapter, SaengmyeongUiSamAdapter
  bible/      BibleBooks(66권 USFM), ReferenceParser(한국어 장절 → bookId + 장:절 범위), VerseCountTable + ResourceVerseCountTable(66권 장·절 수, 잠정)
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
- 장 전체만 표기한 날은 66권 장·절 수 표(잠정)로 끝 절을 채운다. 표가 없거나 그 장을 모르면 추정하지 않고 `INVALID_REFERENCE`.
- `ReasonCode.INTERNAL_ERROR`(어댑터·저장소 예기치 못한 예외 격리)와 `NOT_COLLECTED_YET`(배포 모드에서 서울 오늘 항목이 아직 수집되지 않음)는 계약 초안 이후 추가된 값이다(개방형 열거).

제공처 조사 결과는 [`docs/adapter-notes.md`](docs/adapter-notes.md).

### 66권 장·절 수 표 (잠정, 개역개정 전수 미검증)

- 리소스: `src/main/resources/bible/verse-counts.json` (dataVersion `eng.vrs@71c66cb+REV12=17`, versificationSystem `nkrv-provisional-1`, 66권 1,189장 31,103절). **잠정 데이터다: 개역개정 전수 미검증**이며 원본 헤더가 밝힌 대로 표본 확인에서 다른 지점은 REV 12장(18→17) 한 곳뿐이었고 그 외 장은 검증하지 않았다. 사도행전 15:25-26 병합 표시, 24:7 같은 번호는 번호 기준으로 센다.
- 소유: 원본은 planner-core가 생성하는 `web/src/data/nkrvProvisional.ts`(읽기 전용). 이 서비스는 소비자로서 **생성 스크립트와 동기화 테스트만 소유**한다. 데이터를 복사해 고치지 않고 그대로 옮긴다.
  - 갱신: `python3 services/qt/scripts/generate_verse_counts.py` (`--check`는 갱신 없이 최신 여부만 확인, 어긋나면 종료 코드 1, 원본 형식이 바뀌어 파싱하지 못하면 종료 코드 2).
  - 동기화 테스트 `VerseCountsSyncTest`: 스크립트와 독립적으로 원본 TS를 다시 파싱해 리소스와 비교한다. 원본 파일이 없거나 형식이 바뀌면 조용히 통과하지 않고 명확한 메시지로 실패하고, 값이 어긋나면 어긋난 책을 알려 준다. planner-core가 데이터를 갱신하면 이 테스트가 실패하므로 스크립트를 다시 돌려 리소스를 갱신한다.
  - `ResourceVerseCountTable`은 66권·성경 순서·양수 절 수를 검증하고, 리소스가 없거나 형식이 어긋나면 서비스 시작 시 실패한다.
- 효과(연결됨): 책마다의 장·절 수를 검증한다. `창세기 1:1-99`, `창세기 51:1`, `시편 23:7`은 `INVALID_REFERENCE`(`RANGE_UNAVAILABLE`)다. 장 전체만 표기한 QT(`시편 23편`, `창세기 1~3장`)는 표로 끝 절을 채워 `RANGE_CONFIRMED`가 된다(시편 23 → 23:1-6). `displayReference`는 제공처 표기 그대로 두고 `verifiedAt` 등 기존 규칙은 그대로다.
- **잠정 데이터의 위험(계약 v1.2 제안 참고)**: 표의 절 수가 개역개정과 다르면 (a) 제공처가 적은 정상 범위를 `INVALID_REFERENCE`로 잘못 거부해 링크 대체로 떨어질 수 있고(안전한 방향), (b) 장 전체 표기의 끝 절이 실제와 다르게 채워질 수 있다(화면 표기만 영향, QT는 계획에 영향을 주지 않는다).
- 표를 쓰지 않는 경우(`VerseCountTable.NONE`, 테스트용): 장·절 상한은 절대값(장 150, 절 176)뿐이라 `창세기 1:1-99`가 통과하고 장 전체 표기는 `INVALID_REFERENCE`다(`ReferenceParserTest.knownLimit...`이 이 동작을 고정한다).

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
| 7 fixture에 본문·해설 없음 | `FixtureRulesTest`(fixture 안의 한글은 고정 구조 단어 5개뿐이어야 하고 그 밖의 한글은 한 글자도 불가, 크기 제한), fixture는 구조 조각만 |

추가 실패 시나리오(qa-review 반영 포함: 성공 경로 로그에 장절 표기 없음, 실패 항목 `notice` null, 매일성경 부분 렌더(날짜만/장절만) JSON 보조, 응답 크기 제한, 9월 31일 같은 무효 날짜, 테스트 컨텍스트의 제공처 요청 대상을 죽은 로컬 주소로 고정): 매일성경 동적 로딩 실패·JSON 오류·필드 누락·HTML 구조 변경(`MaeilSeongyeongAdapterTest`), 생명의삶 EUC-KR 해독·문자셋 오표기·깨짐·껍데기 페이지·구조 변경·불가능한 날짜(`SaengmyeongUiSamAdapterTest`), 타임아웃·연결 거부·HTTP 오류, 재수집 중복 없음·캐시·동시 호출 단일 요청·kill switch·취득 플래그·어댑터 예외/무응답 격리·로그에 원문 없음(`QtTodayServiceTest`), 장절 정규화(`ReferenceParserTest`, `BibleBooksTest`).

## AWS Lambda 배포 산출물 (T15·T16, 로컬 검증만: 실제 AWS 호출·배포 없음)

같은 서비스 로직을 Lambda(Java 21)에서 실행하는 진입점이다. Spring Cloud Function AWS 어댑터(`spring-cloud-function-adapter-aws`, Cloud 2025.1.3 BOM = Function 5.0.4)의 `FunctionInvoker`를 쓴다. 근거 문서: <https://docs.spring.io/spring-cloud-function/reference/adapters/aws-intro.html> (2026-09-24 확인). **하나의 jar에 두 함수(조회, 수집)가 있고 핸들러 문자열만 다르다.**

### platform-cost(IaC)가 참조할 값

| 항목 | 값 |
| --- | --- |
| 빌드 | `cd services/qt && mvn -B package` (테스트 생략: `-DskipTests`) |
| **배포 산출물(두 함수 공통)** | `services/qt/target/qt-service-0.0.1-SNAPSHOT-aws.jar` (shaded, 의존성 전부 포함, thin 아님, 약 35MB(35,295,959 B). zip 직접 업로드 한도 50MB 이내) |
| 배포하지 않는 것 | `qt-service-0.0.1-SNAPSHOT.jar`(shade 입력용 일반 jar), `...-exec.jar`(로컬 `java -jar` 실행용) |
| 런타임 | `java21`. x86_64·arm64 모두 순수 Java라 무관 |
| **조회 함수 핸들러** | `kr.malssumharu.qt.lambda.QtLambdaHandler::handleRequest` (함수 빈 `qtToday`) |
| **수집 함수 핸들러** | `kr.malssumharu.qt.lambda.QtCollectHandler::handleRequest` (함수 빈 `qtCollect`) |
| 대체 방식 | 두 핸들러는 함수 이름을 고정한 `FunctionInvoker` 하위 클래스다. 문서의 기본 방식(`org.springframework.cloud.function.adapter.aws.FunctionInvoker::handleRequest` + `SPRING_CLOUD_FUNCTION_DEFINITION=qtToday` 또는 `qtCollect`)도 동작한다. **IaC는 전용 핸들러 문자열을 쓰는 것을 권장하며 함수 정의 환경 변수는 필요 없다** |
| 조회 이벤트 | API Gateway **HTTP API, payload 2.0**. 라우트 `GET /api/qt/today`. 다른 경로 404, 다른 메서드 405 |
| 조회 응답 | 200, `Content-Type: application/json`, **`Cache-Control: public, max-age=60`**(REST 컨트롤러와 Lambda 모두), 본문은 계약 v1.2 JSON(`providerDate`·`generatedAt` 유지) |
| 수집 이벤트 | 스케줄이 `{"trigger":"schedule"}`로 호출(API Gateway 이벤트 아님). 그 밖의 입력은 아무것도 하지 않고 `IGNORED` |
| 수집 출력 | `{"result":"DONE","seoulDate":"YYYY-MM-DD","providers":[{"providerId","result","reason"?}]}` (결과 코드만, 장절·본문 없음). result: `STORED`, `ALREADY_COLLECTED`, `SKIPPED_COLLECTOR_DISABLED`, `SKIPPED_PROVIDER_DISABLED`, `SKIPPED_ACQUISITION_OFF`, `FAILED`(reason = reasonCode 이름) |
| 권장 자원 | 조회: 메모리 512MB 이상·타임아웃 10초 안팎(배포 모드는 제공처에 요청하지 않고 DynamoDB 읽기 1회씩). 수집: 메모리 512MB, 타임아웃 30초 이상(내부 총 대기 15초 + 저장) |
| 네트워크 | 조회: DynamoDB(같은 리전 엔드포인트)만. 수집: DynamoDB + 두 공식 사이트 https(443, 매일성경은 8888). 개인 데이터 필드·라우트·테이블 없음 |

### 환경 변수 (모두 Lambda 이름 규칙에 맞는 형식)

| 이름 | 기본 | 의미 |
| --- | --- | --- |
| `QT_TABLE_NAME` | (없음) | **있으면 배포 모드**: DynamoDB 저장소를 쓰고 조회 API는 저장소에서 서울 오늘 항목만 읽는다(제공처에 요청하지 않음). 없으면 로컬 모드(메모리 저장 + 요청 시 실시간 취득) |
| `QT_ITEM_TTL_DAYS` | 400 | 항목 보관 일수(`expiresAt` 계산) |
| `QT_COLLECTOR_ENABLED` | `disabled` | `enabled`가 아니면 수집 함수가 어떤 제공처 요청도 저장도 하지 않는다 |
| `QT_ACQUISITION_ENABLED` | `false` | 취득 플래그. false면 조회는 `RANGE_NOT_PERMITTED`(저장소도 읽지 않음), 수집은 요청·저장 없음. 권리 확인 전에는 공개 배포에서 켜지 않는다. 비공개 시험 운영에서만 켠다(아래 '배포에서 취득 켜기') |
| `QT_PROVIDER_MAEIL_SEONGYEONG`, `QT_PROVIDER_SAENGMYEONG_UI_SAM` | `enabled` | `disabled`면 조회는 `DISABLED`/`OPERATOR_DISABLED`, 수집은 그 제공처를 건너뜀. (`QT_PROVIDERS_MAEILSEONGYEONG_DISABLED=true` 형식도 동작) |
| `AWS_REGION` | Lambda가 설정 | DynamoDB 리전. 자격 증명은 Lambda 실행 역할의 환경 변수(`EnvironmentVariableCredentialsProvider`) |
| `QT_HTTP_USERAGENT` | 코드 기본값 | 제공처에 보내는 User-Agent. 연락처는 사용자가 정한다(값은 비워 둠) |

### DynamoDB 테이블 (IaC가 만들 것)

- 키: 파티션 `providerId`(S), 정렬 `providerDate`(S, `YYYY-MM-DD`). TTL 속성 `expiresAt`(N, epoch 초).
- 서비스가 쓰는 IAM 권한: 조회 = `dynamodb:GetItem`, 수집 = `dynamodb:GetItem` + `dynamodb:PutItem`(테이블 ARN 한정). Query/Scan은 쓰지 않는다.
- 항목 속성: `providerId`, `providerDate`, `ranges`(예: `JHN:3:1-3:21,PSA:23:1-23:3`), `displayReference`, `verifiedAt`(ISO), `sourceVersion`, `expiresAt`. 장절 구조 정보뿐이고 본문·해설·개인 데이터는 없다.
- 읽기는 정확한 키 GetItem(강한 일관성) 한 번이다. 쓰기는 PutItem 덮어쓰기라 같은 `(providerId, providerDate)`는 항목이 늘지 않는다. 조건식·GSI·트랜잭션은 쓰지 않는다.

### 동작 (배포 모드)

- **조회**: 서울 오늘 키만 읽는다. 항목이 없으면 `RANGE_UNAVAILABLE` + `NOT_COLLECTED_YET`(어제 항목으로 대체 금지, `providerDate` null). 취득 플래그 off면 `RANGE_NOT_PERMITTED`, 제공처 disabled면 `DISABLED`. 저장소 오류는 그 항목만 `INTERNAL_ERROR`(HTTP 200 유지, 오류 메시지는 응답·로그에 없음).
- **수집**: 서울 오늘 기준으로 어댑터를 실행해 제공처 날짜 = 서울 오늘이고 장절을 읽었을 때만 upsert. 날짜 불일치·파싱 실패·링크 오류는 저장하지 않고, 이미 있는 오늘 항목을 지우거나 덮어쓰지도 않는다. **(providerId, 서울 오늘) 항목이 이미 저장돼 있으면 시간과 무관하게 그 제공처에는 요청하지 않고 건너뛴다(`ALREADY_COLLECTED`, 멱등, 하루 요청 최소화).** 저장되지 않은 제공처(실패·날짜 불일치)만 다음 스케줄에서 다시 시도한다. 같은 실행 환경 안의 동시 수집은 제공처별로 직렬화한다. 한 제공처 실패가 다른 쪽을 막지 않는다. 자정 직후 제공처가 아직 어제 페이지를 보이면 `DATE_MISMATCH`로 저장 없이 끝나므로, **스케줄은 서울 자정 이후 여러 번(예: 몇 분~수십 분 간격)** 돌려야 한다.
- **조회 함수는 방문자 요청 때 절대 제공처로 요청하지 않는다**(취득 플래그가 켜져 있어도 저장소만 읽는다). 제공처에 요청하는 것은 수집 함수뿐이다(`DeployedQueryNeverFetchesTest`가 REST·Lambda 양쪽에서 요청 수 0을 확인).
- 실행 환경마다 메모리 상태가 따로이지만 배포 모드의 정답 저장소는 DynamoDB라 환경 수와 무관하게 제공처 요청은 수집 함수의 호출 횟수로만 정해진다.

### 문서와 다르거나 직접 확인한 점
- 문서의 기본 핸들러는 `FunctionInvoker::handleRequest` + `spring_cloud_function_definition` 환경 변수다. 우리는 `FunctionInvoker(String)` 생성자를 쓰는 하위 클래스로 함수 이름을 고정했다. 어댑터가 웹 서버 없이 컨텍스트를 띄우는 것(`spring.main.web-application-type=none`)도 5.0.4 sources jar에서 확인했다.
- 문서는 Boot 3 시대 기준이다. Boot 4.0.8 + Function 5.0.4(Jackson 3)에서 테스트와 shaded jar 직접 호출로 동작을 확인했다.
- 입력이 API Gateway 형태(`APIGatewayV2HTTPEvent`)면 Spring Cloud Function이 응답도 API Gateway 형태(`body` 문자열)로 감싼다. 수집 함수에 API Gateway 이벤트를 잘못 연결하면 `IGNORED`가 그 `body` 안에 담긴다(테스트로 확인).
- 어댑터 pom이 `provided`로 둔 `aws-lambda-java-core/events/serialization`은 직접 의존성으로 추가했다. 어댑터가 끌어오는 WebFlux/Netty는 제외했다.
- AWS SDK v2(BOM 2.55.4)는 DynamoDB 클라이언트 + `url-connection-client`만 쓰고, apache-client·apache5-client·netty-nio-client는 제외했다. 자격 증명은 환경 변수 제공자만 쓴다.
- Boot 부모 pom의 shade 설정이 `transformers`/`filters`에 합쳐져 오류가 나므로 `combine.self="override"`로 덮어썼다. Spring 리소스 병합 transformer, `ServicesResourceTransformer`, `Start-Class` 매니페스트를 넣었다.

### 배포에서 취득 켜기: 비공개 시험 운영 한정, 허용 미확인

- **제공처(매일성경·생명의삶)의 자동 취득·저장 허용 여부는 아직 확인되지 않았다**(`docs/rights-matrix.md` 참고). 코드 기본값은 계속 `QT_ACQUISITION_ENABLED=false`이며, 사용자가 혼자 쓰는 **비공개 시험 운영**에 한해 배포 환경 변수 `QT_ACQUISITION_ENABLED=true`(IaC 파라미터)로 켠다. 공개 배포에서는 권리 확인 전에 켜지 않는다.
- 켜도 제공처에 요청하는 것은 예약된 수집 함수(`qtCollect`)뿐이고, 제공처당 서울 하루 1회 성공하면 그날은 더 요청하지 않고, 실패한 제공처만 다음 스케줄에서 재시도한다. 저장하는 것은 장절 구조 정보(`ranges`, `displayReference`, `verifiedAt`, `sourceVersion`)뿐이다. 본문·해설·제목·개인 데이터는 저장하지 않는다.
- 위험: 제공처가 자동 접근을 허용하지 않으면 접속 차단, 약관 위반 문의가 있을 수 있다. 문의가 오거나 허용하지 않는다는 답을 받으면 `QT_ACQUISITION_ENABLED=false` 또는 `QT_PROVIDER_*=disabled`로 즉시 끈다(공식 링크만 남고 서비스는 계속 동작한다).
- 요청 예의는 그대로다: 서비스 자체 User-Agent 명시(연락처 값은 비워 두며 이메일 등 개인정보를 넣지 않는다), 제공처 사이 병렬이지만 제공처당 요청은 한 번에 하나(GET 1회, 매일성경 보조 JSON 1회), 타임아웃 3초(연결)·5초(요청)·15초(총), 실패 결과는 캐시하지 않고 다음 스케줄이 재시도한다.

### 미시험 (실제 AWS 없이는 확인할 수 없음)
- 실제 DynamoDB와의 통신: PutItem 덮어쓰기, GetItem 강한 일관성, TTL 삭제(삭제는 만료 후 최대 수십 시간 지연될 수 있으나 조회가 정확한 오늘 키만 읽으므로 무관하다는 논리), 요청 서명·리전 엔드포인트, IAM 권한 오류. 테스트는 `DynamoDbClient` 대역(`FakeDynamoDb`)으로 키·속성·덮어쓰기·오늘 키 조회를 검증했을 뿐이다.
- 첫 DynamoDB 호출의 콜드 비용(TLS 핸드셰이크, SigV4, 엔드포인트 해석)은 측정하지 못했다. 아래 측정에는 클라이언트 생성만 포함된다.
- 실제 Lambda 런타임, API Gateway·EventBridge 연동, SnapStart 복원 후 동작.
- 로컬 DynamoDB(DynamoDB Local)는 Docker/네트워크 의존이 커서 쓰지 않았다.

### 로컬 검증 (인터넷·AWS 불필요)
- `QtLambdaFunctionsTest`: 함수 빈 본문이 REST 컨트롤러 본문과 바이트 단위로 같고 두 응답 모두 `Cache-Control: public, max-age=60`. 405/404.
- `QtLambdaHandlerTest`, `QtCollectHandlerTest`: 배포 핸들러(`QtLambdaHandler`, `QtCollectHandler`)를 이벤트 픽스처 스트림으로 직접 호출(`src/test/resources/lambda-events/*.json`, API Gateway v2 형태와 스케줄 이벤트를 손으로 작성). 취득 플래그·수집 스위치 off/on, 스케줄 외 입력 무시. 실제 시계를 쓰므로 서울 자정 전후 60초는 건너뛴다.
- `DynamoDbQtDayStoreTest`: 키·속성 집합·TTL 값·덮어쓰기·정확한 키만 조회·손상 항목 무시.
- `QtStoredModeTest`: 저장소 조회 모드: 오늘 항목 조회(제공처 무요청), `NOT_COLLECTED_YET`, 어제 항목 미노출, 서울 자정 경계 전환, 취득 off 시 저장소 미접근, 제공처 disabled, 저장소 오류 격리.
- `QtCollectorServiceTest`: 수집 upsert(중복 없음), 재확인 간격, 수집 off·취득 off·제공처 disabled 무요청·무저장, 어제 자료 미저장, 실패 시 기존 항목 보존, 제공처 격리, 자정 경계, 수집→조회 통합.
- `DeploymentEnvironmentNamesTest`, `QtConfigWiringTest`, `QtPropertiesBindingTest`: IaC 환경 변수 이름 → 설정 매핑, 저장소 선택(`QT_TABLE_NAME`).
- shaded jar 직접 호출: `java -cp target/qt-service-0.0.1-SNAPSHOT-aws.jar scripts/LocalInvoke.java src/test/resources/lambda-events/get-today.json [핸들러 클래스명]` (기본 취득 off라 제공처에 요청하지 않는다. `QT_TABLE_NAME`을 주면 실제 DynamoDB로 나가므로 `LOCAL_INVOKE_INIT_ONLY=1`로 초기화까지만 측정).

### 로컬 측정 (참고치일 뿐, Lambda 환경이 아님)
2026-09-24, Apple Silicon Mac, OpenJDK 21.0.9, `java -cp <aws.jar>` 각 3회. Lambda의 vCPU는 메모리에 비례해 작고 디스크·CDS·아키텍처가 달라 실제 콜드 스타트는 이보다 몇 배 느릴 수 있다.

| 항목 | T15(DynamoDB SDK 없음) | T16 메모리 저장 | T16 DynamoDB 모드(초기화만) |
| --- | --- | --- | --- |
| jar 크기 | 28,084,953 B | 35,295,959 B (+7.2MB) | 동일 |
| 핸들러 생성(Spring 컨텍스트 기동, Lambda Init에 해당) | 약 550ms | 약 555~570ms | 약 610~615ms (+약 45ms: 클라이언트 생성) |
| 첫 호출 / 두 번째 호출 | 약 110ms / 1ms | 약 115~120ms / 1ms | 측정 안 함(실제 AWS 호출이 필요) |
| JVM 시작 → 초기화 끝 | (약 680ms까지 호출 포함) | 약 580~600ms | 약 635~640ms |
| 최대 RSS | 약 233~237MB | 약 244~247MB(호출 포함) / 206~214MB(초기화만) | 약 236~239MB(초기화만) |

SnapStart를 쓸지는 이 수치가 아니라 Lambda 실측과 platform-cost 비용표로 판단한다.

## 수동 스모크 (실제 제공처 대상, 사용자 승인 전 실행 금지)

**제공처별 자동 취득 권리가 확인되기 전까지 실제 제공처 서버로 요청하는 것을 중단한다.** `scripts/smoke.sh`는 `QT_SMOKE_APPROVED=yes`를 명시하지 않으면 요청 없이 종료 코드 3으로 거부한다. 그 값은 사용자의 승인을 받은 뒤에만 설정한다. 개발·검증은 fixture와 로컬 목 서버로만 한다(`mvn -q test`).

```sh
QT_SMOKE_APPROVED=yes services/qt/scripts/smoke.sh   # PORT=18081 기본
```

승인 후 동작: `local-experiment` 프로필로 서버를 띄워 실제 두 공식 페이지에 각 1회 요청하고 JSON과 제공처별 상태 요약을 출력한다. 종료 코드 0 = 두 제공처 모두 `RANGE_CONFIRMED`, 1 = 그 밖(요약에 상태·사유), 2 = 기동 실패, 3 = 승인 없음. 로그는 `target/smoke.log`. User-Agent 연락처(`qt.http.user-agent`)에는 개인정보를 넣지 않고, 값은 사용자가 정한다.

과거 실행 기록(2026-09-24, 승인 전 초기 조사 때 1회): 매일성경 `RANGE_CONFIRMED`(JDG 11:1-11:11), 생명의삶 `RANGE_CONFIRMED`(1CH 14:1-14:17). 이후 추가 요청은 하지 않았다.
