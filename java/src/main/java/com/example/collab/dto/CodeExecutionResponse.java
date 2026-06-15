package com.example.collab.dto;

/**
 * 代码执行接口的统一返回结构。
 *
 * @param success 执行是否成功，当前按退出码是否为 0 判断
 * @param language 实际使用的语言策略
 * @param exitCode 命令退出码；请求级失败时可能为空
 * @param durationMs 从接收请求到执行完成的总耗时
 * @param stdout 标准输出
 * @param stderr 标准错误
 * @param stackTrace 从 stderr 中识别出的堆栈信息
 * @param error 后端请求级错误码，例如 unsupported-language、execution-failed
 */
public record CodeExecutionResponse(
  boolean success,
  String language,
  Integer exitCode,
  long durationMs,
  String stdout,
  String stderr,
  String stackTrace,
  String error
) {
  public static CodeExecutionResponse failed(String error) {
    return new CodeExecutionResponse(false, null, null, 0, "", "", "", error);
  }
}
