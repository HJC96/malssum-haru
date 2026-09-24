// AWS 공식 Price List(공개 벌크 JSON)에서 비용 모델이 쓰는 단가만 뽑아 prices.json 을 만든다.
// 자격 증명이 필요 없다(공개 HTTP GET). 실행: node infra/cost/fetch-prices.mjs
// 가격표 자체는 계정과 무관하므로 AWS 계정에 접근하지 않는다.
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const BASE = 'https://pricing.us-east-1.amazonaws.com/offers/v1.0/aws';
const REGIONS = {
  'ap-northeast-2': { label: '서울', prefix: 'APN2-' },
  'ap-northeast-1': { label: '도쿄', prefix: 'APN1-' },
  'us-east-1': { label: '버지니아 북부', prefix: '' },
};

async function getJson(path) {
  const res = await fetch(`${BASE}/${path}`);
  if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
  return res.json();
}

/** usagetype 이 정확히 일치하는 상품의 OnDemand 가격 차원을 [{begin,end,usd,desc}] 로 반환 */
function tiers(offer, usagetype) {
  const out = [];
  for (const [sku, p] of Object.entries(offer.products)) {
    if (p.attributes?.usagetype !== usagetype) continue;
    for (const term of Object.values(offer.terms.OnDemand?.[sku] ?? {})) {
      for (const pd of Object.values(term.priceDimensions)) {
        out.push({
          begin: Number(pd.beginRange),
          end: pd.endRange === 'Inf' ? Infinity : Number(pd.endRange),
          usd: Number(pd.pricePerUnit.USD),
          desc: pd.description,
        });
      }
    }
  }
  return out.sort((a, b) => a.begin - b.begin);
}

// us-east-1 은 서비스에 따라 usagetype 접두어가 없거나 USE1- 이다.
function withAlt(usagetype) {
  return usagetype.startsWith('APN') ? [usagetype] : [usagetype, `USE1-${usagetype}`];
}

function tiersAny(offer, usagetype) {
  for (const u of withAlt(usagetype)) {
    const t = tiers(offer, u);
    if (t.length) return t;
  }
  return [];
}

function first(offer, usagetype) {
  const t = tiersAny(offer, usagetype);
  if (!t.length) throw new Error(`가격 없음: ${usagetype}`);
  return t[0].usd;
}

/** 무료 구간(0달러) 다음의 첫 유료 단가 */
function firstPaid(offer, usagetype) {
  const t = tiersAny(offer, usagetype).filter((x) => x.usd > 0);
  if (!t.length) throw new Error(`유료 가격 없음: ${usagetype}`);
  return t[0].usd;
}

const prices = {
  checkedOn: '2026-09-24',
  source: `${BASE}/<service>/current/<region>/index.json (AWS Price List Bulk API)`,
  publicationDates: {},
  regions: {},
  cloudfront: {},
};

for (const [region, { label, prefix }] of Object.entries(REGIONS)) {
  const [lambda, apigw, ddb, s3, cw] = await Promise.all([
    getJson(`AWSLambda/current/${region}/index.json`),
    getJson(`AmazonApiGateway/current/${region}/index.json`),
    getJson(`AmazonDynamoDB/current/${region}/index.json`),
    getJson(`AmazonS3/current/${region}/index.json`),
    getJson(`AmazonCloudWatch/current/${region}/index.json`),
  ]);
  const events = await getJson(`AWSEvents/current/${region}/index.json`);
  prices.publicationDates[region] = {
    lambda: lambda.publicationDate,
    apigw: apigw.publicationDate,
    dynamodb: ddb.publicationDate,
    s3: s3.publicationDate,
    cloudwatch: cw.publicationDate,
    events: events.publicationDate,
  };
  const p = prefix;
  prices.regions[region] = {
    label,
    lambda: {
      requestUsdPer: first(lambda, `${p}Request`),
      gbSecondX86: first(lambda, `${p}Lambda-GB-Second`),
      gbSecondArm: first(lambda, `${p}Lambda-GB-Second-ARM`),
      snapStartCachedGbSecond: first(lambda, `${p}Lambda-SnapStart-Cached-GB-S`),
      snapStartRestoredGb: first(lambda, `${p}Lambda-SnapStart-Restored-GB`),
    },
    apiGatewayHttpRequest: first(apigw, `${p}ApiGatewayHttpRequest`),
    dynamodbOnDemand: {
      writeRequestUnit: first(ddb, `${p}WriteRequestUnits`),
      readRequestUnit: first(ddb, `${p}ReadRequestUnits`),
      storageGbMonthBeyondFree25: firstPaid(ddb, `${p}TimedStorage-ByteHrs`),
    },
    s3Standard: {
      storageGbMonthFirst50Tb: first(s3, `${p}TimedStorage-ByteHrs`),
      putCopyPostListRequest: first(s3, `${p}Requests-Tier1`),
      getRequest: first(s3, `${p}Requests-Tier2`),
    },
    cloudwatch: {
      logIngestGbStandard: first(cw, `${p}DataProcessing-Bytes`),
      logStorageGbMonth: first(cw, `${p}TimedStorage-ByteHrs`),
      standardAlarmMonth: first(cw, `${p}CW:AlarmMonitorUsage`),
    },
    eventBridgeScheduler: {
      freeInvocationsPerMonth: 14_000_000,
      perInvocationAfterFree: firstPaid(events, `${p}ScheduledInvocation`),
    },
  };
}

// CloudFront: 요금은 엣지 위치 그룹별(리전 무관). 한국은 "Asia" 그룹(공식 페이지 표의 South Korea 열).
const cf = await getJson('AmazonCloudFront/current/index.json');
prices.publicationDates.cloudfront = cf.publicationDate;
prices.cloudfront = {
  edgeGroupKorea: 'Asia Pacific 그룹(Hong Kong, Indonesia, Philippines, Singapore, South Korea, Taiwan, Thailand, Malaysia, Vietnam)',
  httpsRequestPer: first(cf, 'AP-Requests-Tier2-HTTPS'),
  dataOutGbFirst10TbAsia: first(cf, 'AP-DataTransfer-Out-Bytes'),
  dataOutGbFirst10TbJapan: first(cf, 'JP-DataTransfer-Out-Bytes'),
  dataOutGbFirst10TbUs: first(cf, 'US-DataTransfer-Out-Bytes'),
  functionPerInvocation: firstPaid(cf, 'Executions-CloudFrontFunctions'),
  alwaysFree: { dataTransferOutGb: 1024, requests: 10_000_000, functionInvocations: 2_000_000 },
};

const here = dirname(fileURLToPath(import.meta.url));
writeFileSync(join(here, 'prices.json'), JSON.stringify(prices, null, 2) + '\n');
console.log('wrote prices.json');
