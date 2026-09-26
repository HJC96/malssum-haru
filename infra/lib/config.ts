import { RetentionDays } from 'aws-cdk-lib/aws-logs';

/**
 * 배포 파라미터. cdk 컨텍스트(`-c 키=값`)로 바꾼다. 비밀 값은 어떤 파라미터로도 받지 않는다.
 * (지금 QT 서비스는 비밀이 필요 없다. 필요해지면 SSM Parameter Store 파라미터 "이름"만 참조한다.)
 * 개인 계획·진도와 관련된 설정은 존재하지 않는다(PRD SESSION01).
 */
export interface StackConfig {
  region: string;
  /** QT Lambda 산출물(jar 또는 zip). 기본값은 자리표시자이며, 배포 전 services/qt 의 -aws.jar 로 바꾼다. */
  qtLambdaAssetPath: string;
  /** services/qt README(T15)가 확정한 핸들러. 함수 이름은 핸들러 클래스가 고정하므로 환경 변수가 필요 없다. */
  qtLambdaHandler: string;
  /** 수집 함수 핸들러(services/qt README T16, 함수 빈 qtCollect). */
  qtCollectorHandler: string;
  /**
   * 레거시 QT 범위 API의 제공처 자동 취득 스위치(QT_ACQUISITION_ENABLED).
   * 현재 메인 화면은 날짜별 정적 말씀 자료와 공식 링크를 사용하므로 기본값은 false다.
   * 별도 private preview에서 제공처 권리 확인 후 명시적으로 켜는 경우에만 true로 둔다.
   */
  qtAcquisitionEnabled: boolean;
  /** 제공처 연동 kill switch. false 로 두면 해당 제공처는 DISABLED 상태가 된다. */
  qtProviders: { maeilSeongyeong: boolean; saengmyeongUiSam: boolean };
  /** 스케줄 수집 켜기/끄기. 끄면 마지막 자료를 오늘로 다시 보여주지 않고 서버가 날짜 불일치를 반환해야 한다. */
  collectorEnabled: boolean;
  /** 레거시 QT 범위 수집 시각. collectorEnabled를 명시적으로 켠 경우에만 스케줄에 사용한다. */
  collectorTimesKst: string[];
  collectorTimeoutSeconds: number;
  /** DynamoDB 테이블을 스택 삭제 후에도 남긴다 */
  retainData: boolean;
  /** QT 일별 항목 보관 일수(TTL). 첫 버전은 오늘만 제공하므로 짧게 둔다 */
  qtItemTtlDays: number;
  apiCacheDefaultTtlSeconds: number;
  apiCacheMaxTtlSeconds: number;
  /** HTTP API 기본 스테이지 스로틀(요청 제한). 추가 요금 없음 */
  apiThrottleRatePerSecond: number;
  apiThrottleBurst: number;
  /** 미설정이면 예약하지 않는다(신규 계정의 동시성 할당량이 낮을 수 있어 기본은 지정 안 함) */
  apiReservedConcurrency?: number;
  lambdaMemoryMb: number;
  lambdaTimeoutSeconds: number;
  logRetentionDays: number;
  /** 월 예산 알림(USD). 알림 전용이며 과금 차단 장치가 아니다 */
  budgetMonthlyUsd: number;
  /** 예산·알람 수신 이메일. 없으면 예산·알림 주체를 만들지 않고 경고를 남긴다 */
  alertEmail?: string;
  /** 빌드된 웹 산출물 경로(web/dist). 폴더가 없으면 배포 자산은 만들지 않는다 */
  webDistPath: string;
}

export const PLACEHOLDER_ASSET = 'assets/qt-placeholder';

export const DEFAULTS: StackConfig = {
  region: 'ap-northeast-2',
  qtLambdaAssetPath: PLACEHOLDER_ASSET,
  qtLambdaHandler: 'kr.malssumharu.qt.lambda.QtLambdaHandler::handleRequest',
  qtCollectorHandler: 'kr.malssumharu.qt.lambda.QtCollectHandler::handleRequest',
  qtAcquisitionEnabled: false,
  collectorEnabled: false,
  collectorTimesKst: ['00:05', '00:35', '06:00', '12:00'],
  collectorTimeoutSeconds: 60,
  retainData: true,
  qtItemTtlDays: 400,
  qtProviders: { maeilSeongyeong: false, saengmyeongUiSam: false },
  apiCacheDefaultTtlSeconds: 60,
  apiCacheMaxTtlSeconds: 300,
  apiThrottleRatePerSecond: 20,
  apiThrottleBurst: 40,
  lambdaMemoryMb: 1024,
  lambdaTimeoutSeconds: 10,
  logRetentionDays: 14,
  budgetMonthlyUsd: 6,
  webDistPath: '../web/dist',
};

const RETENTION: Record<number, RetentionDays> = {
  1: RetentionDays.ONE_DAY,
  3: RetentionDays.THREE_DAYS,
  5: RetentionDays.FIVE_DAYS,
  7: RetentionDays.ONE_WEEK,
  14: RetentionDays.TWO_WEEKS,
  30: RetentionDays.ONE_MONTH,
  60: RetentionDays.TWO_MONTHS,
  90: RetentionDays.THREE_MONTHS,
};

/** 무기한 보관(RetentionDays.INFINITE)은 비용 통제를 위해 허용하지 않는다. */
export function retentionFor(days: number): RetentionDays {
  const r = RETENTION[days];
  if (!r) {
    throw new Error(`logRetentionDays 는 ${Object.keys(RETENTION).join(', ')} 중 하나여야 한다: ${days}`);
  }
  return r;
}

type ContextGetter = (key: string) => unknown;

const asBool = (v: unknown, fallback: boolean): boolean => {
  if (v === undefined || v === null || v === '') return fallback;
  if (typeof v === 'boolean') return v;
  if (v === 'true') return true;
  if (v === 'false') return false;
  throw new Error(`true/false 가 필요하다: ${String(v)}`);
};

const asNum = (v: unknown, fallback: number, name: string): number => {
  if (v === undefined || v === null || v === '') return fallback;
  const n = Number(v);
  if (!Number.isFinite(n)) throw new Error(`${name} 는 숫자여야 한다: ${String(v)}`);
  return n;
};

const asStr = (v: unknown, fallback: string): string =>
  v === undefined || v === null || v === '' ? fallback : String(v);

/** `-c` 컨텍스트에서 설정을 읽어 검증한다. */
export function resolveConfig(get: ContextGetter): StackConfig {
  const alertEmail = asStr(get('alertEmail'), '');
  const reserved = get('apiReservedConcurrency');
  const cfg: StackConfig = {
    region: asStr(get('region'), DEFAULTS.region),
    qtLambdaAssetPath: asStr(get('qtLambdaAssetPath'), DEFAULTS.qtLambdaAssetPath),
    qtLambdaHandler: asStr(get('qtLambdaHandler'), DEFAULTS.qtLambdaHandler),
    qtCollectorHandler: asStr(get('qtCollectorHandler'), DEFAULTS.qtCollectorHandler),
    collectorEnabled: asBool(get('collectorEnabled'), DEFAULTS.collectorEnabled),
    collectorTimesKst:
      typeof get('collectorTimesKst') === 'string' && get('collectorTimesKst') !== ''
        ? String(get('collectorTimesKst')).split(',').map((h) => h.trim())
        : DEFAULTS.collectorTimesKst,
    collectorTimeoutSeconds: asNum(get('collectorTimeoutSeconds'), DEFAULTS.collectorTimeoutSeconds, 'collectorTimeoutSeconds'),
    retainData: asBool(get('retainData'), DEFAULTS.retainData),
    qtItemTtlDays: asNum(get('qtItemTtlDays'), DEFAULTS.qtItemTtlDays, 'qtItemTtlDays'),
    qtAcquisitionEnabled: asBool(get('qtAcquisitionEnabled'), DEFAULTS.qtAcquisitionEnabled),
    qtProviders: {
      maeilSeongyeong: asBool(get('providerMaeilSeongyeong'), DEFAULTS.qtProviders.maeilSeongyeong),
      saengmyeongUiSam: asBool(get('providerSaengmyeongUiSam'), DEFAULTS.qtProviders.saengmyeongUiSam),
    },
    apiCacheDefaultTtlSeconds: asNum(get('apiCacheDefaultTtlSeconds'), DEFAULTS.apiCacheDefaultTtlSeconds, 'apiCacheDefaultTtlSeconds'),
    apiCacheMaxTtlSeconds: asNum(get('apiCacheMaxTtlSeconds'), DEFAULTS.apiCacheMaxTtlSeconds, 'apiCacheMaxTtlSeconds'),
    apiThrottleRatePerSecond: asNum(get('apiThrottleRatePerSecond'), DEFAULTS.apiThrottleRatePerSecond, 'apiThrottleRatePerSecond'),
    apiThrottleBurst: asNum(get('apiThrottleBurst'), DEFAULTS.apiThrottleBurst, 'apiThrottleBurst'),
    apiReservedConcurrency: reserved === undefined || reserved === '' ? undefined : asNum(reserved, 0, 'apiReservedConcurrency'),
    lambdaMemoryMb: asNum(get('lambdaMemoryMb'), DEFAULTS.lambdaMemoryMb, 'lambdaMemoryMb'),
    lambdaTimeoutSeconds: asNum(get('lambdaTimeoutSeconds'), DEFAULTS.lambdaTimeoutSeconds, 'lambdaTimeoutSeconds'),
    logRetentionDays: asNum(get('logRetentionDays'), DEFAULTS.logRetentionDays, 'logRetentionDays'),
    budgetMonthlyUsd: asNum(get('budgetMonthlyUsd'), DEFAULTS.budgetMonthlyUsd, 'budgetMonthlyUsd'),
    alertEmail: alertEmail === '' ? undefined : alertEmail,
    webDistPath: asStr(get('webDistPath'), DEFAULTS.webDistPath),
  };
  validate(cfg);
  return cfg;
}

export function validate(cfg: StackConfig): void {
  if (cfg.collectorTimesKst.length === 0 || cfg.collectorTimesKst.some((t) => !/^([01]\d|2[0-3]):[0-5]\d$/.test(t))) {
    throw new Error(`collectorTimesKst 는 HH:MM(00:00~23:59) 목록이어야 한다: ${cfg.collectorTimesKst.join(',')}`);
  }
  if (new Set(cfg.collectorTimesKst).size !== cfg.collectorTimesKst.length) throw new Error('collectorTimesKst 에 중복이 있다');
  retentionFor(cfg.logRetentionDays);
  if (cfg.apiCacheMaxTtlSeconds < cfg.apiCacheDefaultTtlSeconds) {
    throw new Error('apiCacheMaxTtlSeconds 는 apiCacheDefaultTtlSeconds 이상이어야 한다');
  }
  // qt-backend 권장(T16): 조회는 메모리 512MB 이상, 타임아웃 10초 안팎(DynamoDB 읽기 1회). 수집은 30초 이상(아래)
  if (cfg.lambdaMemoryMb < 512) throw new Error('lambdaMemoryMb 는 512 이상이어야 한다(qt-backend 권장)');
  if (cfg.lambdaTimeoutSeconds < 3 || cfg.lambdaTimeoutSeconds > 30) {
    throw new Error('lambdaTimeoutSeconds 는 3~30 이어야 한다(HTTP API 통합 상한 30초)');
  }
  if (cfg.collectorTimeoutSeconds < 30) {
    throw new Error('collectorTimeoutSeconds 는 30 이상이어야 한다(내부 총 대기 15초 + 저장, qt-backend 권장)');
  }
  if (cfg.budgetMonthlyUsd <= 0) throw new Error('budgetMonthlyUsd 는 0보다 커야 한다');
  if (cfg.alertEmail && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(cfg.alertEmail)) {
    throw new Error(`alertEmail 형식이 올바르지 않다: ${cfg.alertEmail}`);
  }
}
