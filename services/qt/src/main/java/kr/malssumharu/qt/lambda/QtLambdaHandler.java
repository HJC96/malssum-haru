package kr.malssumharu.qt.lambda;

import org.springframework.cloud.function.adapter.aws.FunctionInvoker;

/**
 * Lambda 핸들러: {@code kr.malssumharu.qt.lambda.QtLambdaHandler::handleRequest}.
 * FunctionInvoker(Spring Cloud Function AWS 어댑터)에 함수 이름을 고정해 넘기므로
 * IaC가 spring_cloud_function_definition 환경 변수를 따로 설정할 필요가 없다.
 * 어댑터는 웹 서버 없이(web-application-type=none) 컨텍스트를 띄운다.
 */
public class QtLambdaHandler extends FunctionInvoker {

    public QtLambdaHandler() {
        super(QtLambdaFunctions.FUNCTION_NAME);
    }
}
