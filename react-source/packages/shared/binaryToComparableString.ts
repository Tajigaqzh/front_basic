type BinaryView = ArrayBufferView<ArrayBufferLike>;

/**
 * 把 TypedArray/DataView 对应的字节序列转成可直接作为 Map key 比较的字符串。
 * 这里必须使用 `byteOffset/byteLength`，否则同一个 ArrayBuffer 的不同切片会混在一起。
 */
export default function binaryToComparableString(view: BinaryView): string {
  return String.fromCharCode.apply(
    String,
    Array.from(new Uint8Array(view.buffer, view.byteOffset, view.byteLength)),
  );
}
