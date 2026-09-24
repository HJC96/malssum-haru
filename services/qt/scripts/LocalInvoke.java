import com.amazonaws.services.lambda.runtime.Context;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.lang.reflect.Proxy;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;

/**
 * 배포용 shaded jar 의 Lambda 핸들러를 AWS 없이 직접 호출하는 로컬 검증 도구(단일 소스 실행).
 * 인터넷·AWS에 접속하지 않는다(취득 플래그 기본 off 이면 제공처에도 요청하지 않는다).
 *
 *   java -cp target/qt-service-0.0.1-SNAPSHOT-aws.jar scripts/LocalInvoke.java src/test/resources/lambda-events/get-today.json
 *
 * 핸들러는 기본이 조회 핸들러다. 수집 핸들러는 두 번째 인자로 클래스 이름을 준다(수집은 제공처에 요청할 수 있으니 취득 플래그 기본 off 상태에서만 시험).
 * 출력: init(핸들러 생성=Spring 컨텍스트 기동) 시간, 첫 호출·두 번째 호출 시간, 응답 상태코드와 요약.
 * Lambda 환경이 아니므로 시간은 참고치일 뿐이다.
 */
public class LocalInvoke {

    public static void main(String[] args) throws Exception {
        byte[] event = Files.readAllBytes(Path.of(args[0]));
        long jvmStartMs = java.lang.management.ManagementFactory.getRuntimeMXBean().getStartTime();
        long t0 = System.nanoTime();
        Class<?> handlerClass = Class.forName(args.length > 1 ? args[1] : "kr.malssumharu.qt.lambda.QtLambdaHandler");
        Object handler = handlerClass.getDeclaredConstructor().newInstance();
        long t1 = System.nanoTime();
        var handle = handlerClass.getMethod("handleRequest", java.io.InputStream.class, java.io.OutputStream.class, Context.class);
        Context ctx = (Context) Proxy.newProxyInstance(Context.class.getClassLoader(), new Class<?>[] {Context.class},
                (p, m, a) -> m.getReturnType() == int.class ? 512 : m.getReturnType() == long.class ? 0L : m.getReturnType() == String.class ? "local" : null);

        if (System.getenv("LOCAL_INVOKE_INIT_ONLY") != null) {
            // 배포 모드(QT_TABLE_NAME)에서는 호출하면 실제 DynamoDB로 나가므로 초기화까지만 측정한다
            Runtime r = Runtime.getRuntime();
            System.out.printf("init(handler constructed): %d ms (init only, no invocation)%n", (t1 - t0) / 1_000_000);
            System.out.printf("JVM start -> init done: %d ms, heap used: %d MB%n", System.currentTimeMillis() - jvmStartMs, (r.totalMemory() - r.freeMemory()) >> 20);
            return;
        }
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        handle.invoke(handler, new ByteArrayInputStream(event), out, ctx);
        long t2 = System.nanoTime();
        out.reset();
        handle.invoke(handler, new ByteArrayInputStream(event), out, ctx);
        long t3 = System.nanoTime();

        String response = out.toString(StandardCharsets.UTF_8);
        System.out.printf("init(handler constructed): %d ms%n", (t1 - t0) / 1_000_000);
        System.out.printf("first invoke: %d ms, second invoke: %d ms%n", (t2 - t1) / 1_000_000, (t3 - t2) / 1_000_000);
        System.out.printf("JVM start -> second invoke done: %d ms%n", System.currentTimeMillis() - jvmStartMs);
        Runtime rt = Runtime.getRuntime();
        System.out.printf("heap used: %d MB (JVM max %d MB)%n", (rt.totalMemory() - rt.freeMemory()) >> 20, rt.maxMemory() >> 20);
        System.out.println(response.length() > 1500 ? response.substring(0, 1500) + "..." : response);
    }
}
