# 공유 작업 목록 (team lead 관리)

- 갱신 규칙: **상태 칸은 lead만 고친다.** 팀원은 완료 시 lead에게 메시지(변경 파일·실행한 테스트와 결과·미해결 문제)를 보내고, lead가 직접 확인한 뒤 상태를 바꾼다.
- 상태: `todo` / `doing` / `blocked(사유)` / `review` / `done(검증일)` / `superseded(사유)`
- 한 과제는 한 팀원이 소유한다. 소유 파일 밖은 수정하지 않는다. 필요하면 lead에게 메시지로 요청한다.
- 작성일: 2026-09-24

## 2026-09-26 최신 요청: 오늘의 말씀 메인·공식 QT 바로가기 (계획만 작성)

계획: [DAILY_WORD_MAIN_PLAN.md](../plans/DAILY_WORD_MAIN_PLAN.md). 기존 두 상위 탭은 유지한다. 이 일감은 아래 U06~U09 일독 개선과 병렬/별도이며, QT 범위 자동 수집 대신 오늘 구약·신약 각 한 절과 해설을 메인으로 둔다. 아직 구현하지 않았다.

| ID | 과제 | 담당안 | 의존 | 완료 기준 | 상태 |
| --- | --- | --- | --- | --- | --- |
| W01 | 한국어 번역본·본문 표시 및 정적 배포 권리 확인 | source-rights + lead | 공식 근거 확인 | 번역본·출처·versification·허용 범위 기록. 근거 부족 시 본문 배포 중지 | todo |
| W02 | 날짜별 두 구절·해설 콘텐츠 계약과 검증기 | content-data | W01의 기준; UI는 fixture로 선행 가능 | 한 날짜에 구약/신약 한 절씩, 출처·버전·누락/날짜 검증 | todo |
| W03 | 오늘 말씀 카드·상태·공식 바로가기 UI | daily-ui | 화면/API 계약 | 두 카드와 해설, 오류 상태, 매일성경·생명의삶 직접 링크 | todo |
| W04 | 정적 호스팅 우선 설계, 후속 서버리스/MSA 경계·비용 | platform-cost + msa-lab | W02 계약 | 기존 비용 상한과 배포 경계 검토; 별도 승인 없는 AWS/LLM 배포 없음 | todo |
| W05 | 통합 접근성·언어·날짜 경계·링크 검수 및 인계 | qa + lead | W02~W04 | 계획 D-01~D-08과 결과 문서 | todo |

## 2026-09-26 추가 요청: 일독 계획 간소화 (계획만 작성)

최신 계획: [PLAN_SIMPLIFICATION_PLAN.md](../plans/PLAN_SIMPLIFICATION_PLAN.md). 기존 탭 구현 위에 적용할 다음 작업이다. 사용자는 이번 턴에 개선 계획을 요청했으며 아래 제품 변경은 아직 구현하지 않았다. QT 실취득 여부와 별개로 진행할 수 있다.

| ID | 과제 | 담당안 | 의존 | 완료 기준 | 상태 |
| --- | --- | --- | --- | --- | --- |
| U06 | 진도 요약·접이식 기록·일정 조정 미리보기 | progress-ui + lead | 진도 초안/확정·배정 기준 상태 계약 | P-01~P-02 (진도 기능 유지, 삭제안 철회) | todo |
| U07 | 선택한 책의 드래그·터치·키보드 정렬 | book-order + lead | 정렬 도구·컴포넌트 계약 | P-03~P-04 | todo |
| U08 | 목록/캘린더 공통 크기·내부 스크롤·보기 상태 | schedule-view + lead | 공통 wrapper 계약 | P-05~P-08 | todo |
| U09 | 통합·회귀·실브라우저 검수·인계 | lead + qa | U06~U08 | P-01~P-08 및 QA 기록 | todo |

## 2026-09-26 우선 작업: 두 탭·디자인·오늘 QT 장절

명세: [UI_TABS_QT_PLAN.md](../plans/UI_TABS_QT_PLAN.md), 실행 팀: [GPT6_LUNA_UI_TEAM.md](GPT6_LUNA_UI_TEAM.md).
계획 작성 후 GPT-6 Luna 역할 팀으로 구현을 시작했다. 새 역할의 파일 소유권은 팀 문서를 따르며 과거 팀 소유권과 중복 배정하지 않는다. U01~U05를 T20보다 먼저 진행한다. 2026-09-26 현재 데스크톱 탭 UI와 전체 웹 회귀는 확인했으나 QT 실취득 승인, 모바일·인쇄 검수는 남아 있다.

| ID | 과제 | 담당 | 의존 | 완료 기준 | 상태 |
| --- | --- | --- | --- | --- | --- |
| U00 | 현재 UI·참고 디자인·QT 비활성 원인 조사, 계획·팀 프롬프트 작성 | planning | - | 두 문서 및 인수인계 진입점 존재. 제품 코드 변경 없음 | done(2026-09-26, 소스 기반 계획) |
| U01 | 두 탭·상태 유지·접근성·한영·QT 복귀 날짜 검사 | shell-state | U00, lead 계약 확인 | UI-01~UI-07, 기존 App 테스트의 탭 진입 반영 | done(2026-09-26, 관련 테스트 통과) |
| U02 | 참고 카드 디자인, 반응형·다크·인쇄 스타일 | visual | U00, lead DOM/토큰 계약 | UI-08~UI-09, 참조 대비와 브라우저 확인 | done(2026-09-26, 데스크톱 로컬 화면 확인; 모바일·인쇄는 U04) |
| U03 | QT 실취득 실행 경로·설정 진단·필요한 어댑터 수정 | qt-local + lead(루트 스크립트) | U00 | QT-01~QT-03, on/off 및 제공처별 확인 결과 구분 | superseded(최신 메인 방향은 공식 제공처 바로가기만 사용; 범위 자동 취득은 새 메인 경험의 선행조건이 아님) |
| U04 | 독립 회귀·시각·인쇄·QT 검수 | qa + lead | U01, U02, U03 | `docs/qa/UI-tabs-review.md`, 회귀/미확인 항목 명시 | doing(2026-09-26, 데스크톱·회귀 완료; 모바일·인쇄 남음) |
| U05 | 통합 검증·개발 실행 안내·완료 인계 | lead | U04 및 발견 결함 수정 | 웹 typecheck/test/build, QT 변경 검증, 로컬 확인 주소와 결과 보고 | doing(2026-09-26, 웹 359 테스트·빌드 및 QT 모의 15 테스트 통과) |

## 팀 소유권

| 팀원 | 소유 |
| --- | --- |
| lead | 루트 골격·공통 빌드 파일·의존성 버전, `docs/contracts/**`, `docs/team/**`, README.md, docs/PRD.md, docs/IMPLEMENTATION_PLAN.md, git 브랜치·커밋·스테이징 |
| source-rights | `docs/data-sources.md`, `docs/rights-matrix.md` |
| qt-backend | `services/qt/**` |
| planner-core | `web/src/domain/**`, `web/src/data/**`, 그 영역의 테스트 |
| web-experience | `web/src/app/**`, `web/src/components/**`, `web/src/export/**`, `web/src/i18n/**`, `web/src/styles/**` |
| platform-cost | `infra/**`, `.github/workflows/**`, `docs/cost-estimate.md` |
| (예정) qa-review | `docs/qa/**` (읽기 전용 검토) |
| (조건부) ai-content | `services/ai/**` — 본문·AI 사용 조건 확인 후 |
| (조건부) msa-lab | `labs/spring-cloud/**` — QT·AI 계약 후 |

## 활성 과제 (M0 · M1 · M2 시작)

| ID | 과제 | 담당 | 의존 | 소유 파일 | 완료 기준 | PRD 검수 | 상태 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| T00 | 계약 v1 작성(QT 응답·계획 결과) | lead | - | `docs/contracts/**` | 두 계약 문서 존재, 담당 팀원에게 전달됨 | - | done(2026-09-24) |
| T01 | 저장소 골격·빌드 파일·의존성 버전 고정 | lead | - | 루트, `web/{package.json,tsconfig*,vite.config.ts,index.html}`, `services/qt/pom.xml` 초안 | `pnpm install`·빈 테스트·`mvn -q validate` 통과, 버전 근거 기록 | M0 | done(2026-09-24: pnpm test·typecheck 통과, mvn dependency:resolve 통과) |
| T02 | 성경 66권 장절 구조 데이터 출처 조사 | source-rights | - | `docs/data-sources.md` | 후보별 출처 URL·확인일·기준 체계·버전·라이선스·본문 전문 데이터와 구조 데이터 구분, 권고안 | M0 | done(2026-09-24 수령·검토, T10 승인 대기 절차 정리 중) |
| T03 | 제공처별 권리 매트릭스 + 문의 초안 | source-rights | - | `docs/rights-matrix.md` | 매일성경·생명의삶(+365QT 조사만)의 장절 취득·공식 링크·본문 표시·보관·AI 입력·AI 출력 저장 각 항목에 `확인됨/문의 중/사용 불가/미확인` + 근거 URL + 확인일. 문의 초안(미발송) | M0 | done(2026-09-24 수령, 문의 발송은 사용자 지시 대기) |
| T04 | 매일성경·생명의삶 오늘 장절 취득 경로 조사와 어댑터 | qt-backend | T00 | `services/qt/**` | 두 어댑터가 fixture 기반 테스트로 통과. 실제 경로는 조사 결과와 함께 기록 | AC11 | done(2026-09-24 lead 검증: mvn test 86통과) |
| T05 | QT 공통 모델·상태·정규화·로컬 `/api/qt/today` | qt-backend | T00, T01 | `services/qt/**` | 계약 "테스트 가능한 기준" 1~7 전부 자동 테스트로 통과, 로컬 실행해 JSON 확인 | AC11, AC18(제공처 날짜) | done(2026-09-24 lead 검증) |
| T06 | 실패 시나리오 검증(동적 로딩 실패, EUC-KR 오류, 날짜 불일치, 링크 오류) | qt-backend | T04 | `services/qt/**` | 각 실패가 계약의 상태·reasonCode로 나오고 다른 제공처는 영향 없음 | AC11 | done(2026-09-24 lead 검증) |
| T07 | 계산 엔진: 66권 구조 타입, `SAMPLE_BIBLE`, 범위 합집합/차집합 | planner-core | T00 | `web/src/domain/**`, `web/src/data/**` | 집합 연산·검증 단위 테스트 통과 | AC03, AC23 | done(2026-09-24 lead 검증: web pnpm test 170통과·typecheck·build) |
| T08 | 날짜·요일·제외일, 장/절 배분, 재계산, 진행률 | planner-core | T07 | 동일 | 계약 불변식 1~7 테스트(예시 + 무작위 property) 통과. 윤년·월 경계·빈 날·부분 장 포함 | AC03~AC06, AC08, AC23, AC24 | done(2026-09-24 lead 검증: 불변식 property 3000건, 단 실제 66권 데이터 전 SAMPLE_BIBLE 기준) |
| T09 | 화면 골격(mock QT + mock/샘플 계획)·오늘 카드·공식 링크 대체 화면 | web-experience | T00, T01 | `web/src/{app,components,i18n,styles}/**` | mock 계약으로 5가지 상태 화면 렌더 테스트 통과 | AC11, AC18, AC26 | done(2026-09-24 lead 검증: QT 카드 5상태·i18n·axe 0건. 모바일/다크/스크린리더는 M7에서 실측) |
| T10 | 실제 66권 데이터 확정·`web/src/data` 반영 | planner-core | T02(권고안), lead 승인 | `web/src/data/**` | 데이터 출처·버전·검증 스크립트(장 수 1189, 절 수 합계 등) 재현 가능 | M0/M2 | done(2026-09-24 lead 검증: 66권·1,189장·31,103절 직접 재계산 일치, web 214테스트 통과. 잠정 데이터, 개역개정 전수 미검증) |
| T11 | 계획 입력·목록·캘린더·진행률·내보내기 연결 | web-experience | T08 | 위 + `web/src/export/**` | 화면·xlsx·PDF가 같은 `PlanResult` 사용, 새로고침 시 미복원 | AC10, AC17, AC20 | done(2026-09-24 lead 검증: web 355테스트·typecheck·build, 프로덕션 번들에 fixture 없음 직접 확인, F-01·F-06·F-14·F-15 반영). 다크모드·스크린리더·색 대비는 실기 미확인 |
| T12 | AWS 리전별 비용표(낮음/기준/증가) + 크레딧 종료 후 | platform-cost | - | `docs/cost-estimate.md` | 공식 가격 URL·확인일·환율 가정, 3 시나리오, 10,000원 대비 판정 | M0/M4 | done(2026-09-24 lead 검토: 표=모델 일치 cost:doc:check. 개역개정 사용료는 범위 밖 메모로 조정 중) |
| T13 | 서버리스 IaC 초안 + CI | platform-cost | T05 계약 | `infra/**`, `.github/workflows/**` | `cdk synth`(또는 동등) 통과, 개인 진도 테이블/API 없음, 실제 배포는 하지 않음 | M4 | done(2026-09-24 lead 검증: infra 23테스트·typecheck·synth:ci 통과, 배포 없음. 자리표시자 산출물 배포 차단 규칙 포함) |
| T15 | QT Lambda 진입점(Spring Cloud Function AWS 어댑터), 배포 산출물 형태 기록 | qt-backend | T05 | `services/qt/**` | 핸들러가 REST와 동일 JSON, 로컬 테스트 통과, 산출물·핸들러 문자열 문서화, 실제 AWS 호출 없음 | M4 | done(2026-09-24 lead 검증: mvn package 96통과, aws.jar 28MB. 실제 Lambda 런타임·API Gateway는 미시험) |
| T16 | 서버리스 저장·수집 경로: DynamoDB 저장소 구현체, 스케줄 수집 함수(qtCollect), 조회 함수의 저장소 읽기·Cache-Control, IaC 환경 변수 계약 일치 | qt-backend | T13, T15 | `services/qt/**` | 인터페이스 뒤에서 메모리/DynamoDB 교체, 오늘 항목 없으면 NOT_COLLECTED_YET(어제 대체 금지), 수집 off/취득 off 동작, 테스트 통과. 실제 AWS 호출 없음 | M4 | done(2026-09-24 lead 검증: mvn package 129통과). 실제 DynamoDB·Lambda·EventBridge 연동은 미시험. 수집 skip 규칙 정정 후속 진행 |
| T17 | AI 입력용 공개 번역본 후보 조사(KJV·WEB·ASV 등 퍼블릭 도메인/공개 라이선스, 한국어 공개 번역본 여부는 조사만) | source-rights | - | `docs/data-sources.md`(신규 절), `docs/rights-matrix.md`(신규 절) | 후보별 라이선스 근거 URL·확인일, 재배포·저장·AI 입력·AI 출력 저장 조건, 데이터 배포처(파일 형식·버전), 절 번호 체계와 개역개정 기준 QT 범위와의 대응 위험, 권고안 | M5 | done(2026-09-24 권고 WEB, ai-content 조건부 예 → 인용 금지·정렬 검사 조건으로 시작) |
| T18 | AI 설명 서비스 골격(Java, services/ai): 캐시 키, 동일 키 단일 활성 생성, 예산·호출 제한 차단, 검토·리비전·오류 신고, 출력 검증(구절 인용 금지), WEB 입력 절 정렬 검사, 목(mock) LLM | ai-content | T17, docs/contracts/ai-explain.md | `services/ai/**` | 계약 v1 응답, AC12~AC16·AC22·AC25에 대응하는 테스트(목 LLM), 실제 LLM 호출·API 키 없음(기본 AI_GENERATION_ENABLED=false) | M5 | done(2026-09-25, 24 테스트 통과; 메모리 저장소·제한은 단일 프로세스 개발 골격, 실제 LLM 비활성화) |
| T19 | 두 번째 QA: M1 발견 종결 확인, T16 배포 경로, IaC 권한·비용표 정합, 화면·내보내기 재확인 | qa-review | T11, T16 | `docs/qa/M2-review.md` | 항목별 종결/미종결·AC 표 갱신 | M7 | done(2026-09-25; 로컬 자동 검증만, AWS·브라우저 실기는 미확인, F-11 미해결) |
| T20 | Spring Cloud 실습: Gateway 라우팅, Config 분리, Eureka 검색, CircuitBreaker(AI 중단 시 QT 링크 유지), 모의 AI | msa-lab | QT·AI 계약 | `labs/spring-cloud/**` | QT·모의 AI 독립 빌드·실행·중단, 한쪽 장애 영향 테스트, 배포단위·장애경계·비용 기록. 공개 일정에 영향 없음 | M6 | todo(A1·T19 완료, 다음 진행 후보) |
| T14 | M1 통합 QA | qa-review | T05, T06 | `docs/qa/**` | AC11·QT 날짜·링크·비저장 점검 결과 문서 | AC11 | done(2026-09-24 docs/qa/M1-review.md: 차단 0, 중요 F-01·F-02(수정됨)·F-03(수정됨)·F-04~F-06 후속 배정) |

## 잠금 기준선

- QT 계약 v1, 계획 결과 계약 v1 (2026-09-24). 변경은 lead 경유.
- 의존성 버전(T01에서 확정):
  - Java 21(LTS, 로컬 확인 21.0.9), Maven 3.9.15 (로컬에 Gradle 없음 → Maven 사용)
  - Spring Boot 4.0.8 + Spring Cloud 2025.1.3(BOM이 Boot 4.0.8, Function 5.0.4 명시) — 근거: Maven Central `spring-cloud-dependencies-2025.1.3.pom`
  - vitest 4.1.11로 하향 고정(5.x는 engines가 Node ^22.12 이상이라 Node 20.20 환경 비지원). web에 exceljs 4.4.0, pdf-lib 1.17.1, @pdf-lib/fontkit 1.1.1 추가(T11)
  - Node 20.20.0 / pnpm 9.4.0 (`.nvmrc`), 루트 `pnpm-workspace.yaml`(web, infra)
  - web: React 19.3.0, Vite 8.3.0, TypeScript 7.0.2 (TS7에서 `baseUrl` 제거됨 → `paths`만 사용), Vitest 5.0.1, jsdom 29.1.1(30.x는 Node 22+ 필요), Testing Library. 정확한 버전은 `web/package.json`
  - services/qt: Boot 4.0.8은 Jackson 3(`tools.jackson.*`) 기반, 스타터는 `spring-boot-starter-webmvc`, jsoup 1.23.2
