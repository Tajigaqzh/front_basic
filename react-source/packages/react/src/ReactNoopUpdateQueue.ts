/**
 * @beginner-module: 源码导读
 * 本文件属于 react 包的公开 API 或基础能力，通常只创建描述对象或转发到 reconciler。
 * 阅读建议：先看这些中文注释建立概念，再回到代码名和类型名理解真实实现。
 */
// @beginner: 定义 UpdateQueue：描述对象需要具备哪些字段，方便读者理解数据形状。
export interface UpdateQueue {
  isMounted(publicInstance: unknown): boolean;
  enqueueForceUpdate(publicInstance: unknown, callback?: () => void): void;
  enqueueReplaceState(publicInstance: unknown, completeState: unknown, callback?: () => void): void;
  enqueueSetState(publicInstance: unknown, partialState: unknown, callback?: () => void): void;
}

// @beginner: 声明 ReactNoopUpdateQueue：保存当前步骤需要读取或更新的数据。
const ReactNoopUpdateQueue: UpdateQueue = {
  isMounted() {
    // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
    return false;
  },
  enqueueForceUpdate(_publicInstance, callback) {
    callback?.();
  },
  enqueueReplaceState(_publicInstance, _completeState, callback) {
    callback?.();
  },
  enqueueSetState(_publicInstance, _partialState, callback) {
    callback?.();
  },
};

export default ReactNoopUpdateQueue;
