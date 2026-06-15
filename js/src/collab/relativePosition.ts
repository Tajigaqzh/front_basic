import * as Y from 'yjs'
import { base64ToUint8Array, uint8ArrayToBase64 } from './encoding'

export function encodeRelativePosition(position: Y.RelativePosition): string {
  return uint8ArrayToBase64(Y.encodeRelativePosition(position))
}

export function decodeRelativePosition(encoded: string): Y.RelativePosition {
  return Y.decodeRelativePosition(base64ToUint8Array(encoded))
}

export function createEncodedRange(ytext: Y.Text, startIndex: number, endIndex: number) {
  return {
    anchor: encodeRelativePosition(Y.createRelativePositionFromTypeIndex(ytext, startIndex)),
    head: encodeRelativePosition(Y.createRelativePositionFromTypeIndex(ytext, endIndex))
  }
}

export function resolveEncodedRange(ydoc: Y.Doc, encoded: { anchor: string; head: string }) {
  const anchor = Y.createAbsolutePositionFromRelativePosition(decodeRelativePosition(encoded.anchor), ydoc)
  const head = Y.createAbsolutePositionFromRelativePosition(decodeRelativePosition(encoded.head), ydoc)

  if (!anchor || !head) {
    return null
  }

  const start = Math.min(anchor.index, head.index)
  const end = Math.max(anchor.index, head.index)
  return { start, end }
}
