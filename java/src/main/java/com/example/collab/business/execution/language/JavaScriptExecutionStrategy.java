package com.example.collab.business.execution.language;

import com.example.collab.business.execution.CommandResult;
import com.example.collab.business.execution.CommandRunner;
import com.example.collab.dto.CodeExecutionRequest;
import com.example.collab.dto.CodeExecutionResponse;
import java.nio.file.Path;
import java.util.List;
import org.springframework.stereotype.Component;

/**
 * JavaScript 代码执行策略。
 *
 * <p>当前实现依赖本机或容器内已经安装 {@code node}，后端通过命令行运行临时
 * {@code main.js} 文件。
 */
@Component
public class JavaScriptExecutionStrategy extends AbstractCommandExecutionStrategy {
  public JavaScriptExecutionStrategy(CommandRunner commandRunner) {
    super(commandRunner);
  }

  @Override
  public String language() {
    return "javascript";
  }

  @Override
  public CodeExecutionResponse execute(CodeExecutionRequest request, Path workspace, long startedAt) throws Exception {
    Path sourceFile = writeSource(workspace, "main.js", request.code());
    CommandResult result = commandRunner.run(workspace, List.of("node", sourceFile.getFileName().toString()));
    return response(result, startedAt);
  }
}
