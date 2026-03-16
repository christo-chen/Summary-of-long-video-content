package com.example.aisummary;

import org.mybatis.spring.annotation.MapperScan;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
@MapperScan("com.example.aisummary.mapper")
public class AiSummaryApplication {
    public static void main(String[] args) {
        SpringApplication.run(AiSummaryApplication.class, args);
    }
}
