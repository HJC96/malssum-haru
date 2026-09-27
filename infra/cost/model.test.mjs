// 실행: node --test infra/cost/model.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { usage, awsCost, llmCost, krw, cfg, prices } from './model.mjs';

const scn = {
  dailyVisits: 1000,
  apiCallsPerVisit: 1,
  staticRequestsPerVisit: 10,
  staticMbPerVisit: 1,
  apiCdnHitRatio: 0,
  coldFraction: 0,
  checksPerProviderPerDay: 1,
  retryFactor: 0,
  kbPerApiInvocation: 1,
};

test('사용량 산식', () => {
  const u = usage(scn);
  assert.equal(u.monthlyVisits, 30000);
  assert.equal(u.apiOrigin, 30000);
  assert.equal(u.visitRequests, 30000);
  assert.equal(u.apiGatewayRequests, 60000);
  assert.equal(u.cfRequests, 360000);
  assert.ok(Math.abs(u.cfGb - 30000 / 1024) < 1e-9);
  // QT 웜 4500 GB-s + 방문 128MB*100ms*30000=375 GB-s + 수집 480 GB-s
  assert.ok(Math.abs(u.lambdaGbSeconds - (4500 + 375 + 480)) < 1e-6);
  assert.equal(u.ddbWriteUnits, 30180);
});

test('정가 모드는 CloudFront 전송을 첫 GB부터 청구한다', () => {
  const u = usage(scn);
  const c = awsCost(u, 'ap-northeast-2', 'list');
  assert.ok(Math.abs(c.items.cloudfrontData - (30000 / 1024) * prices.cloudfront.dataOutGbFirst10TbAsia) < 1e-9);
});

test('크레딧 종료 후 모드는 상시 무료만 뺀다', () => {
  const u = usage(scn);
  const c = awsCost(u, 'ap-northeast-2', 'postCredit');
  assert.equal(c.items.cloudfrontData, 0);
  assert.equal(c.items.lambdaCompute, 0);
  assert.ok(c.items.apiGateway > 0); // API Gateway는 상시 무료 아님
  assert.ok(c.items.cloudwatchAlarms > 0);
});

test('AWS 항목에 개인 진도 관련 항목이 없다', () => {
  const c = awsCost(usage(scn), 'ap-northeast-2', 'list');
  for (const k of Object.keys(c.items)) assert.doesNotMatch(k, /progress|plan|user/i);
});

test('LLM 산식(Haiku 4.5: 6000 입력, 2500 출력 토큰)', () => {
  const m = cfg.ai.models['claude-haiku-4-5'];
  const r = llmCost({ newPassagesPerDay: 1, languageCombos: 1, reuseRatio: 0, retryFactor: 0 }, m);
  assert.equal(r.generations, 30);
  assert.ok(Math.abs(r.perGeneration - (6000 * 1 + 2500 * 5) / 1e6) < 1e-12);
  const b = llmCost({ newPassagesPerDay: 1, languageCombos: 1, reuseRatio: 0, retryFactor: 0 }, m, { batch: true });
  assert.ok(Math.abs(b.usd - r.usd / 2) < 1e-12);
});

test('원화 환산은 환율과 부가세를 곱한다', () => {
  assert.ok(Math.abs(krw(1) - cfg.currency.krwPerUsd * (1 + cfg.currency.vatRate)) < 1e-9);
});
