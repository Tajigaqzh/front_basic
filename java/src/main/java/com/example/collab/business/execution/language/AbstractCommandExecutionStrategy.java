package com.example.collab.business.execution.language;

import com.example.collab.business.execution.CommandResult;
import com.example.collab.business.execution.CommandRunner;
import com.example.collab.dto.CodeExecutionResponse;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.concurrent.TimeUnit;

/**
 * 基于命令行执行的策略基类。
 *
 * <p>它封装所有语言都会用到的能力：写入源码文件、把命令执行结果转换成接口响应、
 * 从 stderr 中提取堆栈信息。
 */
public abstract class AbstractCommandExecutionStrategy implements CodeExecutionStrategy {
  protected final CommandRunner commandRunner;

  protected AbstractCommandExecutionStrategy(CommandRunner commandRunner) {
    this.commandRunner = commandRunner;
  }

  /**
   * 将前端传来的源码写入临时工作目录。
   */
  protected Path writeSource(Path workspace, String fileName, String code) throws IOException {
    Path sourceFile = workspace.resolve(fileName);
    Files.writeString(sourceFile, code, StandardCharsets.UTF_8);
    return sourceFile;
  }

  /**
   * 将命令执行结果转换成统一响应结构。
   */
  protected CodeExecutionResponse response(CommandResult result, long startedAt) {
    return new CodeExecutionResponse(
      result.exitCode() == 0,
      language(),
      result.exitCode(),
      elapsedMs(startedAt),
      result.stdout(),
      result.stderr(),
      detectStackTrace(result.stderr()),
      null
    );
  }

  private long elapsedMs(long startedAt) {
    return TimeUnit.NANOSECONDS.toMillis(System.nanoTime() - startedAt);
  }

  private String detectStackTrace(String stderr) {
    if (stderr == null || stderr.isBlank()) {
      return "";
    }
    return stderr.contains("Exception") || stderr.contains("Error") || stderr.contains("at ")
      ? stderr
      : "";
  }
}
