package com.example.collab;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
public class CollabApplication {
  /**
   * Spring Boot 应用入口。
   *
   * <p>当前后端提供两个独立能力：{@code /collab} WebSocket 协同编辑，以及
   * {@code /api/execute} REST 代码执行。
   */
  public static void main(String[] args) {
    SpringApplication.run(CollabApplication.class, args);
  }
}
