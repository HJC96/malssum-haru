# 말씀하루 월 운영비 추정과 IaC 변경 내역 (AWS + LLM)

> **2026-09-27 재산정 필요:** 아래 자동 생성 표는 기존 구조의 비용 가정이다. [새 백엔드 계획](plans/BACKEND_ARCHITECTURE_PLAN.md)의 콘텐츠 배치, 레거시 QT 제외, 실제 이미지 전송량과 도메인 비용을 반영하기 전에는 새 운영안의 견적으로 쓰지 않는다. 특히 아래 Java SnapStart 고정비 민감도는 수정 대상이다. [AWS 공식 문서](https://docs.aws.amazon.com/lambda/latest/dg/snapstart.html)는 Java managed runtime에 별도 SnapStart 요금이 없다고 명시한다. 이번 작업에서는 자동 생성 표와 계산 모델을 수동으로 고치지 않았으며 B0/B5에서 함께 갱신해야 한다.

- 작성: platform-cost, 2026-09-24
- 상태: **추정치와 배포 정의 초안**. 실제 배포·청구 전에는 월 10,000원 달성을 주장하지 않는다. 실제 AWS 계정에는 아무것도 만들지 않았다.
- 표는 `infra/cost/` 의 모델에서 나온다. `node infra/cost/update-doc.mjs` 가 `<!-- model:... -->` 표시 사이의 표를 다시 쓰고, `--check` 로 문서가 모델과 같은지 검사한다(3-3절).

## 0. 사용자에게 제시할 요약 (비용표 + IaC 변경 내역)

### 0-1. 비용표 결과

서울 리전, 원화, 부가세 10% 포함, 환율 1,560원/USD 가정. 목표는 AWS와 LLM 합계 월 10,000원이지만, 현재 범위(오늘 장절 범위와 공식 링크만 표시, AI 보류)에서는 **AWS 단독 값이 주 판정**이고 LLM 포함 값은 보조·참고용이다. **모든 사용량은 가정이며 측정값이 아니다.**

<!-- model:totals:begin -->
| 시나리오 | **AWS 단독, 정가** (주 판정) | **AWS 단독, 크레딧 종료 후** (주 판정) | 참고(AI 보류): 종료 후 + Haiku 4.5 | 참고: 정가 + Haiku 4.5 | 참고: 종료 후 + Sonnet 5 |
| --- | ---: | ---: | ---: | ---: | ---: |
| 낮음 | 1,329 | 598 | 1,646 | 2,377 | 3,322 |
| 기준 | 8,329 | 783 | 4,440 | 11,986 (초과) | 10,292 (초과) |
| 증가(공개 직후, 한 달 내내 지속 가정) | 110,088 (초과) | 3,465 | 11,084 (초과) | 117,707 (초과) | 23,274 (초과) |
<!-- model:totals:end -->

열 설명: 앞의 두 열이 주 판정이다. "AWS 정가"는 무료 구간과 크레딧을 전혀 반영하지 않은 값, "AWS 크레딧 종료 후"는 신규 계정 크레딧이 끝나고 공식 페이지에 기간 제한 없이 적힌 상시 무료 구간만 반영한 값이다. 뒤의 세 열은 AI를 켤 경우를 위한 참고값으로, 두 모델의 산식 결과일 뿐 결정이 아니며 **AI 공개는 본문 사용 권한 확인 전까지 보류 중이다.** 도메인 등록비는 포함하지 않았다. **콘텐츠 사용료: 본문을 표시하지 않으므로 해당 없음**(개역개정 등 본문 표시로 범위를 넓힐 때만 재검토. 대한성서공회 요금은 미확인, 출처 확인 중이라 이 문서에서는 금액을 쓰지 않는다).

읽는 법:

1. **트래픽 비용은 CloudFront 전송량이 거의 전부다.** 정가 기준 시나리오에서 CloudFront 전송이 AWS 비용의 약 73%, 요청까지 합치면 약 86%다. Lambda, API Gateway, DynamoDB, Scheduler는 합쳐도 월 1달러 미만이다(5장 표).
2. **AWS 단독으로는 낮음·기준 시나리오가 정가에서도 10,000원 이내이고, 크레딧 종료 후에는 증가 시나리오까지 이내다.** 다만 증가 시나리오의 이내 판정은 CloudFront 상시 무료 구간(월 1TB, 요청 1,000만)에 전적으로 의존한다(공식 페이지에 "Always Free"로 적힘). 무료 구간이 없다고 본 정가에서는 증가 시나리오가 초과하며 어떤 조정으로도 예산 안에 들지 않는다. AI를 더하면(참고 열) 기준 시나리오의 정가 값과 증가 시나리오의 Haiku 4.5 값도 초과한다.
3. **LLM은 모델 선택이 가장 큰 변수다.** 같은 생성 횟수에서 Haiku 4.5 대비 Sonnet 5는 약 2.6배, Opus 5.5는 약 5.2배, Fable 5.1은 약 13배다(7장).
4. **AI 비용은 방문자 수가 아니라 "서버가 생성하는 횟수"로 정해진다.** 애플리케이션이 월 생성 횟수 상한을 강제해야 예산이 지켜진다(10-1절). IaC에는 `aiMonthlyGenerationLimit` 환경 변수만 전달하며 집행은 앱 코드의 몫이다.
5. **AWS Budgets 알림은 과금 차단 장치가 아니다.** 알림 전용으로만 만들었고, Anthropic API 비용은 AWS 청구서에 보이지 않는다(11장).
6. **SnapStart는 이 예산에서 비싸다.** 서울에서 1GB 함수 한 버전을 상시 두면 캐시 요금만 월 약 4.8달러(약 8,200원)다. 기본으로 끄고 콜드 스타트는 엣지 캐시와 주기적 워밍 호출로 먼저 줄이는 것을 권고한다(10-4절).
7. 도메인을 붙이면 Route 53 호스팅 영역이 월 약 0.5달러(약 860원)이고 도메인 등록 요금은 미확인이다.

### 0-2. IaC 변경 내역 (AWS CDK, TypeScript. 배포하지 않음)

`infra/` 에 작성했고(qt-backend T15·T16의 핸들러·환경 변수·테이블 계약에 맞춤) `cdk synth` 와 단위·스냅샷 테스트가 통과한다(8장의 검증 기록). CDK를 고른 근거: 계획서의 기본 후보이고 web과 같은 TypeScript 도구 체인이라 스택을 코드로 테스트할 수 있다. SAM은 Lambda 중심이라 CloudFront·Budgets 기술이 CloudFormation 원문으로 늘고, Terraform은 별도 HCL과 상태 저장소가 필요하다.

**만들어지는 리소스(스택 `MalssumHaru`, 기본 리전 `ap-northeast-2`)**

| 영역 | 리소스 | 비용 관련 메모 |
| --- | --- | --- |
| 정적 웹 | S3 버킷(비공개, OAC), CloudFront 배포 1개(가격 등급 200, 접속 로그 끔), 경로 재작성 CloudFront Function 1개, 응답 헤더 정책(`X-Robots-Tag: noindex, nofollow` + 보안 헤더) | 재작성 함수는 기본 동작에만 연결. 헤더 정책 요금은 미확인 |
| API | HTTP API 1개, 레거시 `GET /api/qt/today`와 날짜별 방문 기록 `POST /api/visits`, 기본 스테이지 스로틀(초당 20, 버스트 40), 액세스 로그 없음 | QT GET만 CloudFront `/api/*`에서 60초(최대 300초) 엣지 캐시. 방문 POST는 별도 캐시 비활성 동작 |
| 실행 | Lambda 3개. QT 조회·수집 2개는 Java 21 arm64 1,024MB로 같은 `-aws.jar` 사용(조회 `GetItem`, 수집 `GetItem`+`PutItem`). 방문 카운터는 별도 Node.js 22 arm64 128MB 함수(`UpdateItem`만) | QT 산출물은 자리표시자(아래). 배포할 QT 산출물은 `services/qt/target/qt-service-0.0.1-SNAPSHOT-aws.jar`; 방문 함수는 `services/visits/src` 자산 |
| 데이터 | DynamoDB 2개: QT 공통 데이터(키 `providerId` + `providerDate`, TTL `expiresAt`, 온디맨드, 항목 보관 400일)와 영구 보존 일별 방문 수(키 `id=daily#YYYY-MM-DD`, 날짜별 한 항목, TTL 없음). 둘 다 삭제 보호·Retain | **개인 진도·계획 테이블은 없다** |
| 일정 | EventBridge Scheduler 4개(Asia/Seoul 00:05, 00:35, 06:00, 12:00, 재시도 1회, 기본 disabled) | 하루 4회 호출은 레거시 QT 취득을 명시적으로 opt-in한 시나리오의 비용이다. 현재 기본 웹 경험은 정적 말씀 파일과 공식 QT 링크를 쓴다. |
| 로그 | 함수별 로그 그룹 3개, 보존 14일(무기한 허용 안 함) | 방문 API는 요청 헤더·IP·본문을 앱 로그로 남기지 않음 |
| 알림 | CloudWatch 알람 3개(조회 오류, 수집 오류, API 5xx), 알림 이메일이 있을 때만 SNS 주제와 AWS Budgets 월 예산(알림 전용) | 알람 3개가 비용표의 고정비 |
| 비밀 | **없음.** 지금 서비스는 비밀이 필요 없어 Secrets Manager, SSM 권한을 만들지 않았다(테스트가 검사). AI 서비스가 생기면 SSM SecureString 이름 참조와 단일 파라미터 읽기 권한만 추가한다 | AI는 IaC에 넣지 않았다(보류) |

**설정 파라미터(`-c 이름=값`)**: `qtAcquisitionEnabled`(레거시 제공처 자동 취득, **기본 false**), `providerMaeilSeongyeong`, `providerSaengmyeongUiSam`(제공처별 취득, 기본 false), `collectorEnabled`(기본 false), `collectorTimesKst`(`HH:MM` 목록), `logRetentionDays`, `apiCacheDefaultTtlSeconds`, `apiThrottleRatePerSecond`, `alertEmail`, `budgetMonthlyUsd`(기본 6), `qtLambdaAssetPath`(예: `../services/qt/target/qt-service-0.0.1-SNAPSHOT-aws.jar`), `region`, `retainData`. 제공처 수집은 권리 확인 뒤 비공개 실험을 위해 명시적으로 opt-in할 때만 켠다.

**안전장치**

- 배포 산출물이 자리표시자(`infra/assets/qt-placeholder`)인 동안 CloudFormation 규칙이 배포를 거부한다(`QtArtifactConfirmed` 파라미터를 `yes` 로 명시하지 않는 한). `services/qt` 산출물 경로를 지정하면 규칙이 사라진다.
- 테스트가 리소스 유형 허용 목록을 강제한다. 새 유형(예: 다른 DB, 큐, 인증 서비스)은 목록과 리뷰 없이는 추가할 수 없다.
- CI 워크플로(`.github/workflows/ci.yml`)에는 배포·AWS 자격 증명 단계가 없고, 테스트가 이를 검사한다.

**배포하려면(사용자 승인 뒤 lead가 실행. 지금은 하지 않음)**: 계정 부트스트랩(`cdk bootstrap`: 자산 S3 버킷과 IAM 역할 생성), `services/qt` 산출물 빌드, `cdk diff` 검토, `cdk deploy -c alertEmail=... -c qtLambdaAssetPath=...`. 부트스트랩과 배포는 유료 리소스를 만든다.

### 0-3. 사용자 결정이 필요한 것

- 실제 배포 전: AWS 리전(권고: 서울 `ap-northeast-2`), 계정 요금제(유료 요금제 + 신규 크레딧 권고, 6장), 도메인 포함 여부, 예산·알람 수신 이메일. 날짜별 성경 콘텐츠는 승인된 본문만 공개 artifact에 넣고, 비용·권리 조건이 확인되지 않은 번역본은 비활성으로 둔다.
- AI를 켤 때: 모델, 월 생성 횟수 상한, 월 LLM 예산 상한. 이 문서는 결정하지 않는다.
- 실제 청구 통화(USD 또는 KRW)와 세율 확인. 이 문서는 USD 단가에 환율 1,560원과 부가세 10%를 가정했다.
- 웹 산출물의 방문당 전송 예산. lead가 web-experience에 초기 로드 gzip 150KB 이하를 요청했다. 이 문서의 시나리오 가정(방문당 0.8/1.0/1.5MB)은 그보다 보수적이며, 예산이 지켜지면 11장의 0.3MB 행(정가 기준 3,938원)에 가까워진다(측정 전).

## 1. 범위와 정의

| 용어 | 뜻 |
| --- | --- |
| 정가 | 무료 구간, 크레딧, 프리 티어를 **전혀 반영하지 않은** 공식 단가 그대로의 월 비용. 가장 보수적인 값 |
| 크레딧 종료 후 | 신규 계정 크레딧은 소진됐고, 공식 요금 페이지에 기간 제한 없이 적힌 상시 무료 구간만 반영한 월 비용. 장기 운영의 기준값 |
| 크레딧 기간 | 신규 계정 크레딧(최대 200달러)이 청구액에 적용되는 동안. 6장 참고. 이 표에는 별도 수치로 넣지 않고 "정가 월액이 크레딧으로 충당되는가"만 판단한다 |

포함: CloudFront(Functions 포함), S3, API Gateway HTTP API, Lambda(Java 21, arm64), DynamoDB(온디맨드), EventBridge Scheduler, CloudWatch Logs와 알람, Budgets, SSM Parameter Store(Standard), LLM 호출.

포함하지 않음(별도 표시): 도메인 등록비(미확인), 콘텐츠 사용료(본문 미표시로 **해당 없음**, 본문 표시로 넓힐 때만 재검토), AWS WAF(사용하지 않음, 가격 미확인), AWS Support, 개발 중 CI 비용(GitHub Actions는 AWS 비용이 아님), 세금 외 결제 수수료.

환율·세금 가정:

| 항목 | 값 | 근거 |
| --- | --- | --- |
| 환율 | **1,560원/USD** | ECB 참조환율을 제공하는 frankfurter.dev 조회(2026-09-24): 2026-09-23 값 1,365.35원, 최근 3개월(2026-06-24~09-24) 최저 1,336.20 최고 1,558.09. 최고치를 올림해 보수적으로 잡았다. 1,365원으로 계산하면 정가 기준 시나리오가 약 12.5% 낮아진다(11절 표) |
| 부가세 | **10%** | 한국 부가가치세 표준세율 가정. AWS 한국 세금 안내(https://aws.amazon.com/tax-help/south-korea1/, 2026-09-24 확인)에는 Amazon Web Services Korea LLC가 한국 계정에 세금계산서 또는 카드 전표를 발행한다고만 적혀 있고 **세율과 청구 통화는 적혀 있지 않다. 미확인** |
| LLM 세금 | 동일하게 10% 가정 | Anthropic의 한국 과세 방식은 **미확인** |

## 2. 공식 가격 근거

확인일은 모두 2026-09-24다. "Price List"는 AWS 공개 벌크 가격 API(자격 증명 불필요)이며, 이 API가 청구 단가의 기준 데이터다. 요금 페이지는 화면에 단가를 스크립트로 채우는 경우가 있어 무료 구간·조건 문구를 읽는 데 썼고 단가는 Price List에서 가져왔다. 단가는 `infra/cost/prices.json` 에 저장되고 `infra/cost/fetch-prices.mjs` 로 다시 만든다.

### 2-1. 단가 (USD, 세금 전)

| 서비스 | 서울 ap-northeast-2 | 도쿄 ap-northeast-1 | 버지니아 us-east-1 | 출처(확인일 2026-09-24) |
| --- | ---: | ---: | ---: | --- |
| Lambda 요청 | 0.20/백만 | 0.20/백만 | 0.20/백만 | https://aws.amazon.com/lambda/pricing/ + Price List `AWSLambda` (게시 2026-09-19) |
| Lambda arm64 GB-초 (첫 구간 60억 GB-초까지) | 0.0000133334 | 0.0000133334 | 0.0000133334 | 동일 |
| Lambda x86 GB-초 | 0.0000166667 | 0.0000166667 | 0.0000166667 | 동일 |
| Lambda SnapStart 캐시 (GB-초) | 0.0000018383 | 0.0000015046 | 0.0000015046 | 동일 |
| Lambda SnapStart 복원 (GB) | 0.0001674588 | 0.0001397998 | 0.0001397998 | 동일 |
| API Gateway HTTP API (첫 3억 요청) | 1.23/백만 | 1.29/백만 | 1.00/백만 | https://aws.amazon.com/api-gateway/pricing/ + Price List `AmazonApiGateway` (게시 2026-09-21). 512KB 단위로 계량 |
| DynamoDB 온디맨드 쓰기 | 0.68/백만 | 0.715/백만 | 0.625/백만 | https://aws.amazon.com/dynamodb/pricing/on-demand/ + Price List `AmazonDynamoDB` (게시 2026-09-11) |
| DynamoDB 온디맨드 읽기 | 0.1355/백만 | 0.1425/백만 | 0.125/백만 | 동일 |
| DynamoDB 저장 (25GB 초과분, GB-월) | 0.27075 | 0.285 | 0.25 | 동일 |
| S3 Standard 저장 (첫 50TB, GB-월) | 0.025 | 0.025 | 0.023 | https://aws.amazon.com/s3/pricing/ + Price List `AmazonS3` (게시 2026-09-18) |
| S3 PUT/COPY/POST/LIST | 0.0045/천 | 0.0047/천 | 0.005/천 | 동일 |
| S3 GET | 0.0035/만 | 0.0037/만 | 0.004/만 | 동일 |
| CloudWatch Logs 수집 (Standard, GB) | 0.76 | 0.76 | 0.50 | https://aws.amazon.com/cloudwatch/pricing/ + Price List `AmazonCloudWatch` (게시 2026-09-22) |
| CloudWatch Logs 저장 (GB-월) | 0.0314 | 0.033 | 0.03 | 동일 |
| CloudWatch 표준 알람 (개/월) | 0.10 | 0.10 | 0.10 | 동일 |
| EventBridge Scheduler (1,400만 호출 초과분, 호출당) | 1.15/백만 | 1.25/백만 | 1.00/백만 | https://aws.amazon.com/eventbridge/pricing/ + Price List `AWSEvents` (게시 2026-09-11) |
| Route 53 호스팅 영역 (25개까지, 개/월) | 0.50 (리전 무관) | | | https://aws.amazon.com/route53/pricing/ + Price List `AmazonRoute53` (게시 2026-09-11). Alias 레코드(CloudFront, API Gateway) 쿼리는 무료 |
| Route 53 도메인 등록 | **미확인** | | | 요금 페이지가 TLD별 표로 연결되며 표 파일 접근 거부(HTTP 403). 크레딧 적용 불가라고 페이지에 적혀 있음 |
| Secrets Manager 시크릿 | 0.40/개/월 (API 1만 건당 0.05) | | 0.40 | https://aws.amazon.com/secrets-manager/pricing/ + Price List `AWSSecretsManager` |
| SSM Parameter Store Standard | **추가 요금 없음** (Advanced는 개당 월 0.05) | | | https://aws.amazon.com/systems-manager/pricing/ |
| AWS Budgets | 예산 모니터링·알림 무료. 동작(action) 연결 예산은 계정당 2개까지 무료, 이후 일 0.10 | | | https://aws.amazon.com/aws-cost-management/aws-budgets/pricing/ + Price List `AWSBudgets` (게시 2026-09-11) |

CloudFront(리전 무관, 사용자가 접속하는 엣지 위치 기준). 한국 사용자는 공식 표의 "Hong Kong, Indonesia, Philippines, Singapore, South Korea, Taiwan, Thailand, Malaysia, and Vietnam" 열이다.

| 항목 | 한국 열 | 일본 | 미국 | 출처 |
| --- | ---: | ---: | ---: | --- |
| 인터넷 전송 (GB, 첫 1TB 무료 뒤 다음 9TB) | 0.120 | 0.114 | 0.085 | https://aws.amazon.com/cloudfront/pricing/pay-as-you-go/ + Price List `AmazonCloudFront` (게시 2026-09-16) |
| HTTPS 요청 (만 건당) | 0.012 | 0.012 | 0.010 | 동일 |
| CloudFront Functions 실행 (백만 회당, 월 200만 회 무료 뒤) | 0.10 | 0.10 | 0.10 | Price List `AmazonCloudFront` |
| 원본(S3, API Gateway 등 AWS 원본) → CloudFront 전송 | 무료 | | | 동일 페이지의 "Free for origin fetches from any AWS origin" |

인터넷 직접 전송(참고, CloudFront를 쓰지 않을 때): 서울 0.126, 도쿄 0.114, 버지니아 0.09 USD/GB(전 서비스 합산 월 100GB 무료 뒤). Price List `AWSDataTransfer` 게시 2026-09-16.

### 2-2. 무료 구간과 크레딧 (계산에서 어디까지 반영했는지)

| 항목 | 공식 문구(요약) | 출처 | 계산 반영 |
| --- | --- | --- | --- |
| CloudFront | Always Free: 월 1TB 인터넷 전송, 1,000만 HTTP/HTTPS 요청, CloudFront Functions 200만 호출 | https://aws.amazon.com/cloudfront/pricing/pay-as-you-go/ | "크레딧 종료 후"에 반영 |
| Lambda | 무료 구간 월 100만 요청, 400,000 GB-초 (문구에 기간 제한이 없음). **콜드 스타트의 초기화 시간도 실행 시간으로 청구**(페이지의 Duration 설명: 핸들러 밖 초기화 코드 포함) | https://aws.amazon.com/lambda/pricing/ | "크레딧 종료 후"에 반영. 콜드 스타트 초기화를 청구 시간에 넣음 |
| EventBridge Scheduler | 월 1,400만 호출 무료 | https://aws.amazon.com/eventbridge/pricing/ | 반영 |
| DynamoDB | 프리 티어는 **프로비저닝 용량** 기준(25 WCU/RCU, 25GB 저장). 온디맨드 읽기·쓰기 요청에는 적용되지 않음 | https://aws.amazon.com/dynamodb/pricing/on-demand/ | 저장 25GB만 반영, 읽기·쓰기는 정가 |
| 전송(인터넷 아웃) | 월 100GB, 전 서비스·리전 합산 | https://aws.amazon.com/ec2/pricing/on-demand/ | 이 설계는 CloudFront로 나가므로 사용하지 않음 |
| API Gateway | 프리 티어(HTTP API 월 100만 호출)는 **12개월** 한정으로 적혀 있음 | https://aws.amazon.com/api-gateway/pricing/ | 상시 무료 아님 → 미반영 |
| CloudWatch Logs | 프리 티어 표에 5GB(수집·저장·쿼리)가 있으나 상시/기간 한정 여부를 페이지에서 확인하지 못함 | https://aws.amazon.com/cloudwatch/pricing/ | 보수적으로 미반영 |
| S3 | 프리 티어 조건을 요금 페이지에서 확인하지 못함 | https://aws.amazon.com/s3/pricing/ | 미반영 |
| 신규 계정 크레딧 | 2025-07-15 이후 신규 고객: 가입 시 100달러 + 활동으로 최대 100달러, 무료 요금제는 6개월 뒤 종료하거나 크레딧이 소진되면 종료. 유료 요금제도 최대 200달러 크레딧 대상. 크레딧은 계정 생성 후 12개월 안에 사용해야 함. 무료 요금제는 "select services only" | https://aws.amazon.com/free/ , https://docs.aws.amazon.com/awsaccountbilling/latest/aboutv2/free-tier-plans.html , https://aws.amazon.com/api-gateway/pricing/ | 표에는 넣지 않음. 6장에서 별도 판단 |
| 크레딧 적용 제외 | Route 53 도메인 등록에는 프로모션 크레딧을 쓸 수 없음 | https://aws.amazon.com/route53/pricing/ | 도메인은 항상 정가 |
| CloudFront 정액제(참고) | Free 플랜 월 0달러: 요청 100만, 전송 100GB 허용량, 초과 요금 없음. 허용량 초과 시 전송이 조정될 수 있고, 첫 급증은 허용량의 3배까지 영향 없음 | https://aws.amazon.com/cloudfront/pricing/ , https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/flat-rate-pricing-plan.html | 9장에서 적합성만 점검. 종량제 대신 선택할 수 있는 대안 |

### 2-3. LLM (Anthropic Claude API)

출처: https://platform.claude.com/docs/en/about-claude/pricing (확인일 2026-09-24). 단위는 USD/백만 토큰(MTok).

| 모델 | 입력 | 출력 | 배치 입력 / 출력 | 비고 |
| --- | ---: | ---: | ---: | --- |
| Claude Haiku 4.5 | 1 | 5 | 0.5 / 2.5 | 이전 토크나이저 |
| Claude Sonnet 5 | 2 | 10 | 1 / 5 | 신형 토크나이저 |
| Claude Opus 5.5 | 4 | 20 | 2 / 10 | 신형 토크나이저 |
| Claude Fable 5.1 | 10 | 50 | 5 / 25 | 신형 토크나이저 |

- 배치 API는 입출력 50% 할인(같은 페이지). 프롬프트 캐시 적중은 입력의 0.1배(같은 페이지)이며 이 계산에는 넣지 않았다(보수적).
- 같은 페이지의 안내: Claude 4.7 이후 모델은 새 토크나이저로 같은 텍스트에서 토큰이 약 30% 더 나온다. 아래 계산은 Haiku 4.5 기준 토큰 수에 신형 모델은 1.3배를 곱했다. 실제 배율은 한국어 본문에서 다를 수 있어 **측정 필요**.
- Amazon Bedrock 경유 가격은 확인하지 않았다(미확인). 직접 API 가격만 썼다.
- 세금과 결제 통화는 미확인(1장).
- **AI 공개는 본문·해설 사용 권한이 확인되기 전까지 보류 중이다.** 이 문서는 모델을 고르지 않고 산식 결과만 보여 준다.

## 3. 가정과 산식

모든 값은 `infra/cost/scenarios.json` 에 있다. **측정한 값이 아니라 가정**이며, M4에서 로컬·스테이징으로 측정해 교체한다. 시나리오는 IMPLEMENTATION_PLAN 5장의 변수 표를 그대로 따른다.

### 3-1. 시나리오 변수

| IMPLEMENTATION_PLAN 변수 | 낮음 | 기준 | 증가(한 달 내내 지속 가정) | 근거·설명 |
| --- | ---: | ---: | ---: | --- |
| 일 방문 수 | 100 | 1,000 | 10,000 | 가정. "증가"는 공개 직후 급증이 30일 지속된다고 두는 보수적 상정 |
| 방문 카운터 POST | 방문당 1회 | 동일 | 동일 | 브라우저 최초 로드마다 1회, 새로고침은 다시 1회. 엣지 캐시 없음 |
| 방문당 QT 조회 횟수(API 호출) | 1 | 1.5 | 2 | 가정. 오늘 QT 카드를 1회 조회하고 일부는 새로고침 |
| 피크 시간 비중 | 일 방문의 20%가 한 시간에 | 동일 | 동일 | 가정. 피크 초당 요청은 4장 표의 "피크" 행 |
| 정적 파일 요청(방문당) | 15 | 15 | 20 | 가정. 첫 방문 위주일수록 많음 |
| 정적 전송량(방문당 MB) | 0.8 | 1.0 | 1.5 | 가정. 시스템 글꼴, 코드 분할, 내보내기 라이브러리는 필요할 때만 로드한다고 가정. 웹 산출물이 나오면 실측으로 교체 |
| API 엣지 캐시 적중률 | 30% | 60% | 70% | 가정. `Cache-Control` 짧은 TTL을 CloudFront에 두는 설계(예: 60초). 민감도는 11절 표 |
| QT 수집(제공처당 하루 확인) | 4 | 4 | 4 | IaC 스케줄 고정: 00:05, 00:35, 06:00, 12:00 KST 4회(lead 결정). 제공처 2곳 |
| 수집 재시도(추가 시도 비율) | 10% | 30% | 100% | 가정. 실패한 확인을 같은 호출에서 다시 시도하는 비율 |
| Lambda 메모리 | 1,024MB | 1,024MB | 1,024MB | 가정. Spring Boot Java 21 기준. 실측 필요 |
| 방문 카운터 Lambda | 128MB, 100ms | 동일 | 동일 | Node.js 22 별도 함수. 100ms는 비용 가정이며 실측 전 |
| Lambda 실행 시간(웜) | 150ms | 150ms | 150ms | 가정. 미측정 |
| 콜드 스타트 비율 | 30% | 10% | 3% | 가정. 미측정. 초기화 5,000ms 추가로 가정(Spring Boot + Java, SnapStart 없음) |
| 수집 Lambda 시도당 시간 | 8초 | 8초 | 8초 | 가정. 제공처 두 곳 HTTP 조회와 파싱 |
| 알람 | 3개 | 3개 | 3개 | IaC 기본 |
| 로그량(API 호출 1건당) | 1.2KB | 1.5KB | 2.0KB | 가정. 본문·개인 입력은 로그에 남기지 않는 설계. 시작·종료·REPORT 줄 포함 |
| 로그량(방문 POST 1건당) | 0.5KB | 동일 | 동일 | 가정. 앱은 요청 헤더·IP·본문을 로깅하지 않음 |
| 로그량(수집 1건당) | 3KB | 3KB | 3KB | 가정 |
| 로그 보존 | 14일 | 14일 | 14일 | IaC 기본값 |
| DynamoDB 읽기 | API 호출당 2 읽기 단위 | 동일 | 동일 | 가정. 두 제공처 항목을 강한 일관성으로 읽는다고 보수적으로 |
| DynamoDB 쓰기 | 수집 호출당 3 쓰기 단위 | 동일 | 동일 | 가정. 항목 1 + 상태 1 + 여유 1 |
| DynamoDB 저장 | 0.01GB | 동일 | 동일 | QT 공통 데이터와 날짜별 방문 합계 항목. 개인 진도 없음 |
| S3 저장 | 1.05GB | 동일 | 동일 | 정적 산출물 0.05GB + 배포 산출물 1GB |
| AI: 하루 새 본문 수 | 1 | 2 | 2 | 가정. 제공처 2곳의 오늘 범위 |
| AI: 언어 조합 수 | 1 | 2 | 2 | 가정. ko, en |
| AI: 재사용률 | 0% | 20% | 0% | 가정. 같은 키 재사용 |
| AI: 실패 재시도 | 10% | 20% | 100% | 가정 |
| AI: 입력 / 출력 토큰 | 6,000 / 2,500 | 동일 | 동일 | 가정. Haiku 4.5 토크나이저 기준, 한국어 본문 + 앞뒤 문맥 + 지시문 |

### 3-2. 산식

- 월 방문 = 일 방문 x 30
- 레거시 QT API 호출 = 월 방문 x 방문당 QT API 호출. QT 원본 도달 = QT 호출 x (1 - 엣지 캐시 적중률).
- 방문 POST = 월 방문(캐시 없음). API Gateway 요청 = QT 원본 도달 + 방문 POST.
- CloudFront 요청 = 월 방문 x 정적 요청 + QT API 호출 + 방문 POST. 전송(GB) = 월 방문 x 방문당 MB / 1024. Functions 실행 = 정적 요청(재작성 함수는 기본 동작에만 붙음)
- QT API Lambda GB-초 = QT 원본 도달 x [(1 - 콜드비율) x 웜시간 + 콜드비율 x (웜시간 + 초기화시간)] x 메모리(GB)
- 방문 Lambda GB-초 = 방문 POST x 0.1초 x 128MB/1024. Lambda 요청 수에도 방문 POST를 더한다.
- 수집 Lambda 호출 = 제공처 수 x 하루 확인 횟수 x 30. GB-초 = 호출 x (1 + 재시도) x 시도당 시간 x 메모리(GB). Scheduler 호출 수도 같다.
- 로그 수집(GB) = (QT 원본 도달 x 호출당 KB + 방문 POST x 0.5KB + 수집 호출 x 수집 KB) / 1024²  ·  로그 저장 = 수집 x 보존일/30
- DynamoDB 읽기 단위 = QT 원본 도달 x 2  ·  쓰기 단위 = 수집 호출 x 3 + 방문 POST x 1
- S3 GET = 정적 요청 x 3%(엣지 미스)
- AWS 월 비용 = Σ 항목 x 2-1절 단가. "크레딧 종료 후"는 2-2절의 반영 항목만 각 사용량에서 뺀다(음수는 0).
- LLM = 월 생성 횟수 x 1회 비용. 월 생성 횟수 = 새 본문 수 x 언어 조합 수 x (1 - 재사용률) x (1 + 재시도) x 30. 1회 비용 = (입력토큰 x 입력단가 + 출력토큰 x 출력단가)/10⁶ x 토크나이저 배율
- 원화 = USD x 1,560 x 1.10

### 3-3. 재현

```sh
node infra/cost/fetch-prices.mjs        # 공식 Price List 재조회 → infra/cost/prices.json (자격 증명 불필요, 공개 GET)
node infra/cost/model.mjs               # 모든 표를 Markdown으로 출력
node infra/cost/update-doc.mjs          # 이 문서의 <!-- model:... --> 표를 모델 결과로 갱신 (--check: 최신 여부만 검사)
node --test infra/cost/model.test.mjs   # 산식 단위 테스트
```

`model.mjs` 는 의존성이 없다. 가정을 바꾸려면 `scenarios.json` 을 고친 뒤 다시 실행한다.

## 4. 사용량 (가정에서 계산)

<!-- model:usage:begin -->
| 항목 | 낮음 | 기준 | 증가(공개 직후, 한 달 내내 지속 가정) |
| --- | ---: | ---: | ---: |
| 월 방문 수 | 3,000 | 30,000 | 300,000 |
| 레거시 QT API 호출(엣지 포함) | 3,000 | 45,000 | 600,000 |
| 레거시 QT API 원본 도달(캐시 미스) | 2,100 | 18,000 | 180,000 |
| 방문 카운터 POST(캐시 없음) | 3,000 | 30,000 | 300,000 |
| API Gateway 총 요청 | 5,100 | 48,000 | 480,000 |
| CloudFront 요청(정적+API) | 51,000 | 525,000 | 6,900,000 |
| CloudFront 전송(GB) | 2.3 | 29.3 | 439.5 |
| Lambda 요청(API+수집) | 5,340 | 48,240 | 480,240 |
| Lambda GB-초 | 5,615 | 14,571 | 61,590 |
| 콜드 스타트 수 | 630 | 1,800 | 5,400 |
| 수집 Lambda 호출(=Scheduler 호출) | 240 | 240 | 240 |
| 로그 수집(GB) | 0.005 | 0.041 | 0.487 |
| DynamoDB 읽기 단위 | 4,200 | 36,000 | 360,000 |
| DynamoDB 쓰기 단위 | 3,720 | 30,720 | 300,720 |
| 피크 시간 API 요청(초당, 엣지 포함) | 0.01 | 0.14 | 1.67 |
| 피크 시간 API 원본 도달(초당) | 0.01 | 0.09 | 0.89 |
<!-- model:usage:end -->

가정한 피크는 최대 초당 1.67건이다. 처리량과 콜드 스타트 지연은 실제 측정으로 확인해야 한다(10-4절). 수집 Lambda 호출 수는 제공처 수 x 확인 횟수(4)로 셌는데, IaC의 스케줄은 한 번의 호출이 두 제공처를 모두 처리하므로 실제 호출 수는 이 값의 절반이다(보수적 과대 계산).

## 5. AWS 비용 (서울)

### 5-A. 무료 구간·크레딧 없음 (정가)

<!-- model:awsList:begin -->
| 항목 (USD, 세금 전) | 낮음 | 기준 | 증가(공개 직후, 한 달 내내 지속 가정) |
| --- | ---: | ---: | ---: |
| CloudFront 전송 | 0.28 | 3.52 | 52.73 |
| CloudFront 요청 | 0.06 | 0.63 | 8.28 |
| CloudFront Functions | 0.0045 | 0.04 | 0.60 |
| API Gateway | 0.0063 | 0.06 | 0.59 |
| Lambda 요청 | 0.0011 | 0.0096 | 0.10 |
| Lambda 실행(arm64) | 0.07 | 0.19 | 0.82 |
| DynamoDB 읽기 | 0.0006 | 0.0049 | 0.05 |
| DynamoDB 쓰기 | 0.0025 | 0.02 | 0.20 |
| DynamoDB 저장 | 0.0027 | 0.0027 | 0.0027 |
| S3 | 0.04 | 0.04 | 0.10 |
| CloudWatch Logs | 0.0035 | 0.03 | 0.38 |
| CloudWatch 알람 3개 | 0.30 | 0.30 | 0.30 |
| EventBridge Scheduler | 0.0003 | 0.0003 | 0.0003 |
| Budgets, SSM Standard(추가 요금 없음) | 0.0000 | 0.0000 | 0.0000 |
| **합계 USD** | **0.77** | **4.85** | **64.15** |
| **합계 원** (환율 1,560, 부가세 10%) | **1,329** | **8,329** | **110,088** |
<!-- model:awsList:end -->

### 5-B. 크레딧 종료 후 (상시 무료 반영: CloudFront 1TB·요청 1,000만·Functions 200만, Lambda 100만 요청·400,000 GB-초, Scheduler 1,400만, DynamoDB 저장 25GB)

<!-- model:awsPost:begin -->
| 항목 (USD, 세금 전) | 낮음 | 기준 | 증가(공개 직후, 한 달 내내 지속 가정) |
| --- | ---: | ---: | ---: |
| CloudFront 전송 | 0.0000 | 0.0000 | 0.0000 |
| CloudFront 요청 | 0.0000 | 0.0000 | 0.0000 |
| CloudFront Functions | 0.0000 | 0.0000 | 0.40 |
| API Gateway | 0.0063 | 0.06 | 0.59 |
| Lambda 요청 | 0.0000 | 0.0000 | 0.0000 |
| Lambda 실행(arm64) | 0.0000 | 0.0000 | 0.0000 |
| DynamoDB 읽기 | 0.0006 | 0.0049 | 0.05 |
| DynamoDB 쓰기 | 0.0025 | 0.02 | 0.20 |
| DynamoDB 저장 | 0.0000 | 0.0000 | 0.0000 |
| S3 | 0.04 | 0.04 | 0.10 |
| CloudWatch Logs | 0.0035 | 0.03 | 0.38 |
| CloudWatch 알람 3개 | 0.30 | 0.30 | 0.30 |
| EventBridge Scheduler | 0.0000 | 0.0000 | 0.0000 |
| Budgets, SSM Standard(추가 요금 없음) | 0.0000 | 0.0000 | 0.0000 |
| **합계 USD** | **0.35** | **0.46** | **2.02** |
| **합계 원** (환율 1,560, 부가세 10%) | **598** | **783** | **3,465** |
<!-- model:awsPost:end -->

이 표의 가장 큰 항목은 트래픽이 아니라 **알람 3개(월 0.30달러)** 다. CloudWatch 알람에는 무료 구간(월 10개)이 가격표에 있으나 상시 여부를 확인하지 못해 뺐다.

## 6. 리전 비교와 크레딧

AWS 월 합계(원, 부가세 포함, 환율 1,560). LLM 제외.

<!-- model:regions:begin -->
| 리전 | 시나리오 | 정가 | 크레딧 종료 후 |
| --- | --- | ---: | ---: |
| 서울 ap-northeast-2 | 낮음 | 1,329 | 598 |
| 서울 ap-northeast-2 | 기준 | 8,329 | 783 |
| 서울 ap-northeast-2 | 증가(공개 직후, 한 달 내내 지속 가정) | 110,088 | 3,465 |
| 도쿄 ap-northeast-1 | 낮음 | 1,331 | 600 |
| 도쿄 ap-northeast-1 | 기준 | 8,338 | 792 |
| 도쿄 ap-northeast-1 | 증가(공개 직후, 한 달 내내 지속 가정) | 110,168 | 3,544 |
| 버지니아 북부 us-east-1 | 낮음 | 1,322 | 592 |
| 버지니아 북부 us-east-1 | 기준 | 8,287 | 742 |
| 버지니아 북부 us-east-1 | 증가(공개 직후, 한 달 내내 지속 가정) | 109,659 | 3,036 |
<!-- model:regions:end -->

판단:

- **리전 간 차이는 1% 안팎이다(정가).** CloudFront 요금은 리전과 무관하고, 리전별 단가 차이는 API Gateway, DynamoDB, 로그 수집에서만 나는데 이 항목들이 작다. 비용만으로 리전을 정할 이유가 없다.
- 그래서 **서울(ap-northeast-2)을 권고한다.** 데이터와 API 원본이 한국 사용자와 같은 지역에 있어 캐시 미스 때 왕복이 짧다(PRD 서버 응답 p95 1초 목표와 관련. 지연은 미측정). 버지니아는 약간 싸지만 한국 사용자의 원본 왕복이 길 것으로 예상된다(미측정).
- 도메인 없이 시작하면 `*.cloudfront.net` 주소를 쓰므로 us-east-1 인증서 스택이 필요 없다. 이때 기본 인증서의 보안 정책은 TLS 1.0 이상으로 고정된다(CDK 경고 확인). 도메인을 붙이면 CloudFront용 인증서는 us-east-1에서 요청하거나 가져와야 한다(공식 문서 https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/cnames-and-https-requirements.html, 2026-09-24 확인). 이때 리전 간 스택이 추가된다.
- Lambda `java21` 런타임은 현재 지원 목록에 있으며 폐기 예정일은 2029-06-30이다(https://docs.aws.amazon.com/lambda/latest/dg/lambda-runtimes.html, 2026-09-24 확인).
- 그 밖의 리전은 조사하지 않았다.

### 신규 계정 크레딧 기간

최대 200달러가 무료 요금제 6개월 또는 계정 생성 후 12개월 안에 적용된다. 6개월로 나누면 월 약 33달러이며, 5-A의 기준 시나리오 정가 월액(약 4.8달러)은 이 안에 든다. 즉 **기준 시나리오까지는 크레딧 기간 청구액이 0원에 가깝다.** 다만 (1) 무료 요금제는 크레딧 소진 또는 6개월 뒤 계정이 닫히고 사용할 수 있는 서비스가 제한된다("select services only"). CloudFront·API Gateway·Lambda가 무료 요금제 대상인지는 **미확인**이라 유료 요금제로 전환하고 크레딧을 받는 경로를 권고한다. (2) 도메인 등록비는 크레딧으로 낼 수 없다.

## 7. LLM 월 비용 (원, 부가세 포함) - 산식 결과, 결정 아님

<!-- model:llm:begin -->
| 모델 | 시나리오 | 월 생성 횟수 | 1회 비용(USD) | 월 USD | 월 원 | 배치 API(50%) 원 |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| Claude Haiku 4.5 | 낮음 | 33 | 0.0185 | 0.61 | 1,048 | 524 |
| Claude Haiku 4.5 | 기준 | 115 | 0.0185 | 2.13 | 3,657 | 1,829 |
| Claude Haiku 4.5 | 증가(공개 직후, 한 달 내내 지속 가정) | 240 | 0.0185 | 4.44 | 7,619 | 3,810 |
| Claude Sonnet 5 | 낮음 | 33 | 0.0481 | 1.59 | 2,724 | 1,362 |
| Claude Sonnet 5 | 기준 | 115 | 0.0481 | 5.54 | 9,509 | 4,754 |
| Claude Sonnet 5 | 증가(공개 직후, 한 달 내내 지속 가정) | 240 | 0.0481 | 11.54 | 19,810 | 9,905 |
| Claude Opus 5.5 | 낮음 | 33 | 0.0962 | 3.17 | 5,448 | 2,724 |
| Claude Opus 5.5 | 기준 | 115 | 0.0962 | 11.08 | 19,017 | 9,509 |
| Claude Opus 5.5 | 증가(공개 직후, 한 달 내내 지속 가정) | 240 | 0.0962 | 23.09 | 39,619 | 19,810 |
| Claude Fable 5.1 | 낮음 | 33 | 0.2405 | 7.94 | 13,619 | 6,810 |
| Claude Fable 5.1 | 기준 | 115 | 0.2405 | 27.71 | 47,543 | 23,771 |
| Claude Fable 5.1 | 증가(공개 직후, 한 달 내내 지속 가정) | 240 | 0.2405 | 57.72 | 99,048 | 49,524 |
<!-- model:llm:end -->

- 생성 횟수는 방문자 수와 무관하다. 서버가 확인한 QT 범위만 생성하므로 "증가" 시나리오의 늘어난 값은 실패 재시도 100%와 재사용 0% 가정에서 나온다.
- 기준 시나리오의 AWS 비용을 뺀 예산 잔액으로 가능한 월 생성 횟수(재시도도 1회로 셈):

<!-- model:aiRoom:begin -->
| 모델 (1회 원) | AWS 정가 기준 잔액(원) | 가능 횟수 | AWS 크레딧 종료 후 기준 잔액(원) | 가능 횟수 |
| --- | ---: | ---: | ---: | ---: |
| Claude Haiku 4.5 (31.7원) | 1,671 | 52 | 9,217 | 290 |
| Claude Sonnet 5 (82.5원) | 1,671 | 20 | 9,217 | 111 |
| Claude Opus 5.5 (165.1원) | 1,671 | 10 | 9,217 | 55 |
| Claude Fable 5.1 (412.7원) | 1,671 | 4 | 9,217 | 22 |
<!-- model:aiRoom:end -->

하루 2개 범위를 한국어·영어로 생성하면 월 최소 120회다. 표에 따르면 **Haiku 4.5는 크레딧 종료 후 기준으로 들어오고, Sonnet 5는 배치 API나 횟수 상한이 있어야 들어오며, Opus 5.5 이상은 이 예산 구조에서 매일 두 언어 생성이 어렵다.** 품질과 사람 검토 비용은 이 표에 없다.

## 8. IaC 검증 기록

| 검증 | 명령 | 결과 |
| --- | --- | --- |
| 타입 검사 | `pnpm --filter malssum-haru-infra typecheck` (`tsc --noEmit`, TypeScript 7.0.2) | 통과 |
| 단위·스냅샷 테스트 | `pnpm --filter malssum-haru-infra test` (`node --import tsx --test`) | 개인 진도·계획 리소스 부재, 허용 목록, QT GET·방문 POST 라우트, 방문 함수의 단일 UpdateItem 권한, 조회 함수 쓰기 권한 없음, 비밀 값 없음, 로그 보존, S3 비공개, 설정 검증, noindex 헤더, 비공개 시험 운영 표시, VPC 없음·쓰기 권한 분리, 스냅샷, CI에 배포 단계 없음 |
| 합성 | `pnpm --filter malssum-haru-infra synth:ci` (`cdk synth`, 자격 증명 없이) | 통과. 경고 2개(자리표시자 산출물, 웹 산출물 없음)는 의도한 것 |
| 비용 모델 테스트 | `pnpm --filter malssum-haru-infra cost:test` | 6개 통과 |
| 문서 표와 모델 일치 | `pnpm --filter malssum-haru-infra cost:doc:check` | 통과 |
| 테스트 민감도 | 개인 진도용 테이블을 임시로 추가해 보고 테스트가 실패하는지 확인 | 3개 테스트가 실패해 검출됨 |

검증 위치: 워크스페이스(lead가 갱신한 `pnpm-lock.yaml` 기준)에서 위 명령을 그대로 실행했다. 합성은 `AWS_SHARED_CREDENTIALS_FILE=/dev/null` 등으로 로컬 자격 증명을 쓰지 않게 하고 실행했다. 테스트는 `web/dist` 유무와 무관하도록 웹 산출물 경로를 고정한다.

의존성 버전(2026-09-24 npm 레지스트리 메타데이터로 확인, 정확히 고정): `aws-cdk-lib` 2.270.0(Node >= 20), `aws-cdk` 2.1143.0, `constructs` 10.8.1, `typescript` 7.0.2와 `@types/node` 22.20.4(web과 동일), `tsx` 4.23.15. 테스트는 Node 내장 테스트 러너를 쓴다.

## 9. CloudFront 정액제 Free 플랜 적합성 (종량제의 대안)

<!-- model:flatPlan:begin -->
| 시나리오 | CloudFront 요청 | 허용량(100만) 대비 | 전송(GB) | 허용량(100GB) 대비 |
| --- | ---: | ---: | ---: | ---: |
| 낮음 | 51,000 | 5% | 2.3 | 2% |
| 기준 | 525,000 | 53% | 29.3 | 29% |
| 증가(공개 직후, 한 달 내내 지속 가정) | 6,900,000 | 690% | 439.5 | 439% |
<!-- model:flatPlan:end -->

낮음·기준은 허용량 안이라 월 0달러 상한이 성립한다. 증가는 허용량을 크게 넘어 전송이 조정될 수 있다. 종량제는 "1TB·1,000만 요청 무료 뒤 청구", 정액제는 "초과 요금 없음, 그러나 초과 시 전송 조정"이다. 공개 직후 급증을 가장 저렴하게 막는 선택이 정액제인지는 조정 조건을 실제로 겪어야 알 수 있어 **미확인**이다. IaC는 종량제를 기본으로 하고 정액제 전환은 사용자가 결정한다. CDK로 정액제 플랜을 선언할 수 있는지는 확인하지 않았다.

## 10. 10,000원을 넘을 때의 조정안

10,000원을 넘는 경우는 (a) 무료 구간이 없다고 본 기준 시나리오, (b) Sonnet 5 이상의 모델, (c) 증가 시나리오다. 조정 수단과 효과는 아래 순서이며 효과는 모델로 재계산한 값이다.

### 10-1. AI 생성 한도 (애플리케이션 코드가 강제)

- 월 생성 횟수 상한과 월 LLM 예산 상한(원 또는 USD)을 서버 설정으로 둔다. 상한에 도달하면 **신규 생성만 멈추고** 기존 결과, QT 공식 링크, 일독 계산은 유지한다(PRD 운영 비용 원칙). IaC는 상한값을 환경 변수 `AI_MONTHLY_GENERATION_LIMIT` 로 전달하고, AI를 켜려면 이 값이 1 이상이어야 합성이 통과한다.
- 상한 예시는 7장 잔액 표에서 고른다. 예: 기준 시나리오에서 AWS 정가와 함께 두려면 Haiku 4.5 월 57회, 크레딧 종료 후 기준이면 294회까지.
- 사용자 임의 프롬프트·모델 설정은 받지 않고 서버가 확인한 QT 범위만 요청받는다(IMPLEMENTATION_PLAN M5). 그러면 트래픽이 늘어도 생성 횟수는 늘지 않는다.

### 10-2. 캐시 재사용과 배치

- 캐시 키에 제공처명·날짜를 넣지 않아 같은 본문 범위가 두 제공처에 나와도 한 번만 생성한다(M5 캐시 키 규칙).
- 신규 생성은 방문 시점이 아니라 수집 직후 예약 작업으로 만들면 **배치 API(50% 할인)** 를 쓸 수 있다(7장 표의 마지막 열). 지연은 배치 처리 시간만큼 늘어난다(대기 상태 표시로 대응, PRD AI04).
- 프롬프트 캐시(적중 입력 0.1배)는 계산에 넣지 않았다. 고정 지시문이 길다면 추가 절감 여지가 있다.
- 실패 재시도 횟수를 제한한다(재시도 100%는 비용이 2배).

### 10-3. 요청 제한과 전송량

- API Gateway 스테이지 스로틀은 IaC에 넣었다(추가 요금 없음). Lambda 예약 동시성은 신규 계정의 동시성 할당량이 낮을 수 있어 기본으로는 지정하지 않았고 `apiReservedConcurrency` 로 켤 수 있다(할당량은 미확인).
- 오늘 QT 응답의 엣지 캐시는 이미 설정했다(기본 60초). 기준 시나리오에서 캐시 적중률이 0%에서 90%가 되어도 정가는 약 9% 줄 뿐이라 비용보다 지연·콜드 스타트 감소 효과가 크다(11절 민감도 표).
- **방문당 전송량이 가장 큰 지렛대다.** 시스템 글꼴, 라우트 단위 코드 분할, Excel·PDF 라이브러리 지연 로드, Brotli 압축으로 방문당 전송을 줄이도록 web-experience에 요청할 수 있다. 효과(정가 기준 시나리오 방어 가능성):

<!-- model:adjust:begin -->
| 시나리오 | 조정 | AWS 정가 | AWS 종료 후 | 정가 + Haiku 배치 | 종료 후 + Sonnet 5 배치 |
| --- | --- | ---: | ---: | ---: | ---: |
| 기준 | 기준 그대로 | 8,329 | 783 | 10,158 (초과) | 5,537 |
| 기준 | 방문당 전송 0.5MB | 5,313 | 783 | 7,141 | 5,537 |
| 기준 | 방문당 전송 0.5MB + API 캐시 90% | 5,047 | 723 | 6,876 | 5,477 |
| 증가(공개 직후, 한 달 내내 지속 가정) | 기준 그대로 | 110,088 | 3,465 | 113,897 (초과) | 13,370 (초과) |
| 증가(공개 직후, 한 달 내내 지속 가정) | 방문당 전송 0.5MB | 49,760 | 3,465 | 53,569 (초과) | 13,370 (초과) |
| 증가(공개 직후, 한 달 내내 지속 가정) | 방문당 전송 0.5MB + API 캐시 90% | 48,282 | 2,852 | 52,091 (초과) | 12,756 (초과) |
<!-- model:adjust:end -->

- 증가 시나리오는 정가 기준으로는 위 조정을 모두 해도 예산 밖이다. 이 규모의 정가 방어는 불가능하며 상시 무료 구간이나 정액제 Free 플랜 같은 요금 모델의 특성에 기대야 한다. 증가 시나리오가 실제로 발생하면 예산 목표를 다시 검토해야 한다.

### 10-4. 인프라 선택

- 비밀은 Secrets Manager 대신 **SSM Parameter Store Standard(무료)** SecureString을 쓴다(IaC 기본). 시크릿당 월 약 690원 절감.
- **Lambda arm64(Graviton)** 사용(IaC 기본). x86 대비 GB-초 단가가 20% 낮다(같은 가격표). Java는 JAR라 아키텍처 변경 비용이 적다.
- CloudWatch 알람은 필요한 것만 둔다(IaC 기본 3개). 로그 보존은 14일, 로그 수준은 INFO 이하, 본문·개인 입력은 남기지 않는다. 방문당 20KB 상세 로그면 기준 시나리오 크레딧 종료 후 비용이 크게 오른다(11절).
- DynamoDB는 온디맨드 기본. 요청이 매우 적으므로 프로비저닝 1 RCU/1 WCU(프리 티어 25/25 안, 월 0달러)도 대안이지만 급증 시 스로틀 위험이 있어 기본으로는 두지 않았다(측정 뒤 결정).
- **콜드 스타트 대응**: PRD의 서버 응답 p95 1초에는 Java 콜드 스타트가 걸린다. 선택지와 비용(서울, 월): (1) 엣지 캐시로 콜드 요청 비중 축소(무료, 적용됨), (2) EventBridge Scheduler로 5분마다 워밍 호출(월 8,640회, 약 0.02달러=33원, IaC에는 아직 없음), (3) SnapStart(1GB 한 버전 상시: 캐시 약 4.8달러=약 8,200원, 메모리 512MB면 절반). 현재 예산에서는 (1)+(2)를 먼저 측정하고 SnapStart는 측정 결과가 필요할 때만 검토한다. 콜드 스타트 시간은 **미측정**이다.
- 상시 실행 서버(EC2, ECS), NAT Gateway, AWS WAF(웹 ACL 유료, 이 조사에서 가격 미조회), Route 53 Resolver, Spring Cloud MSA 상시 구성은 예산 위험이 커서 쓰지 않는다(IMPLEMENTATION_PLAN M6과 같은 원칙).

## 11. 민감도 (서울, AWS만, 기준 시나리오)

<!-- model:sensitivity:begin -->
| 경우 (AWS만, 원) | 정가 | 크레딧 종료 후 |
| --- | ---: | ---: |
| 기준 | 8,329 | 783 |
| API 엣지 캐시 0% | 8,861 | 904 |
| API 엣지 캐시 90% | 8,063 | 723 |
| 방문당 전송 0.3MB(초기 로드 gzip 150KB 예산 + 여유) | 4,106 | 783 |
| 방문당 전송 0.5MB | 5,313 | 783 |
| 방문당 전송 3MB | 20,395 | 783 |
| 로그 방문당 20KB(상세 로그) | 8,751 | 1,205 |
| SnapStart 사용(1GB, 활성 버전 1) | 17,023 | 9,477 |
| Secrets Manager 시크릿 1개 | 9,016 | 1,469 |
| Route 53 호스팅 영역 1개(도메인 등록비 제외) | 9,187 | 1,641 |
| 환율 1,365원(2026-09-23 값) | 7,288 | - |
<!-- model:sensitivity:end -->

- 정가 기준으로 가장 큰 영향은 방문당 전송량과 SnapStart다. 크레딧 종료 후 기준에서는 트래픽보다 **고정비**(알람, Route 53 영역, Secrets Manager, SnapStart)가 지배한다.

<!-- model:budgetUsd:begin -->
월 예산 10,000원은 세전 약 5.83달러(환율 1,560, 부가세 10%)다.
<!-- model:budgetUsd:end -->

## 12. AWS Budgets 알림과 애플리케이션 AI 생성 차단은 별개다

| | AWS Budgets | 애플리케이션 AI 생성 차단 |
| --- | --- | --- |
| 무엇을 보나 | AWS 청구 예상·실제 금액(청구 데이터는 지연됨) | 서비스가 직접 센 LLM 호출 횟수·토큰·금액 |
| LLM 비용 | **포함하지 못함**: Anthropic API를 직접 쓰면 그 비용은 AWS 청구서에 나타나지 않는다(Bedrock 등 AWS 경유 상품은 다를 수 있으나 미확인) | 필수. 서버가 월 호출 수·예산을 세고 상한에서 신규 생성을 거절 |
| 하는 일 | 임계치 도달 시 이메일 알림. 동작(action)을 연결해도 IAM·SCP 권한 변경이나 EC2·RDS 중지 등이며 요청 기반 요금(CloudFront, Lambda, API Gateway)을 자동으로 멈추지 않는다 | 신규 생성만 중단하고 기존 결과·QT 링크·일독 계산은 유지 |
| 지연 | 청구 데이터 반영 시차가 있어 급증을 늦게 안다 | 호출 즉시 판단 |
| 요금 | 모니터링 무료, 동작 연결 예산은 2개까지 무료 | 구현 비용만 |

IaC의 Budgets는 알림 전용이다(테스트가 동작 리소스가 없음을 검사한다). 자동 차단 동작은 만들지 않았다. 만들려면 별도 설계와 승인이 필요하다. 알림 수신 이메일은 배포 전 사용자가 정한다. 예산 금액은 USD이며 기본 6달러는 10,000원을 환율 1,560, 부가세 제외로 환산한 값이다(Budgets가 세금을 포함해 집계하는지는 미확인).

## 13. 미확인 항목과 한계

| 항목 | 상태 |
| --- | --- |
| 모든 사용량(트래픽, 전송량, 콜드 스타트, 로그, 토큰) | 가정. M4에서 측정해 교체 |
| Route 53 도메인 등록 요금 | 미확인(TLD 표 접근 거부, HTTP 403) |
| AWS 한국 부가세율과 청구 통화 | 미확인. 10%와 USD 단가 x 환율을 가정 |
| Anthropic의 세금·청구 통화 | 미확인 |
| API Gateway·S3·CloudWatch Logs의 신규 계정 무료 구간 형태 | 12개월 또는 크레딧 방식으로 보이며 상시 무료 아님으로 처리 |
| 무료 요금제에서 사용할 수 있는 서비스 범위 | 미확인 |
| CloudFront 정액제 초과 시 전송 조정의 실제 영향, CDK 지원 | 미확인 |
| AWS Budgets가 세금을 포함해 집계하는지 | 미확인 |
| Lambda 계정 동시성 할당량(신규 계정) | 미확인 |
| SNS 이메일 알림 요금, CloudFront 응답 헤더 정책 요금 | 조회 안 함(소량 또는 추가 요금 없음으로 알려져 있으나 미확인, 비용표 미포함) |
| AWS WAF 요금, KMS 사용자 관리 키 요금 | 조회 안 함(사용 안 함) |
| Java Lambda 콜드 스타트 시간, 실행 시간, Spring Cloud Function 어댑터 메모리 요구량 | 미측정 |
| Bedrock 경유 Claude 가격 | 조회 안 함 |
| 콘텐츠(선택한 성경 번역본·QT 제공처) 이용료 | 승인된 번역본의 정적 파일·콘텐츠 권리 조건을 확인해야 한다. QT 제공처 본문·해설은 앱에서 복제하지 않고 공식 링크만 둔다. |
| 수집 Lambda의 실제 시간과 DynamoDB 첫 호출 콜드 비용 | 시도당 8초 가정, 미측정 |
| 토크나이저 배율 1.3 | 공식 페이지의 "약 30%"를 그대로 적용. 한국어에서 실제 배율은 측정 필요 |
| Price List 게시 후 요금 변경 | 배포 시점에 재조회 필요(`fetch-prices.mjs` 재실행 후 `update-doc.mjs`) |
| SSM SecureString의 AWS 관리형 키(alias/aws/ssm) 사용 시 IAM 권한 | 추가 kms 권한 없이 동작한다고 가정. 배포 전 확인 |

## 14. 서비스 코드와 맞춰야 하는 IaC 계약 (qt-backend T15·T16 확정, 2026-09-24)

| 이름 | 값 |
| --- | --- |
| 배포 산출물(두 함수 공통) | `services/qt/target/qt-service-0.0.1-SNAPSHOT-aws.jar`(shaded, 약 35MB), 런타임 java21. `-exec.jar`와 일반 jar는 배포하지 않는다 |
| 조회 핸들러 | `kr.malssumharu.qt.lambda.QtLambdaHandler::handleRequest`(빈 `qtToday`), HTTP API payload 2.0, `GET /api/qt/today`. 응답에 `Cache-Control: public, max-age=60`(엣지 기본 TTL 60초와 일치) |
| 수집 핸들러 | `kr.malssumharu.qt.lambda.QtCollectHandler::handleRequest`(빈 `qtCollect`), 스케줄이 `{"trigger":"schedule"}` 로 호출, 그 밖의 입력은 `IGNORED` |
| 함수 이름 환경 변수 | 불필요(핸들러가 고정). `SPRING_CLOUD_FUNCTION_DEFINITION` 은 넣지 않는다 |
| `QT_TABLE_NAME` | 있으면 배포 모드(DynamoDB). 조회는 서울 오늘 항목만 읽고 제공처에 요청하지 않는다 |
| `QT_ITEM_TTL_DAYS` | 400 |
| `QT_COLLECTOR_ENABLED`, `QT_PROVIDER_MAEIL_SEONGYEONG`, `QT_PROVIDER_SAENGMYEONG_UI_SAM` | `enabled` / `disabled`. IaC 기본값은 모두 disabled. 명시적 opt-in 전에는 provider 요청·정기 수집 없음 |
| `QT_ACQUISITION_ENABLED` | IaC 기본값은 `false`. false면 조회는 `RANGE_NOT_PERMITTED`, 수집은 요청·저장 없음. 현재 web은 `/daily-word/YYYY-MM-DD.json` 정적 artifact와 공식 링크를 사용하며 이 레거시 API는 메인 말씀 화면에 연결되지 않는다 |
| 테이블 | 파티션 `providerId`(S), 정렬 `providerDate`(S, YYYY-MM-DD), TTL `expiresAt`(N, epoch 초) |
| IAM | 조회 `dynamodb:GetItem`, 수집 `dynamodb:GetItem`+`dynamodb:PutItem`, 테이블 ARN 한정(테스트로 검사) |
| 자원 | 조회 512MB 이상·타임아웃 10초 안팎, 수집 512MB·30초 이상(IaC는 둘 다 1,024MB, 수집 60초) |
| 스케줄 | 서울 자정 직후 제공처가 어제 페이지를 보일 수 있어(`DATE_MISMATCH`) 자정 이후 여러 번 돌린다: 00:05, 00:35, 06:00, 12:00. (providerId, 서울 오늘) 항목이 이미 저장돼 있으면 시간과 무관하게 그 제공처는 요청하지 않고 `ALREADY_COLLECTED` 로 건너뛴다. 실패·날짜 불일치 제공처만 다음 스케줄에서 재시도(저장 없음) |

미시험(qt-backend 보고): 실제 DynamoDB 동작(PutItem 덮어쓰기, TTL 삭제, IAM)은 클라이언트 대역으로만 검증됐고, 첫 DynamoDB 호출의 콜드 비용은 측정하지 못했다. JVM 스택 옵션(`-Xss` 등)은 넣지 않는다(lead: `-Xss512k` 에서 로컬 기동 실패 관찰).

- **레거시 자동 취득의 opt-in**: 기본은 acquisition/provider/collector 모두 off이며 `/api/qt/today`는 새 오늘의 말씀 화면의 데이터 경로가 아니다. 별도 권리 확인 후에만 `-c qtAcquisitionEnabled=true -c providerMaeilSeongyeong=true -c providerSaengmyeongUiSam=true -c collectorEnabled=true`로 켠다. 취득을 켠 배포는 스택 표시/태그/출력에 private-preview 및 permission 미확인 경고를 남긴다. 끌 때는 이 컨텍스트들을 false로 재합성·재배포한다.

### 14-A. 날짜별 정적 말씀 파일 배포 경로

- 웹 빌드의 `web/public/daily-word/YYYY-MM-DD.json` 파일은 Vite가 `web/dist/daily-word/YYYY-MM-DD.json`으로 복사한다.
- CDK `BucketDeployment`는 `web/dist` 전체 디렉터리를 재귀적으로 S3 루트에 배포하므로 최종 URL은 `/daily-word/YYYY-MM-DD.json`이다. `.json` 확장자가 있는 경로는 CloudFront SPA rewrite가 `/index.html`로 바꾸지 않는다.
- 날짜 artifact는 공개 본문이 되므로 권리·출처·장절 검증이 완료된 승인 파일만 `web/public`에 넣는다. 파일이 제공되지 않은 날짜는 웹 로더가 unavailable 처리하고 어제 자료로 대체하지 않는다.
- 재배포 시 `/index.html`과 `/daily-word/*`를 함께 CloudFront에서 무효화한다. 같은 날짜 artifact의 정정 배포가 기본 캐시 TTL에 가려지는 일을 방지한다. 이 변경은 기존 S3/CloudFront만 사용하며 새 AWS 리소스는 만들지 않는다.
- **검색 엔진 비노출**: CloudFront 응답 헤더로 `X-Robots-Tag: noindex, nofollow` 를 모든 응답에 붙인다(`web/public/robots.txt` 의 `Disallow: /` 는 web-experience 요청 중). 접근 제어가 아니므로 URL을 알면 접속된다.
- 조회 함수와 수집 함수 모두 VPC 밖(NAT 불필요)이며 DynamoDB 쓰기 권한은 수집 함수에만 있다(테스트로 검사). 배포 모드의 조회 함수는 제공처에 요청하지 않으므로 외부 아웃바운드가 필요한 것은 수집 함수뿐이다(qt-backend T16 보고, 테스트로 확인됨. IAM은 아웃바운드를 제한하지 않아 코드 동작에 의존). 스케줄 호출 비용은 횟수에 비례한다(4회/일로 고정).
- 개인 계획·진도는 어떤 환경 변수, 테이블, 라우트에도 없다.
- JVM 스택 옵션(`-Xss` 등)은 넣지 않는다(lead: `-Xss512k` 에서 로컬 기동 실패 관찰).
- AI 환경 변수와 SSM 권한은 이전 초안에서 뺐다(서비스가 쓰지 않는다).

### 14-2. 웹 접근 제어 선택지 (혼자 쓰는 비공개 시험 운영)

현재 IaC는 (a)뿐이다. 웹의 일일 말씀 콘텐츠는 S3/CloudFront 정적 artifact이고, 레거시 QT API는 기본 provider 취득 off다. 접근 제어는 배포 전 별도 결정 사항이며 아래 표는 **구현하지 않은 비교**다. 비용은 서울 기준 원화(환율 1,560, 부가세 10% 포함)이고, 단가는 2026-09-24 AWS Price List·요금 페이지 확인값이다.

| 선택지 | 월 비용 영향 | 구현 복잡도 | 모바일 사용성 | 장점 | 단점·주의 |
| --- | --- | --- | --- | --- | --- |
| (a) 현재: `noindex` 헤더만, URL을 알면 접속 | 0원 | 없음(구현됨) | 가장 좋음 | 추가 비용·설정 없음 | 접근 제어가 아니다. URL(`*.cloudfront.net` 무작위 주소)이 새면 누구나 접속하고, API를 호출하면 DynamoDB 읽기 비용이 든다. 스로틀(초당 20)만 방어 |
| (b) CloudFront Function 기본 인증(Basic auth) | 함수 실행 요금이 이미 있는 재작성 함수와 같은 단가(월 200만 회 무료, 초과 100만 회당 0.10달러). 인증을 API 동작에도 붙이면 실행 수가 API 호출만큼 늘지만 기준 시나리오에서 무료 구간 안(정가로 계산해도 월 0.01달러 미만). 자격 증명 저장에 KeyValueStore를 쓰면 그 요금은 **미확인** | 중간: 함수 코드 수정 + 두 동작에 연결 + 자격 증명 주입 | 좋음: 브라우저 로그인 창과 비밀번호 관리자를 쓴다. 같은 출처의 `fetch` 는 인증 정보를 자동으로 보낸다. PDF·Excel 다운로드는 브라우저 안에서 만들므로 영향 없음 | 값싸고 엣지에서 차단해 원본(Lambda·DynamoDB)을 보호한다 | **자격 증명을 함수 코드에 넣으면 템플릿과 저장소에 남는다.** 코드에 두지 말고 배포 시 주입(KeyValueStore 또는 파라미터)해야 하며, 그 방식은 미검증. 취약한 비밀번호는 무차별 대입에 약함 |
| (c) IP 제한 | **AWS WAF 사용 시 웹 ACL 월 5달러 + 규칙 월 1달러 = 약 10,300원(가격표 확인)으로 월 예산 10,000원 자체를 넘는다.** WAF 없이 CloudFront Function에서 `event.viewer.ip` 를 검사하면 (b)와 같은 무료 수준 | WAF: 중간(us-east-1 전역 스코프 필요). Function: 낮음 | **나쁨**: 이동통신망·공용 와이파이는 IP가 자주 바뀌어 접속이 막힌다. 집 고정 IP에서만 쓸 때만 적합 | 비밀번호가 필요 없다 | IP가 바뀌면 재배포해야 하고, 자신이 차단된다. WAF는 이 예산에서 사실상 불가(정액제 Free 플랜에는 WAF 규칙 5개가 포함된다고 적혀 있으나 이 조사에서 사용 조건을 확인하지 않음: 미확인) |
| (d-1) 무작위 비밀 경로/토큰 링크(함수가 쿠키·쿼리 토큰 확인) | (b)와 같음 | 중간 | 좋음: 링크를 한 번 열면 쿠키 유지 | 로그인 창 없이 즐겨찾기로 사용 | 토큰이 URL·기록에 남고 코드/설정 주입 문제가 (b)와 같음. 공유되면 취소 방법이 재배포뿐 |
| (d-2) Cognito 등 인증 서비스 | 미확인(조사 안 함) | 높음 | 좋음 | 표준 인증 | **이 프로젝트는 사용자 식별·인증 리소스를 만들지 않는 원칙이라 허용 목록에서 막혀 있다**(개인 진도 비저장 원칙과 충돌 소지). 혼자 쓰는 용도에는 과함 |
| (d-3) Lambda@Edge 인증 | Lambda@Edge에는 무료 구간이 없다고 CloudFront 페이지에 적혀 있음. 요청 백만 건당 0.60달러(Price List), 실행 시간 별도 | 높음 | 좋음 | 복잡한 검증 가능 | (b)로 충분해 비용·복잡도만 늘어남 |
| (d-4) 원본 직접 접속 차단 | 0원 | 낮음 | 영향 없음 | CloudFront를 우회한 API 직접 호출을 줄임 | 이 표의 사용자 접근 제어와는 별개. 현재 HTTP API 주소는 공개 엔드포인트이며 비밀 헤더 검증은 구현하지 않았다(미구현) |

권고(결정은 사용자): 모바일에서 쓰고 비용을 늘리지 않으려면 **(b) 기본 인증**이 가장 균형이 좋다. 다만 자격 증명 주입 방식(코드가 아닌 배포 시 입력)을 먼저 정해야 한다. 그 결정 전에는 (a)로 둔다. 제공처 자동 취득은 기본 비활성이므로 이 접근 제어 선택과 별개다.

## 15. 배포 후 실제 청구와 비교할 항목

배포 후 첫 두 달간 Cost Explorer의 서비스별 비용을 이 표의 항목과 대조한다. 어긋나면 `infra/cost/scenarios.json` 을 실측으로 고치고 이 문서의 표를 다시 만든다.

- CloudFront 전송(GB)과 요청 수, 방문당 전송량
- Lambda 호출·GB-초·콜드 스타트 비율(로그의 REPORT 줄 수치), 평균 실행 시간
- API Gateway 요청 수, DynamoDB 읽기·쓰기 단위, CloudWatch Logs 수집량
- LLM 실제 입출력 토큰과 월 지출(앱이 센 값과 Anthropic 콘솔 값 대조)
- 환율과 세금 적용 후 실제 청구 원화
