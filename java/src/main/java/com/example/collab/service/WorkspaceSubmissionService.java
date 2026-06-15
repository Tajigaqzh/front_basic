package com.example.collab.service;

import com.example.collab.dto.WorkspaceSubmissionRequest;
import com.example.collab.dto.WorkspaceSubmissionResponse;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.UUID;
import org.springframework.stereotype.Service;

@Service
public class WorkspaceSubmissionService {
  private static final DateTimeFormatter ID_TIME_FORMAT = DateTimeFormatter.ofPattern("yyyyMMddHHmmss");
  private static final Path SUBMISSION_ROOT = Path.of("target", "submissions");

  private final ObjectMapper objectMapper;

  public WorkspaceSubmissionService() {
    this.objectMapper = new ObjectMapper().enable(SerializationFeature.INDENT_OUTPUT);
  }

  /**
   * 保存一次完整工作区提交。
   *
   * <p>当前 demo 写入本地 JSON 文件，后续可以替换为数据库、对象存储或消息队列。
   */
  public WorkspaceSubmissionResponse save(WorkspaceSubmissionRequest request) {
    String submissionId = createSubmissionId(request);

    try {
      Files.createDirectories(SUBMISSION_ROOT);
      Path savedPath = SUBMISSION_ROOT.resolve(submissionId + ".json");
      objectMapper.writeValue(savedPath.toFile(), request);
      return new WorkspaceSubmissionResponse(true, submissionId, savedPath.toAbsolutePath().toString(), null);
    } catch (Exception error) {
      return WorkspaceSubmissionResponse.failed("submission-save-failed");
    }
  }

  private String createSubmissionId(WorkspaceSubmissionRequest request) {
    String time = LocalDateTime.now().format(ID_TIME_FORMAT);
    String clientId = request.clientId() == null || request.clientId().isBlank()
      ? "anonymous"
      : request.clientId().replaceAll("[^A-Za-z0-9_-]", "_");
    return time + "-" + clientId + "-" + UUID.randomUUID();
  }
}
