/**
 * 文件作用：创建并识别 runtime-core 内部专用对象原型。
 *
 * 它主要服务于 vnode props / slots 归一化阶段，
 * 让运行时可以快速判断“当前对象是不是组件内部生成的 attrs / slots 容器”。
 */
// 这里用“专用原型 + 原型比较”做标记，而不是定义不可枚举字段，
// 目的是减少对象额外属性开销，这也是 SSR benchmark 里的优化点之一。
const internalObjectProto = {}

/**
 * 作用：创建一个挂在内部原型上的空对象。
 */
export const createInternalObject = (): any =>
  Object.create(internalObjectProto)

/**
 * 作用：判断一个对象是否来自 `createInternalObject()`。
 */
export const isInternalObject = (obj: object): boolean =>
  Object.getPrototypeOf(obj) === internalObjectProto
