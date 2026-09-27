// 개인 진도·계획 관련 리소스가 없음을 검증한다(PRD SESSION01, IMPLEMENTATION_PLAN M4).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { build, resourcesOfType } from './helpers.js';

const WITH_EMAIL = { alertEmail: 'alerts@example.com' };

/** 이 스택에 허용된 리소스 유형. 새 유형이 필요하면 이 목록과 함께 리뷰한다(개인 데이터 저장소가 아닌지 확인). */
const ALLOWED_TYPES = new Set([
  'AWS::ApiGatewayV2::Api',
  'AWS::ApiGatewayV2::Integration',
  'AWS::ApiGatewayV2::Route',
  'AWS::ApiGatewayV2::Stage',
  'AWS::Budgets::Budget',
  'AWS::CDK::Metadata',
  'AWS::CloudFront::CachePolicy',
  'AWS::CloudFront::Distribution',
  'AWS::CloudFront::Function',
  'AWS::CloudFront::OriginAccessControl',
  'AWS::CloudFront::ResponseHeadersPolicy',
  'AWS::CloudWatch::Alarm',
  'AWS::DynamoDB::Table',
  'AWS::IAM::Policy',
  'AWS::IAM::Role',
  'AWS::Lambda::Function',
  'AWS::Lambda::Permission',
  'AWS::Logs::LogGroup',
  'AWS::S3::Bucket',
  'AWS::S3::BucketPolicy',
  'AWS::Scheduler::Schedule',
  'AWS::SNS::Subscription',
  'AWS::SNS::Topic',
  'Custom::S3AutoDeleteObjects',
]);

const PERSONAL = /progress|진도|plan|계획|reading|readrange|bookmark|profile|member|user|account|session|login|cognito|memo|note/i;

test('허용 목록 밖의 리소스 유형이 없다(데이터베이스·큐·인증 서비스 포함 금지)', () => {
  const { json } = build(WITH_EMAIL);
  const extra = Object.values(json.Resources)
    .map((r) => r.Type)
    .filter((t) => !ALLOWED_TYPES.has(t));
  assert.deepEqual(extra, []);
});

test('DynamoDB 테이블은 QT 공통 데이터와 익명 사이트 방문 합계용이며 개인 진도 키가 없다', () => {
  const { json } = build(WITH_EMAIL);
  const tables = resourcesOfType(json, 'AWS::DynamoDB::Table');
  assert.equal(tables.length, 2);
  const props = tables.find(([id]) => id.startsWith('QtItems'))![1].Properties!;
  const keyNames = props.KeySchema.map((k: { AttributeName: string }) => k.AttributeName);
  assert.deepEqual(keyNames, ['providerId', 'providerDate']);
  assert.equal(props.BillingMode, 'PAY_PER_REQUEST');
  assert.equal(props.GlobalSecondaryIndexes, undefined);
  assert.equal(props.TimeToLiveSpecification.Enabled, true);
  const visit = tables.find(([id]) => id.startsWith('SiteVisits'))![1];
  assert.deepEqual(visit.Properties!.KeySchema.map((k: { AttributeName: string }) => k.AttributeName), ['id']);
  assert.equal(visit.Properties!.TimeToLiveSpecification, undefined);
  assert.equal(visit.DeletionPolicy, 'Retain');
  for (const [id, table] of tables) {
    for (const a of table.Properties!.AttributeDefinitions as Array<{ AttributeName: string }>) {
      assert.doesNotMatch(a.AttributeName, PERSONAL);
    }
    assert.doesNotMatch(id, PERSONAL);
    assert.equal(table.Properties!.TableName, undefined); // 고정 이름 없음
  }
});

test('HTTP API는 공통 QT 조회와 익명 방문 1회 기록만 제공한다', () => {
  const { json } = build(WITH_EMAIL);
  const routes = resourcesOfType(json, 'AWS::ApiGatewayV2::Route').map(([, r]) => r.Properties!.RouteKey).sort();
  assert.deepEqual(routes, ['GET /api/qt/today', 'POST /api/visits']);
});

test('논리 ID, 환경 변수 이름에 개인 진도 관련 이름이 없다', () => {
  const { json } = build(WITH_EMAIL);
  for (const id of Object.keys(json.Resources)) assert.doesNotMatch(id, PERSONAL, `논리 ID: ${id}`);
  for (const [, fn] of resourcesOfType(json, 'AWS::Lambda::Function')) {
    for (const key of Object.keys(fn.Properties?.Environment?.Variables ?? {})) {
      assert.doesNotMatch(key, PERSONAL, `환경 변수: ${key}`);
    }
  }
});

test('조회 함수는 DynamoDB 쓰기 권한이 없다', () => {
  const { json } = build(WITH_EMAIL);
  const policies = resourcesOfType(json, 'AWS::IAM::Policy');
  const apiPolicy = policies.find(([id]) => id.startsWith('QtApiFunctionServiceRoleDefaultPolicy'));
  assert.ok(apiPolicy);
  const actions = (apiPolicy[1].Properties!.PolicyDocument.Statement as Array<{ Action: string | string[] }>).flatMap((s) =>
    Array.isArray(s.Action) ? s.Action : [s.Action],
  );
  for (const a of actions) assert.doesNotMatch(a, /PutItem|UpdateItem|DeleteItem|BatchWriteItem/);
});

test('템플릿과 환경 변수에 비밀 값이 없다', () => {
  const { json } = build({ ...WITH_EMAIL, qtAcquisitionEnabled: 'true' });
  const text = JSON.stringify(json);
  assert.doesNotMatch(text, /sk-ant-|AKIA[0-9A-Z]{16}|-----BEGIN|SecretString|"Type":"AWS::SecretsManager/i);
});

test('모든 로그 그룹에 보존 기간이 있고 무기한이 아니다', () => {
  const { json } = build(WITH_EMAIL);
  const groups = resourcesOfType(json, 'AWS::Logs::LogGroup');
  assert.equal(groups.length, 3);
  for (const [, g] of groups) assert.equal(g.Properties!.RetentionInDays, 14);
});

test('S3는 공개 접근이 막혀 있고 CloudFront 접속 로그는 꺼져 있다', () => {
  const { json } = build(WITH_EMAIL);
  const bucket = resourcesOfType(json, 'AWS::S3::Bucket')[0]![1].Properties!;
  assert.deepEqual(bucket.PublicAccessBlockConfiguration, {
    BlockPublicAcls: true,
    BlockPublicPolicy: true,
    IgnorePublicAcls: true,
    RestrictPublicBuckets: true,
  });
  const dist = resourcesOfType(json, 'AWS::CloudFront::Distribution')[0]![1].Properties!.DistributionConfig;
  assert.equal(dist.Logging, undefined);
  assert.equal(dist.CacheBehaviors.length, 3);
  const qt = dist.CacheBehaviors.find((b: { PathPattern: string }) => b.PathPattern === '/api/*');
  assert.deepEqual(qt.AllowedMethods, ['GET', 'HEAD']);
});

test('API 캐시 정책은 쿠키·헤더·쿼리 문자열을 캐시 키에 넣지 않는다', () => {
  const { json } = build(WITH_EMAIL);
  const p = resourcesOfType(json, 'AWS::CloudFront::CachePolicy')[0]![1].Properties!.CachePolicyConfig
    .ParametersInCacheKeyAndForwardedToOrigin;
  assert.equal(p.CookiesConfig.CookieBehavior, 'none');
  assert.equal(p.HeadersConfig.HeaderBehavior, 'none');
  assert.equal(p.QueryStringsConfig.QueryStringBehavior, 'none');
});
