# 말씀하루 (malssum-haru)

QT 통합 대시보드와 성경 일독 계획 웹서비스.

- 생명의삶·매일성경의 오늘 QT 범위와 공식 링크, 제공 조건을 충족한 경우 개역개정 본문과 AI 요약·해설
- 시작일·마감일 기반 성경 일독 분량 계산, 캘린더, 진행률, Excel/PDF 내보내기
- 회원가입 없음, 개인 진도 비저장

요구사항은 [PRD](docs/PRD.md), 이어서 진행할 작업은 [구현 인계 계획](docs/IMPLEMENTATION_PLAN.md) 참고. Claude Code 에이전트 팀용 [시작 프롬프트](docs/CLAUDE_TEAM_PROMPT.md)도 준비되어 있다.

## 로컬 실행

Node 20.20(`.nvmrc`), pnpm 9.4, Java 21, Maven 3.9가 필요하다. 실제 AWS 계정에는 아무것도 배포하지 않는다.

```sh
pnpm install                                   # 루트에서 한 번
pnpm --filter malssum-haru-web dev             # 웹 개발 서버(개발 중 기본: 샘플 QT 데이터, 화면에 샘플 배너). /api 는 localhost:8081 로 프록시
VITE_QT_SOURCE=api pnpm --filter malssum-haru-web dev   # 실제 QT 서비스(8081)를 사용. 프로덕션 빌드는 항상 api
pnpm --filter malssum-haru-web test            # 웹 테스트
pnpm --filter malssum-haru-web typecheck
pnpm --filter malssum-haru-web build

cd services/qt
mvn -q -B test                                 # QT 서비스 테스트(인터넷 불필요)
mvn spring-boot:run                            # 취득 off: 공식 링크만(포트 8081)
mvn spring-boot:run -Dspring-boot.run.profiles=local-experiment   # 제공처에서 오늘 장절을 실제로 읽음(허용 여부 미확인, 본인 판단)

pnpm --filter malssum-haru-infra test          # IaC 테스트(배포 없음)
```

QT 서비스 세부는 [services/qt/README.md](services/qt/README.md), 작업 진행은 [docs/team/TASKS.md](docs/team/TASKS.md)를 본다.
