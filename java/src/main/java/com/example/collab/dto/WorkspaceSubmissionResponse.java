package com.example.collab.dto;

/**
 * 工作区提交结果。
 *
 * @param success 是否保存成功
 * @param submissionId 本次提交 ID
 * @param savedPath 后端保存路径
 * @param error 错误码
 */
public record WorkspaceSubmissionResponse(
  boolean success,
  String submissionId,
  String savedPath,
  String error
) {
  public static WorkspaceSubmissionResponse failed(String error) {
    return new WorkspaceSubmissionResponse(false, null, null, error);
  }
}
