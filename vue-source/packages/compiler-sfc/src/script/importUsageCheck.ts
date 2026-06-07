import type { SFCDescriptor } from '../parse'
import {
  NodeTypes,
  parserOptions,
  walkIdentifiers,
} from '@vue-source/compiler-dom'
import type {
  ExpressionNode,
  SimpleExpressionNode,
  TemplateChildNode,
} from '@vue-source/compiler-core'
import { isSimpleIdentifier } from '@vue-source/compiler-core'
import { createCache } from '../cache'
import { camelize, capitalize, isBuiltInDirective } from '@vue-source/shared'

export function isImportUsed(local: string, sfc: SFCDescriptor): boolean {
  return resolveTemplateUsedIdentifiers(sfc).has(local)
}

const templateAnalysisCache = createCache<{
  usedIds?: Set<string>
  vModelIds: Set<string>
}>()

export function resolveTemplateVModelIdentifiers(
  sfc: SFCDescriptor,
): Set<string> {
  return resolveTemplateAnalysisResult(sfc, false).vModelIds
}

export function resolveTemplateUsedIdentifiers(
  sfc: SFCDescriptor,
): Set<string> {
  return resolveTemplateAnalysisResult(sfc, true).usedIds || new Set<string>()
}

function resolveTemplateAnalysisResult(
  sfc: SFCDescriptor,
  collectUsedIds = true,
): {
  usedIds?: Set<string>
  vModelIds: Set<string>
} {
  // 这一层做的是“模板会反向消费哪些 script 名字”的分析。
  // 结果会影响 import 是否保留、bindingMetadata 如何配合模板使用。
  if (!sfc.template) {
    return {
      usedIds: collectUsedIds ? new Set<string>() : undefined,
      vModelIds: new Set<string>(),
    }
  }

  const { content, ast } = sfc.template
  const cached = templateAnalysisCache.get(content)
  if (cached && (!collectUsedIds || cached.usedIds)) {
    return cached
  }

  const ids = collectUsedIds ? new Set<string>() : undefined
  const vModelIds = new Set<string>()

  if (!ast) {
    const emptyResult = {
      usedIds: ids,
      vModelIds,
    }
    templateAnalysisCache.set(content, emptyResult)
    return emptyResult
  }

  ast.children.forEach(walk)

  function walk(node: TemplateChildNode) {
    switch (node.type) {
      case NodeTypes.ELEMENT: {
        let tag = node.tag
        if (tag.includes('.')) {
          tag = tag.split('.')[0].trim()
        }
        if (
          ids &&
          !parserOptions.isNativeTag?.(tag) &&
          !parserOptions.isBuiltInComponent?.(tag)
        ) {
          // 非原生标签、非内建组件时，要把组件标签名转换成可能的本地绑定名，
          // 这样 `<FooBar />` 才能和 script 里的 `FooBar` / `fooBar` 对上。
          ids.add(camelize(tag))
          ids.add(capitalize(camelize(tag)))
        }

        for (const prop of node.props) {
          if (prop.type === NodeTypes.DIRECTIVE) {
            if (ids && !isBuiltInDirective(prop.name)) {
              // 自定义指令本质上也对应运行时绑定，例如 `v-focus` -> `vFocus`。
              ids.add(`v${capitalize(camelize(prop.name))}`)
            }

            if (prop.name === 'model') {
              const exp = prop.exp
              if (exp && exp.type === NodeTypes.SIMPLE_EXPRESSION) {
                const expString = exp.content.trim()
                if (
                  isSimpleIdentifier(expString) &&
                  expString !== 'undefined'
                ) {
                  // v-model 变量单独收集，后续脚本编译会把它作为更特殊的使用信号。
                  vModelIds.add(expString)
                }
              }
            }

            if (
              ids &&
              prop.arg &&
              prop.arg.type === NodeTypes.SIMPLE_EXPRESSION &&
              !prop.arg.isStatic
            ) {
              extractIdentifiers(ids, prop.arg)
            }

            if (ids) {
              if (prop.name === 'for' && prop.forParseResult) {
                // v-for 的 source 在解析后挂在 forParseResult 里，不能只看原始 prop.exp。
                extractIdentifiers(ids, prop.forParseResult.source)
              } else if (prop.exp) {
                extractIdentifiers(ids, prop.exp)
              } else if (
                prop.name === 'bind' &&
                prop.arg &&
                prop.arg.type === NodeTypes.SIMPLE_EXPRESSION
              ) {
                ids.add(camelize(prop.arg.content))
              }
            }
          }

          if (
            ids &&
            prop.type === NodeTypes.ATTRIBUTE &&
            prop.name === 'ref' &&
            prop.value?.content
          ) {
            // 模板 ref 名字也会在脚本侧以绑定形式被消费。
            ids.add(prop.value.content)
          }
        }

        node.children.forEach(walk)
        break
      }
      case NodeTypes.INTERPOLATION:
        if (ids) {
          extractIdentifiers(ids, node.content)
        }
        break
    }
  }

  const result = {
    usedIds: ids,
    vModelIds,
  }
  templateAnalysisCache.set(content, result)
  return result
}

function extractIdentifiers(ids: Set<string>, node: ExpressionNode) {
  // 表达式如果已经有 AST，就按 AST 精确抽取标识符；
  // 否则退化成直接使用简单表达式内容。
  if ((node as ExpressionNode & { ast?: unknown }).ast) {
    walkIdentifiers((node as ExpressionNode & { ast: any }).ast, id =>
      ids.add(id.name),
    )
  } else if ((node as ExpressionNode & { ast?: unknown }).ast === null) {
    ids.add((node as SimpleExpressionNode).content)
  }
}
