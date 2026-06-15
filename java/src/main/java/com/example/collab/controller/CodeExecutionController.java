package com.example.collab.controller;

import com.example.collab.dto.CodeExecutionRequest;
import com.example.collab.dto.CodeExecutionResponse;
import com.example.collab.service.CodeExecutionService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@CrossOrigin(origins = "*")
@RequestMapping("/api")
public class CodeExecutionController {
  private final CodeExecutionService codeExecutionService;

  public CodeExecutionController(CodeExecutionService codeExecutionService) {
    this.codeExecutionService = codeExecutionService;
  }

  /**
   * 执行当前编辑器文件。
   *
   * <p>Controller 只做 HTTP 请求形态校验；语言选择、临时目录、命令执行和返回值组装
   * 都交给 {@link CodeExecutionService}。
   */
  @PostMapping("/execute")
  public ResponseEntity<CodeExecutionResponse> execute(@RequestBody CodeExecutionRequest request) {
    if (request == null || request.code() == null || request.code().isBlank()) {
      return ResponseEntity.badRequest().body(CodeExecutionResponse.failed("empty-code"));
    }
    return ResponseEntity.ok(codeExecutionService.execute(request));
  }
}
