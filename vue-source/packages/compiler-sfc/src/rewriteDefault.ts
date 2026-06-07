import { parse } from '@babel/parser'
import type { ParserPlugin } from '@babel/parser'
import type { Identifier, Statement } from '@babel/types'
import MagicString from './magicString'

export function rewriteDefault(
  input: string,
  as: string,
  parserPlugins: ParserPlugin[] = ['typescript'],
): string {
  const ast = parse(input, {
    sourceType: 'module',
    plugins: parserPlugins,
  }).program.body
  const s = new MagicString(input)

  rewriteDefaultAST(ast, s, as)

  return s.toString()
}

export function rewriteDefaultAST(
  ast: Statement[],
  s: MagicString,
  as: string,
): void {
  if (!hasDefaultExport(ast)) {
    s.append(`\nconst ${as} = {}`)
    return
  }

  ast.forEach(node => {
    if (node.type === 'ExportDefaultDeclaration') {
      if (node.declaration.type === 'ClassDeclaration' && node.declaration.id) {
        const start =
          node.declaration.decorators && node.declaration.decorators.length > 0
            ? node.declaration.decorators[node.declaration.decorators.length - 1]
                .end!
            : node.start!
        s.overwrite(start, node.declaration.id.start!, ' class ')
        s.append(`\nconst ${as} = ${node.declaration.id.name}`)
      } else {
        s.overwrite(node.start!, node.declaration.start!, `const ${as} = `)
      }
    } else if (node.type === 'ExportNamedDeclaration') {
      for (const specifier of node.specifiers) {
        if (
          specifier.type === 'ExportSpecifier' &&
          specifier.exported.type === 'Identifier' &&
          specifier.exported.name === 'default'
        ) {
          if (node.source) {
            if (specifier.local.name === 'default') {
              s.prepend(
                `import { default as __VUE_DEFAULT__ } from '${node.source.value}'\n`,
              )
              const end = specifierEnd(s, specifier.local.end!, node.end!)
              s.remove(specifier.start!, end)
              s.append(`\nconst ${as} = __VUE_DEFAULT__`)
            } else {
              s.prepend(
                `import { ${s.slice(
                  specifier.local.start!,
                  specifier.local.end!,
                )} as __VUE_DEFAULT__ } from '${node.source.value}'\n`,
              )
              const end = specifierEnd(s, specifier.exported.end!, node.end!)
              s.remove(specifier.start!, end)
              s.append(`\nconst ${as} = __VUE_DEFAULT__`)
            }
            continue
          }

          const end = specifierEnd(s, specifier.end!, node.end!)
          s.remove(specifier.start!, end)
          s.append(`\nconst ${as} = ${specifier.local.name}`)
        }
      }
    }
  })
}

export function hasDefaultExport(ast: Statement[]): boolean {
  for (const stmt of ast) {
    if (stmt.type === 'ExportDefaultDeclaration') {
      return true
    }
    if (
      stmt.type === 'ExportNamedDeclaration' &&
      stmt.specifiers.some(
        spec => spec.type === 'ExportSpecifier' &&
          (spec.exported as Identifier).name === 'default',
      )
    ) {
      return true
    }
  }
  return false
}

function specifierEnd(s: MagicString, end: number, nodeEnd: number): number {
  let hasCommas = false
  const oldEnd = end
  while (end < nodeEnd) {
    const char = s.slice(end, end + 1)
    if (/\s/.test(char)) {
      end++
    } else if (char === ',') {
      end++
      hasCommas = true
      break
    } else if (char === '}') {
      break
    } else {
      break
    }
  }
  return hasCommas ? end : oldEnd
}
