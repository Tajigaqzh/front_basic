export default function formatProdErrorMessage(code: number, ...args: unknown[]): string {
  let url = `https://react.dev/errors/${code}`;
  for (const arg of args) {
    url += `?args[]=${encodeURIComponent(String(arg))}`;
  }
  return `Minified React error #${code}; visit ${url} for the full message.`;
}
