package com.example.collab.business.execution;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Path;
import java.time.Duration;
import java.util.List;
import java.util.concurrent.TimeUnit;
import org.springframework.stereotype.Component;

@Component
public class CommandRunner {
  private static final Duration TIMEOUT = Duration.ofSeconds(8);

  /**
   * 在临时工作目录中执行一条命令，并分别收集 stdout、stderr 和退出码。
   *
   * <p>命令超过 {@link #TIMEOUT} 会被强制终止。退出码 {@code 124} 参考常见 shell
   * 超时约定，便于前端和日志排查。
   */
  public CommandResult run(Path workspace, List<String> command) throws IOException, InterruptedException {
    Process process = new ProcessBuilder(command)
      .directory(workspace.toFile())
      .redirectErrorStream(false)
      .start();

    ByteArrayOutputStream stdout = new ByteArrayOutputStream();
    ByteArrayOutputStream stderr = new ByteArrayOutputStream();
    Thread stdoutThread = streamTo(process.getInputStream(), stdout);
    Thread stderrThread = streamTo(process.getErrorStream(), stderr);

    boolean completed = process.waitFor(TIMEOUT.toMillis(), TimeUnit.MILLISECONDS);
    if (!completed) {
      process.destroyForcibly();
      process.waitFor();
    }

    stdoutThread.join();
    stderrThread.join();

    return new CommandResult(
      completed ? process.exitValue() : 124,
      stdout.toString(StandardCharsets.UTF_8),
      completed ? stderr.toString(StandardCharsets.UTF_8) : stderr.toString(StandardCharsets.UTF_8) + "\nExecution timed out."
    );
  }

  private Thread streamTo(InputStream input, ByteArrayOutputStream output) {
    Thread thread = new Thread(() -> {
      try (input; output) {
        input.transferTo(output);
      } catch (IOException ignored) {
        // 超时终止进程时，进程可能已经主动关闭输出流。
      }
    });
    thread.start();
    return thread;
  }
}
