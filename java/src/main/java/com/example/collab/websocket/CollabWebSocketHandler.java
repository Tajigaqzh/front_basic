package com.example.collab.websocket;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.net.URI;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

/**
 * 协同编辑 WebSocket 处理器。
 *
 * <p>它按 roomId 在内存中维护房间、连接和 Yjs update 历史。demo 阶段不落库，
 * 因此服务重启后房间状态会丢失；生产环境应把 update/presence/session 状态迁移到
 * Redis 或数据库。
 */
@Component
public class CollabWebSocketHandler extends TextWebSocketHandler {
  private static final String DEFAULT_ROOM_ID = "demo-room";

  private final ObjectMapper objectMapper = new ObjectMapper();
  private final Map<String, Room> rooms = new ConcurrentHashMap<>();
  private final Map<String, Client> clients = new ConcurrentHashMap<>();

  @Override
  public void afterConnectionEstablished(WebSocketSession session) throws Exception {
    // 建立 socket 时先按 query 参数归入房间，正式用户信息会在 room:join 中补齐。
    Map<String, String> query = parseQuery(session.getUri());
    String roomId = query.getOrDefault("roomId", DEFAULT_ROOM_ID);
    String role = query.getOrDefault("role", "viewer");
    String name = query.getOrDefault("name", "Anonymous");
    Client client = new Client(session, roomId, role, name);

    clients.put(session.getId(), client);
    rooms.computeIfAbsent(roomId, Room::new).sessions.add(session);
  }

  @Override
  protected void handleTextMessage(WebSocketSession session, TextMessage message) throws Exception {
    Map<String, Object> payload = objectMapper.readValue(message.getPayload(), new TypeReference<>() {});
    String type = String.valueOf(payload.getOrDefault("type", ""));
    Client client = clients.get(session.getId());

    if (client == null) {
      send(session, error("session-not-found"));
      return;
    }

    switch (type) {
      case "room:join" -> handleJoin(session, client, payload);
      case "ping" -> handlePing(session, payload);
      case "doc:update" -> handleDocUpdate(session, client, payload);
      case "awareness:update" -> handleAwarenessUpdate(session, client, payload);
      default -> send(session, error("unknown-message-type"));
    }
  }

  @Override
  public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
    Client client = clients.remove(session.getId());
    if (client == null) {
      return;
    }

    Room room = rooms.get(client.roomId);
    if (room == null) {
      return;
    }

    room.sessions.remove(session);
    room.presence.remove(client.clientId);
    broadcastUsers(room);
  }

  private void handleJoin(WebSocketSession session, Client client, Map<String, Object> payload) throws IOException {
    client.clientId = stringValue(payload.get("clientId"), session.getId());
    client.name = stringValue(payload.get("name"), client.name);
    client.role = stringValue(payload.get("role"), client.role);

    Room room = rooms.computeIfAbsent(client.roomId, Room::new);
    room.sessions.add(session);

    // 新加入客户端先收到历史 Yjs update，前端重放后即可恢复当前文档状态。
    Map<String, Object> snapshot = new LinkedHashMap<>();
    snapshot.put("type", "doc:snapshot");
    snapshot.put("roomId", client.roomId);
    snapshot.put("updates", new ArrayList<>(room.updates));
    send(session, snapshot);

    Map<String, Object> joined = new LinkedHashMap<>();
    joined.put("type", "room:joined");
    joined.put("roomId", client.roomId);
    joined.put("clientId", client.clientId);
    joined.put("role", client.role);
    send(session, joined);

    broadcastUsers(room);
  }

  private void handlePing(WebSocketSession session, Map<String, Object> payload) throws IOException {
    Map<String, Object> pong = new LinkedHashMap<>();
    pong.put("type", "pong");
    pong.put("timestamp", payload.getOrDefault("timestamp", System.currentTimeMillis()));
    send(session, pong);
  }

  private void handleDocUpdate(WebSocketSession session, Client client, Map<String, Object> payload) throws IOException {
    if (!canEdit(client.role)) {
      send(session, error("permission-denied"));
      return;
    }

    Object update = payload.get("update");
    if (!(update instanceof String updateText) || updateText.isBlank()) {
      send(session, error("invalid-update"));
      return;
    }

    Room room = rooms.computeIfAbsent(client.roomId, Room::new);
    // demo 阶段把 update 存在内存中，供同房间新客户端进入时恢复文档。
    room.updates.add(updateText);

    Map<String, Object> outbound = new LinkedHashMap<>(payload);
    outbound.put("roomId", client.roomId);
    outbound.put("clientId", client.clientId);
    broadcast(room, outbound, session);
  }

  private void handleAwarenessUpdate(WebSocketSession session, Client client, Map<String, Object> payload) throws IOException {
    Room room = rooms.computeIfAbsent(client.roomId, Room::new);

    Map<String, Object> state = new LinkedHashMap<>();
    Object rawState = payload.get("state");
    if (rawState instanceof Map<?, ?> rawStateMap) {
      for (Map.Entry<?, ?> entry : rawStateMap.entrySet()) {
        state.put(String.valueOf(entry.getKey()), entry.getValue());
      }
    }
    // 服务端补齐可信的 clientId/name/role，避免完全依赖前端传值。
    state.put("clientId", client.clientId);
    state.put("name", client.name);
    state.put("role", client.role);

    room.presence.put(client.clientId, state);

    Map<String, Object> outbound = new LinkedHashMap<>();
    outbound.put("type", "awareness:update");
    outbound.put("roomId", client.roomId);
    outbound.put("clientId", client.clientId);
    outbound.put("state", state);
    broadcast(room, outbound, session);
    broadcastUsers(room);
  }

  private void broadcastUsers(Room room) {
    List<Map<String, Object>> users = new ArrayList<>(room.presence.values());
    Map<String, Object> payload = new LinkedHashMap<>();
    payload.put("type", "room:users");
    payload.put("roomId", room.roomId);
    payload.put("users", users);
    broadcast(room, payload, null);
  }

  private void broadcast(Room room, Map<String, Object> payload, WebSocketSession excludedSession) {
    String json;
    try {
      json = objectMapper.writeValueAsString(payload);
    } catch (JsonProcessingException error) {
      return;
    }

    for (WebSocketSession target : room.sessions) {
      if (target.isOpen() && (excludedSession == null || !target.getId().equals(excludedSession.getId()))) {
        try {
          target.sendMessage(new TextMessage(json));
        } catch (IOException ignored) {
          // 失效连接会在 close 回调中被移除。
        }
      }
    }
  }

  private void send(WebSocketSession session, Map<String, Object> payload) throws IOException {
    if (session.isOpen()) {
      session.sendMessage(new TextMessage(objectMapper.writeValueAsString(payload)));
    }
  }

  private Map<String, Object> error(String code) {
    Map<String, Object> payload = new LinkedHashMap<>();
    payload.put("type", "error");
    payload.put("code", code);
    return payload;
  }

  private boolean canEdit(String role) {
    return "A".equals(role) || "B".equals(role);
  }

  private String stringValue(Object value, String fallback) {
    if (value == null) {
      return fallback;
    }
    String text = String.valueOf(value).trim();
    return text.isEmpty() ? fallback : text;
  }

  private Map<String, String> parseQuery(URI uri) {
    if (uri == null || uri.getRawQuery() == null || uri.getRawQuery().isBlank()) {
      return Collections.emptyMap();
    }

    Map<String, String> query = new HashMap<>();
    for (String pair : uri.getRawQuery().split("&")) {
      String[] parts = pair.split("=", 2);
      String key = URLDecoder.decode(parts[0], StandardCharsets.UTF_8);
      String value = parts.length > 1 ? URLDecoder.decode(parts[1], StandardCharsets.UTF_8) : "";
      query.put(key, value);
    }
    return query;
  }

  private static final class Room {
    // 房间内保存连接、Yjs update 历史和在线状态。
    private final String roomId;
    private final Set<WebSocketSession> sessions = ConcurrentHashMap.newKeySet();
    private final List<String> updates = Collections.synchronizedList(new ArrayList<>());
    private final Map<String, Map<String, Object>> presence = new ConcurrentHashMap<>();

    private Room(String roomId) {
      this.roomId = roomId;
    }
  }

  private static final class Client {
    // 单个 WebSocket 连接对应的客户端信息。
    private final WebSocketSession session;
    private final String roomId;
    private String clientId;
    private String role;
    private String name;

    private Client(WebSocketSession session, String roomId, String role, String name) {
      this.session = session;
      this.roomId = roomId;
      this.clientId = session.getId();
      this.role = role;
      this.name = name;
    }
  }
}
