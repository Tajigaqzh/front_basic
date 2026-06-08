const isJavaScriptProtocol = /^[\u0000-\u001F ]*j[\r\n\t]*a[\r\n\t]*v[\r\n\t]*a[\r\n\t]*s[\r\n\t]*c[\r\n\t]*r[\r\n\t]*i[\r\n\t]*p[\r\n\t]*t[\r\n\t]*:/i;

export default function sanitizeURL<T>(url: T): T | string {
  if (typeof url === "string" && isJavaScriptProtocol.test(url)) {
    return "javascript:throw new Error('React has blocked a javascript: URL for security.')";
  }

  return url;
}
