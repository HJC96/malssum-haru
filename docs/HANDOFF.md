# 말씀하루 인수인계 문서

> **최신 제품 계획 (2026-09-26):** `오늘의 QT` 탭은 구약 한 절·신약 한 절과 각각의 해설을 메인으로 보여 주고, 아래 매일성경·생명의삶 버튼은 공식 페이지로 직접 연결한다. 따라서 QT 제공처의 장절 자동 수집은 이 메인 경험의 선행조건이 아니다. 번역본의 표시·정적 배포 권리와 출처를 먼저 확인해야 하며, 승인 전 실제 본문 데이터는 넣지 않는다. 다음 계획은 [오늘의 말씀 메인 계획](plans/DAILY_WORD_MAIN_PLAN.md), 실행 작업은 [W01–W05](team/TASKS.md)다. 아래의 두 탭 구현 기록과 일독 개선(U06–U09)은 각각 완료/별도 계획으로 유지한다.

- 작성: 2026-09-24, 2026-09-25 갱신 — Claude 인수인계 이후 이어서 진행한 상태를 반영했다.
- 제품 요구사항의 기준은 [PRD](PRD.md), 실행 순서는 [구현 계획](IMPLEMENTATION_PLAN.md)의 M0~M7이다. 이 문서는 "지금 어디까지 됐고, 무엇이 남았고, 어떻게 이어가는가"만 다룬다.
- 작업 목록의 상세 상태는 [docs/team/TASKS.md](team/TASKS.md)에 있다.

> 2026-09-26 최신 추가 요청은 진도 기능을 요약 카드·접이식 기록 패널로 자연스럽게 배치하고, 책 순서를 드래그로 정렬하며, 목록을 캘린더와 같은 크기의 스크롤 박스에 넣는 것이다. 사용자의 후속 정정으로 진도 제거안은 철회했다. 이번에는 [개선 계획](plans/PLAN_SIMPLIFICATION_PLAN.md)만 작성했다. 다음 구현은 U06~U09를 참고한다. 앞서 구현된 두 탭과 미완료 QT 확인은 아래 기록대로 유지한다.

> 2026-09-26 UI 작업: 두 탭(오늘의 QT / 일독 계획)과 참고 디자인을 반영했다. 데스크톱 로컬 브라우저에서 두 탭 전환을 확인했고, 전체 웹 359 테스트·빌드, QT 모의 upstream 15 테스트가 통과했다. QT 범위 미표시는 별도 승인 전까지 외부 취득을 끄는 정책이 원인이다. 기본 화면은 계속 공식 링크만 보여 주므로, 오늘 장절이 실제 표시되는 것까지는 완료되지 않았다. 사용자의 실취득 선택과 모바일·인쇄 검수 결과는 [UI 검수](qa/UI-tabs-review.md)에 기록한다. 상세 계획·팀 구성은 [UI·QT 구현 계획](plans/UI_TABS_QT_PLAN.md), [GPT-6 Luna 팀 프롬프트](team/GPT6_LUNA_UI_TEAM.md).

## 1. 30초 요약

- 하려는 것: 생명의삶·매일성경의 **오늘 QT 장절 범위와 공식 링크**를 한 화면에 보여 주고, **성경 66권 일독 계획**(계산·캘린더·진행률·Excel/PDF)을 브라우저에서 만든다. 회원가입 없음, 개인 진도는 서버·브라우저에 저장하지 않는다.
- 범위 결정(사용자, 2026-09-24): **개역개정 본문은 사이트에 표시·보관하지 않는다.** QT는 장절 범위 + 공식 링크만. AI 요약·설명은 개역개정이 아니라 **WEB(World English Bible, 퍼블릭 도메인)** 을 입력 본문으로 쓰는 방향이며, 실제 LLM은 아직 연결하지 않았다.
- 상태: M0~M4는 로컬에서 구현·검증 완료. **AWS에는 아무것도 배포하지 않았다.** M5 AI 골격도 로컬 구현 및 테스트 24개 통과(목 LLM, 실제 생성 비활성화). M6(Spring Cloud 실습) 산출물은 아직 없고, M7 최종 검수도 남아 있다.
- 저장소: `https://github.com/HJC96/malssum-haru` (private). 커밋은 사용자가 직접 한다(자동 커밋 훅이 있음).

## 2. 저장소 구조와 소유 영역

| 경로 | 내용 | 기술 |
| --- | --- | --- |
| `web/` | 브라우저 앱: 계산 엔진(`src/domain`), 66권 잠정 데이터(`src/data`), 화면(`src/app`, `src/components`), 내보내기(`src/export`), 한/영(`src/i18n`) | React 19, Vite 8, TypeScript 7, Vitest 4, exceljs, pdf-lib |
| `services/qt/` | QT 오늘 장절 서비스: 제공처 어댑터, `/api/qt/today`, Lambda 핸들러 2개(조회·수집), DynamoDB 저장 | Java 21, Spring Boot 4.0.8, Spring Cloud 2025.1.3, Maven |
| `services/ai/` | AI 설명 서비스 개발 골격(실제 LLM 비활성화, 프로세스 메모리 저장소) | 위와 동일 |
| `infra/` | AWS CDK(TypeScript) 스택 초안, 비용 모델(`infra/cost`) | aws-cdk-lib 2.270 |
| `.github/workflows/ci.yml` | CI(web·qt·infra, **배포 단계 없음**) | GitHub Actions |
| `docs/contracts/` | 서비스 간 계약: `qt-today.md`, `plan-result.md`, `ai-explain.md` | - |
| `docs/` | PRD, 구현 계획, 권리 매트릭스, 데이터 출처, 비용표, QA 결과, 팀 작업 목록 | - |
| `labs/spring-cloud/` | (아직 없음) M6 실습 | - |

개발 중에는 영역별 담당 에이전트가 파일을 나눠 소유했다(`docs/team/TASKS.md` 상단 표). 사람이 이어받을 때는 이 소유 규칙을 지킬 필요는 없지만, **계약 문서(`docs/contracts/**`)를 바꾸면 그 계약을 쓰는 코드·테스트를 함께 바꿔야 한다.**

## 3. 로컬에서 실행·검증하기

필요: Node 20.20(`.nvmrc`), pnpm 9.4, Java 21, Maven 3.9. (Node 22 이상이면 vitest 5도 되지만, 이 저장소는 vitest 4.1.11로 고정)

```sh
pnpm install                                                    # 루트에서 한 번
pnpm --filter malssum-haru-web test                             # 355 테스트 (기준 시점)
pnpm --filter malssum-haru-web typecheck
pnpm --filter malssum-haru-web build                            # 초기 로드 gzip 약 100KB 예산(150KB 이내)
(cd services/qt && mvn -q -B test)                              # 179 테스트, 인터넷 불필요
pnpm --filter malssum-haru-infra test                           # 27 테스트
pnpm --filter malssum-haru-infra cost:doc:check                 # 비용표 문서 = 모델 결과
AWS_SHARED_CREDENTIALS_FILE=/dev/null pnpm --filter malssum-haru-infra synth:ci   # 배포 없이 CloudFormation 합성만

# 안전 기본 화면 (두 터미널)
pnpm run dev:qt:links                                           # 8081, 제공처 요청 없이 링크만
pnpm run dev:web:api                                            # 5173, QT API 사용

# 실취득은 권리·사용자 승인을 확인한 뒤에만 수동 선택
pnpm run dev:qt:live                                             # 제공처에 실제 요청
```

주의:
- 프로덕션 빌드는 항상 실제 API(`/api/qt/today`)를 쓴다. 샘플 데이터는 개발 서버이거나 `VITE_QT_SOURCE=mock`일 때만. `prodBundle.test.ts`가 빌드 산출물에 샘플 데이터가 없음을 확인한다(vitest 안에서 vite build를 돌리면 NODE_ENV=test라 DEV 모드가 되므로 자식 프로세스에 NODE_ENV=production을 넣는다).
- `dev:qt:live`와 `services/qt/scripts/smoke.sh`는 **실제 제공처 서버로 요청**한다. 자동 취득 허용 여부가 확인되지 않았으므로 사용자가 의도적으로 선택하기 전에는 실행하지 않는다. `smoke.sh`는 별도 `QT_SMOKE_APPROVED=yes` 확인값이 없으면 거부한다. 일반 테스트는 로컬 목 서버만 사용한다.
- 66권 데이터를 갱신하면 `services/qt/src/main/resources/bible/verse-counts.json`도 다시 만들어야 한다: `python3 services/qt/scripts/generate_verse_counts.py`(`--check`로 검사). `VerseCountsSyncTest`가 어긋나면 실패한다.

## 4. 지금까지 확인된 것 (기준 시점: 2026-09-24)

| 영역 | 결과 | 확인 방법 |
| --- | --- | --- |
| 계산 엔진 | 계약 불변식 1~7을 무작위 3,000건 property 테스트와 독립 오라클로 검증, 잠정 66권으로 1년 계획 1초 이내 | web 테스트 |
| 66권 데이터 | `nkrv-provisional-1`: UBS `eng.vrs`(MIT, 커밋 71c66cb) + 요한계시록 12장 17절 덮어쓰기. 66권·1,189장·31,103절(구약 23,145/신약 7,958). **개역개정 전수 미검증** | 생성 스크립트 `web/src/data/tools/`, 직접 재계산 |
| QT 서비스 | 제공처 어댑터, 자정·날짜 불일치·껍데기 페이지·EUC-KR·링크 오류 처리, 조회는 제공처에 요청하지 않음, 수집은 멱등 | mvn 179 테스트, 변이 테스트 |
| 화면·내보내기 | 계획 입력·목록·캘린더·진행률 차트·재계산, xlsx·PDF(목록형·월간형)·인쇄, 화면=xlsx=PDF 같은 데이터 | web 테스트, PDF를 이미지로 렌더링해 눈으로 확인 |
| 개인정보 | 저장소·쿠키·URL·로그·QT 요청에 개인 입력 없음 | 테스트+소스 검색 |
| IaC | 스택 합성 통과, IAM 최소 권한(조회 GetItem, 수집 GetItem+PutItem), 개인 진도 리소스 없음 | infra 테스트 27, 실제 jar 경로로 synth |
| QA | M1 검토: 차단 0, 중요 6건 → 수정됨(`docs/qa/M1-review.md`) | qa-review |

**아직 확인하지 못한 것** (실환경 필요): 실제 DynamoDB(PutItem/TTL/IAM), Lambda 런타임·콜드 스타트, API Gateway·EventBridge 연동, 다크모드·스크린리더·색 대비 실기, 브라우저 파일 다운로드 클릭·인쇄 미리보기, 개역개정 전체 절 수, 제공처 자동 취득 허용 여부.

## 5. 남은 작업 (우선순위 순)

### A. 즉시 이어갈 것

| # | 작업 | 상태 | 이어가는 법 |
| --- | --- | --- | --- |
| A1 | **AI 설명 서비스 골격(T18)** `services/ai/` | 완료(2026-09-25). API·상태/동시 생성 제어·예산·호출 제한·리비전/신고/관리 경로·출력 검증·메모리 저장소와 테스트 구현 | `cd services/ai && mvn -q -B test` 통과. 총 24 테스트; 목 LLM만 사용, `AI_GENERATION_ENABLED=false`. 실제 모델 연결·품질 검토·다중 인스턴스 저장소는 미완료 |
| A2 | **두 번째 QA(T19)** `docs/qa/M2-review.md` | 완료(2026-09-25). 로컬 자동 검증 통과, F-11 및 실환경 확인은 남음 | 자세한 결과와 경계는 `docs/qa/M2-review.md` 참고 |
| A3 | **AI 골격 QA** | 미착수 | AC12~AC16·AC22·AC25 계약·구현 정합 검토. 실제 LLM 호출은 금지 |

### B. 배포 전에 필요한 것 (사용자 결정 포함)

1. **배포 승인 자료를 사용자에게 제시하고 지시 받기.** 자료 위치: [비용표·IaC 변경 내역·접근 제어 선택지](cost-estimate.md) 0장·14장. 배포 전에 정할 값:
   - 리전(기본 서울 `ap-northeast-2`, 리전 간 비용 차이 1% 안팎), 계정 요금제(유료 요금제+신규 크레딧 권고, 무료 요금제 서비스 범위 미확인), 알림 이메일(없으면 Budgets·알람 미생성), 도메인 사용 여부(Route 53 호스팅 영역 월 약 860원, 등록비 미확인)
   - **웹 접근 제어**: (a) noindex만, (b) CloudFront Function 기본 인증(권고, 추가 비용 사실상 0, 자격 증명 주입 방식을 먼저 정해야 함), (c) IP 제한(WAF는 월 약 10,300원으로 예산 초과)
2. 배포 순서(사용자 승인 후에만): 웹 빌드 → QT jar 빌드 → `cdk deploy`
   ```sh
   pnpm --filter malssum-haru-web build
   (cd services/qt && mvn -B package)      # target/qt-service-0.0.1-SNAPSHOT-aws.jar
   cd infra && pnpm cdk deploy -c alertEmail=<이메일> \
     -c qtLambdaAssetPath=../services/qt/target/qt-service-0.0.1-SNAPSHOT-aws.jar
   ```
   IaC 컨텍스트 파라미터: `region`, `alertEmail`, `qtLambdaAssetPath`, `webDistPath`(기본 `../web/dist`), `qtAcquisitionEnabled`(기본 true=비공개 시험 운영), `collectorEnabled`, `collectorTimesKst`(기본 `00:05,00:35,06:00,12:00`), 제공처별 끄기 `providerMaeilSeongyeong=false` / `providerSaengmyeongUiSam=false`. 자리표시자 산출물이면 CloudFormation Rule이 배포를 거부한다. **이 저장소에서는 아직 한 번도 `cdk deploy`나 `aws` 명령을 실행하지 않았다.**
3. 배포 후: 실제 청구와 비용표 비교(`docs/cost-estimate.md` 15장), Lambda 콜드 스타트·조회 응답 p95 1초 측정(PRD 성능 목표), `DynamoDB` PutItem/TTL 실제 동작 확인, 제공처 날짜 전환(서울 자정 전후) 관찰.
4. 취득을 끄는 법(제공처 회신·차단 등): `-c qtAcquisitionEnabled=false` 또는 제공처별 disabled 환경 변수(`QT_PROVIDER_MAEIL_SEONGYEONG=disabled`, `QT_PROVIDER_SAENGMYEONG_UI_SAM=disabled`). 취득이 꺼지면 카드에 공식 링크만 나온다.

### C. 학습 트랙·최종 검수

- **M6 Spring Cloud 실습(`labs/spring-cloud/`)**: T20 todo, 아직 실습 파일 없음. Gateway 라우팅, Config 분리, Eureka 검색(정적 주소와 비교), CircuitBreaker(AI 중단 시 QT 링크 응답 유지)를 로컬에서 실습. AI 서비스는 모의 응답 사용. 공개 구성에 상시 실행 MSA 인프라를 자동 포함하지 않는다(월 10,000원 예산).
- **M7 최종 검수**: PRD 11장 AC 전체를 결과와 함께 점검, 동시 사용자 20명·1년 계획 성능 측정, 모바일·다크모드·스크린리더 실측, README에 배포법·운영 중지법 정리. AI 관련 AC(AC12~AC16·AC21·AC22·AC25)는 AI를 공개하지 않으면 "보류·대체 상태"로 기록.
- **PRD·구현 계획 문서**: PRD 0.9의 일부 일반 설명은 조건부 AI 기능을 기술한다. 확정 경계(QT는 장절+링크만, WEB은 AI 내부 입력 전용, 실제 LLM 비활성화)와 충돌하는 문구가 없는지 M7에서 AC 전체와 함께 최종 대조한다.

### D. 알려진 한계·기술 부채

- 66권 데이터는 **잠정**(개역개정 전수 미검증). 병합 절(ACT 15:25-26)·표시 없는 절(ACT 24:7)은 번호 기준으로 센다. 대한성서공회 자료로 전수 검증하면 `nkrv-provisional-1`을 확정 데이터로 교체하고 QT 표(`verse-counts.json`)도 재생성.
- 장 전체만 표기한 QT(시편 23편 등)는 절 수 표의 끝 절로 채워 `RANGE_CONFIRMED`로 나온다. 표가 틀리면 정상 범위가 `INVALID_REFERENCE`로 거부될 수 있다(링크만 표시되는 안전한 방향).
- 조회 함수가 제공처에 요청하지 않는다는 보장은 IAM으로 검증할 수 없다(테스트 `DeployedQueryNeverFetchesTest`로만 확인).
- AI 서비스는 Lambda에 그대로 올릴 수 없다: 응답 후 백그라운드 스레드가 멈추므로 생성을 별도 비동기 호출로 분리해야 한다. **AI 서비스는 배포하지 않기로 했다.**
- QT 수집은 서울 자정 직후 제공처가 아직 어제 페이지를 보이면 그 회차가 실패한다. 스케줄을 자정 이후 여러 번 돌려 흡수한다(00:05, 00:35, 06:00, 12:00).
- 웹: 화면 하단 "데이터 출처·라이선스"는 `THIRD_PARTY_NOTICES.md`를 그대로 보여 준다. 신선도 판단은 응답 수신 시각과 `providerDate`만 쓴다(`generatedAt`·`Cache-Control` 미사용).

## 6. 권리·위험 (반드시 읽을 것)

1. **제공처(매일성경 `sum.su.or.kr`, 생명의삶 `duranno.com`)의 장절 범위 자동 취득 허용 여부는 확인되지 않았다.** 약관에 자동 수집을 허용한다는 말도 금지한다는 말도 없다. 코드 기본값은 취득 **off**이고, 사용자가 혼자 쓰는 **비공개 시험 운영** 동안만 배포에서 켠다(사용자 결정, PRD 범위 결정 절). 일반 공개 전에는 제공처 회신 또는 사용자의 별도 결정이 필요하다.
2. 문의 메일 초안이 있다: [rights-matrix.md](rights-matrix.md) 6절(성서유니온·두란노 초안은 "해설·본문 없이 오늘 장절 범위 표기만 자동으로 읽어 링크와 함께 무료 비영리 사이트에 표시해도 되는가"로 좁힘, 대한성서공회는 본문을 쓰지 않으므로 보류, 365QT는 발송 계획 없음). **아무 메일도 보내지 않았다.** 발송 주체·서비스 이름·회신 이메일은 대괄호 자리표시자다. 사용자가 며칠 써 본 뒤 결정한다.
3. 개역개정 본문은 사용하지 않는다. 대한성서공회 요금표(웹 본문 서비스 번역본당 100만 원/1년 안내)는 본문 표시를 하지 않으므로 현 범위에 해당 없다.
4. **사고 기록(사용자에게 보고 완료)**: (a) 조사 중 사용자 이메일이 제공처 서버에 약 20회 전송됨(curl User-Agent) — 이후 어떤 요청에도 개인정보를 넣지 않으며 `qt.http.user-agent` 연락처 값은 비워 두었다. (b) 접근 제한(403)이 있는 `bible.bskorea.or.kr`을 브라우저형 User-Agent·Chrome으로 조회(약 40건, 본문 미저장) — 이후 접근 중단, 상세는 `docs/data-sources.md` 10절. (c) 권리 확인 전 제공처에 실제 요청이 나감 — 이후 `smoke.sh`는 승인 게이트, 테스트는 죽은 로컬 주소로 고정. **이 저장소에서 작업하는 사람·에이전트도 같은 원칙을 따른다: 접근 제한을 우회하지 않고, 개인정보를 외부 요청에 넣지 않는다.**
5. 제3자 라이선스: `eng.vrs`(MIT) → `web/src/data/THIRD_PARTY_NOTICES.md`, Noto Sans KR(SIL OFL) → `web/public/fonts/OFL.txt`, WEB(퍼블릭 도메인, 명칭 조건) → `services/ai/` 데이터의 `copr.htm`.

## 7. 사용자가 이미 정한 것

- 개역개정 본문은 쓰지 않고 오늘 장절 범위 + 공식 링크만 표시.
- AI 입력은 공개 번역본(WEB 권고)으로 검토, AI 출력은 구절 원문 인용 없이 절 참조와 설명만.
- 문의 메일은 사용자가 써 본 뒤 결정(그 전 발송 금지).
- 배포본에서도 자동 취득을 켠다(혼자 쓰는 비공개 시험 운영).
- 커밋·푸시는 사용자가 직접 한다. 실제 AWS 배포·유료 리소스 생성은 사용자 지시 후에만.

## 8. 에이전트 팀으로 이어가기

이 프로젝트는 Claude Code 에이전트 팀으로 진행했다. 팀원의 대화 기록은 자동 복구되지 않으므로 새 세션의 lead가 다음 순서로 시작한다.

1. `git status`, 이 문서, `docs/team/TASKS.md`, `docs/contracts/*.md`를 읽는다.
2. 필요한 팀원만 다시 만든다. 각 팀원의 시작 지시는 [CLAUDE_TEAM_PROMPT.md](CLAUDE_TEAM_PROMPT.md)와 아래 역할 요약을 기준으로 쓴다.

| 역할 | 소유 | 이어갈 일 |
| --- | --- | --- |
| ai-content | `services/ai/**` | A1 |
| qa-review | `docs/qa/**`(읽기 전용) | A2, A3, M7 |
| platform-cost | `infra/**`, `.github/workflows/**`, `docs/cost-estimate.md` | 배포 승인 뒤 배포 지원, 접근 제어 구현 |
| msa-lab | `labs/spring-cloud/**` | M6 |
| qt-backend | `services/qt/**` | 배포 후 실측 반영, 제공처 변경 대응 |
| web-experience | `web/src/{app,components,export,i18n,styles}/**`, `web/public/**` | AI 설명 화면(AI 공개 시), 실기 접근성 수정 |
| planner-core | `web/src/{domain,data}/**` | 개역개정 확정 데이터 반영 |
| source-rights | `docs/data-sources.md`, `docs/rights-matrix.md` | 문의 회신 반영 |

3. 팀원 공통 규칙: 개인 계획·읽은 범위를 어디에도 저장·전송하지 않는다, QT 열람은 일독에 영향 없음, 소유 파일 밖은 수정하지 않는다, git 커밋·스테이징은 lead(사용자)만, 실제 외부 요청·배포는 사용자 승인 후, 완료 보고는 변경 파일·실행한 검증·미해결 문제를 포함하고 lead가 직접 재실행해 확인한다.

## 9. 커밋·푸시

현재 `main`은 `origin/main`과 같다(4개 커밋 푸시됨). 아직 커밋되지 않은 것은 `services/ai/`(작성 중)와 이 문서·작업 목록 갱신이다.

```sh
cd /Users/hanjichan/Desktop/git/malssum-haru

# 지금: 문서만
git add docs/HANDOFF.md docs/team/TASKS.md README.md
git commit -m "docs: 인수인계 문서 추가, 작업 목록 갱신"
git push origin main

# services/ai 가 테스트까지 통과한 뒤 별도 커밋
(cd services/ai && mvn -q -B test)
git add services/ai
git commit -m "feat(ai): AI 설명 서비스 골격 (목 LLM, 실제 호출 없음)"
git push origin main
```

커밋 전 점검: `pnpm --filter malssum-haru-web test`, `(cd services/qt && mvn -q -B test)`, `pnpm --filter malssum-haru-infra test`, 그리고 `grep -rIn "gmail\|AKIA\|BEGIN .*PRIVATE KEY" --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=target --exclude-dir=cdk.out --exclude-dir=dist .`에서 의도하지 않은 결과가 없는지 확인한다. `target/`, `dist/`, `cdk.out/`, `node_modules/`는 `.gitignore`로 제외된다.
