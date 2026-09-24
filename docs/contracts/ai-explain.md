# 계약: AI 요약·설명 (`GET /api/ai/explanation`) — v1 초안

- 작성: lead, 2026-09-24. 관련: PRD AI01~AI05, AC12~AC16·AC22·AC25, 구현 계획 M5, 결정 기록(PRD "2026-09-24 범위 결정")
- 상태: **초안**. 본문 입력은 공개 번역본 WEB(World English Bible, 퍼블릭 도메인 — docs/data-sources.md 11절)이다. 실제 LLM 호출은 사용자가 API 키·모델·예산 상한을 정하기 전까지 꺼져 있다(`AI_GENERATION_ENABLED=false`, 기본).

## 원칙

1. **QT 범위에서만 생성한다.** 요청은 제공처와 언어만 받는다. 범위는 서버가 QT 서비스(`docs/contracts/qt-today.md`)에서 확인한 오늘의 `RANGE_CONFIRMED` 범위를 쓴다. 임의 프롬프트·모델 설정·범위 문자열·개인 진도는 받지 않는다.
2. **허용된 정확한 본문이 없으면 생성하지 않는다.** 입력 번역본에 QT 범위의 절이 하나라도 없으면 `UNAVAILABLE`+`TEXT_NOT_ALIGNED`(생성 보류)다. 절 번호 대응이 검증되지 않은 범위도 마찬가지다.
3. **구절 인용 금지, 절 참조만.** 화면에 영어 성경 본문이 나타나지 않도록 AI 출력은 구절 원문을 인용하지 않고 `장:절` 참조와 자기 말 설명만 담는다(PRD LOC01·AC21과 충돌 방지). 출력 검증에서 입력 본문과 긴 문자열 일치(예: 8단어 이상 연속)를 거부한다.
4. **AI임을 표시**한다. 사용한 번역본 이름(`sourceTranslation`), 생성 모델·정책 버전, 수정일, 오류 신고 경로를 응답에 담는다. 제공처 해설과 구분되며 제공처가 승인한 것처럼 표시하지 않는다.
5. 같은 캐시 키에는 활성 생성 작업이 하나다. 실패 결과는 정상 콘텐츠로 저장하지 않는다. 예산 부족·호출 제한·LLM 장애 때 신규 생성만 멈추고 기존 결과·QT 링크·일독 계산은 유지된다.
6. 개인 계획·읽은 범위·진도는 요청·응답·로그 어디에도 없다. QT 열람은 계획에 영향을 주지 않는다.

## 요청

`GET /api/ai/explanation?providerId=maeil-seongyeong|saengmyeong-ui-sam&lang=ko|en`

## 응답 (HTTP 200, 상태는 본문에)

```json
{
  "schemaVersion": "1",
  "providerId": "maeil-seongyeong",
  "providerDate": "2026-09-24",
  "lang": "ko",
  "status": "AVAILABLE",
  "reasonCode": null,
  "passage": { "ranges": [ { "bookId": "JDG", "start": {"chapter": 11, "verse": 1}, "end": {"chapter": 11, "verse": 11} } ] },
  "sourceTranslation": { "id": "WEB", "name": "World English Bible", "license": "Public Domain", "language": "en" },
  "content": {
    "summary": "…",
    "context": "…",
    "keyPoints": [ { "text": "…", "refs": [ { "bookId": "JDG", "chapter": 11, "verse": 3 } ] } ],
    "questions": [ "…" ],
    "viewpointNotes": [ "해석이 갈리는 부분의 견해 차이 …" ]
  },
  "meta": { "aiGenerated": true, "revision": 3, "updatedAt": "2026-09-24T01:10:00Z", "modelId": "…", "policyVersion": "p1", "cacheKey": "sha256…" },
  "report": { "path": "/api/ai/reports" }
}
```

| 필드 | 규칙 |
| --- | --- |
| `status` | `AVAILABLE`(제공 가능) \| `GENERATING`(생성 중, 대기) \| `NOT_GENERATED`(미생성) \| `FAILED`(실패, 재시도 경로) \| `IN_REVIEW`(검토 중, 내용 숨김) \| `UNAVAILABLE`(생성하지 않음, `reasonCode` 필수) |
| `reasonCode` | `UNAVAILABLE`/`FAILED`일 때: `NO_RANGE`(QT 범위 없음), `TEXT_NOT_ALIGNED`(입력 본문에 범위 절 없음/대응 미검증), `BUDGET_EXHAUSTED`, `RATE_LIMITED`, `AI_DISABLED`, `LLM_ERROR`, `OUTPUT_INVALID`, `NOT_COLLECTED_YET`(QT 범위 아직 없음). 모르는 코드는 클라이언트가 일반 처리 |
| `content` | `AVAILABLE`일 때만. 그 외 null. 구절 원문 인용 없음, `refs`는 참조만 |
| `keyPoints[].refs` | 반드시 `passage`(또는 앞뒤 문맥 허용 범위) 안의 유효한 절이어야 한다(서버 검증) |
| `meta.cacheKey` | 정규화 범위·번역본·장절 기준·입력 데이터 해시·언어·옵션·프롬프트/정책 버전·모델 설정·참고 자료 버전의 해시. 제공처명·날짜는 포함하지 않는다 |

## 오류 신고 `POST /api/ai/reports`

본문: `{ "cacheKey": "…", "revision": 3, "category": "FACTUAL_ERROR|WRONG_REFERENCE|OFFENSIVE|OTHER", "note": "선택, 200자 이내" }`. 개인 식별 정보를 받지 않는다(IP·UA 저장 금지, 호출 제한에만 임시 사용). 심각 유형이 임계 건수를 넘으면 해당 결과를 `IN_REVIEW`로 전환해 제공을 멈춘다.

## 서버 간 의존 (M6 학습 트랙)

AI 서비스는 QT 서비스를 서버 간 호출(`GET /api/qt/today`)해 범위를 얻는다. QT 서비스 중단 시 `UNAVAILABLE`+`NO_RANGE`, AI 서비스 중단 시 QT 응답은 그대로 유지된다(서로의 DB에 직접 의존하지 않는다).

## 합의 사항 (ai-content 제안 승인, 2026-09-24)

1. `NOT_GENERATED`는 내부 상태다. GET은 생성 가능하면 `GENERATING`(즉시 반환, 클라이언트 재조회), 막히면 `UNAVAILABLE`+사유로 응답한다. 짧은 대기 설정(기본 0)은 허용.
2. 사유 매핑: `RATE_LIMITED`·`BUDGET_EXHAUSTED`·`AI_DISABLED`·`NO_RANGE`·`TEXT_NOT_ALIGNED`·`NOT_COLLECTED_YET` = `UNAVAILABLE`, `LLM_ERROR`·`OUTPUT_INVALID` = `FAILED`(같은 GET 재요청, 재시도 대기 후 신규 생성). QT가 `RANGE_CONFIRMED`가 아니면 `NO_RANGE`(QT `NOT_COLLECTED_YET`는 그대로 전달).
3. 입력 본문 정렬(WEB vs `nkrv-provisional-1`, services/ai/docs/verse-alignment.md): 범위에 WEB 본문이 없는 절(LUK 17:36, ACT 8:37, 15:34, 24:7, ROM 16:25 — 번호만 있고 본문 없음, 및 ROM 16:26-27, 3JN 1:15)이 하나라도 있거나, 구조가 다른 7개 장(LUK 17, ACT 8·15·24, ROM 14·16, 3JN 1)에 범위가 걸리면 `TEXT_NOT_ALIGNED`(보수 처리). 앞뒤 문맥은 같은 책의 범위 앞 5절·뒤 5절(장 경계 넘음, 구조 상이 장·빈 절 제외). `refs`는 범위+문맥 안의 절만 유효.
4. 같은 책 다중 범위는 하나의 요청·하나의 캐시 키(정규화한 범위 집합)이며 사이 절은 문맥 규칙으로 입력에 넣는다.
5. 오류 신고 `POST /api/ai/reports`: 202 `{"accepted":true,"status":"AVAILABLE|IN_REVIEW"}`, 잘못된 입력 400, 호출 제한 429. 임계 기본 3건(심각 유형 FACTUAL_ERROR|WRONG_REFERENCE|OFFENSIVE, 같은 리비전). 익명이라 남용으로 결과가 내려갈 수 있음 — 호출 제한으로 완화하고 최종 판단은 운영자.
6. 운영 API `/internal/ai/admin/**`(hide, regenerate, replace-revision, invalidate): 기본 꺼짐(`AI_ADMIN_ENABLED=false`), 켜도 `X-Admin-Token`(`AI_ADMIN_TOKEN`, 미설정이면 전부 거부)과 루프백 주소만 허용. 배포 환경에는 넣지 않는다.
7. 예산: `AI_MONTHLY_GENERATION_LIMIT`, `AI_MONTHLY_BUDGET_UNITS` 둘 다 기본 0 = fail closed(켜도 한도가 없으면 `BUDGET_EXHAUSTED`). 월 경계 UTC.
8. `content`: `questions` 1개 이상, `viewpointNotes` 필수 키(빈 배열 허용), `keyPoints` 1~8개, 각 `refs` 최소 1개. `lang=ko`여도 입력은 영어 WEB이며 연속 8단어 일치 거부 검사를 동일하게 적용.
9. **배포 주의(M4/M6)**: Lambda는 응답 후 백그라운드 스레드가 멈추므로 실제 배포 때는 생성을 별도 비동기 호출로 분리해야 한다. 이번 골격은 로컬 JVM 스레드 전제이며 **AI 서비스는 배포하지 않는다**(실제 LLM 키·모델·예산·제공자 데이터 조건 결정 후 재논의).
