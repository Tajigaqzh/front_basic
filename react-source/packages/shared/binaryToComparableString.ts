/**
 * @beginner-module: 源码导读
 * 本文件属于 shared 公共工具/类型层，被 react、react-dom、reconciler 共同复用。
 * 阅读建议：先看这些中文注释建立概念，再回到代码名和类型名理解真实实现。
 */
// @beginner: 定义 BinaryView：给复杂数据结构起名字，后续代码会按这个形状传递数据。
type BinaryView = ArrayBufferView<ArrayBufferLike>;

/**
 * 把 TypedArray/DataView 对应的字节序列转成可直接作为 Map key 比较的字符串。
 * 这里必须使用 `byteOffset/byteLength`，否则同一个 ArrayBuffer 的不同切片会混在一起。
 */
export default function binaryToComparableString(view: BinaryView): string {
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return String.fromCharCode.apply(
    String,
    Array.from(new Uint8Array(view.buffer, view.byteOffset, view.byteLength)),
  );
}
