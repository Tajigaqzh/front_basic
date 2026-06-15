package com.example.collab.business.execution;

/**
 * 单条命令的原始执行结果。
 *
 * <p>它不关心语言，只表示一次 ProcessBuilder 调用的退出码、标准输出和标准错误。
 */
public record CommandResult(int exitCode, String stdout, String stderr) {}
