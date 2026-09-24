// 말씀하루 월 비용 모델(AWS + LLM). 의존성 없음. 실행: node infra/cost/model.mjs [--json]
// 입력: prices.json(공식 Price List에서 생성, fetch-prices.mjs), scenarios.json(가정)
// 결과는 추정이다. 실제 청구와 비교하기 전에는 10,000원 달성을 주장하지 않는다.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const load = (f) => JSON.parse(readFileSync(join(here, f), 'utf8'));

export const prices = load('prices.json');
export const cfg = load('scenarios.json');

const MB_PER_GB = 1024;
const KB_PER_GB = 1024 * 1024;

/** 시나리오의 월간 사용량(가격과 무관) */
export function usage(scn, common = cfg.common, days = cfg.daysPerMonth, override = {}) {
  const s = { ...scn, ...override };
  const monthlyVisits = s.dailyVisits * days;
  const apiRequests = monthlyVisits * s.apiCallsPerVisit;
  const apiOrigin = apiRequests * (1 - s.apiCdnHitRatio); // API Gateway와 Lambda까지 오는 요청
  const staticRequests = monthlyVisits * s.staticRequestsPerVisit;
  const gbSecondsPerInvocation =
    (((1 - s.coldFraction) * common.lambdaApi.warmMs +
      s.coldFraction * (common.lambdaApi.warmMs + common.lambdaApi.coldInitMs)) /
      1000) *
    (common.lambdaApi.memoryMb / 1024);
  const collectorInvocations = common.providers * s.checksPerProviderPerDay * days;
  const collectorGbSeconds =
    collectorInvocations *
    (1 + s.retryFactor) *
    common.collector.secondsPerAttempt *
    (common.collector.memoryMb / 1024);
  const apiGbSeconds = apiOrigin * gbSecondsPerInvocation;
  const logKb = apiOrigin * s.kbPerApiInvocation + collectorInvocations * common.logs.kbPerCollectorInvocation;
  const logIngestGb = logKb / KB_PER_GB;
  const peakRps = (s.dailyVisits * s.apiCallsPerVisit * common.peakHourShare) / 3600;
  return {
    monthlyVisits,
    apiRequests,
    apiOrigin,
    staticRequests,
    cfRequests: staticRequests + apiRequests,
    cfFunctionInvocations: staticRequests, // SPA 경로 재작성 함수는 기본 동작(정적)에만 붙는다
    cfGb: (monthlyVisits * s.staticMbPerVisit) / MB_PER_GB,
    lambdaRequests: apiOrigin + collectorInvocations,
    lambdaGbSeconds: apiGbSeconds + collectorGbSeconds,
    coldStarts: apiOrigin * s.coldFraction,
    collectorInvocations,
    schedulerInvocations: collectorInvocations,
    logIngestGb,
    logStorageGbMonth: logIngestGb * (common.logs.retentionDays / days),
    ddbReadUnits: apiOrigin * common.dynamodb.readUnitsPerApiInvocation,
    ddbWriteUnits: collectorInvocations * common.dynamodb.writeUnitsPerCollectorInvocation,
    s3Gets: staticRequests * common.s3.staticOriginMissRatio,
    peakRps,
    peakApiOriginRps: peakRps * (1 - s.apiCdnHitRatio),
  };
}

const pos = (x) => Math.max(0, x);

/**
 * AWS 월 비용(USD, 세금 전) 항목별.
 * mode 'list' = 무료 구간·크레딧을 전혀 반영하지 않은 정가.
 * mode 'postCredit' = 크레딧은 끝났고 상시 무료(cfg.alwaysFree)만 반영.
 */
export function awsCost(u, region, mode, opts = {}) {
  const P = prices.regions[region];
  const cf = prices.cloudfront;
  const free = mode === 'postCredit' ? cfg.alwaysFree : null;
  const f = (k) => (free ? free[k] : 0);
  const arm = cfg.common.lambdaApi.architecture === 'arm';
  const gbSecPrice = arm ? P.lambda.gbSecondArm : P.lambda.gbSecondX86;
  const items = {};
  items.cloudfrontData = pos(u.cfGb - f('cloudfrontGb')) * cf.dataOutGbFirst10TbAsia;
  items.cloudfrontRequests = pos(u.cfRequests - f('cloudfrontRequests')) * cf.httpsRequestPer;
  items.cloudfrontFunction = pos(u.cfFunctionInvocations - f('cloudfrontFunctionInvocations')) * cf.functionPerInvocation;
  items.apiGateway = u.apiOrigin * P.apiGatewayHttpRequest;
  items.lambdaRequests = pos(u.lambdaRequests - f('lambdaRequests')) * P.lambda.requestUsdPer;
  items.lambdaCompute = pos(u.lambdaGbSeconds - f('lambdaGbSeconds')) * gbSecPrice;
  items.dynamodbReads = u.ddbReadUnits * P.dynamodbOnDemand.readRequestUnit;
  items.dynamodbWrites = u.ddbWriteUnits * P.dynamodbOnDemand.writeRequestUnit;
  items.dynamodbStorage =
    pos(cfg.common.dynamodb.storageGb - f('dynamodbStorageGb')) * P.dynamodbOnDemand.storageGbMonthBeyondFree25;
  items.s3 =
    cfg.common.s3.storageGb * P.s3Standard.storageGbMonthFirst50Tb +
    cfg.common.s3.putRequestsPerMonth * P.s3Standard.putCopyPostListRequest +
    u.s3Gets * P.s3Standard.getRequest;
  items.cloudwatchLogs = u.logIngestGb * P.cloudwatch.logIngestGbStandard + u.logStorageGbMonth * P.cloudwatch.logStorageGbMonth;
  items.cloudwatchAlarms = cfg.common.alarms * P.cloudwatch.standardAlarmMonth;
  items.scheduler =
    pos(u.schedulerInvocations - f('schedulerInvocations')) * P.eventBridgeScheduler.perInvocationAfterFree;
  items.budgetsAndSsmStandard = 0; // Budgets 모니터링과 SSM Standard 파라미터는 추가 요금 없음(공식 페이지)
  if (opts.snapStart) {
    const gb = cfg.common.lambdaApi.memoryMb / 1024;
    const seconds = cfg.daysPerMonth * 86400;
    items.snapStartCache = cfg.optional.snapStartActiveVersions * gb * seconds * P.lambda.snapStartCachedGbSecond;
    items.snapStartRestore = u.coldStarts * gb * P.lambda.snapStartRestoredGb;
  }
  if (opts.secretsManager) items.secretsManager = cfg.optional.secretsManagerUsdPerSecretPerMonth;
  if (opts.route53Zone) items.route53HostedZone = cfg.optional.route53HostedZoneUsdPerMonth;
  const total = Object.values(items).reduce((a, b) => a + b, 0);
  return { items, total };
}

export function llmCost(aiScn, model, { batch = false } = {}) {
  const a = cfg.ai;
  const generations = aiScn.newPassagesPerDay * aiScn.languageCombos * (1 - aiScn.reuseRatio) * (1 + aiScn.retryFactor) * a.days;
  const inTok = a.inputTokens * model.tokenizerFactor;
  const outTok = a.outputTokens * model.tokenizerFactor;
  const perGeneration = (inTok * model.inputPerMTok + outTok * model.outputPerMTok) / 1e6;
  const usd = generations * perGeneration * (batch ? 1 - a.batchDiscount : 1);
  return { generations, perGeneration, usd };
}

export const krw = (usd, fx = cfg.currency.krwPerUsd) => usd * fx * (1 + cfg.currency.vatRate);
const fmt = (n) => Math.round(n).toLocaleString('en-US');
const usdFmt = (n) => (n < 0.01 ? n.toFixed(4) : n.toFixed(2));

const ITEM_LABELS = {
  cloudfrontData: 'CloudFront 전송',
  cloudfrontRequests: 'CloudFront 요청',
  cloudfrontFunction: 'CloudFront Functions',
  apiGateway: 'API Gateway',
  lambdaRequests: 'Lambda 요청',
  lambdaCompute: 'Lambda 실행(arm64)',
  dynamodbReads: 'DynamoDB 읽기',
  dynamodbWrites: 'DynamoDB 쓰기',
  dynamodbStorage: 'DynamoDB 저장',
  s3: 'S3',
  cloudwatchLogs: 'CloudWatch Logs',
  cloudwatchAlarms: 'CloudWatch 알람 3개',
  scheduler: 'EventBridge Scheduler',
  budgetsAndSsmStandard: 'Budgets, SSM Standard(추가 요금 없음)',
  snapStartCache: 'SnapStart 캐시',
  snapStartRestore: 'SnapStart 복원',
  secretsManager: 'Secrets Manager',
  route53HostedZone: 'Route 53 호스팅 영역',
};

/** 문서에 붙이는 Markdown 블록들. 키는 docs/cost-estimate.md 의 model:<key> 마커와 같다. */
export function sections() {
  const names = Object.keys(cfg.scenarios);
  const regions = Object.keys(prices.regions);
  const U = Object.fromEntries(names.map((n) => [n, usage(cfg.scenarios[n])]));
  const head = (first) => `| ${first} | ${names.map((n) => cfg.scenarios[n].label).join(' | ')} |\n| --- | ${names.map(() => '---:').join(' | ')} |`;
  const out = {};
  const budget = cfg.currency.budgetKrw;
  const mark = (v) => `${fmt(v)}${v > budget ? ' (초과)' : ''}`;

  // 1) 합계 판정
  const totalsRows = names.map((n) => {
    const a = krw(awsCost(U[n], 'ap-northeast-2', 'list').total);
    const b = krw(awsCost(U[n], 'ap-northeast-2', 'postCredit').total);
    const h = krw(llmCost(cfg.ai.scenarios[n], cfg.ai.models['claude-haiku-4-5']).usd);
    const s = krw(llmCost(cfg.ai.scenarios[n], cfg.ai.models['claude-sonnet-5']).usd);
    return `| ${cfg.scenarios[n].label} | ${mark(a)} | ${mark(b)} | ${mark(b + h)} | ${mark(a + h)} | ${mark(b + s)} |`;
  });
  out.totals = [
    '| 시나리오 | **AWS 단독, 정가** (주 판정) | **AWS 단독, 크레딧 종료 후** (주 판정) | 참고(AI 보류): 종료 후 + Haiku 4.5 | 참고: 정가 + Haiku 4.5 | 참고: 종료 후 + Sonnet 5 |',
    '| --- | ---: | ---: | ---: | ---: | ---: |',
    ...totalsRows,
  ].join('\n');

  // 2) 사용량
  const usageRows = [
    ['월 방문 수', 'monthlyVisits', 0],
    ['API 호출(엣지 포함)', 'apiRequests', 0],
    ['API Gateway·Lambda 도달(캐시 미스)', 'apiOrigin', 0],
    ['CloudFront 요청(정적+API)', 'cfRequests', 0],
    ['CloudFront 전송(GB)', 'cfGb', 1],
    ['Lambda 요청(API+수집)', 'lambdaRequests', 0],
    ['Lambda GB-초', 'lambdaGbSeconds', 0],
    ['콜드 스타트 수', 'coldStarts', 0],
    ['수집 Lambda 호출(=Scheduler 호출)', 'collectorInvocations', 0],
    ['로그 수집(GB)', 'logIngestGb', 3],
    ['DynamoDB 읽기 단위', 'ddbReadUnits', 0],
    ['DynamoDB 쓰기 단위', 'ddbWriteUnits', 0],
    ['피크 시간 API 요청(초당, 엣지 포함)', 'peakRps', 2],
    ['피크 시간 API 원본 도달(초당)', 'peakApiOriginRps', 2],
  ].map(([label, key, d]) => `| ${label} | ${names.map((n) => (d ? U[n][key].toFixed(d) : fmt(U[n][key]))).join(' | ')} |`);
  out.usage = [head('항목'), ...usageRows].join('\n');

  // 3) AWS 항목별
  for (const [key, mode] of [['awsList', 'list'], ['awsPost', 'postCredit']]) {
    const c = Object.fromEntries(names.map((n) => [n, awsCost(U[n], 'ap-northeast-2', mode)]));
    const rows = Object.keys(c[names[0]].items).map((k) => `| ${ITEM_LABELS[k] ?? k} | ${names.map((n) => usdFmt(c[n].items[k])).join(' | ')} |`);
    rows.push(`| **합계 USD** | ${names.map((n) => '**' + usdFmt(c[n].total) + '**').join(' | ')} |`);
    rows.push(`| **합계 원** (환율 ${fmt(cfg.currency.krwPerUsd)}, 부가세 ${cfg.currency.vatRate * 100}%) | ${names.map((n) => '**' + fmt(krw(c[n].total)) + '**').join(' | ')} |`);
    out[key] = [head('항목 (USD, 세금 전)'), ...rows].join('\n');
  }

  // 4) 리전 비교
  const regionRows = [];
  for (const r of regions) {
    for (const n of names) {
      const a = awsCost(U[n], r, 'list').total;
      const b = awsCost(U[n], r, 'postCredit').total;
      regionRows.push(`| ${prices.regions[r].label} ${r} | ${cfg.scenarios[n].label} | ${fmt(krw(a))} | ${fmt(krw(b))} |`);
    }
  }
  out.regions = ['| 리전 | 시나리오 | 정가 | 크레딧 종료 후 |', '| --- | --- | ---: | ---: |', ...regionRows].join('\n');

  // 5) LLM
  const llmRows = [];
  for (const m of Object.values(cfg.ai.models)) {
    for (const n of names) {
      const r = llmCost(cfg.ai.scenarios[n], m);
      const rb = llmCost(cfg.ai.scenarios[n], m, { batch: true });
      llmRows.push(`| ${m.name} | ${cfg.scenarios[n].label} | ${r.generations.toFixed(0)} | ${r.perGeneration.toFixed(4)} | ${usdFmt(r.usd)} | ${fmt(krw(r.usd))} | ${fmt(krw(rb.usd))} |`);
    }
  }
  out.llm = ['| 모델 | 시나리오 | 월 생성 횟수 | 1회 비용(USD) | 월 USD | 월 원 | 배치 API(50%) 원 |', '| --- | --- | ---: | ---: | ---: | ---: | ---: |', ...llmRows].join('\n');

  // 6) 예산 잔액으로 가능한 생성 횟수(기준 시나리오 AWS 비용을 뺀 뒤)
  const aList = krw(awsCost(U.base, 'ap-northeast-2', 'list').total);
  const aPost = krw(awsCost(U.base, 'ap-northeast-2', 'postCredit').total);
  const room = (a) => Math.max(0, budget - a);
  const roomRows = Object.values(cfg.ai.models).map((m) => {
    const per = krw(llmCost({ newPassagesPerDay: 1, languageCombos: 1, reuseRatio: 0, retryFactor: 0 }, m).usd / cfg.ai.days);
    return `| ${m.name} (${per.toFixed(1)}원) | ${fmt(room(aList))} | ${Math.floor(room(aList) / per)} | ${fmt(room(aPost))} | ${Math.floor(room(aPost) / per)} |`;
  });
  out.aiRoom = ['| 모델 (1회 원) | AWS 정가 기준 잔액(원) | 가능 횟수 | AWS 크레딧 종료 후 기준 잔액(원) | 가능 횟수 |', '| --- | ---: | ---: | ---: | ---: |', ...roomRows].join('\n');

  // 7) 민감도(기준 시나리오, 서울)
  const base = cfg.scenarios.base;
  const cases = [
    ['기준', {}, {}],
    ['API 엣지 캐시 0%', { apiCdnHitRatio: 0 }, {}],
    ['API 엣지 캐시 90%', { apiCdnHitRatio: 0.9 }, {}],
    ['방문당 전송 0.3MB(초기 로드 gzip 150KB 예산 + 여유)', { staticMbPerVisit: 0.3 }, {}],
    ['방문당 전송 0.5MB', { staticMbPerVisit: 0.5 }, {}],
    ['방문당 전송 3MB', { staticMbPerVisit: 3 }, {}],
    ['로그 방문당 20KB(상세 로그)', { kbPerApiInvocation: 20 }, {}],
    ['SnapStart 사용(1GB, 활성 버전 1)', {}, { snapStart: true }],
    ['Secrets Manager 시크릿 1개', {}, { secretsManager: true }],
    ['Route 53 호스팅 영역 1개(도메인 등록비 제외)', {}, { route53Zone: true }],
  ];
  const sensRows = cases.map(([label, ov, opts]) => {
    const u = usage(base, cfg.common, cfg.daysPerMonth, ov);
    return `| ${label} | ${fmt(krw(awsCost(u, 'ap-northeast-2', 'list', opts).total))} | ${fmt(krw(awsCost(u, 'ap-northeast-2', 'postCredit', opts).total))} |`;
  });
  const usdList = awsCost(usage(base), 'ap-northeast-2', 'list').total;
  sensRows.push(`| 환율 ${fmt(cfg.currency.krwPerUsdLatest)}원(2026-09-23 값) | ${fmt(krw(usdList, cfg.currency.krwPerUsdLatest))} | - |`);
  out.sensitivity = ['| 경우 (AWS만, 원) | 정가 | 크레딧 종료 후 |', '| --- | ---: | ---: |', ...sensRows].join('\n');

  // 8) 조정안 효과(정가 기준 방어 가능성)
  const adj = [
    ['기준 그대로', {}],
    ['방문당 전송 0.5MB', { staticMbPerVisit: 0.5 }],
    ['방문당 전송 0.5MB + API 캐시 90%', { staticMbPerVisit: 0.5, apiCdnHitRatio: 0.9 }],
  ];
  const adjRows = [];
  for (const n of ['base', 'surge']) {
    for (const [label, ov] of adj) {
      const u = usage(cfg.scenarios[n], cfg.common, cfg.daysPerMonth, ov);
      const a = krw(awsCost(u, 'ap-northeast-2', 'list').total);
      const b = krw(awsCost(u, 'ap-northeast-2', 'postCredit').total);
      const hb = krw(llmCost(cfg.ai.scenarios[n], cfg.ai.models['claude-haiku-4-5'], { batch: true }).usd);
      const sb = krw(llmCost(cfg.ai.scenarios[n], cfg.ai.models['claude-sonnet-5'], { batch: true }).usd);
      adjRows.push(`| ${cfg.scenarios[n].label} | ${label} | ${fmt(a)} | ${fmt(b)} | ${mark(a + hb)} | ${mark(b + sb)} |`);
    }
  }
  out.adjust = ['| 시나리오 | 조정 | AWS 정가 | AWS 종료 후 | 정가 + Haiku 배치 | 종료 후 + Sonnet 5 배치 |', '| --- | --- | ---: | ---: | ---: | ---: |', ...adjRows].join('\n');

  // 9) CloudFront 정액제 Free 플랜 점검
  const flatRows = names.map((n) => `| ${cfg.scenarios[n].label} | ${fmt(U[n].cfRequests)} | ${(U[n].cfRequests / 1e4).toFixed(0)}% | ${U[n].cfGb.toFixed(1)} | ${U[n].cfGb.toFixed(0)}% |`);
  out.flatPlan = ['| 시나리오 | CloudFront 요청 | 허용량(100만) 대비 | 전송(GB) | 허용량(100GB) 대비 |', '| --- | ---: | ---: | ---: | ---: |', ...flatRows].join('\n');

  out.budgetUsd = `월 예산 ${fmt(budget)}원은 세전 약 ${(budget / cfg.currency.krwPerUsd / (1 + cfg.currency.vatRate)).toFixed(2)}달러(환율 ${fmt(cfg.currency.krwPerUsd)}, 부가세 ${cfg.currency.vatRate * 100}%)다.`;
  return out;
}

function report() {
  const s = sections();
  return Object.entries(s).map(([k, v]) => `## ${k}\n${v}`).join('\n\n');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) console.log(report());
