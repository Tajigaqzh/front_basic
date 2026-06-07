interface Edit {
  start: number
  end: number
  content: string
}

export default class MagicString {
  private readonly source: string
  private readonly edits: Edit[] = []
  private prepends = ''
  private appends = ''

  constructor(source: string) {
    this.source = source
  }

  overwrite(start: number, end: number, content: string): this {
    this.edits.push({ start, end, content })
    return this
  }

  append(content: string): this {
    this.appends += content
    return this
  }

  prepend(content: string): this {
    this.prepends = content + this.prepends
    return this
  }

  remove(start: number, end: number): this {
    this.edits.push({ start, end, content: '' })
    return this
  }

  slice(start: number, end: number): string {
    return this.source.slice(start, end)
  }

  toString(): string {
    if (!this.edits.length) {
      return this.prepends + this.source + this.appends
    }

    const edits = [...this.edits].sort((a, b) => {
      if (a.start === b.start) {
        return a.end - b.end
      }
      return a.start - b.start
    })

    let result = ''
    let cursor = 0

    for (const edit of edits) {
      if (edit.start < cursor) {
        continue
      }
      result += this.source.slice(cursor, edit.start)
      result += edit.content
      cursor = edit.end
    }

    result += this.source.slice(cursor)
    return this.prepends + result + this.appends
  }
}
