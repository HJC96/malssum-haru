# 오늘 방문 횟수

## 동작 계약

- 브라우저에서 페이지를 처음 로드할 때 `POST /api/visits`를 한 번 보낸다. 새로고침은 새 페이지 로드이므로 다시 센다. 같은 화면에서 QT·계획 탭을 오가는 행동은 세지 않는다.
- 요청 본문, 쿠키, 사용자 ID가 없다. 프런트 요청은 `credentials: 'omit'`이며 브라우저 저장소를 사용하지 않는다.
- 성공: HTTP 200, `Content-Type: application/json`, `Cache-Control: no-store, max-age=0`, 본문 `{ "count": 123 }`. `count`는 한국 시간 날짜별 페이지 로드 수이며 매일 1부터 다시 시작한다.
- 실패: HTTP 503 `{ "error": "visit_count_unavailable" }`. 화면은 숫자 대신 이용 불가 상태를 보여주되 다른 기능을 막지 않는다.
- 이 값은 **고유 방문자 수가 아니다**. 같은 사람의 새로고침·새 탭, 자동화된 호출도 각각 증가한다. 쿠키/식별자 없이 이를 구분하지 않는다.

## 구현과 개인정보 경계

- CloudFront의 `/api/visits` 동작만 POST를 허용하고 캐시를 비활성화한다. 기존 `/api/*` QT GET 캐시는 유지한다.
- 별도 Node.js Lambda가 한국 시간 날짜(`Asia/Seoul`)로 DynamoDB `SiteVisits` 테이블의 `id=daily#YYYY-MM-DD` 항목에 `UpdateItem ADD count :one`을 실행하고 `UPDATED_NEW` 값을 그대로 반환한다. 읽고 쓴 뒤 더하는 두 단계가 아니라 원자적 쓰기 한 번이므로 동시 요청에서 증가분이 유실되지 않는다.
- 방문 테이블에는 TTL이 없고 삭제 보호와 CloudFormation `Retain`을 적용한다. 날짜별로 한 항목씩 저장하며 QT 일별 항목이나 개인 계획·진도와 섞지 않는다. Lambda에는 이 테이블의 `UpdateItem` 권한만 준다.
- API Gateway 액세스 로그와 CloudFront 접속 로그는 꺼져 있다. 방문 Lambda는 요청 헤더·IP·User-Agent·본문을 기록하지 않는다. Lambda 기본 실행 로그는 14일 보존한다.
- React 개발 환경의 StrictMode effect 재실행을 고려해 프런트는 한 페이지 로드 동안 단일 Promise를 재사용한다. 탭 전환에서 호출하지 않는다.

## 운영·정확도 한계

- DynamoDB 원자적 카운터는 비멱등이다. 네트워크 단절 뒤 SDK/클라이언트가 성공 여부를 확인하지 못하고 재시도하면 실제 페이지 로드보다 많이 셀 수 있다. 식별자를 저장하지 않는 현재 요구사항에서는 정확한 1회성 중복 제거를 약속하지 않는다. 외부 호출 남용도 고유 방문으로 판별할 수 없으므로 이 수치를 분석·정산용 정확한 사용자 수로 사용하지 않는다.
- 서버 쓰기가 실패하면 사용자는 방문수만 보지 못하고 QT·계획 기능은 계속 사용한다. HTTP API 5xx 알람이 연속 장애를 감지한다.
- 배포 전 `infra/cost/scenarios.json`의 방문 수·Node Lambda 128MB/100ms 가정을 실제 트래픽으로 조정하고 `pnpm --filter malssum-haru-infra cost:doc`으로 비용표를 갱신한다. `docs/cost-estimate.md`는 방문 POST의 API Gateway·Lambda·DynamoDB 쓰기·로그 비용을 포함한다. 월 10,000원 목표는 실제 청구로 검증해야 한다.
- 삭제 보호와 Retain 때문에 스택을 제거해도 방문 테이블과 날짜별 값은 남는다. 운영자가 수동으로 테이블을 삭제하거나 다른 스택으로 이전하기 전까지 보존된다. 실제 AWS 배포·삭제는 별도 승인 후 진행한다.

## 검증

```sh
node --test services/visits/test/*.test.mjs
pnpm --filter malssum-haru-web exec vitest run src/app/visits/recordVisit.test.ts
pnpm --filter malssum-haru-infra typecheck
pnpm --filter malssum-haru-infra test
pnpm --filter malssum-haru-infra cost:test
pnpm --filter malssum-haru-infra cost:doc:check
```

AWS `UpdateItem`의 원자적 카운터와 `UPDATED_NEW` 반환 동작은 [DynamoDB 공식 문서](https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_UpdateItem.html)에 따른다. Lambda Node.js 런타임에는 AWS SDK v3가 포함되어 있으며([AWS 문서](https://docs.aws.amazon.com/lambda/latest/dg/nodejs-handler.html)), 이 작은 함수는 런타임 제공 SDK를 사용한다. 런타임의 SDK 버전은 갱신될 수 있으므로 장기 운영 시 SDK를 배포 자산에 고정하는 방안을 검토한다.
