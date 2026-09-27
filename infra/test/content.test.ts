import assert from 'node:assert/strict';
import { test } from 'node:test';
import { build, resourcesOfType } from './helpers.js';

const providerArn = 'arn:aws:iam::123456789012:oidc-provider/token.actions.githubusercontent.com';

test('기본 인프라는 콘텐츠 버킷을 보존하지만 GitHub 게시 역할을 만들지 않는다', () => {
  const { json } = build();
  const bucket = resourcesOfType(json, 'AWS::S3::Bucket').find(([id]) => id.startsWith('DailyWordBucket'))!;
  assert.equal(bucket[1].DeletionPolicy, 'Retain');
  assert.equal(bucket[1].Properties!.VersioningConfiguration.Status, 'Enabled');
  assert.equal(resourcesOfType(json, 'AWS::IAM::Role').filter(([id]) => id.startsWith('DailyWordPublisherRole')).length, 0);
});

test('게시 역할은 지정한 GitHub 환경만 신뢰하고 날짜별 객체에만 권한을 준다', () => {
  const { json } = build({ githubOidcProviderArn: providerArn, githubEnvironment: 'production' });
  const role = resourcesOfType(json, 'AWS::IAM::Role').find(([id]) => id.startsWith('DailyWordPublisherRole'))!;
  const trust = JSON.stringify(role[1].Properties!.AssumeRolePolicyDocument);
  assert.match(trust, /repo:HJC96\/malssum-haru:environment:production/);
  assert.match(trust, /sts.amazonaws.com/);
  assert.doesNotMatch(trust, /environment:staging/);
  const policy = resourcesOfType(json, 'AWS::IAM::Policy').find(([id]) => id.startsWith('DailyWordPublisherRole'))!;
  const statements = policy[1].Properties!.PolicyDocument.Statement;
  assert.deepEqual(statements[0].Action, ['s3:PutObject', 's3:GetObject']);
  assert.match(JSON.stringify(statements[0].Resource), /daily-word\/\*/);
  assert.doesNotMatch(JSON.stringify(statements), /s3:DeleteObject|s3:ListBucket/);
});

test('게시 역할 설정은 provider ARN과 GitHub 환경을 둘 다 요구한다', () => {
  assert.throws(() => build({ githubEnvironment: 'production' }), /githubOidcProviderArn/);
  assert.throws(() => build({ githubOidcProviderArn: providerArn }), /githubEnvironment/);
});
