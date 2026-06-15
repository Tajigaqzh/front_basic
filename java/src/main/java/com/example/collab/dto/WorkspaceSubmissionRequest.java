package com.example.collab.dto;

import java.util.List;

/**
 * 前端提交整个工作区时的请求体。
 *
 * @param roomId 房间号
 * @param clientId 当前用户 ID
 * @param userName 当前用户名称
 * @param role 当前用户角色
 * @param files 当前用户可见的完整目录树和文件内容
 */
public record WorkspaceSubmissionRequest(
  String roomId,
  String clientId,
  String userName,
  String role,
  List<WorkspaceSubmissionFile> files
) {}
