package com.example.collab.controller;

import com.example.collab.dto.WorkspaceSubmissionRequest;
import com.example.collab.dto.WorkspaceSubmissionResponse;
import com.example.collab.service.WorkspaceSubmissionService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@CrossOrigin(origins = "*")
@RequestMapping("/api")
public class WorkspaceSubmissionController {
  private final WorkspaceSubmissionService workspaceSubmissionService;

  public WorkspaceSubmissionController(WorkspaceSubmissionService workspaceSubmissionService) {
    this.workspaceSubmissionService = workspaceSubmissionService;
  }

  /**
   * 保存当前用户提交的完整目录结构和代码内容。
   */
  @PostMapping("/submissions")
  public ResponseEntity<WorkspaceSubmissionResponse> submit(@RequestBody WorkspaceSubmissionRequest request) {
    if (request == null || request.files() == null || request.files().isEmpty()) {
      return ResponseEntity.badRequest().body(WorkspaceSubmissionResponse.failed("empty-submission"));
    }
    return ResponseEntity.ok(workspaceSubmissionService.save(request));
  }
}
