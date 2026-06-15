package com.example.collab.dto;

/**
 * 前端执行代码接口的请求体。
 *
 * @param language 语言标识，例如 java、javascript、typescript
 * @param fileName 当前编辑器文件名，后续支持多文件执行时可用于构建真实文件结构
 * @param code 当前文件的源码内容
 */
public record CodeExecutionRequest(String language, String fileName, String code) {}
