import type { Code } from '@vue/language-core'

/**
 * Augments the VLS context (volar) with additianal type information.
 *
 * @param content - content retrieved from the volar pluign
 * @param codes - codes to add to the VLS context
 */
export function augmentVlsCtx(content: Code[], codes: Code[]) {
  let from = -1

  for (let i = 0; i < content.length; i++) {
    const code = content[i]

    if (typeof code !== 'string') {
      continue
    }

    if (from === -1 && code.startsWith(`const __VLS_ctx`)) {
      // 先记住 `__VLS_ctx` 对象起始位置，后面再决定它是对象字面量还是表达式形式。
      from = i
    } else if (from !== -1) {
      if (code === `}`) {
        // 对象字面量形式：在结束花括号前直接插入展开字段。
        content.splice(i, 0, ...codes.map(code => `...${code},\n`))
        break
      } else if (code === `;\n`) {
        // 表达式形式：重写成 `{ ...原内容, ...增强项 }` 的对象包裹结构。
        content.splice(
          from + 1,
          i - from,
          `{\n`,
          `...`,
          ...content.slice(from + 1, i),
          `,\n`,
          ...codes.map(code => `...${code},\n`),
          `}`,
          `;\n`
        )
        break
      }
    }
  }
}
