package com.example.collab.business.execution.language;

import com.example.collab.dto.CodeExecutionRequest;
import com.example.collab.dto.CodeExecutionResponse;
import java.nio.file.Path;

/**
 * 代码执行策略接口。
 *
 * <p>每种语言实现一个策略类，新增语言时只需要新增实现并注册为 Spring Bean，
 * {@code CodeExecutionService} 会自动收集并按 {@link #language()} 分发。
 */
public interface CodeExecutionStrategy {
  /**
   * 前端请求使用的语言标识，例如 {@code java}、{@code javascript}。
   */
  String language();

  /**
   * 在指定临时目录中执行代码。
   *
   * @param request 前端传入的语言、文件名和代码内容
   * @param workspace 本次执行独占的临时目录
   * @param startedAt 请求开始时间，用于计算整体耗时
   */
  CodeExecutionResponse execute(CodeExecutionRequest request, Path workspace, long startedAt) throws Exception;
}
