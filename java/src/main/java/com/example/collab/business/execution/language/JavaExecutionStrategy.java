package com.example.collab.business.execution.language;

import com.example.collab.business.execution.CommandResult;
import com.example.collab.business.execution.CommandRunner;
import com.example.collab.dto.CodeExecutionRequest;
import com.example.collab.dto.CodeExecutionResponse;
import java.nio.file.Path;
import java.util.List;
import java.util.Optional;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.springframework.stereotype.Component;

/**
 * Java 代码执行策略。
 *
 * <p>流程：写入 {@code .java} 文件，调用 {@code javac} 编译，再调用 {@code java}
 * 运行主类。若代码声明了 {@code public class Xxx}，文件名必须匹配该类名。
 */
@Component
public class JavaExecutionStrategy extends AbstractCommandExecutionStrategy {
  private static final Pattern PUBLIC_CLASS_PATTERN = Pattern.compile("\\bpublic\\s+class\\s+([A-Za-z_$][\\w$]*)");

  public JavaExecutionStrategy(CommandRunner commandRunner) {
    super(commandRunner);
  }

  @Override
  public String language() {
    return "java";
  }

  @Override
  public CodeExecutionResponse execute(CodeExecutionRequest request, Path workspace, long startedAt) throws Exception {
    // Java 的 public class 名必须和源文件名一致；未声明 public class 时默认 Main。
    String className = findPublicClassName(request.code()).orElse("Main");
    Path sourceFile = writeSource(workspace, className + ".java", request.code());

    CommandResult compile = commandRunner.run(workspace, List.of("javac", sourceFile.getFileName().toString()));
    if (compile.exitCode() != 0) {
      return response(compile, startedAt);
    }

    CommandResult run = commandRunner.run(workspace, List.of("java", "-cp", workspace.toString(), className));
    return response(run, startedAt);
  }

  private Optional<String> findPublicClassName(String code) {
    Matcher matcher = PUBLIC_CLASS_PATTERN.matcher(code);
    return matcher.find() ? Optional.of(matcher.group(1)) : Optional.empty();
  }
}
