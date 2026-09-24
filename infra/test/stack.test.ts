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

test('핸들러와 취득 스위치가 services/qt README(T15)의 이름과 같다', () => {
  const { json } = build(WITH_EMAIL);
  const api = resourcesOfType(json, 'AWS::Lambda::Function').find(([id]) => id.startsWith('QtApiFunction'))![1].Properties!;
  assert.equal(api.Handler, 'kr.malssumharu.qt.lambda.QtLambdaHandler::handleRequest');
  const env = api.Environment.Variables;
  assert.equal(env.QT_ACQUISITION_ENABLED, 'false'); // 권리 확인 전 기본값
  assert.equal(env.QT_PROVIDERS_MAEILSEONGYEONG_DISABLED, 'false');
  assert.equal(env.QT_PROVIDERS_SAENGMYEONGUISAM_DISABLED, 'false');
  assert.equal(env.SPRING_CLOUD_FUNCTION_DEFINITION, undefined); // 핸들러가 함수 이름을 고정한다
  assert.equal(api.Timeout, 20);
  assert.ok(api.MemorySize >= 512);
  for (const k of Object.keys(env)) assert.doesNotMatch(k, /JAVA_TOOL_OPTIONS|Xss/);
});

test('제공처 스위치와 수집 스케줄 파라미터가 환경 변수와 스케줄에 반영된다', () => {
  const on = build(WITH_EMAIL);
  const env = (b: ReturnType<typeof build>) =>
    resourcesOfType(b.json, 'AWS::Lambda::Function').find(([id]) => id.startsWith('QtApiFunction'))![1].Properties!.Environment.Variables;
  const off = build({
    ...WITH_EMAIL,
    providerMaeilSeongyeong: 'false',
    providerSaengmyeongUiSam: 'false',
    collectorEnabled: 'false',
    qtAcquisitionEnabled: 'true',
  });
  assert.equal(env(off).QT_PROVIDERS_MAEILSEONGYEONG_DISABLED, 'true');
  assert.equal(env(off).QT_PROVIDERS_SAENGMYEONGUISAM_DISABLED, 'true');
  assert.equal(env(off).QT_ACQUISITION_ENABLED, 'true');
  on.template.hasResourceProperties('AWS::Scheduler::Schedule', {
    State: 'ENABLED',
    ScheduleExpressionTimezone: 'Asia/Seoul',
    ScheduleExpression: 'cron(5 0,1,6,12,18,21 * * ? *)',
  });
  off.template.hasResourceProperties('AWS::Scheduler::Schedule', { State: 'DISABLED' });
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
  assert.throws(() => build({ collectorHoursKst: '25' }), /collectorHoursKst/);
  assert.throws(() => build({ lambdaMemoryMb: '256' }), /lambdaMemoryMb/);
  assert.throws(() => build({ lambdaTimeoutSeconds: '10' }), /lambdaTimeoutSeconds/);
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
  assert.equal(resourcesOfType(json, 'Custom::CDKBucketDeployment').length, 1);
});

test('CloudFront /api/* 동작과 기본 동작이 분리되어 있고 SPA 재작성 함수는 기본 동작에만 붙는다', () => {
  const { json } = build(WITH_EMAIL);
  const cfg = resourcesOfType(json, 'AWS::CloudFront::Distribution')[0]![1].Properties!.DistributionConfig;
  assert.equal(cfg.DefaultCacheBehavior.FunctionAssociations.length, 1);
  assert.equal(cfg.CacheBehaviors[0].PathPattern, '/api/*');
  assert.equal(cfg.CacheBehaviors[0].FunctionAssociations, undefined);
  assert.equal(cfg.PriceClass, 'PriceClass_200');
});
