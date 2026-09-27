# 오늘의 말씀 콘텐츠 준비와 게시

현재 상태(2026-09-27): 코드와 수동 게시 경로만 준비되어 있습니다. 후보 2건은 본문·해설·권리 승인 대기이며, AWS 환경은 배포되지 않았습니다. 승인 없이 실제 날짜 파일을 생성하거나 게시하지 않습니다.

## 1. 후보 검토

`services/daily-content/src/main/resources/catalog/candidate-catalog-v1.json`의 각 후보에 대해 다음을 사람에게 확인받습니다.

- `reference`와 `text`가 출처의 해당 한 절과 정확히 일치하는지 확인하고 원문 SHA-256을 기록합니다.
- 해설을 편집 검토하고 재배포 근거 URL을 기록합니다.
- `textStatus`, `explanationStatus`, `rightsStatus`를 각각 승인하고 `reviewedBy`, `reviewedAt`을 채웁니다. 후보가 바뀌면 `catalogVersion`도 바꿉니다. 도구의 형식 검사는 검토자 본인이나 권리 보유자의 허락을 대신하지 않습니다.

## 2. 14일분 준비

승인이 끝난 카탈로그에서 아래 명령으로 14일분을 로컬에 만듭니다. 모든 날짜의 내용을 계산하고 기존 파일과 충돌하는지 확인한 뒤 쓰기 시작합니다. 같은 내용의 재실행은 성공하며 다른 내용의 덮어쓰기는 거부합니다.

```sh
node tools/daily-catalog/validate.mjs --require-approved
(cd services/daily-content && mvn -B -ntp verify && mvn -q -DskipTests package)
(cd services/daily-content && java -jar target/daily-content-0.1.0-SNAPSHOT.jar \
  --date=2026-10-01 --days=14 --output-dir=target/generated-daily-word)
```

날짜는 운영 시점의 다음 서울 날짜로 바꿉니다. 준비 파일은 `target/` 아래에 있고 Git에 포함되지 않습니다. 준비 범위 7일 미만 경고와 매일 00:00 KST 자동 게시·00:10 공개 확인은 아직 구현되지 않았습니다.

## 3. 수동 게시 경로

CDK의 `DailyWordBucket`은 웹 버킷과 분리되고 버전 관리 및 삭제 보존을 사용합니다. CloudFront의 `/daily-word/*`만 이 버킷을 읽습니다. 웹 배포는 해당 경로를 업로드하거나 삭제하지 않습니다. **새 버킷은 비어 있습니다.** 현재 로컬 화면의 9월 26일·27일 샘플 파일도 배포 대상에서 제외되므로, 후보 승인과 해당 날짜의 게시가 끝나기 전에 이 스택을 배포하면 오늘의 말씀은 자료 없음 상태로 표시됩니다. 배포 전에 실제 당일 파일과 다음 날짜의 승인본을 준비해야 합니다.

AWS 계정에 GitHub Actions OIDC provider가 준비되면 스택에 다음 컨텍스트를 지정해 지정한 환경만 신뢰하는 게시 역할을 만들 수 있습니다. `staging`과 `production`은 서로 다른 스택·버킷·역할을 사용해야 합니다.

```sh
cd infra
pnpm cdk diff -c githubOidcProviderArn=arn:aws:iam::<계정번호>:oidc-provider/token.actions.githubusercontent.com \
  -c githubEnvironment=staging
```

스택 출력 `DailyWordBucketName`과 `DailyWordPublisherRoleArn`을 각각 GitHub 환경의 `DAILY_WORD_BUCKET_NAME`, `DAILY_WORD_PUBLISH_ROLE_ARN` 변수로 설정합니다. `publish-content.yml`은 `main`에서 수동 실행할 때만 OIDC 임시 자격을 받고, 선택한 날짜의 파일을 생성·검증합니다. 게시 스크립트는 `If-None-Match: *`로 새 날짜만 쓰며 동일 SHA-256 재시도만 성공 처리합니다. 다른 내용이 이미 있으면 정정 작업으로 넘깁니다.

로컬 검증만 하려면 `node tools/daily-catalog/publish.mjs --file=<생성 파일> --catalog=<승인 카탈로그> --bucket=<대상 버킷>`을 실행합니다. 실제 S3 쓰기에는 `--publish`를 명시해야 합니다. 이 명령은 권리 승인을 추정하지 않고 카탈로그 승인 기록과 파일의 본문·해설·버전을 대조합니다.

## 4. 남은 운영 조건

1. 콘텐츠 담당자가 후보 본문·해설·권리를 실제로 검토하고 승인합니다. 현재 후보에는 이를 대행할 수 있는 근거가 없습니다.
2. AWS 계정·리전·예산 알림·도메인을 정하고 비용표를 갱신한 뒤 인프라를 배포합니다. 기존 QT 인프라는 현재 CDK 스택에 그대로 있으므로 배포 산출물과 비용을 함께 검토해야 합니다.
3. 일정 실행, 실패 알림, 공개 URL의 날짜 검증, 최소 7일 재고 알림과 정정/롤백 절차를 운영 환경에 연결합니다. 현재 워크플로는 수동 게시만 합니다.
4. 게시 후에는 해당 날짜 URL, 구약·신약 본문과 해설, 누적 방문 응답, 모바일 화면과 인쇄 결과를 실제 환경에서 확인합니다.

현재 화면에서 쓰는 낮·밤 배경과 양피지 이미지 4개는 WebP로 변환해 합계 약 8.7MB에서 1.7MB로 줄였습니다. 원본 PNG는 편집용으로 저장소에 남기고 웹 배포 자산에서는 제외합니다. 화면은 WebP를 요청합니다.
현재 구조의 비용 시나리오는 `node infra/cost/current-model.mjs`로 확인할 수 있습니다. 예전 QT 수집 중심 비용표와 구분해 읽어야 합니다.
