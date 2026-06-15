package com.example.collab.dto;

/**
 * 单个提交项。文件夹没有 code，文件包含 code。
 *
 * @param id 前端生成的节点 ID
 * @param parentId 父节点 ID，根节点为空
 * @param name 文件或文件夹名称
 * @param kind file 或 folder
 * @param language 文件语言；文件夹为空
 * @param code 文件内容；文件夹为空
 */
public record WorkspaceSubmissionFile(
  String id,
  String parentId,
  String name,
  String kind,
  String language,
  String code
) {}
