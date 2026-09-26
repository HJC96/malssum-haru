# 말씀하루 (malssum-haru)

QT 통합 대시보드와 성경 일독 계획 웹서비스.

- 생명의삶·매일성경의 오늘 QT 장절 범위와 공식 링크 (성경 본문은 제공처에서 확인)
- AI 설명 서비스 개발 골격은 있으나, 기본 설정에서 실제 AI 생성은 비활성화
- 시작일·마감일 기반 성경 일독 분량 계산, 캘린더, 진행률, Excel/PDF 내보내기
- 회원가입 없음, 개인 진도 비저장

이어서 작업하려면 먼저 [인수인계 문서](docs/HANDOFF.md)를 읽는다. 요구사항은 [PRD](docs/PRD.md), 이어서 진행할 작업은 [구현 인계 계획](docs/IMPLEMENTATION_PLAN.md) 참고. Claude Code 에이전트 팀용 [시작 프롬프트](docs/CLAUDE_TEAM_PROMPT.md)도 준비되어 있다.

## 로컬 실행

Node 20.20(`.nvmrc`), pnpm 9.4, Java 21, Maven 3.9가 필요하다. 실제 AWS 계정에는 아무것도 배포하지 않는다.

```sh
pnpm install                                   # 루트에서 한 번
pnpm run dev:qt:links                          # QT API(8081): 외부 요청 없음, 공식 링크만
pnpm run dev:web:api                            # 웹(5173): 로컬 QT API 연결
pnpm --filter malssum-haru-web dev             # 웹(5173): QT 샘플 데이터와 샘플 배너
pnpm --filter malssum-haru-web test            # 웹 테스트
pnpm --filter malssum-haru-web typecheck
pnpm --filter malssum-haru-web build

pnpm run dev:qt:live                            # QT API(8081): 제공처에 실제 요청, 개인 로컬 실험 전용
cd services/qt && mvn -q -B test              # QT 서비스 테스트(인터넷 불필요)

pnpm --filter malssum-haru-infra test          # IaC 테스트(배포 없음)
```

`dev:qt:links`와 `dev:qt:live`는 같은 8081 포트를 사용하므로 한 번에 하나만 실행한다. `live`는 제공처 페이지에 실제 HTTP 요청을 보낸다. 접근 허용 여부가 확인되지 않아 첫 모드인 `links`를 기본으로 사용하고, `live`는 외부 요청을 의도한 로컬 점검에서만 선택한다. 매일성경·생명의삶은 실제 장절을 확인하면 장절 범위를 표시하고, 성경 전문은 각 공식 페이지에서 읽는다.

QT 서비스 세부는 [services/qt/README.md](services/qt/README.md), 작업 진행은 [docs/team/TASKS.md](docs/team/TASKS.md)를 본다.
