import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  Annotations,
  CfnOutput,
  CfnParameter,
  CfnRule,
  Duration,
  Fn,
  RemovalPolicy,
  Stack,
  type StackProps,
  Tags,
  TimeZone,
} from 'aws-cdk-lib';
import * as apigwv2 from 'aws-cdk-lib/aws-apigatewayv2';
import { HttpLambdaIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import * as budgets from 'aws-cdk-lib/aws-budgets';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as cwActions from 'aws-cdk-lib/aws-cloudwatch-actions';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import * as scheduler from 'aws-cdk-lib/aws-scheduler';
import * as targets from 'aws-cdk-lib/aws-scheduler-targets';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as subs from 'aws-cdk-lib/aws-sns-subscriptions';
import type { Construct } from 'constructs';
import { PLACEHOLDER_ASSET, type StackConfig, retentionFor } from './config.js';

const INFRA_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export type MalssumStackProps = StackProps & { config: StackConfig };

/**
 * 말씀하루 서버리스 스택: S3+CloudFront(정적 웹, /api/* 는 HTTP API), Lambda(Java 21, arm64),
 * QT 공통 데이터 DynamoDB, EventBridge Scheduler 수집, 로그 보존, 예산·알람.
 *
 * 만들지 않는 것(PRD SESSION01, IMPLEMENTATION_PLAN M4):
 * - 개인 계획·읽은 범위·진도를 담는 테이블, API, 저장소. 사용자 식별·인증 리소스(Cognito 등).
 * - 상시 실행 서버, VPC/NAT, WAF, Secrets Manager 시크릿(SSM Parameter Store 이름만 참조).
 */
export class MalssumStack extends Stack {
  readonly table: dynamodb.Table;
  readonly apiFunction: lambda.Function;
  readonly collectorFunction: lambda.Function;
  readonly api: apigwv2.HttpApi;
  readonly distribution: cloudfront.Distribution;
  readonly webBucket: s3.Bucket;
  readonly usesPlaceholderAsset: boolean;

  constructor(scope: Construct, id: string, props: MalssumStackProps) {
    super(scope, id, props);
    const cfg = props.config;
    Tags.of(this).add('project', 'malssum-haru');
    if (cfg.qtAcquisitionEnabled) {
      // 자동 취득이 켜진 배포임을 리소스에서 바로 알 수 있게 한다.
      Tags.of(this).add('stage', 'private-preview');
      Tags.of(this).add('provider-permission', 'unconfirmed');
    }

    // --- QT 공통 데이터. 개인 진도 테이블은 만들지 않는다. 키는 계약의 재수집 키 (providerId, providerDate) ---
    this.table = new dynamodb.Table(this, 'QtItems', {
      partitionKey: { name: 'providerId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'providerDate', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      timeToLiveAttribute: 'expiresAt',
      deletionProtection: cfg.retainData,
      removalPolicy: cfg.retainData ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY,
    });

    // --- Lambda(Java 21, arm64). 산출물은 services/qt 빌드 결과로 교체 ---
    this.usesPlaceholderAsset = cfg.qtLambdaAssetPath === PLACEHOLDER_ASSET;
    const code = lambda.Code.fromAsset(resolve(INFRA_ROOT, cfg.qtLambdaAssetPath));
    const bool = (v: boolean) => String(v);
    const enabled = (v: boolean) => (v ? 'enabled' : 'disabled');
    const commonEnv: Record<string, string> = {
      // 이름은 services/qt README(T15·T16)와 같다. 기본 true 는 비공개 시험 운영 결정이며 제공처 권한은 미확인이다.
      QT_ACQUISITION_ENABLED: bool(cfg.qtAcquisitionEnabled),
      // kill switch: true 이면 해당 제공처는 계약의 DISABLED / OPERATOR_DISABLED 로 응답한다.
      // 제공처 kill switch. 'disabled' 이면 해당 제공처는 계약의 DISABLED / OPERATOR_DISABLED 로 응답한다.
      QT_PROVIDER_MAEIL_SEONGYEONG: enabled(cfg.qtProviders.maeilSeongyeong),
      QT_PROVIDER_SAENGMYEONG_UI_SAM: enabled(cfg.qtProviders.saengmyeongUiSam),
      QT_COLLECTOR_ENABLED: enabled(cfg.collectorEnabled),
      // QT_TABLE_NAME 이 있으면 서비스는 배포 모드(DynamoDB)로 동작한다(T16).
      QT_TABLE_NAME: this.table.tableName,
      QT_ITEM_TTL_DAYS: String(cfg.qtItemTtlDays),
      // 로그에는 본문 전문과 개인 입력을 남기지 않는다. 기본 INFO 이하
      LOGGING_LEVEL_ROOT: 'INFO',
      // JVM 스택 옵션(-Xss 등)은 넣지 않는다: -Xss512k 에서 로컬 기동 실패가 관찰됨(lead 확인).
    };
    const retention = retentionFor(cfg.logRetentionDays);
    const description = this.usesPlaceholderAsset ? 'PLACEHOLDER ASSET - 배포 금지: services/qt 산출물로 교체 필요' : undefined;

    const apiLogs = new logs.LogGroup(this, 'QtApiLogs', { retention, removalPolicy: RemovalPolicy.DESTROY });
    this.apiFunction = new lambda.Function(this, 'QtApiFunction', {
      description: description ?? 'GET /api/qt/today (배포 모드에서는 DynamoDB 읽기만, 제공처 요청 없음)',
      runtime: lambda.Runtime.JAVA_21,
      architecture: lambda.Architecture.ARM_64,
      handler: cfg.qtLambdaHandler,
      code,
      memorySize: cfg.lambdaMemoryMb,
      timeout: Duration.seconds(cfg.lambdaTimeoutSeconds),
      reservedConcurrentExecutions: cfg.apiReservedConcurrency,
      logGroup: apiLogs,
      environment: commonEnv,
    });
    // 최소 권한(qt-backend T16): 조회는 GetItem 만, Query/Scan/GSI 는 쓰지 않는다.
    this.table.grant(this.apiFunction, 'dynamodb:GetItem');

    const collectorLogs = new logs.LogGroup(this, 'QtCollectorLogs', { retention, removalPolicy: RemovalPolicy.DESTROY });
    this.collectorFunction = new lambda.Function(this, 'QtCollectorFunction', {
      description: description ?? 'QT 오늘 장절 수집(스케줄 호출 전용)',
      runtime: lambda.Runtime.JAVA_21,
      architecture: lambda.Architecture.ARM_64,
      handler: cfg.qtCollectorHandler,
      code,
      memorySize: cfg.lambdaMemoryMb,
      timeout: Duration.seconds(cfg.collectorTimeoutSeconds),
      logGroup: collectorLogs,
      environment: commonEnv,
    });
    this.table.grant(this.collectorFunction, 'dynamodb:GetItem', 'dynamodb:PutItem');

    // --- HTTP API. 라우트는 QT 공통 조회 하나뿐이다(계약 docs/contracts/qt-today.md) ---
    this.api = new apigwv2.HttpApi(this, 'HttpApi', {
      description: '말씀하루 QT 공통 조회 API. 개인 계획·진도 경로는 없다.',
    });
    this.api.addRoutes({
      path: '/api/qt/today',
      methods: [apigwv2.HttpMethod.GET],
      integration: new HttpLambdaIntegration('QtTodayIntegration', this.apiFunction),
    });
    // 요청 제한(추가 요금 없음). 액세스 로그는 켜지 않는다(IP 등 불필요한 수집과 로그 비용 방지).
    const stage = this.api.defaultStage?.node.defaultChild as apigwv2.CfnStage;
    stage.defaultRouteSettings = {
      throttlingRateLimit: cfg.apiThrottleRatePerSecond,
      throttlingBurstLimit: cfg.apiThrottleBurst,
    };

    // --- 정적 웹(S3, 비공개 + CloudFront OAC) ---
    this.webBucket = new s3.Bucket(this, 'WebBucket', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
      encryption: s3.BucketEncryption.S3_MANAGED,
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    const spaRewrite = new cloudfront.Function(this, 'SpaRewrite', {
      runtime: cloudfront.FunctionRuntime.JS_2_0,
      comment: '확장자 없는 경로를 /index.html 로 재작성(기본 동작에만 연결, /api/* 는 제외)',
      code: cloudfront.FunctionCode.fromInline(
        [
          'function handler(event) {',
          '  var request = event.request;',
          '  var uri = request.uri;',
          "  if (uri.charAt(uri.length - 1) === '/') { request.uri = uri + 'index.html'; }",
          "  else if (uri.indexOf('.') === -1) { request.uri = '/index.html'; }",
          '  return request;',
          '}',
        ].join('\n'),
      ),
    });

    // 검색 엔진 비노출(비공개 시험 운영) + 기본 보안 헤더
    const responseHeaders = new cloudfront.ResponseHeadersPolicy(this, 'ResponseHeaders', {
      comment: 'X-Robots-Tag noindex + 보안 헤더',
      customHeadersBehavior: {
        customHeaders: [{ header: 'X-Robots-Tag', value: 'noindex, nofollow', override: true }],
      },
      securityHeadersBehavior: {
        contentTypeOptions: { override: true },
        frameOptions: { frameOption: cloudfront.HeadersFrameOption.DENY, override: true },
        referrerPolicy: { referrerPolicy: cloudfront.HeadersReferrerPolicy.STRICT_ORIGIN_WHEN_CROSS_ORIGIN, override: true },
        strictTransportSecurity: { accessControlMaxAge: Duration.days(365), includeSubdomains: true, override: true },
      },
    });

    const apiCachePolicy = new cloudfront.CachePolicy(this, 'ApiCachePolicy', {
      comment: '오늘 QT 응답의 짧은 엣지 캐시. 원본 Cache-Control 을 최대 TTL 안에서 따른다',
      defaultTtl: Duration.seconds(cfg.apiCacheDefaultTtlSeconds),
      minTtl: Duration.seconds(0),
      maxTtl: Duration.seconds(cfg.apiCacheMaxTtlSeconds),
      headerBehavior: cloudfront.CacheHeaderBehavior.none(),
      cookieBehavior: cloudfront.CacheCookieBehavior.none(),
      queryStringBehavior: cloudfront.CacheQueryStringBehavior.none(),
      enableAcceptEncodingGzip: true,
      enableAcceptEncodingBrotli: true,
    });

    const apiDomain = Fn.select(2, Fn.split('/', this.api.apiEndpoint));
    this.distribution = new cloudfront.Distribution(this, 'Cdn', {
      comment: '말씀하루 웹과 API 진입점 (private-preview, provider permission unconfirmed)',
      defaultRootObject: 'index.html',
      priceClass: cloudfront.PriceClass.PRICE_CLASS_200,
      httpVersion: cloudfront.HttpVersion.HTTP2_AND_3,
      enableLogging: false, // 접속 로그 비활성: 개인 정보 최소 수집과 로그 비용 방지
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(this.webBucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        responseHeadersPolicy: responseHeaders,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD,
        compress: true,
        functionAssociations: [{ function: spaRewrite, eventType: cloudfront.FunctionEventType.VIEWER_REQUEST }],
      },
      additionalBehaviors: {
        '/api/*': {
          origin: new origins.HttpOrigin(apiDomain, { protocolPolicy: cloudfront.OriginProtocolPolicy.HTTPS_ONLY }),
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.HTTPS_ONLY,
          cachePolicy: apiCachePolicy,
          responseHeadersPolicy: responseHeaders,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD,
          compress: true,
        },
      },
    });

    const webDist = resolve(INFRA_ROOT, cfg.webDistPath);
    if (existsSync(webDist)) {
      new s3deploy.BucketDeployment(this, 'WebDeployment', {
        sources: [s3deploy.Source.asset(webDist)],
        destinationBucket: this.webBucket,
        distribution: this.distribution,
        distributionPaths: ['/index.html'],
      });
    } else {
      Annotations.of(this).addWarningV2('malssum:web-dist-missing', `웹 산출물이 없어 정적 파일 배포 리소스를 만들지 않았다: ${webDist}`);
    }

    // --- 수집 스케줄(Asia/Seoul). cfg.collectorEnabled=false 이면 스케줄을 끈다 ---
    // 시각마다 스케줄 하나(월 호출 수는 무료 구간 1,400만 호출 안). qt-backend 는 이미 성공한 제공처를 건너뛴다.
    cfg.collectorTimesKst.forEach((time, i) => {
      const [hour, minute] = time.split(':') as [string, string];
      new scheduler.Schedule(this, `QtCollectorSchedule${i + 1}`, {
        description: `QT 제공처 오늘 장절 수집 ${time} KST`,
        schedule: scheduler.ScheduleExpression.cron({
          minute: String(Number(minute)),
          hour: String(Number(hour)),
          timeZone: TimeZone.ASIA_SEOUL,
        }),
        target: new targets.LambdaInvoke(this.collectorFunction, {
          retryAttempts: 1,
          maxEventAge: Duration.minutes(30),
          input: scheduler.ScheduleTargetInput.fromObject({ trigger: 'schedule' }),
        }),
        enabled: cfg.collectorEnabled,
      });
    });

    // --- 알람(비용표는 3개 가정)과 예산. 수신 이메일이 없으면 주체를 만들지 않는다 ---
    let alertAction: cwActions.SnsAction | undefined;
    if (cfg.alertEmail) {
      const topic = new sns.Topic(this, 'AlertTopic', { displayName: '말씀하루 알림' });
      topic.addSubscription(new subs.EmailSubscription(cfg.alertEmail));
      alertAction = new cwActions.SnsAction(topic);

      new budgets.CfnBudget(this, 'MonthlyCostBudget', {
        budget: {
          budgetName: 'malssum-haru-monthly',
          budgetType: 'COST',
          timeUnit: 'MONTHLY',
          budgetLimit: { amount: cfg.budgetMonthlyUsd, unit: 'USD' },
        },
        // 알림 전용이다. 요청 기반 요금을 자동으로 멈추지 않으며 Anthropic API 비용은 이 예산에 보이지 않는다.
        notificationsWithSubscribers: [
          { notification: { notificationType: 'ACTUAL', comparisonOperator: 'GREATER_THAN', threshold: 50, thresholdType: 'PERCENTAGE' }, subscribers: [{ subscriptionType: 'EMAIL', address: cfg.alertEmail }] },
          { notification: { notificationType: 'ACTUAL', comparisonOperator: 'GREATER_THAN', threshold: 80, thresholdType: 'PERCENTAGE' }, subscribers: [{ subscriptionType: 'EMAIL', address: cfg.alertEmail }] },
          { notification: { notificationType: 'FORECASTED', comparisonOperator: 'GREATER_THAN', threshold: 100, thresholdType: 'PERCENTAGE' }, subscribers: [{ subscriptionType: 'EMAIL', address: cfg.alertEmail }] },
        ],
      });
    } else {
      Annotations.of(this).addWarningV2(
        'malssum:alert-email-missing',
        '알림 이메일(alertEmail)이 없어 AWS Budgets 알림과 알람 SNS 주제를 만들지 않았다. 배포 전에 -c alertEmail=... 로 지정한다.',
      );
    }

    const alarms: cloudwatch.Alarm[] = [
      new cloudwatch.Alarm(this, 'QtApiErrorsAlarm', {
        alarmDescription: 'QT 조회 Lambda 오류',
        metric: this.apiFunction.metricErrors({ period: Duration.minutes(5), statistic: 'Sum' }),
        threshold: 3,
        evaluationPeriods: 1,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      }),
      new cloudwatch.Alarm(this, 'QtCollectorErrorsAlarm', {
        alarmDescription: 'QT 수집 Lambda 오류',
        metric: this.collectorFunction.metricErrors({ period: Duration.minutes(5), statistic: 'Sum' }),
        threshold: 1,
        evaluationPeriods: 1,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      }),
      new cloudwatch.Alarm(this, 'HttpApi5xxAlarm', {
        alarmDescription: 'HTTP API 5xx',
        metric: this.api.metricServerError({ period: Duration.minutes(5), statistic: 'Sum' }),
        threshold: 3,
        evaluationPeriods: 1,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      }),
    ];
    if (alertAction) for (const a of alarms) a.addAlarmAction(alertAction);

    // --- 자리표시자 산출물은 명시적으로 승인하지 않으면 배포되지 않는다 ---
    if (this.usesPlaceholderAsset) {
      Annotations.of(this).addWarningV2(
        'malssum:placeholder-asset',
        `QT Lambda 산출물이 자리표시자(${PLACEHOLDER_ASSET})다. services/qt 산출물 경로를 -c qtLambdaAssetPath=... 로 지정하기 전에는 배포하지 않는다.`,
      );
      const confirmed = new CfnParameter(this, 'QtArtifactConfirmed', {
        type: 'String',
        default: 'no',
        allowedValues: ['no', 'yes'],
        description: '자리표시자 산출물을 실제 배포하려면 yes. 기본 no 는 배포를 거부한다.',
      });
      new CfnRule(this, 'RequireRealQtArtifact', {
        assertions: [
          {
            assert: Fn.conditionEquals(confirmed.valueAsString, 'yes'),
            assertDescription: 'QT Lambda 산출물이 자리표시자라 배포할 수 없다. -c qtLambdaAssetPath 를 지정한다.',
          },
        ],
      });
    }

    new CfnOutput(this, 'CloudFrontDomainName', { value: this.distribution.distributionDomainName });
    new CfnOutput(this, 'QtTableName', { value: this.table.tableName });
    new CfnOutput(this, 'DeploymentNotice', {
      value: cfg.qtAcquisitionEnabled
        ? 'private-preview: provider acquisition ON, provider permission unconfirmed. Not for public release.'
        : 'provider acquisition OFF (official links only)',
    });
  }
}
