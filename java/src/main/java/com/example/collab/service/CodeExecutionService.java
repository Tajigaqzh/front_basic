package com.example.collab.service;

import com.example.collab.business.execution.language.CodeExecutionStrategy;
import com.example.collab.dto.CodeExecutionRequest;
import com.example.collab.dto.CodeExecutionResponse;
import java.io.IOException;
import java.io.PrintWriter;
import java.io.StringWriter;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.TimeUnit;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;

@Service
public class CodeExecutionService {
  private final Map<String, CodeExecutionStrategy> strategies;

  /**
   * Spring 会注入所有语言执行策略，这里按语言标识建立索引，例如
   * {@code java}、{@code javascript}、{@code typescript}。
   */
  public CodeExecutionService(List<CodeExecutionStrategy> strategies) {
    this.strategies = strategies.stream()
      .collect(Collectors.toUnmodifiableMap(CodeExecutionStrategy::language, Function.identity()));
  }

  /**
   * 根据请求语言选择对应策略执行代码。
   *
   * <p>每次请求都会创建一个新的临时目录。语言策略应把源码、编译产物和运行时临时文件
   * 都写入该目录，方法结束后统一清理。
   */
  public CodeExecutionResponse execute(CodeExecutionRequest request) {
    long startedAt = System.nanoTime();
    String language = normalizeLanguage(request.language());
    CodeExecutionStrategy strategy = strategies.get(language);

    if (strategy == null) {
      return new CodeExecutionResponse(false, language, null, elapsedMs(startedAt), "", "", "", "unsupported-language");
    }

    Path workspace = null;
    try {
      workspace = Files.createTempDirectory("collab-code-");
      return strategy.execute(request, workspace, startedAt);
    } catch (Exception error) {
      return new CodeExecutionResponse(
        false,
        language,
        null,
        elapsedMs(startedAt),
        "",
        "",
        stackTrace(error),
        "execution-failed"
      );
    } finally {
      deleteQuietly(workspace);
    }
  }

  private String normalizeLanguage(String language) {
    if (language == null || language.isBlank()) {
      return "javascript";
    }
    return language.trim().toLowerCase(Locale.ROOT);
  }

  private long elapsedMs(long startedAt) {
    return TimeUnit.NANOSECONDS.toMillis(System.nanoTime() - startedAt);
  }

  private String stackTrace(Exception error) {
    StringWriter buffer = new StringWriter();
    error.printStackTrace(new PrintWriter(buffer));
    return buffer.toString();
  }

  /**
   * 尽力清理生成的源码、编译产物和临时运行文件。清理失败不应该覆盖真实执行结果。
   */
  private void deleteQuietly(Path path) {
    if (path == null) {
      return;
    }

    try (var paths = Files.walk(path)) {
      paths
        .sorted(Comparator.reverseOrder())
        .forEach((item) -> {
          try {
            Files.deleteIfExists(item);
          } catch (IOException ignored) {
            // 临时目录清理失败不影响本次执行结果返回。
          }
        });
    } catch (IOException ignored) {
      // 临时目录清理失败不影响本次执行结果返回。
    }
  }
}
