# GPT-6 Luna: 탭·디자인·QT 장절 표시 작업 팀

- 작성일: 2026-09-26
- 상태: 다음 구현 세션용 인계. 현재는 계획만 작성함.
- 구현 명세: [UI_TABS_QT_PLAN.md](../plans/UI_TABS_QT_PLAN.md)
- 작업 상태: [TASKS.md](TASKS.md)의 U00~U05

> 다음 구현 세션은 먼저 [오늘의 말씀 메인 계획](../plans/DAILY_WORD_MAIN_PLAN.md)과 작업 W01–W05를 따른다. 이 문서의 탭/스타일 기록은 이미 구현된 상위 UI의 인계 자료다. 기존 `qt-local`의 제공처 범위 자동 수집은 최신 사용자 방향(공식 링크 바로가기)에서 필수 작업이 아니며, 본문 권리 확인 없이 실제 성경 콘텐츠를 넣지 않는다.

## 1. 모델과 동시 실행

lead와 모든 작업 에이전트를 **GPT-6 Luna (`gpt-6-luna`)**로 구성한다. 현재 세션에서 구현 에이전트를 미리 실행하지 않는다. 다음 구현 세션의 실행 환경에서 모델을 명시하고 시작한다. 지원되지 않는 모델 식별자를 임의의 CLI 옵션으로 만들어 사용하거나 다른 모델로 조용히 대체하지 않는다.

논리 역할은 다섯 개이며 동시 실행은 lead 포함 최대 네 개다.

| 단계 | 실행 역할 | 종료 조건 |
| --- | --- | --- |
| 준비 | lead | 저장소 상태, 요구사항, 파일 소유권, DOM/토큰/props 계약 확정 |
| 병렬 구현 | lead + shell-state + visual + qt-local | 각 소유 범위 구현 및 검증 보고 |
| 통합 검수 | lead + qa (필요 시 담당자 재호출) | UI/QT 검증표, 회귀 수정, 통합 검증 |

qa는 구현 세 역할 중 하나 이상이 끝나 슬롯이 비면 시작할 수 있다. 변경 중인 UI의 최종 검수는 통합이 안정된 뒤 수행한다. 이전 Claude 에이전트 대화나 이전 세션의 메모리가 복구된다고 가정하지 않는다.

## 2. 파일 소유권

| 역할 | 책임 | 쓰기 허용 경로 |
| --- | --- | --- |
| lead | 계약 확정, 통합, 실행 스크립트, 문서·작업 상태 관리 | 루트 `package.json`, README.md, docs/PRD.md, docs/HANDOFF.md, docs/IMPLEMENTATION_PLAN.md, docs/team/**, docs/plans/** |
| shell-state | 상위 두 탭, 메모리 상태 유지, 접근성·한영 문구, QT 복귀 신선도, 기존 App 테스트 적응 | `web/src/app/App.tsx`, 새 `web/src/components/ServiceTabs.tsx` 및 그 단위 테스트, `web/src/components/QtToday.tsx`, `web/src/i18n/**`; 기존 `QtToday.test.tsx`, `QtFreshness.test.tsx`, `PlanSection.test.tsx`, `noStorage.test.tsx`, `defaultData.test.tsx`, `a11y.test.tsx` |
| visual | 참고 앱의 색감·카드·버튼을 적용, 반응형·다크·인쇄 | `web/src/styles/**`, `web/src/components/QtProviderCard.tsx`, `web/src/components/PlanSection.tsx`, `web/src/components/plan/**`의 표시 마크업/클래스만 |
| qt-local | off 원인 재확인, 실취득 실행 경로, 제공처별 진단, 필요한 최소 백엔드 수정 | `services/qt/**`; 루트 스크립트 변경안은 lead에게 전달 |
| qa | 탭 왕복·접근성·장절·내보내기 독립 검수 | 새 `web/src/components/AppTabs.test.tsx`, `docs/qa/UI-tabs-review.md`, 필요 시 `docs/qa/assets/ui-tabs/**` 캡처 |

각 경로는 malssum-haru 기준이다. `omalssum-react/**`는 읽기 전용 참고 자료다. 이번 작업에서 `services/ai/**`, `infra/**`, `labs/**`, 계산 엔진 `web/src/domain/**`, 데이터 `web/src/data/**`, 내보내기 엔진 `web/src/export/**`는 읽기 전용으로 둔다. 실제 결함으로 수정이 필요하면 근거와 최소 범위를 lead에게 전달해 소유권을 조정한다.

`visual`은 PlanSection의 상태·계산·key를 바꾸지 않는다. 문구 변경은 shell-state의 i18n 담당에 요청한다. shell-state는 CSS를 직접 쓰지 않고 `.service-tabs`, `.service-tabs__tab`, `.service-panel` 계약을 visual에 전달한다. qa는 기존 테스트와 제품 코드를 동시에 고치지 않고 발견한 결함을 소유자에게 전달한다.

## 3. 준비 시 공유할 계약

- 기본 탭 qt, 두 패널 모두 마운트 유지, 비선택 패널은 `hidden`.
- tab/tabpanel ID: `service-tab-qt`, `service-tab-plan`, `service-panel-qt`, `service-panel-plan`.
- 수동 활성화: 화살표/Home/End는 포커스 이동, 클릭/Enter/Space는 탭 선택.
- `ServiceTabs`는 선택값과 onChange를 받는 제어 컴포넌트. 계획 폼이나 QT 데이터는 받지 않는다.
- `QtToday`에 `isActive?: boolean`을 추가할 경우 기본값 true로 기존 독립 사용·테스트와 호환시킨다. 실제 구현 전에 lead가 props 계약을 확정한다.
- 앱 탭 복귀 시 QT 날짜 검사를 하되 캐시가 유효한 빠른 왕복마다 fetch하지 않는다. lang/activeTab 변경으로 컴포넌트를 재마운트하지 않는다.
- CSS 기존 토큰의 의미를 유지하고 새 `--surface-soft`, 카드/탭 radius·shadow 등 필요한 소수 토큰을 visual이 정의한다. 상태 배지와 버튼 대비를 별도로 확인한다.
- 루트 실행 스크립트 예정 이름: `dev:qt:links`, `dev:qt:live`, `dev:web:api`. lead 소유이며 live는 기존 local-experiment 프로필을 사용한다.
- API 계약 변경은 원칙적으로 필요 없다. 새로운 사유/필드가 꼭 필요하면 lead가 계약·프런트·백엔드의 동시 변경 범위를 먼저 확정한다.

## 4. 새 구현 세션에 붙여 넣을 lead 프롬프트

```text
말씀하루의 두 서비스 탭, 참고 디자인 적용, 오늘 QT 장절 표시 문제를 구현해 줘.
너는 team lead이고, lead와 모든 작업 에이전트는 GPT-6 Luna(gpt-6-luna)를 사용한다.
모델은 실제 실행 환경에서 선택하고, 지원되지 않으면 임의 모델로 대체하지 말고 알려라.

작업 저장소: /Users/hanjichan/Desktop/git/malssum-haru
읽기 전용 디자인 참고: /Users/hanjichan/Desktop/git/omalssum-react

먼저 적용 가능한 AGENTS.md와 git status를 확인하고 아래 문서를 읽어라.
- docs/plans/UI_TABS_QT_PLAN.md
- docs/team/GPT6_LUNA_UI_TEAM.md
- docs/team/TASKS.md의 U00~U05
- docs/PRD.md, docs/contracts/qt-today.md, docs/HANDOFF.md

최신 사용자 요청은 오늘의 QT / 일독 계획 두 탭과 참고 앱의 디자인 적용이다.
서비스 분리는 화면의 분리이며 이 작업으로 MSA나 새 앱을 만들지 않는다.
오늘 QT 문제는 현재 기본 프로필의 자동 취득 off가 직접 원인이다.
기존 local-experiment를 활용하고 실제 제공처 성공 여부는 별도로 검증한다.
사용자가 확정한 본문 비표시 정책에 따라 오늘 장절+공식 링크까지만 제공한다.

docs/CLAUDE_TEAM_PROMPT.md는 과거 초기 구축 자료다.
그 문서의 '구현 코드 없음', 초기 다섯 팀원 생성, M0부터 재시작 지시를 실행하지 마라.
이번 사용자 UI/QT 작업을 우선하고 T20 MSA 및 실제 AI 연결은 별도 과제로 남겨라.

먼저 GPT6_LUNA_UI_TEAM.md의 DOM/props/파일 소유권 계약을 확정한다.
그다음 shell-state, visual, qt-local을 병렬로 실행한다(lead 포함 동시 최대 4명).
구현이 안정되면 qa를 실행해 독립 검수한다. 각 역할에는 해당 전용 프롬프트를 전달한다.
팀원은 맡은 파일만 쓰고 다른 팀원 파일 변경이 필요하면 lead에게 요청한다.
오류 발견 시 원 소유자에게 수정하도록 배정한다.

탭 왕복 시 계획 입력·보기·선택 월·내보내기 범위를 유지하라.
hidden 패널은 높이·Tab 순서·접근성 트리에서 제외하고, 인쇄에서 노출되지 않게 하라.
QT 복귀 시 서울 오늘을 재평가하고, 캐시가 유효한 탭 왕복에는 중복 요청하지 마라.
계획을 storage/URL/서버에 저장하지 마라. 전체 회귀 테스트의 검증 의도를 유지하라.

참고 프로젝트에서는 둥근 카드·옅은 블루·인디고 버튼만 현재 구조에 맞게 적용한다.
외부 무작위 성경 API·큰 정사각형 이미지·가상 기도문/묵상 출력을 가져오지 마라.
기술 설정 설명은 개발 문서에 두고 사용자 화면은 장절·상태·행동을 중심으로 쓴다.

실제 제공처 요청이 있는 live 확인은 qt-local 한 명이 조율하고 횟수와 결과를 기록한다.
현재 세션의 사용자 실행 허용 범위를 먼저 확인하고 이미 허용된 동작은 반복 질문하지 마라.
자동 테스트는 목 제공처로 검증하며 기존 스모크 승인 게이트를 우회하지 마라.

완료 때 웹 typecheck/test/build, 변경한 QT 테스트, git diff --check를 확인한다.
브라우저에서 두 탭·입력 왕복·한영·모바일·다크·인쇄를 확인하고 QA 문서를 남겨라.
자동 테스트와 실제 제공처 결과를 구분해서 보고하라.
Git 커밋·푸시는 현재 구현 세션의 사용자 지시에 따르며 팀원은 수행하지 않는다.
사용자가 바로 확인할 로컬 주소, 변경 파일, 검증 결과, 미완료 항목까지 전달하라.
```

## 5. 작업 에이전트별 프롬프트

아래 프롬프트 앞에 공통 지시를 붙인다.

```text
모델: gpt-6-luna. docs/plans/UI_TABS_QT_PLAN.md와 docs/team/GPT6_LUNA_UI_TEAM.md를 먼저 읽어라.
적용 가능한 AGENTS.md, git status, 네가 맡은 기존 코드를 확인하라.
이 세션은 기존 앱 수정이다. 기존 변경을 되돌리거나 계약/계산 엔진을 새로 만들지 마라.
배정된 파일만 수정하고 다른 파일 수정은 lead에게 요청하라.
git add/commit/push와 사용자 시스템의 무관한 프로세스 종료는 하지 마라.
완료 보고는 변경 파일, 구현 동작, 실행한 검증/결과, 미확인 항목, lead 후속 조치를 포함하라.
```

### shell-state

```text
App.tsx의 QT+계획 세로 배치를 두 서비스 탭으로 바꿔라.
UI_TABS_QT_PLAN의 3.1/5/6절을 행동 계약으로 삼는다.
ServiceTabs와 tabpanel 연결, 키보드 수동 활성화, 한영 문구를 구현하라.
PlanSection·QtToday의 마운트를 유지하고 hidden 패널은 높이와 포커스를 차지하지 않게 하라.
QtToday의 기존 날짜/캐시 동작을 읽고 내부 탭 활성화 때의 신선도 검사를 추가하라.
활성 탭·언어 변경마다 네트워크 요청이나 초기화를 일으키지 마라.
기존 App 테스트는 실제 탭을 선택한 뒤 검증하도록 고쳐라. 테스트 삭제나 hidden:true 일괄 적용 금지.
CSS와 PlanSection 생산 코드는 visual 소유다. 필요한 클래스/props를 먼저 합의하라.
신규 AppTabs.test.tsx는 qa 소유다. 너는 ServiceTabs 단위 검증과 배정된 기존 테스트를 맡아라.
```

### visual

```text
참고 앱의 src/components/VerseCard.js, src/App.js, tailwind.config.js, public/index.html을 읽어라.
UI_TABS_QT_PLAN 3.2절에 따라 기존 CSS 토큰과 카드/폼을 정리하라.
연한 블루/회색 배경, 흰 둥근 카드, 인디고 pill 탭·버튼, 절제한 그림자를 사용하라.
서비스 탭의 클래스 계약은 shell-state와 맞추고 스타일은 네가 전담하라.
일독 입력·표·날짜별 목록은 현재 기능을 모두 유지하며 읽기 쉽게 배치하라.
문구 변경은 i18n 담당에게 요청하고 상태나 계산 로직, 컴포넌트 key를 바꾸지 마라.
360/768/1280px, 긴 영어 문구, 다크, reduced-motion, forced-colors를 확인하라.
서비스 탭은 print에서 제외하고 hidden 계획 패널이 인쇄 CSS로 살아나지 않게 하라.
이미지/외부 폰트/API 호출 추가 없이 구현하라. 실제 화면 캡처로 결과를 확인하라.
```

### qt-local

```text
UI_TABS_QT_PLAN 4절대로 자동 확인 안 함의 실행 설정 원인부터 검증하라.
QtProperties/QtTodayService 및 local-experiment의 기존 동작을 이용하라.
루트 스크립트 dev:qt:links/dev:qt:live/dev:web:api의 정확한 명령을 lead에게 전달하라.
기본 프로필의 취득 off는 유지하고 live 프로필을 실행자가 명확히 선택하게 하라.
QT_TABLE_NAME 유입, provider별 override, 오래된 서버 프로세스를 확인하라.
MockUpstream으로 on/off·날짜·파싱 경로를 검증하고, 실제 확인은 현재 사용자 실행 허용 범위에서 하라.
다른 팀원과 중복 외부 요청을 하지 마라. 기존 smoke.sh 게이트를 우회하지 마라.
실패가 남으면 reasonCode로 좁혀 최소 fixture를 만들고 필요한 어댑터만 수정하라.
성경 전문·제공처 해설을 fixture/로그/응답에 저장하지 말고, 오늘 범위를 추정/하드코딩하지 마라.
원인 수정과 실제 두 제공처 성공을 구분해 lead에게 보고하라.
```

### qa

```text
UI_TABS_QT_PLAN 6절 UI-01~UI-09/QT-01~QT-03으로 독립 검수하라.
새 AppTabs.test.tsx에 사용자 관점의 왕복 상태 보존·가시성·키보드·QT 장애/복귀를 검증하라.
기존 테스트는 소유자에게 변경을 요청하고 제품 코드는 직접 수정하지 마라.
getByText로 숨겨진 DOM을 찾은 것을 화면 표시 성공으로 착각하지 마라.
브라우저에서 모바일/데스크톱, 양쪽 탭, 한영/다크, 실제 인쇄 미리보기를 확인하라.
QT 외부 취득 결과는 qt-local의 실행 기록으로 검토하라. 중복 수집을 시작하지 마라.
미검증이면 미검증으로 남기고 docs/qa/UI-tabs-review.md에 근거·재현·심각도를 기록하라.
기존 M2 QA의 F-11 서술은 QtConfig와 연결 테스트로 다시 대조하라.
현재 코드가 이미 검증하는 기능을 미구현으로 재보고하지 말고 정정 근거를 남겨라.
```

## 6. 작업 상태와 종료 규칙

lead가 U01~U05 상태를 관리한다. 팀원의 “완료” 메시지만으로 done 처리하지 말고 실제 diff와 검증 결과를 확인한다. 각 팀원 보고 형식:

```text
담당 과제 / 변경 파일:
구현한 행동:
실행한 검증과 결과:
실제 제공처·브라우저 확인 여부:
남은 문제 및 다른 소유자에게 필요한 변경:
```

UI만 끝나고 QT 실취득이 미확인이면 전체 완료로 표시하지 않는다. UI 완료, QT 실행 모드 수정 완료, 제공처별 확인 결과를 따로 기록한다. 새 작업은 이 문서의 계획 범위에서 진행하고 이미 완료한 M0~M5를 다시 구축하지 않는다.
