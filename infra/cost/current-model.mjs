// Current product estimate: static web + approved daily content + one visit API.
// Price snapshot is infra/cost/prices.json (2026-09-24); refresh before any AWS deployment.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const prices = JSON.parse(readFileSync(join(here, 'prices.json'), 'utf8'));
const region = prices.regions['ap-northeast-2'];
const cf = prices.cloudfront;
const GB = 1024;
const scenarios = {
  low: { dailyViews: 100, mbPerView: 1 },
  base: { dailyViews: 1000, mbPerView: 3 },
  surge: { dailyViews: 10000, mbPerView: 6 },
};

export function estimate({ dailyViews, mbPerView }, { useAlwaysFree = false } = {}) {
  if (!Number.isFinite(dailyViews) || dailyViews < 0 || !Number.isFinite(mbPerView) || mbPerView < 0) {
    throw new RangeError('dailyViews and mbPerView must be nonnegative finite numbers');
  }
  const views = dailyViews * 30;
  const batchRuns = 60; // preparation and publication once per day each; future target, not deployed code
  const cfRequests = views * 17; // 15 static + 1 daily JSON + 1 visit POST
  const cfFunction = views * 15; // SPA rewrite on default static behavior only
  const transferredGb = views * mbPerView / GB;
  const lambdaRequests = views + batchRuns;
  const lambdaGbSeconds = views * 0.1 * 0.125 + batchRuns * 5;
  const s3Reads = views * 16 * 0.03;
  const free = useAlwaysFree ? cf.alwaysFree : { dataTransferOutGb: 0, requests: 0, functionInvocations: 0 };
  const items = {
    cloudfrontData: Math.max(0, transferredGb - free.dataTransferOutGb) * cf.dataOutGbFirst10TbAsia,
    cloudfrontRequests: Math.max(0, cfRequests - free.requests) * cf.httpsRequestPer,
    cloudfrontFunction: Math.max(0, cfFunction - free.functionInvocations) * cf.functionPerInvocation,
    apiGateway: views * region.apiGatewayHttpRequest,
    lambdaRequests: Math.max(0, lambdaRequests - (useAlwaysFree ? 1_000_000 : 0)) * region.lambda.requestUsdPer,
    lambdaCompute: Math.max(0, lambdaGbSeconds - (useAlwaysFree ? 400_000 : 0)) * region.lambda.gbSecondArm,
    dynamodbWrites: views * region.dynamodbOnDemand.writeRequestUnit,
    s3: 0.1 * region.s3Standard.storageGbMonthFirst50Tb
      + 480 * region.s3Standard.putCopyPostListRequest
      + s3Reads * region.s3Standard.getRequest,
    cloudwatch: (views * 0.5 / (GB * GB)) * region.cloudwatch.logIngestGbStandard
      + 3 * region.cloudwatch.standardAlarmMonth,
    scheduler: Math.max(0, batchRuns - region.eventBridgeScheduler.freeInvocationsPerMonth)
      * region.eventBridgeScheduler.perInvocationAfterFree,
  };
  return {
    views, transferredGb, items,
    usd: Object.values(items).reduce((sum, value) => sum + value, 0),
  };
}

export const currencyKrw = (usd) => usd * 1560 * 1.1; // conservative snapshot assumption, not a live FX quote

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const result = Object.fromEntries(Object.entries(scenarios).map(([name, scenario]) => {
    const list = estimate(scenario);
    const afterFree = estimate(scenario, { useAlwaysFree: true });
    return [name, { ...scenario, gbTransferred: list.transferredGb,
      monthlyKrwList: Math.round(currencyKrw(list.usd)),
      monthlyKrwWithAlwaysFree: Math.round(currencyKrw(afterFree.usd)) }];
  }));
  console.log(JSON.stringify(result, null, 2));
}
