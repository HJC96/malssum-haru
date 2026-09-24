# T14 M1 통합 QA 결과 (qa-review)

- 검토일: 2026-09-24 (KST 11:00~11:30)
- 검토 대상: 커밋이 아니라 **검토 시점의 작업 트리**다(lead 확인: 사용자가 직접 커밋 예정). 검토 후 저장소에 커밋 `e837f1a`가 생겼고, 그 뒤에도 파일이 바뀌고 있다. 아래는 검토 시점의 수정 시각 요약이다.
  - `services/qt`: `pom.xml` 11:25, `QtTodayService.java` 11:28. T15(Lambda 진입점)까지 포함해 96 테스트를 실행했다. 검토 직후 T16 진행분(`QtCollectorService`, `DynamoDbQtDayStore` 등 신규 파일)이 추가되었으나 **검토 범위 밖이며 재검토하지 않았다**.
  - `web/src`: `PlanSection.tsx` 11:26, `fetchQtToday.ts` 11:08, `pdf.ts`는 검토 때 11:0x판(점 경로)이었다. 재현용 해시(정렬된 파일 목록 shasum 앞 12자리): `services/qt` = `69ed71d9fc0a`, `web/src` = `892f0d6e42aa`.
  - 검토 후 변경 확인: `web/src/export/pdf.ts`(11:31)의 `PDF_FONT_PATH`가 `fonts/NotoSansKR-Regular-subset.ttf`(하이픈)로 바뀌어 **F-02의 경로 불일치는 해소된 것으로 보인다**. 응답 타입·크기 검사 추가 여부와 실제 브라우저 내보내기는 다시 확인하지 않았다(재검토 필요).
  - 중간에 web-experience 작업 중인 상태(`PlanSection`이 삭제된 i18n 키를 참조)의 스냅샷을 잠깐 만났고, 그때 `pnpm typecheck`/`build`가 실패했다. 이후 스냅샷에서는 통과했다. 아래 표는 통과한 최신 스냅샷 기준이다.
- 방법: 모든 실행은 scratchpad에 복사한 사본에서 했다. 저장소 제품 파일과 문서는 수정하지 않았다(쓴 파일은 `docs/qa/**`뿐).
- 안전: 실제 제공처 서버(sum.su.or.kr, duranno.com, 365qt.com, bskorea.or.kr)로 요청하지 않았다. 변이 시험에서 취득 플래그가 켜질 수 있는 사본에는 JVM 프록시 속성(`-Dhttps.proxyHost=127.0.0.1 -Dhttps.proxyPort=9`)을 붙여 외부로 나가지 못하게 막았고, 로컬 서버는 기본 설정(취득 off)으로만 띄웠다. 개인정보는 어떤 요청·파일에도 쓰지 않았다.
- 범위 참고: 사용자가 개역개정 본문·AI 해설을 쓰지 않기로 해서 AC12~AC16, AC21, AC22, AC25는 해당 없음/보류로 분류했다.

## 1. 요약

| 구분 | 결과 |
| --- | --- |
| 차단 | 없음. 단, 배포 전 차단 성격의 중요 항목이 F-01(웹 기본값이 mock), F-02(PDF 폰트 경로)다 |
| 중요 | F-01, F-02, F-03, F-04, F-05, F-06 |
| 경미 | F-07 ~ F-16 |
| 통과 AC | AC01, AC03, AC04, AC05, AC06, AC08, AC18, AC19, AC20, AC23, AC24, AC26(입력 UI 존재), SEC01·SESSION01(현재 소스 기준) |
| 조건부 | AC11: 코드와 테스트는 통과하지만, 공개 기본값(`RANGE_NOT_PERMITTED`)에서는 "확인된 장절 표시" 경로가 운영에서 쓰이지 않는다. 자동 취득 허용 확인 전까지는 "공식 링크만" 경로가 실제 동작이다 |
| 미확인 | AC10(캘린더·목록 일치를 화면 수준으로 확인하지 못함), AC17(xlsx는 테스트 통과, PDF는 F-02로 실제 브라우저 경로가 깨짐), 모바일·다크·스크린리더 실측, CSP·보안 헤더(infra) |

실행 결과 요약(최신 스냅샷)

| 명령 | 결과 |
| --- | --- |
| `cd services/qt && mvn -q -B test` (사본) | 통과. 96 테스트, 실패 0 (진행 초기 스냅샷 86 → T15 추가분 포함 96) |
| `cd web && pnpm test` (사본) | 통과. 21 파일 289 테스트(초기 스냅샷 170 → 214 → 256 → 289로 늘어남) |
| `cd web && pnpm typecheck` | 통과 |
| `cd web && pnpm build` | 통과(청크 500kB 경고만: exceljs·fontkit) |
| TZ=UTC, America/Los_Angeles, Pacific/Kiritimati, Asia/Seoul에서 `vitest run` | 모두 통과. 시간대 의존 실패 없음 |
| 기본 설정으로 서비스 기동 후 `curl localhost:8081/api/qt/today` | 두 제공처 `RANGE_NOT_PERMITTED`/`PERMISSION_UNCONFIRMED`, officialUrl https, 본문 필드 없음. `POST`는 405 |

## 2. 발견 목록 (심각도순)

| ID | 심각도 | 위치 | 내용 | 재현 | 제안 담당 |
| --- | --- | --- | --- | --- | --- |
| F-01 | 중요(배포 전 차단) | `web/src/app/qt/fetchQtToday.ts:20`, `web/src/app/qt/fixtures.ts`, `web/src/app/plan/bibleSource.ts:7` | `VITE_QT_SOURCE`가 `api`가 아니면 mock이 기본이다. 환경 변수 없이 `pnpm build`한 산출물에 fixture(예: `maeil-seongyeong-adapter/1`)가 들어 있고, 방문자에게 고정 범위(요한복음 3:1-21, 2026-09-24)가 "범위 확인됨, 오늘의 범위"로 나온다. 다음 날에도 같은 값이라 "어제 자료를 오늘로 표시하지 않는다"(AC11)를 배포 실수 한 번으로 어긴다. 계획 쪽은 `SAMPLE_BIBLE`이고 샘플 배너가 있지만 QT mock에는 표시가 없다 | `cd web && pnpm build && grep -l "maeil-seongyeong-adapter/1" dist/assets/*.js` | web-experience(기본값을 프로덕션에서는 `api`로, mock은 DEV·테스트 또는 명시 플래그일 때만, mock 사용 시 "샘플" 배너). infra는 빌드 환경 변수 고정 |
| F-02 | 중요 | `web/src/export/pdf.ts:6` (`PDF_FONT_PATH`), `web/public/fonts/` | 코드는 `fonts/NotoSansKR-Regular.subset.ttf`(점)를 요청하지만 실제 파일은 `NotoSansKR-Regular-subset.ttf`(하이픈)다. 정적 호스트가 SPA 폴백으로 index.html(200, text/html)을 돌려주므로 `res.ok` 검사를 통과하고, pdf-lib가 HTML을 폰트로 임베드하려다 실패한다. 테스트는 `fontBytes`를 직접 주입해서 이 경로를 못 잡는다 | `cd web && pnpm build && npx vite preview --port 4173` 후 `curl -s -o /dev/null -w "%{http_code} %{content_type} %{size_download}\n" localhost:4173/fonts/NotoSansKR-Regular.subset.ttf` → `200 text/html 484`. 하이픈 경로는 `200 font/ttf 447036` | web-experience (경로 수정, 응답 content-type/크기 검사 추가, 빌드 산출물의 폰트 요청 URL이 존재하는지 확인하는 테스트) |
| F-03 | 중요 | `web/vite.config.ts:13` vs `services/qt/src/main/resources/application.yml` (`server.port: 8081`) | 개발 프록시가 `/api` → `localhost:8080`인데 QT 서비스 기본 포트는 8081이다. 그대로는 `VITE_QT_SOURCE=api pnpm dev`가 QT 서비스에 닿지 않는다. 루트 README에는 실행 명령이 없고(IMPLEMENTATION_PLAN M0의 "README에 실행 명령 추가"는 미완료), services/qt README의 명령은 실제로 동작한다 | `grep -n "808" web/vite.config.ts services/qt/src/main/resources/application.yml` | lead(README)·web-experience(프록시 포트 8081로) |
| F-04 | 중요(테스트 공백, 코드는 정상) | `services/qt/src/test/.../QtTodayServiceTest.yesterdaysStoredRangeIsNeverReturnedAsTodays` 등 | "어제 자료가 오늘로 나가지 않는다" 테스트가 시계를 확인 시각에서 15시간 뒤로 옮겨서, 저장소 조회 키가 잘못돼도 확인 캐시 TTL(30분)이 이미 만료되어 통과한다. 변이 M19(서울 오늘 키가 없으면 어제 키를 조회)와 M04(실패 캐시가 날짜를 안 봄)가 기존 테스트를 모두 통과(생존)했다. 자정 직전 23:50 확인 → 00:10 조회(TTL 안) 시나리오가 없다. 현재 코드는 내가 추가한 경계 시험 5건을 모두 통과한다(23:50 확인 후 00:10 제공처가 어제 페이지면 DATE_MISMATCH·passage null·verifiedAt null, 정확한 00:00:00.000·23:59:59.999 경계, 자정 직전 실패 캐시 비재사용) | `docs/qa/suggested/QaBoundaryTest.java.txt`를 `services/qt/src/test/java/kr/malssumharu/qt/service/`에 `.java`로 넣고 `mvn -q -B test -Dtest=QaBoundaryTest`(사본에서 5/5 통과). 변이는 `docs/qa/suggested/mutation-qt.py.txt` | qt-backend (제안 시험 채택) |
| F-05 | 중요(테스트 공백) | `services/qt/src/test/java/kr/malssumharu/qt/FixtureRulesTest.java` (`longestHangulRun`) | 계약 기준 7(fixture에 본문·해설 복사 금지)을 검사한다지만 공백에서 연속 길이를 끊어서, 어절 사이에 공백이 있는 한국어 문장은 2048B 이내라면 통과한다. 변이 M21(fixture에 공백 있는 한국어 설명문 한 문장 추가)이 생존했다. 현재 fixture는 깨끗하다(직접 전수 확인, 장절 표기·`FIXTURE_*` 자리표시자뿐). Java 테스트 코드 안의 문자열은 검사 대상도 아니다 | `docs/qa/suggested/mutation-qt.py.txt`의 M21. 사본 `fixtures/maeil-today.html`의 `</body>` 앞에 공백 있는 한국어 한 문장을 넣고 `mvn -q -B test -Dtest=FixtureRulesTest` → 통과 | qt-backend (전체 한글 글자 수 상한, 또는 허용 목록 방식) |
| F-06 | 중요 | `web/src/components/QtToday.tsx` (useEffect), `QtProviderCard.tsx:36` | 탭을 서울 자정 넘어 열어 두면 화면은 다시 조회하지 않고(`setInterval`·`visibilitychange` 없음) 어제 범위를 "오늘의 범위"로 계속 표시한다. 현재 완화는 "내 지역의 오늘 날짜(2026-09-25)와 다를 수 있습니다" 문구 하나뿐이고, 서울 사용자에게는 지역 차이 문구가 맞지 않는다. 생명의삶 date-specific 링크는 자정 후 껍데기 페이지가 될 수 있다(계약에 명시) | `docs/qa/suggested/qaUi.test.tsx.txt`의 첫 OBSERVE 테스트(사본에서 출력 확인: 09-25 01:30 KST에 09-24 확정 카드가 "오늘의 범위 요한복음 3:1–21"로 그려짐) | web-experience(서울 날짜 변경 감지 시 재조회 또는 "오래된 정보" 표시), lead(계약에 클라이언트 신선도 규칙 추가 검토) |
| F-07 | 경미 | `services/qt/.../QtTodayServiceTest.logsNeverContain...` | 로그 무원문 테스트가 예외 경로만 본다. 성공 경로 로그에 `displayReference`를 넣는 변이 M13이 생존했다. 코드는 현재 제공처·상태·사유 코드만 로그한다(`QtTodayService`의 `log.*` 전수 확인) | 변이 M13 | qt-backend |
| F-08 | 경미 | `QtTodayContractTest` | 실패 항목의 `notice`가 null이라는 검사가 없다(변이 M18 생존). 내 시험 `failureEntriesHaveNullNotice`는 통과 | 제안 시험 | qt-backend |
| F-09 | 경미 | `MaeilSeongyeongAdapter.fetch` | 첫 HTML에 날짜만 있고 장절이 없는 부분 렌더 페이지에 대한 시험이 없다(변이 M09 `\|\|`→`&&` 생존). 현재 코드는 JSON 보조 경로로 간다 | 변이 M09 | qt-backend |
| F-10 | 경미 | `JdkHttpFetcher` | 응답 크기 제한(`TOO_LARGE`)이 시험되지 않는다(변이 M11 생존). README는 "크기 제한"을 주장한다 | 변이 M11 | qt-backend |
| F-11 | 경미 | `ReferenceParser.add`, 웹 `normalize.parseRange` | 절 수 표(`VerseCountTable.NONE`)가 없는 동안 장·절 상한이 150·176뿐이라 `창 1:1-99` 같은 불가능한 범위도 `RANGE_CONFIRMED`가 된다. 웹도 양수·순서만 검사하고 `BibleData`와 대조하지 않는다. 실제 제공처 표기가 이렇게 나올 가능성은 낮다 | `ReferenceParserTest` 수준 단위 확인 | qt-backend/planner-core(66권 데이터 확정 후 연결) |
| F-12 | 경미 | `QtTodayDefaultConfigTest` 외 취득 플래그를 켜는 Spring 테스트 | 기본값이 실수로 true가 되면(변이 M02) 이 테스트는 실제 제공처로 요청을 보내려 한다. 내 변이 시험은 프록시로 막았지만 CI에는 그런 장치가 없다. 취득 실수가 곧 외부 요청 사고가 된다 | 변이 M02(프록시 없이 돌리지 말 것) | qt-backend(테스트에서 `fetch-origin`을 죽은 로컬 주소로 고정) |
| F-13 | 경미 | `web/src/domain/dates.test.ts` | 30일 달 검사가 부족하다. `daysInMonth`에서 9월을 31일로 바꾼 변이 W19가 생존했다(`2026-09-31` 무효 판정이 없음). `PERIOD_TOO_LONG` 경계(3660/3661)와 `schemaVersion` 불일치 단독 시험(W26)도 생존. 내 시험 `qaPlan`은 두 경계를 통과 | 변이 W10·W19·W26 | planner-core / web-experience |
| F-14 | 경미 | `web/src/app/qt/qt.test.ts` 'fallbackLinks' | 테스트가 시간대에 둔감하다. `localIsoDate(now,'Asia/Seoul')`에서 `'Asia/Seoul'`을 빼는 변이 W28이 KST·UTC 환경에서 생존한다(음의 UTC 오프셋에서만 실패). 실제 브라우저(미국)에서는 폴백 생명의삶 링크가 서울이 아닌 현지 날짜가 될 수 있다. 코드는 현재 정상 | 변이 W28 | web-experience(vitest에 `TZ=America/Los_Angeles` 고정 또는 케이스 추가) |
| F-15 | 경미 | `QtProviderCard` (RANGE_NOT_PERMITTED, date-specific) | 공개 기본 상태(두 제공처 모두 `RANGE_NOT_PERMITTED`)에서 생명의삶 카드는 "이 날짜의 제공처 페이지로 연결됩니다"라고 하지만 어떤 날짜인지는 화면에 나오지 않는다(날짜는 URL에만 있음). `providerDate`가 null이라 "날짜를 확인하지 못했습니다"가 표시된다 | `qaUi.test.tsx.txt`의 NOTPERMITTED 관찰 | web-experience |
| F-16 | 경미(기록) | `services/qt/README.md` 마지막 절, `docs/adapter-notes.md` | 승인·권리 확인 전 실제 제공처에 약 20회 요청했다는 기록이 남아 있다(조사 요청 + 스모크 1회). 이번 QA는 요청하지 않았다. `smoke.sh`는 `QT_SMOKE_APPROVED=yes`가 없으면 종료 코드 3으로 거부하는 것을 코드로 확인했다(실행은 하지 않음) | `sed -n 1,12p services/qt/scripts/smoke.sh` | lead(기록 정정 불필요, 후속 재발 방지 확인용) |

## 3. 점검 항목별 결과

### 3.1 AC11 (본문 불가 시 공식 링크, 어제 자료 비유입, 자정 경계)

| 점검 | 방법 | 판정 |
| --- | --- | --- |
| 제공처 날짜 ≠ 서울 오늘 → `RANGE_UNAVAILABLE`/`DATE_MISMATCH`, passage·displayReference·verifiedAt null | `QtTodayContractTest.providerDateDifferent...`, 내 `QaBoundaryTest` | 통과 |
| 껍데기 페이지(날짜·장절 없음) → `PARSE_FAILED` | `SaengmyeongUiSamAdapterTest.shellPage...`, `duranno-shell.html` | 통과 |
| 저장소가 서울 오늘 키로만 조회, 재수집 중복 없음 | `QtTodayServiceTest.recollecting...`(store size 2 유지), 코드 `store.find(id, seoulToday)` | 통과 |
| 자정 경계(23:59:59.999 / 00:00:00.000 / 23:50 확인 후 00:10 조회 / 자정 직전 실패 캐시) | `QaBoundaryTest` 5건 사본에서 통과. 기존 테스트만으로는 회귀를 못 잡음 | 코드 통과, 테스트 공백(F-04) |
| 범위도 없으면 추정 없이 상태+링크 | 웹 `normalizeQtToday`가 RANGE_CONFIRMED 외 passage 폐기, 잘못된 범위는 `RANGE_UNAVAILABLE`/`INVALID_REFERENCE`로 강등. 변이 W21·W29·W30 사살. 카드도 상태 기준으로만 범위를 그림 | 통과 |
| 5개 상태 + 알 수 없는 상태 + officialUrl 없음 화면 | `QtProviderCard.test.tsx`, `axe` 6개 시나리오 | 통과 |
| API 전체 실패 시 범위 없는 폴백 링크 | `QtToday.test.tsx` "API 실패 시..." | 통과 |
| 탭 방치 후 자정 경과 | F-06 | 실패(중요) |
| 웹 기본이 mock | F-01 | 실패(중요) |

### 3.2 QT 계약 v1.1 준수

| 점검 | 방법 | 판정 |
| --- | --- | --- |
| 응답 필드 집합 정확 일치(최상위 3, provider 14) | `QtTodayContractTest.responseHasNoBibleText...`가 정확 집합 비교. 실행 중인 서비스에서 `curl \| python3 -m json.tool`로 직접 확인 | 통과 |
| 본문·해설 필드 없음, 제공처 원문 누출 없음 | 센티널 주입 시험 + fixture 전수 열람 + `grep`으로 알려진 절 문구·`Qt_sj`/`Qt_Brf`/`BodyBible` 검색(서비스·웹·infra). 문서·테스트 안의 필드 이름 언급뿐 | 통과. 단 F-05 |
| 모든 상태의 officialUrl이 https | 5개 상태 모두 시험(`everyEntryHasANonEmptyHttpsOfficialUrl...`), 변이 M07(http화) 사살 | 통과 |
| 제공처 순서 | Rig가 어댑터를 뒤집어 등록, 변이 M06(정렬 제거) 사살 | 통과 |
| 한 제공처 실패 격리(파싱·링크·타임아웃·예외·무응답) | `QtTodayContractTest`, `QtTodayServiceTest`. HTTP 200 유지 확인 | 통과 |
| 확정 응답 notice, 실패 notice null | 계약 예시 대비. 실패 notice null 시험 없음(F-08) | 코드 통과 |

변이 시험(서비스, 사본에서 조건 뒤집기). 사살 = 기존 테스트가 실패, 생존 = 기존 테스트가 모두 통과

| ID | 변이 | 결과 |
| --- | --- | --- |
| M01 | 날짜 불일치 검사 제거 | 사살(3건) |
| M02 | 취득 플래그 검사 제거 | 사살(3건) |
| M03 | kill switch 무시 | 사살 |
| M04 | 실패 캐시가 서울 날짜를 안 봄 | **생존**(내 시험이 사살) |
| M05 | 확인 캐시 영구 | 사살 |
| M06 | 제공처 정렬 제거 | 사살 |
| M07 | 생명의삶 링크 http | 사살 |
| M08 | 문자 깨짐 검사 제거 | 생존(파서가 `UNKNOWN_BOOK`으로 다시 막는 이중 방어라 사실상 등가) |
| M09 | JSON 보조 경로 조건 `\|\|`→`&&` | **생존**(F-09) |
| M10 | 빈 범위 허용 | 생존(파서가 빈 범위를 만들지 않아 도달 불가 코드) |
| M11 | 응답 크기 제한 제거 | **생존**(F-10) |
| M12 | (무효 변이, 무시) | - |
| M13 | 성공 로그에 장절 표기 추가 | **생존**(F-07) |
| M14 | 성공 시 실패 캐시 제거 안 함 | 생존(도달 시 등가) |
| M15 | 서울 → UTC | 사살 |
| M16 | 겹치는 범위 허용 | 사살 |
| M17 | 매일성경 링크 종류 date-specific | 사살 |
| M18 | 실패 항목에 notice 복사 | **생존**(내 시험이 사살, F-08) |
| M19 | 서울 오늘 키가 없으면 어제 키 조회 | **생존**(내 시험이 사살, F-04) |
| M20 | 전체 타임아웃 무력화(대기 600초) | 검출(테스트가 300초 안에 끝나지 않고 멈춤. 실패가 아니라 무한 대기 형태라 surefire 타임아웃 설정이 없다는 점은 경미) |
| M21 | fixture에 공백 있는 한국어 문장 추가 | **생존**(F-05) |

### 3.3 권한 미확인 원칙

| 점검 | 판정 | 근거 |
| --- | --- | --- |
| 취득 플래그 기본 off | 통과 | `QtProperties.Acquisition` 기본 `false`, `application.yml enabled:false`, 기동한 서비스 응답이 `RANGE_NOT_PERMITTED`/`PERMISSION_UNCONFIRMED`. `local-experiment` 프로필만 켠다. infra `qtAcquisitionEnabled: false` 기본(`infra/lib/config.ts:58`) 확인 |
| off일 때 제공처에 요청하지 않음 | 통과 | `acquisitionFlagOffReturnsNotPermitted...`가 `upstream.requests()` 비어 있음을 확인 |
| 본문·제공처 해설 저장·노출 없음 | 통과 | 응답 DTO에 필드 없음, 매일성경 JSON 보조 경로는 3개 필드만 읽음(`BodyBible*` 호출 없음), 웹 정규화는 계약 밖 필드를 옮기지 않음(`qt.test.ts`) |
| 로그에 원문·개인정보 없음 | 통과(코드 열람). 테스트 보강 필요(F-07) | `log.*` 호출은 provider·status·reason·예외 클래스명뿐, 스택트레이스 없음 |
| 저장소 전체에서 원문 흔적 | 통과 | 60자 이상 한국어 문장 검색 결과는 웹 UI 문구 3건뿐(제품 문구) |

### 3.4 개인정보 비저장(AC19, AC20, SESSION01, SEC01, AC01)

| 점검 | 판정 | 근거 |
| --- | --- | --- |
| `web/src` 비테스트 코드에서 localStorage·sessionStorage·IndexedDB·cookie·history·location·URLSearchParams·console·sendBeacon·XHR·WebSocket 사용 | 없음(통과) | `grep -rnE` 결과: `fetch` 두 곳(`/api/qt/today` GET, 폰트 GET, 둘 다 `credentials:'omit'`, `referrerPolicy:'no-referrer'`), `navigator.languages`(언어 감지, 저장 안 함), `URL.createObjectURL`(다운로드), `window.print()`뿐 |
| 계획 입력 후 저장소·쿠키·URL 변화 | 통과 | `qaUi.test.tsx.txt` "storage/cookie/url untouched"(사본 통과), `QtToday.test.tsx` 비저장 시험 |
| QT 조회 → 계획 영향(AC01) | 통과 | `App`이 두 영역에 상태를 공유하지 않음, `QtProviderCard`는 계획 상태를 import하지 않음, 서버 API에 요청 파라미터·개인 필드 없음(`?plan=..&read=..` 무시 시험, 기동 서비스에서도 200·무영향) |
| 서버 API 개인 필드 | 없음(통과) | 컨트롤러는 파라미터를 받지 않음, Lambda 함수는 쿼리·본문을 읽지 않음(`QtLambdaFunctions`) |
| 계획 이름(planName) | 통과 | 내보내기 파일에만 들어가고 저장·전송 경로 없음 |
| 미확인 | - | 실제 브라우저의 네트워크 탭·자동완성 동작, CSP·보안 헤더(infra 범위) |

### 3.5 계산 엔진 교차 검토(AC03~AC06, AC08, AC23, AC24)

- `plan.property.test.ts`는 독립 오라클(절 단위 펼침, `Date.UTC` 요일)로 무작위 3000건에서 계약 불변식 1~7과 오류 코드 집합 일치를 검사하고, 시드가 고정되어 재현된다. 변이 W01~W18(윤년·요일 오프셋·진행률·달성률 null·asOf·중복 책·목표 밖 읽기·제외일·부분 장·avg null·상태 분류·연속 읽기 오프바이원·`chapters` 나머지 위치·오늘 읽기의 분모 반영)이 모두 기존 테스트로 사살됐다. 생존한 것은 경계 시험이 없는 W10(기간 상한 `>`/`>=`)과 등가 변이 W11뿐이다.
- 내가 추가한 28개 경계 시험(`docs/qa/suggested/qaPlan.test.ts.txt`)이 사본에서 모두 통과했다. 주요 관찰:
  - 윤년(2028, 2000 윤년, 1900 평년), 월·연 경계, 시작일=마감일(하루에 전부), 기간 3660/3661일(3660 통과, 3661 `PERIOD_TOO_LONG`), 무효 날짜 8종(`2026-9-1`, `2026-02-30`, 앞 공백, 시각 포함 등)이 `INVALID_DATE`.
  - `asOf`가 마감일 뒤: 미독이 있으면 `NO_DAYS_LEFT_WITH_REMAINING`, 전부 읽었으면 정상이고 모든 날 `elapsed`. `asOf`=시작일 또는 그 이전이면 `recalculatedFrom` null.
  - 다 읽은 계획에 읽기 날짜가 남으면 날짜가 전부 `empty`이고 진행률 100%, `avgVersesPerDay`는 0. (계약과 일치하지만 화면 문구가 "빈 날"과 "완독"을 구분하는지는 확인하지 못함)
  - `todayRead` 미입력·빈 배열은 달성률 null, 오늘이 `off`이면 목표 null·달성률 null(0으로 나눔 없음), 겹치는 입력도 100%를 넘지 않음, `todayRead`는 `days`·`remainingRanges`를 바꾸지 않음.
  - 목표 밖 `todayRead`는 다른 부분이 정상이어도 `READ_OUTSIDE_TARGET` 오류다(의도된 동작으로 보이나 화면 안내 확인 필요).
  - 잘못된 요일 값(7, 1.5, NaN)만 있으면 `NO_READING_DAYS`로 처리된다(조용히 무시).
  - 실제 66권 잠정 데이터(`DEFAULT_BIBLE`)로 1년 계획: `verses` 분배는 날별 46~176절, `chapters` 분배는 18~212절, 부분 장 없음, 합계가 총 절 수와 일치. 3652일 계획도 6ms.
- 주의(미확인): `DEFAULT_BIBLE`(nkrv-provisional-1)은 1189장 31103절이다. 확정 여부와 절 수 근거는 T10 소관이라 판정하지 않는다. 그리고 앱은 아직 `SAMPLE_BIBLE`을 쓴다(`bibleSource.ts`, 샘플 배너 표시).

### 3.6 i18n / UX

| 점검 | 판정 | 근거 |
| --- | --- | --- |
| 영어 UI에서 원문이 한국어임을 표시 | 통과 | 영어 카드 모든 상태에 "The provider's text is in Korean only." 표시, 확정 시 "In Korean: 요한복음 3:1–21", 변이 W24 사살. (AC21은 본문 미제공 범위라 해당 없음, 장절 표기만 대상) |
| 언어 전환이 계획 입력을 바꾸지 않음 | 통과 | `QtToday.test.tsx` + 내 시험(모든 input 값 전환 전후 동일) |
| 언어 전환 시 QT 재요청 없음 | 통과 | `QtToday.test.tsx` "App: 언어 전환은 QT를 다시 요청하지 않고..." |
| 외부 링크 버튼 문구·rel | 통과 | "…공식 페이지로 이동 (새 창에서 열림)", `target=_blank rel="noopener noreferrer"`, https만. 내 시험이 모든 `a[href]` 확인, 변이 W23 사살 |
| 제공처 날짜·현지 날짜 구분 | 통과 | "제공처 기준 날짜 … (한국 시간 기준)", 현지 날짜와 다르면 안내. 단 F-06, F-15 |
| axe 접근성 검사 | 통과(범위 한정) | `axe.run`으로 6개 QT 시나리오 + 영어 + 로딩·오류 화면에 위반 0건. jsdom은 레이아웃·색상을 못 계산해 `color-contrast`를 끄고 검사한다. 키보드 시험은 링크 2개와 언어 버튼 도달만 본다. 스크린리더·모바일·다크 모드·색 대비는 미확인 |
| `reasonCode` 문구 누락 | 경미·허용 | `UNKNOWN_BOOK`, `DYNAMIC_CONTENT_UNAVAILABLE`, `LINK_UNREACHABLE`, `INTERNAL_ERROR`, `PERMISSION_UNCONFIRMED`, `OPERATOR_DISABLED`는 사유 문구 없이 상태 문구만 나온다. 계약상 허용 |

### 3.7 문서-코드 일치

| 항목 | 판정 | 근거 |
| --- | --- | --- |
| TASKS T04·T05·T06 done(mvn 86통과) | 일치 | 초기 스냅샷 86 확인, 현재 96(T15 포함) |
| TASKS T07·T08 done(170통과, 불변식 property 3000건) | 일치. 단 "SAMPLE_BIBLE 기준"이라는 단서가 실제와 같다 | 불변식 3000건 실행 확인, 현재 web 289 |
| TASKS T09 done(5상태·i18n·axe 0건) | 일치. F-01·F-06·F-15는 별도 | - |
| services/qt README 실행 명령(`mvn -q test`, `spring-boot:run`, `curl localhost:8081/api/qt/today`) | 일치 | 패키징한 jar로 같은 기본 동작을 확인 |
| README "cd services/qt && mvn -q -B test" | 동작 | - |
| 루트 README 실행 명령 | 없음 | IMPLEMENTATION_PLAN M0 마지막 항목 미완료. F-03 |
| TASKS T11 "새로고침 시 미복원" | 소스 검색으로 저장 경로 없음 확인. 실제 새로고침 동작은 미확인 | - |

## 4. 재현 방법

```sh
# 사본 준비(저장소를 건드리지 않는다)
SP=<scratchpad>; rsync -a --exclude target services/qt/ $SP/qt/
cd $SP/qt && mvn -q -B test                     # 96 테스트, 통과
# 웹: node_modules는 저장소 것을 심볼릭 링크하고, docs/contracts는 ../docs에 복사해 둔다(officialLinks.test.ts가 읽는다)
cd $SP/web && pnpm test && pnpm typecheck && pnpm build
# 변이 시험(취득 플래그를 켜는 변이가 있으므로 프록시 속성으로 외부 요청 차단)
python3 docs/qa/suggested/mutation-qt.py.txt   # 파일명을 .py로 바꿔 사본 경로를 맞춘 뒤 실행
python3 docs/qa/suggested/mutation-web.py.txt
```

`docs/qa/suggested/`의 파일은 컴파일·실행되지 않도록 `.txt`를 붙였다. 채택하면 담당자가 원래 확장자로 각자 소유 경로에 넣는다.

- `QaBoundaryTest.java.txt`: 서울 자정 경계 시험 5건(F-04, F-08)
- `qaPlan.test.ts.txt`: 계산 엔진 경계 시험 28건
- `qaUi.test.tsx.txt`: 자정 넘긴 탭·DATE_MISMATCH·영어 표기·링크 속성·언어 전환·비저장 시험
- `mutation-qt.py.txt`, `mutation-web.py.txt`: 변이 실행 스크립트(웹 변이 러너는 `docs/`를 `../docs`로 링크해 둬야 `officialLinks.test.ts`가 실패로 오판되지 않는다. 처음 실행에서 이 오판이 있었고 그 6건은 링크를 연결해 다시 돌려 확정했다)

## 5. 통과 판정한 AC

AC01, AC03, AC04, AC05, AC06, AC08, AC18, AC19, AC20, AC23, AC24 통과. AC26은 입력 UI(연속 입력 기본 + 여러 범위 행)가 존재하는 것까지 확인. AC11은 조건부(3.1 참고, F-01·F-06 해결 필요). AC10·AC17은 미확인.
