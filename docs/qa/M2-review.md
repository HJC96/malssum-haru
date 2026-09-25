# T19 M2 / 배포 경로 QA 결과

- 검토일: 2026-09-25 (KST)
- 대상: 현재 작업 트리. 저장소 파일은 QA 문서 외 수정하지 않음.
- 방법: 코드·테스트·IaC·비용 모델 정적 검토 및 로컬 자동 테스트. 실제 제공처, AWS 계정, 배포 리소스에는 접속하지 않음.

## 요약

| 구분 | 결과 |
| --- | --- |
| 자동 테스트 | QT 179, 웹 355, AI 24, 인프라 27 통과. 웹 타입 검사와 비용표 `--check` 통과 |
| M1 주요 수정 재확인 | F-01~F-10, F-12~F-16은 대응 코드/테스트가 현 트리에 있음. 아래 표 참고 |
| 남은 코드·데이터 한계 | F-11: QT 범위 parser가 절 수 구조 데이터와 연계되어 있지 않아 불가능한 장절 상한을 완전히 검증하지 못함 |
| 실환경 미검증 | 실제 DynamoDB 조건부 덮어쓰기/TTL, Lambda·API Gateway·EventBridge, 콜드 스타트·p95, 브라우저 실기 접근성·인쇄 |
| 배포 판정 | 배포 승인이 아님. 권리 미확인 상태의 자동 취득·유료 리소스 생성은 별도 사용자 승인 전 금지 |

## M1 발견 후속 확인

| 발견 | 현 상태 | 근거 |
| --- | --- | --- |
| F-01 프로덕션 mock 기본값 | 수정 확인 | `fetchQtToday.ts`, `qt.test.ts`, `prodBundle.test.ts`; 무환경 프로덕션 빌드의 샘플 누출을 회귀 테스트로 차단 |
| F-02 PDF 폰트 URL / SPA 폴백 | 수정 확인 | `pdf.ts`, `prodBundle.test.ts`, `exportFlow.test.ts`; 실제 파일 경로 검사 및 잘못된 HTML 응답 처리 |
| F-03 개발 프록시 포트·README 실행법 | 수정 확인 | `web/vite.config.ts`의 8081 경로, 루트 `README.md`의 실행 안내 |
| F-04 서울 자정/실패 캐시 경계 | 수정 확인 | `QaBoundaryTest`가 QT 테스트 소스에 반영됨; 23:50→00:10 및 서울 날짜 경계 시험 포함 |
| F-05 fixture의 한글 본문 검사 | 수정 확인 | `FixtureRulesTest` 한글 누적 검사와 현재 fixture 검사 |
| F-06 자정 이후 열린 탭의 오래된 범위 | 수정 확인 | `freshness.ts`, `QtFreshness.test.tsx`; 새 날짜에 이전 범위를 오늘 자료로 표시하지 않음 |
| F-07/F-08 성공 로그·실패 notice 검증 | 수정 확인 | 테스트 소스의 성공·실패 응답 검증과 현재 로그 구현 |
| F-09/F-10 파싱 보조 경로·응답 크기 | 회귀 확인 | 제공처 adapter 및 `JdkHttpFetcher` 관련 테스트가 전체 179건에서 통과 |
| F-11 실제 절 수 상한 검사 | 미해결(경미) | QT parser는 장/절의 일반 상한만 사용. 잠정 성경 구조 데이터와 parser 연결은 없음 |
| F-12 취득 플래그 실수로 인한 외부 요청 | 수정 확인 | 취득 경로 테스트에서 origin을 테스트 로컬 서버로 고정; 실제 제공처 네트워크 미사용 |
| F-13 달력 날짜·기간 경계 | 회귀 확인 | 날짜/계획 경계 테스트 포함 웹 355건 통과 |
| F-14 서울 기준 fallback 링크 날짜 | 회귀 확인 | 서울 시간대 고정 로직과 fallback 링크 테스트 포함 |
| F-15 제공처 날짜 안내 | 수정 확인 | `QtProviderCard`와 관련 테스트의 날짜/미확인 안내 확인 |
| F-16 제공처 스모크 요청 안전장치 | 수정 확인 | `smoke.sh` 승인 변수 게이트 코드 확인. 스모크 자체는 실행하지 않음 |

## 서버리스 경로(T16) 확인

- 조회 경로는 서울 오늘 키만 읽고, 오늘 항목이 없을 때 어제 데이터를 대신하지 않고 `NOT_COLLECTED_YET`를 반환한다. `DeployedQueryNeverFetchesTest`가 조회 요청 중 upstream fetch가 없는지 검증한다.
- 수집 경로는 제공처 adapter 결과를 저장하는 별도 함수 경로이며, 저장소 key는 provider/date 조합이다. 같은 키 재수집은 덮어쓰기 방식으로 멱등하게 동작하도록 구현되어 있다.
- REST/Lambda 응답은 `Cache-Control: public, max-age=60`을 사용한다. 인프라 테스트는 조회 Lambda의 쓰기 권한 부재, 수집 전용 쓰기 권한, 단일 테이블/허용 리소스, 비밀·개인 진도 리소스 부재, API rate limit, noindex 헤더를 검사한다.
- AWS 서비스가 실제로 같은 의미로 동작하는지는 확인하지 않았다. DynamoDB TTL은 비동기 삭제이며, IAM·Lambda 패키징·EventBridge 연결은 합성/테스트와 실배포가 다를 수 있다.

## 재현한 검증

| 명령 | 결과 |
| --- | --- |
| `(cd services/qt && mvn -q -B test)` | 통과, 179 tests |
| `(cd services/ai && mvn -q -B test)` | 통과, 24 tests (목 LLM, 기본 생성 비활성화) |
| `pnpm --filter malssum-haru-web test` | 통과, 355 tests |
| `pnpm --filter malssum-haru-web typecheck` | 통과 |
| `pnpm --filter malssum-haru-infra test` | 통과, 27 tests |
| `pnpm --filter malssum-haru-infra cost:doc:check` | 통과, 문서 표와 비용 모델 일치 |

이 결과는 로컬 자동 검증이다. 접근성 실기, PDF 실제 브라우저 인쇄, AWS 통합과 비용 실청구를 통과했다는 뜻은 아니다.
