package com.example.collab.business.execution.language;

import com.example.collab.business.execution.CommandResult;
import com.example.collab.business.execution.CommandRunner;
import com.example.collab.dto.CodeExecutionRequest;
import com.example.collab.dto.CodeExecutionResponse;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import org.springframework.stereotype.Component;

/**
 * TypeScript 代码执行策略。
 *
 * <p>流程：写入 {@code main.ts}，调用 {@code tsc} 编译成 CommonJS，再用
 * {@code node main.js} 执行。优先使用前端项目本地的 TypeScript 编译器，
 * 避免运行时通过 {@code npx} 临时下载依赖。
 */
@Component
public class TypeScriptExecutionStrategy extends AbstractCommandExecutionStrategy {
  private static final Path LOCAL_TSC = Path.of("../js/node_modules/.bin/tsc").toAbsolutePath().normalize();

  public TypeScriptExecutionStrategy(CommandRunner commandRunner) {
    super(commandRunner);
  }

  @Override
  public String language() {
    return "typescript";
  }

  @Override
  public CodeExecutionResponse execute(CodeExecutionRequest request, Path workspace, long startedAt) throws Exception {
    Path sourceFile = writeSource(workspace, "main.ts", request.code());

    List<String> compileCommand = new ArrayList<>();
    // 本地开发时复用 js/node_modules/.bin/tsc；线上可把 tsc 安装进镜像或 PATH。
    if (Files.exists(LOCAL_TSC)) {
      compileCommand.add(LOCAL_TSC.toString());
    } else {
      compileCommand.add("npx");
      compileCommand.add("tsc");
    }
    compileCommand.add(sourceFile.getFileName().toString());
    compileCommand.add("--target");
    compileCommand.add("ES2020");
    compileCommand.add("--module");
    compileCommand.add("CommonJS");
    compileCommand.add("--outDir");
    compileCommand.add(workspace.toString());
    compileCommand.add("--skipLibCheck");

    CommandResult compile = commandRunner.run(workspace, compileCommand);
    if (compile.exitCode() != 0) {
      return response(compile, startedAt);
    }

    CommandResult run = commandRunner.run(workspace, List.of("node", "main.js"));
    return response(run, startedAt);
  }
}
