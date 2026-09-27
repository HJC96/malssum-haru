import assert from 'node:assert/strict';
import { test } from 'node:test';
import { build, resourcesOfType } from './helpers.js';

test('site-wide visitor counter is a retained table with a minimal Node Lambda and one atomic-write permission', () => {
  const { json } = build();
  const table = resourcesOfType(json, 'AWS::DynamoDB::Table').find(([id]) => id.startsWith('SiteVisits'))!;
  assert.equal(table[1].DeletionPolicy, 'Retain');
  assert.equal(table[1].Properties!.DeletionProtectionEnabled, true);
  assert.equal(table[1].Properties!.BillingMode, 'PAY_PER_REQUEST');
  assert.equal(table[1].Properties!.TimeToLiveSpecification, undefined);

  const fn = resourcesOfType(json, 'AWS::Lambda::Function').find(([id]) => id.startsWith('VisitApiFunction'))!;
  assert.equal(fn[1].Properties!.Runtime, 'nodejs22.x');
  assert.equal(fn[1].Properties!.Handler, 'index.handler');
  assert.equal(fn[1].Properties!.MemorySize, 128);
  assert.ok(fn[1].Properties!.Environment.Variables.VISIT_TABLE_NAME);
  const policy = resourcesOfType(json, 'AWS::IAM::Policy').find(([id]) => id.startsWith('VisitApiFunctionServiceRoleDefaultPolicy'))!;
  const statements = policy[1].Properties!.PolicyDocument.Statement as Array<{ Action: string | string[]; Resource: unknown }>;
  const dynamo = statements.filter((s) => JSON.stringify(s.Action).includes('dynamodb'));
  assert.equal(dynamo.length, 1);
  assert.deepEqual(dynamo[0]!.Action, 'dynamodb:UpdateItem');
  assert.doesNotMatch(JSON.stringify(dynamo[0]!.Resource), /\"\*\"|index\//);
});

test('POST route and CloudFront behavior accept uncached writes without changing cached QT GET', () => {
  const { json } = build();
  const route = resourcesOfType(json, 'AWS::ApiGatewayV2::Route').find(([, r]) => r.Properties!.RouteKey === 'POST /api/visits');
  assert.ok(route);
  const cfg = resourcesOfType(json, 'AWS::CloudFront::Distribution')[0]![1].Properties!.DistributionConfig;
  const visit = cfg.CacheBehaviors.find((b: { PathPattern: string }) => b.PathPattern === '/api/visits');
  const qt = cfg.CacheBehaviors.find((b: { PathPattern: string }) => b.PathPattern === '/api/*');
  assert.ok(visit);
  assert.ok(qt);
  assert.ok(cfg.CacheBehaviors.findIndex((b: { PathPattern: string }) => b.PathPattern === '/api/visits')
    < cfg.CacheBehaviors.findIndex((b: { PathPattern: string }) => b.PathPattern === '/api/*')); // 더 구체적인 경로가 먼저다.
  assert.equal(visit.CachePolicyId, '4135ea2d-6df8-44a3-9df3-4b5a84be39ad'); // AWS managed CachingDisabled
  assert.ok(visit.AllowedMethods.includes('POST'));
  assert.equal(visit.FunctionAssociations, undefined);
  assert.deepEqual(qt.AllowedMethods, ['GET', 'HEAD']);
});
