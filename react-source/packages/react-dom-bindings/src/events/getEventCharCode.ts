export function getEventCharCode(nativeEvent: KeyboardEvent): number {
  let charCode = nativeEvent.charCode;

  if (charCode === 0 && nativeEvent.keyCode === 13) {
    charCode = 13;
  }

  // Firefox 可能为非打印键触发 keypress；官方用 32 以下字符过滤，
  // Enter 例外，因为它既可能作为控制键也可能作为可输入字符。
  if (charCode >= 32 || charCode === 13) {
    return charCode;
  }

  return 0;
}

export default getEventCharCode;
