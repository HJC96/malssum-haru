package kr.malssumharu.qt.lambda;

import org.springframework.cloud.function.adapter.aws.FunctionInvoker;

/**
 * 수집 Lambda 핸들러: {@code kr.malssumharu.qt.lambda.QtCollectHandler::handleRequest}.
 * 스케줄(EventBridge Scheduler)이 {@code {"trigger":"schedule"}}를 넘겨 호출한다. API Gateway 이벤트가 아니다.
 * 같은 shaded jar를 조회 핸들러({@link QtLambdaHandler})와 공유한다.
 */
public class QtCollectHandler extends FunctionInvoker {

    public QtCollectHandler() {
        super(QtLambdaFunctions.COLLECT_FUNCTION_NAME);
    }
}
