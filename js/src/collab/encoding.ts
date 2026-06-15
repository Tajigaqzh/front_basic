export function uint8ArrayToBase64(update: Uint8Array): string {
  let binary = ''
  for (const byte of update) {
    binary += String.fromCharCode(byte)
  }
  return btoa(binary)
}

export function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64)
  const update = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) {
    update[index] = binary.charCodeAt(index)
  }
  return update
}
