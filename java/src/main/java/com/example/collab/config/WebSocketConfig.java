package com.example.collab.config;

import com.example.collab.websocket.CollabWebSocketHandler;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;

@Configuration
@EnableWebSocket
public class WebSocketConfig implements WebSocketConfigurer {
  private final CollabWebSocketHandler collabWebSocketHandler;

  public WebSocketConfig(CollabWebSocketHandler collabWebSocketHandler) {
    this.collabWebSocketHandler = collabWebSocketHandler;
  }

  @Override
  public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
    // 前端 Yjs provider 使用该端点同步文档更新和光标状态。
    registry
      .addHandler(collabWebSocketHandler, "/collab")
      .setAllowedOrigins("*");
  }
}
