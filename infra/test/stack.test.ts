import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Match } from 'aws-cdk-lib/assertions';
import { build, resourcesOfType } from './helpers.js';

const WITH_EMAIL = { alertEmail: 'alerts@example.com' };

test('Lambda는 Java 21 arm64이고 두 함수가 같은 자리표시자 산출물을 쓴다', () => {
  const { json, stack } = build(WITH_EMAIL);
  const fns = resourcesOfType(json, 'AWS::Lambda::Function').filter(([, f]) => f.Properties!.Runtime === 'java21');
  assert.equal(fns.length, 2);
  for (const [, f] of fns) {
    assert.deepEqual(f.Properties!.Architectures, ['arm64']);
    assert.equal(f.Properties!.MemorySize, 1024);
    assert.match(f.Properties!.Description, /PLACEHOLDER|GET|수집/);
  }
  assert.equal(stack.usesPlaceholderAsset, true);
});

test('자리표시자 산출물이면 배포 거부 규칙이 붙고, 실제 산출물 경로를 주면 사라진다', () => {
  const placeholder = build(WITH_EMAIL).json;
  assert.ok(placeholder.Rules && 'RequireRealQtArtifact' in placeholder.Rules);
  assert.ok(placeholder.Parameters && 'QtArtifactConfirmed' in placeholder.Parameters);
  const real = build({ ...WITH_EMAIL, qtLambdaAssetPath: 'test/fixtures/real-artifact' }).json;
  assert.ok(!real.Rules || !('RequireRealQtArtifact' in real.Rules));
});

test('레거시 QT Lambda 계약 이름을 유지하면서 취득·수집은 기본 비활성이다', () => {
  const { json } = build(WITH_EMAIL);
  const api = resourcesOfType(json, 'AWS::Lambda::Function').find(([id]) => id.startsWith('QtApiFunction'))![1].Properties!;
  assert.equal(api.Handler, 'kr.malssumharu.qt.lambda.QtLambdaHandler::handleRequest');
  const env = api.Environment.Variables;
  assert.equal(env.QT_ACQUISITION_ENABLED, 'false'); // 새 화면은 날짜별 정적 콘텐츠와 공식 링크 사용
  assert.equal(env.QT_PROVIDER_MAEIL_SEONGYEONG, 'disabled');
  assert.equal(env.QT_PROVIDER_SAENGMYEONG_UI_SAM, 'disabled');
  assert.equal(env.QT_COLLECTOR_ENABLED, 'disabled');
  assert.equal(env.QT_TABLE_NAME.Ref !== undefined, true);
  const collector = resourcesOfType(json, 'AWS::Lambda::Function').find(([id]) => id.startsWith('QtCollectorFunction'))![1].Properties!;
  assert.equal(collector.Handler, 'kr.malssumharu.qt.lambda.QtCollectHandler::handleRequest');
  assert.ok(collector.Timeout >= 30);
  assert.equal(env.SPRING_CLOUD_FUNCTION_DEFINITION, undefined); // 핸들러가 함수 이름을 고정한다
  assert.equal(api.Timeout, 10);
  assert.ok(api.MemorySize >= 512);
  for (const k of Object.keys(env)) assert.doesNotMatch(k, /JAVA_TOOL_OPTIONS|Xss/);
});

test('레거시 제공처 수집은 기본 off이고 명시적 opt-in일 때만 환경 변수와 스케줄에서 켜진다', () => {
  const defaults = build(WITH_EMAIL);
  const on = build({
    ...WITH_EMAIL,
    providerMaeilSeongyeong: 'true',
    providerSaengmyeongUiSam: 'true',
    collectorEnabled: 'true',
    qtAcquisitionEnabled: 'true',
  });
  const env = (b: ReturnType<typeof build>) =>
    resourcesOfType(b.json, 'AWS::Lambda::Function').find(([id]) => id.startsWith('QtApiFunction'))![1].Properties!.Environment.Variables;
  const off = build({
    ...WITH_EMAIL,
    providerMaeilSeongyeong: 'false',
    providerSaengmyeongUiSam: 'false',
    collectorEnabled: 'false',
    qtAcquisitionEnabled: 'false',
  });
  assert.equal(env(off).QT_PROVIDER_MAEIL_SEONGYEONG, 'disabled');
  assert.equal(env(off).QT_PROVIDER_SAENGMYEONG_UI_SAM, 'disabled');
  assert.equal(env(off).QT_COLLECTOR_ENABLED, 'disabled');
  assert.equal(env(off).QT_ACQUISITION_ENABLED, 'false');
  assert.equal(env(defaults).QT_ACQUISITION_ENABLED, 'false');
  assert.equal(env(defaults).QT_PROVIDER_MAEIL_SEONGYEONG, 'disabled');
  assert.equal(env(defaults).QT_PROVIDER_SAENGMYEONG_UI_SAM, 'disabled');
  assert.equal(env(defaults).QT_COLLECTOR_ENABLED, 'disabled');
  const cron = (b: ReturnType<typeof build>) =>
    resourcesOfType(b.json, 'AWS::Scheduler::Schedule')
      .map(([, r]) => `${r.Properties!.ScheduleExpression} ${r.Properties!.ScheduleExpressionTimezone} ${r.Properties!.State}`)
      .sort();
  assert.deepEqual(cron(on), [
    'cron(0 12 * * ? *) Asia/Seoul ENABLED',
    'cron(0 6 * * ? *) Asia/Seoul ENABLED',
    'cron(35 0 * * ? *) Asia/Seoul ENABLED',
    'cron(5 0 * * ? *) Asia/Seoul ENABLED',
  ]); // 하루 4회(00:05, 00:35, 06:00, 12:00 KST)
  assert.ok(cron(defaults).every((c) => c.endsWith('DISABLED')));
  assert.ok(cron(off).every((c) => c.endsWith('DISABLED')));
});

test('예산은 알림 이메일이 있을 때만 만들고 알림 전용(EMAIL)이다', () => {
  const none = build();
  none.template.resourceCountIs('AWS::Budgets::Budget', 0);
  none.template.resourceCountIs('AWS::SNS::Topic', 0);
  const withEmail = build(WITH_EMAIL);
  withEmail.template.resourceCountIs('AWS::Budgets::Budget', 1);
  const budget = resourcesOfType(withEmail.json, 'AWS::Budgets::Budget')[0]![1].Properties!;
  assert.equal(budget.Budget.BudgetLimit.Unit, 'USD');
  assert.equal(budget.Budget.BudgetLimit.Amount, 6);
  const subs = (budget.NotificationsWithSubscribers as Array<{ Subscribers: Array<{ SubscriptionType: string }> }>).flatMap((n) => n.Subscribers);
  assert.ok(subs.length >= 3);
  for (const s of subs) assert.equal(s.SubscriptionType, 'EMAIL'); // 동작(action)이나 SNS 자동 차단 없음
  assert.equal(resourcesOfType(withEmail.json, 'AWS::Budgets::BudgetsAction').length, 0);
});

test('알람은 3개다(비용표 가정)', () => {
  build(WITH_EMAIL).template.resourceCountIs('AWS::CloudWatch::Alarm', 3);
});

test('HTTP API 기본 스테이지에 요청 제한이 있고 액세스 로그는 없다', () => {
  const { template } = build(WITH_EMAIL);
  template.hasResourceProperties('AWS::ApiGatewayV2::Stage', {
    DefaultRouteSettings: { ThrottlingRateLimit: 20, ThrottlingBurstLimit: 40 },
    AccessLogSettings: Match.absent(),
  });
});

test('비밀 저장소와 SSM 읽기 권한이 없다(지금 서비스는 비밀이 필요 없다)', () => {
  const { json, template } = build(WITH_EMAIL);
  assert.ok(!JSON.stringify(json).includes('ssm:'));
  template.resourceCountIs('AWS::SecretsManager::Secret', 0);
});

test('설정 검증: 잘못된 값은 합성 전에 거부된다', () => {
  assert.throws(() => build({ logRetentionDays: '365' }), /logRetentionDays/);
  assert.throws(() => build({ collectorTimesKst: '25:00' }), /collectorTimesKst/);
  assert.throws(() => build({ collectorTimesKst: '06:00,06:00' }), /중복/);
  assert.throws(() => build({ lambdaMemoryMb: '256' }), /lambdaMemoryMb/);
  assert.throws(() => build({ lambdaTimeoutSeconds: '60' }), /lambdaTimeoutSeconds/);
  assert.throws(() => build({ collectorTimeoutSeconds: '10' }), /collectorTimeoutSeconds/);
  assert.throws(() => build({ alertEmail: 'not-an-email' }), /alertEmail/);
  assert.throws(() => build({ apiCacheDefaultTtlSeconds: '600' }), /apiCacheMaxTtlSeconds/);
  assert.throws(() => build({ budgetMonthlyUsd: '0' }), /budgetMonthlyUsd/);
});

test('웹 산출물 폴더가 없으면 배포 리소스를 만들지 않는다(합성은 통과)', () => {
  const { json } = build({ ...WITH_EMAIL, webDistPath: 'test/fixtures/does-not-exist' });
  assert.equal(resourcesOfType(json, 'Custom::CDKBucketDeployment').length, 0);
});

test('웹 산출물 폴더가 있으면 정적 파일 배포 리소스가 붙는다', () => {
  const { json } = build({ ...WITH_EMAIL, webDistPath: 'test/fixtures/web-dist' });
  const deployment = resourcesOfType(json, 'Custom::CDKBucketDeployment');
  assert.equal(deployment.length, 1);
  assert.deepEqual(deployment[0]![1].Properties!.DistributionPaths, ['/index.html', '/daily-word/*']);
});

test('날짜별 JSON도 정적 S3 경로로 제공되고 SPA 재작성 대상에서 제외된다', () => {
  const { json } = build({ ...WITH_EMAIL, webDistPath: 'test/fixtures/web-dist' });
  const rewrite = resourcesOfType(json, 'AWS::CloudFront::Function').find(([id]) => id.startsWith('SpaRewrite'))![1].Properties!.FunctionCode;
  assert.match(rewrite, /uri\.indexOf\('\.'\) === -1/);
  assert.match(rewrite, /request\.uri = '\/index\.html'/);
  // 날짜별 .json 요청은 확장자를 가지므로 SPA fallback을 통과하고, 같은 배포에서 edge cache도 무효화된다.
  const deployment = resourcesOfType(json, 'Custom::CDKBucketDeployment')[0]![1].Properties!;
  assert.ok((deployment.DistributionPaths as string[]).includes('/daily-word/*'));
});

test('CloudFront /api/* 동작과 기본 동작이 분리되어 있고 SPA 재작성 함수는 기본 동작에만 붙는다', () => {
  const { json } = build(WITH_EMAIL);
  const cfg = resourcesOfType(json, 'AWS::CloudFront::Distribution')[0]![1].Properties!.DistributionConfig;
  assert.equal(cfg.DefaultCacheBehavior.FunctionAssociations.length, 1);
  const qt = cfg.CacheBehaviors.find((b: { PathPattern: string }) => b.PathPattern === '/api/*');
  assert.ok(qt);
  assert.equal(qt.FunctionAssociations, undefined);
  assert.equal(cfg.PriceClass, 'PriceClass_200');
});

test('비공개 시험 운영 표시: 스택 태그·출력에 명시되고, 취득을 끄면 사라진다', () => {
  const on = build({ ...WITH_EMAIL, qtAcquisitionEnabled: 'true' });
  assert.ok(JSON.stringify(on.json.Outputs).includes('provider permission unconfirmed'));
  const tags = resourcesOfType(on.json, 'AWS::DynamoDB::Table')[0]![1].Properties!.Tags as Array<{ Key: string; Value: string }>;
  assert.ok(tags.some((t) => t.Key === 'stage' && t.Value === 'private-preview'));
  assert.ok(tags.some((t) => t.Key === 'provider-permission' && t.Value === 'unconfirmed'));
  const off = build(WITH_EMAIL);
  assert.ok(!JSON.stringify(off.json.Outputs).includes('unconfirmed'));
});

test('검색 엔진 비노출: 모든 CloudFront 동작이 X-Robots-Tag noindex 헤더 정책을 쓴다', () => {
  const { json } = build(WITH_EMAIL);
  const policies = resourcesOfType(json, 'AWS::CloudFront::ResponseHeadersPolicy');
  assert.equal(policies.length, 1);
  const custom = policies[0]![1].Properties!.ResponseHeadersPolicyConfig.CustomHeadersConfig.Items;
  assert.deepEqual(custom, [{ Header: 'X-Robots-Tag', Value: 'noindex, nofollow', Override: true }]);
  const cfg = resourcesOfType(json, 'AWS::CloudFront::Distribution')[0]![1].Properties!.DistributionConfig;
  const ref = JSON.stringify(policies[0]![0]);
  for (const b of [cfg.DefaultCacheBehavior, ...cfg.CacheBehaviors]) {
    assert.ok(JSON.stringify(b.ResponseHeadersPolicyId).includes(policies[0]![0]), ref);
  }
});

test('Lambda는 VPC 밖에 있고(NAT 불필요) 쓰기 권한은 QT 수집·방문 카운터에만 있다', () => {
  const { json } = build(WITH_EMAIL);
  const fns = resourcesOfType(json, 'AWS::Lambda::Function');
  for (const [, f] of fns) assert.equal(f.Properties!.VpcConfig, undefined);
  const write = /PutItem|UpdateItem|DeleteItem|BatchWriteItem/;
  const policies = resourcesOfType(json, 'AWS::IAM::Policy');
  const writers = policies.filter(([, p]) => write.test(JSON.stringify(p.Properties!.PolicyDocument))).map(([id]) => id);
  assert.equal(writers.length, 2);
  assert.ok(writers.some((id) => id.startsWith('QtCollectorFunction')));
  assert.ok(writers.some((id) => id.startsWith('VisitApiFunction')));
});

test('DynamoDB 권한은 GetItem/PutItem 으로 한정되고 테이블 ARN 하나에만 붙는다', () => {
  const { json } = build(WITH_EMAIL);
  const actionsOf = (prefix: string) => {
    const pol = resourcesOfType(json, 'AWS::IAM::Policy').find(([id]) => id.startsWith(prefix))![1].Properties!.PolicyDocument.Statement as Array<{
      Action: string | string[];
      Resource: unknown;
    }>;
    return pol.filter((s) => JSON.stringify(s.Action).includes('dynamodb'));
  };
  const api = actionsOf('QtApiFunctionServiceRoleDefaultPolicy');
  assert.equal(api.length, 1);
  assert.deepEqual(api[0]!.Action, 'dynamodb:GetItem');
  const col = actionsOf('QtCollectorFunctionServiceRoleDefaultPolicy');
  assert.equal(col.length, 1);
  assert.deepEqual([...(col[0]!.Action as string[])].sort(), ['dynamodb:GetItem', 'dynamodb:PutItem']);
  for (const s of [...api, ...col]) assert.doesNotMatch(JSON.stringify(s.Resource), /"\*"|index\//);
});
