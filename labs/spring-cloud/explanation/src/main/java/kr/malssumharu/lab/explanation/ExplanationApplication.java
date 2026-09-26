package kr.malssumharu.lab.explanation;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.cloud.client.discovery.EnableDiscoveryClient;

@EnableDiscoveryClient
@SpringBootApplication
public class ExplanationApplication {
    public static void main(String[] args) {
        SpringApplication.run(ExplanationApplication.class, args);
    }
}
