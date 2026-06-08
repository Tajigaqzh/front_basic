/**
 * @beginner-module: 源码导读
 * 本文件属于 shared 公共工具/类型层，被 react、react-dom、reconciler 共同复用。
 * 阅读建议：先看这些中文注释建立概念，再回到代码名和类型名理解真实实现。
 */
// @beginner: 定义 FormStatus：描述对象需要具备哪些字段，方便读者理解数据形状。
export interface FormStatus {
  pending: boolean;
  data: FormData | null;
  method: string | null;
  action: string | ((formData: FormData) => void | Promise<void>) | null;
}

// @beginner: 声明 NotPending：保存当前步骤需要读取或更新的数据。
export const NotPending: FormStatus = {
  pending: false,
  data: null,
  method: null,
  action: null,
};
