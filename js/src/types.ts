export type Role = 'A' | 'B' | 'viewer'

export type AnnotationKind = 'comment' | 'highlight' | 'remark'

export type AnnotationRecord = {
  id: string
  kind: AnnotationKind
  fileId?: string
  authorId: string
  authorName: string
  content: string
  color?: string
  anchor: string
  head: string
  createdAt: number
  updatedAt: number
}
