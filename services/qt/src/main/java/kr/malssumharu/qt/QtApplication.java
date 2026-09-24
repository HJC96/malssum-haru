package kr.malssumharu.qt;

import kr.malssumharu.qt.config.QtProperties;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.EnableConfigurationProperties;

@SpringBootApplication
@EnableConfigurationProperties(QtProperties.class)
public class QtApplication {

    public static void main(String[] args) {
        SpringApplication.run(QtApplication.class, args);
    }
}
