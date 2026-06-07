import type {
  ArrayPattern,
  FunctionDeclaration,
  ImportDeclaration,
  Node,
  ObjectExpression,
  ObjectPattern,
  Statement,
  VariableDeclaration,
  VariableDeclarator,
} from '@babel/types'
import { BindingTypes } from '@vue-source/compiler-core'
import type { ScriptCompileContext } from './context'
import { isCallOf } from './utils'

export function analyzeScriptBindings(ctx: ScriptCompileContext) {
  if (!ctx.program) return

  // 对 `<script setup>` 来说，这一步先只回答一个问题：
  // 当前脚本顶层都声明了哪些名字，它们大致属于哪类绑定。
  for (const stmt of ctx.program.body) {
    analyzeStatement(stmt, ctx)
  }
}

export function analyzeNormalScriptBindings(
  ctx: ScriptCompileContext,
  body: Statement[],
) {
  // 普通 `<script>` 还要兼顾 Options API，所以会额外分析
  // `export default { props, data, methods, computed, setup }` 这一层结构。
  for (const stmt of body) {
    if (
      stmt.type === 'ExportDefaultDeclaration' &&
      stmt.declaration.type === 'ObjectExpression'
    ) {
      analyzeBindingsFromOptions(ctx, stmt.declaration)
    }
    analyzeStatement(stmt, ctx)
  }
}

function analyzeStatement(stmt: Statement, ctx: ScriptCompileContext) {
  // 这里只覆盖最关键的顶层声明类型。
  // 更细的表达式求值不在这一层做，避免把绑定分析变成完整解释器。
  if (stmt.type === 'ImportDeclaration') {
    analyzeImport(stmt, ctx)
    return
  }
  if (stmt.type === 'VariableDeclaration') {
    analyzeVariableDeclaration(stmt, ctx)
    return
  }
  if (stmt.type === 'FunctionDeclaration') {
    analyzeFunctionDeclaration(stmt, ctx)
    return
  }
  if (stmt.type === 'ClassDeclaration' && stmt.id) {
    ctx.markBinding(stmt.id.name, BindingTypes.SETUP_CONST)
  }
}

function analyzeImport(node: ImportDeclaration, ctx: ScriptCompileContext) {
  for (const specifier of node.specifiers) {
    const imported =
      specifier.type === 'ImportDefaultSpecifier'
        ? 'default'
        : specifier.type === 'ImportNamespaceSpecifier'
          ? '*'
          : specifier.imported.type === 'Identifier'
            ? specifier.imported.name
            : specifier.imported.value

    ctx.imports[specifier.local.name] = {
      imported,
      local: specifier.local.name,
      source: node.source.value,
      isType: !!node.importKind && node.importKind === 'type',
      isFromSetup: false,
      isUsedInTemplate: false,
    }
    // import 过来的名字默认先记成 setup 绑定。
    // 如果是运行时 import，通常只能确定“可能是 ref”；如果是 type import，
    // 则更接近普通常量语义。
    ctx.markBinding(
      specifier.local.name,
      node.importKind === 'type'
        ? BindingTypes.SETUP_CONST
        : BindingTypes.SETUP_MAYBE_REF,
    )
  }
}

function analyzeVariableDeclaration(
  node: VariableDeclaration,
  ctx: ScriptCompileContext,
) {
  for (const decl of node.declarations) {
    analyzeDeclarator(decl, node.kind, ctx)
  }
}

function analyzeDeclarator(
  decl: VariableDeclarator,
  kind: VariableDeclaration['kind'],
  ctx: ScriptCompileContext,
) {
  const isConst = kind === 'const'
  // reactive 允许被 alias import，所以这里先解析出它在当前文件里的本地名字。
  const reactiveBinding = resolveVueImportAlias(ctx, 'reactive')

  if (decl.id.type === 'Identifier') {
    // 非解构声明可以直接根据 init 形态推断绑定类别。
    ctx.markBinding(
      decl.id.name,
      resolveBindingType(decl.init, isConst, reactiveBinding, ctx),
    )
    return
  }

  walkPattern(decl.id, ctx, isConst)
}

function analyzeFunctionDeclaration(
  node: FunctionDeclaration,
  ctx: ScriptCompileContext,
) {
  if (node.id) {
    ctx.markBinding(node.id.name, BindingTypes.SETUP_CONST)
  }
}

function walkPattern(
  node: Node,
  ctx: ScriptCompileContext,
  isConst: boolean,
) {
  // 解构场景下要把每个叶子变量都展开登记，否则模板里引用其中某个名字时
  // bindingMetadata 会缺项。
  if (node.type === 'Identifier') {
    ctx.markBinding(
      node.name,
      isConst ? BindingTypes.SETUP_MAYBE_REF : BindingTypes.SETUP_LET,
    )
    return
  }

  if (node.type === 'RestElement') {
    if (node.argument.type === 'Identifier') {
      ctx.markBinding(
        node.argument.name,
        isConst ? BindingTypes.SETUP_CONST : BindingTypes.SETUP_LET,
      )
    }
    return
  }

  if (node.type === 'AssignmentPattern') {
    walkPattern(node.left, ctx, isConst)
    return
  }

  if (node.type === 'ObjectPattern') {
    walkObjectPattern(node, ctx, isConst)
    return
  }

  if (node.type === 'ArrayPattern') {
    walkArrayPattern(node, ctx, isConst)
  }
}

function walkObjectPattern(
  node: ObjectPattern,
  ctx: ScriptCompileContext,
  isConst: boolean,
) {
  for (const prop of node.properties) {
    if (prop.type === 'ObjectProperty') {
      walkPattern(prop.value, ctx, isConst)
    } else if (prop.type === 'RestElement') {
      walkPattern(prop, ctx, isConst)
    }
  }
}

function walkArrayPattern(
  node: ArrayPattern,
  ctx: ScriptCompileContext,
  isConst: boolean,
) {
  for (const element of node.elements) {
    if (element) {
      walkPattern(element, ctx, isConst)
    }
  }
}

function resolveBindingType(
  init: VariableDeclarator['init'],
  isConst: boolean,
  reactiveBinding: string,
  ctx: ScriptCompileContext,
): BindingTypes {
  // 这套规则的目标不是精确模拟 JS 运行时，而是尽量让模板编译阶段知道：
  // 这个名字更像普通常量、响应式对象、ref，还是“可能是 ref”。
  if (!isConst) {
    return BindingTypes.SETUP_LET
  }

  if (!init) {
    return BindingTypes.SETUP_CONST
  }

  if (isStaticNode(init)) {
    return BindingTypes.LITERAL_CONST
  }

  if (isCallOf(init, reactiveBinding)) {
    return BindingTypes.SETUP_REACTIVE_CONST
  }

  if (
    isCallOf(init, 'defineProps') ||
    isCallOf(init, 'withDefaults') ||
    isCallOf(init, 'defineSlots')
  ) {
    // 这些宏返回的值都带明显的响应式/代理语义，模板侧应按 reactive const 看待。
    return BindingTypes.SETUP_REACTIVE_CONST
  }

  if (
    isCallOf(init, 'defineEmits') ||
    isCallOf(init, resolveVueImportAlias(ctx, 'ref')) ||
    isCallOf(init, resolveVueImportAlias(ctx, 'computed')) ||
    isCallOf(init, resolveVueImportAlias(ctx, 'shallowRef')) ||
    isCallOf(init, resolveVueImportAlias(ctx, 'customRef')) ||
    isCallOf(init, resolveVueImportAlias(ctx, 'toRef')) ||
    isCallOf(init, resolveVueImportAlias(ctx, 'useTemplateRef')) ||
    isCallOf(init, 'defineModel')
  ) {
    // ref / computed / defineModel 等返回值在模板里都应按 ref 语义处理。
    return BindingTypes.SETUP_REF
  }

  if (canNeverBeRef(init, reactiveBinding)) {
    return BindingTypes.SETUP_CONST
  }

  return BindingTypes.SETUP_MAYBE_REF
}

function resolveVueImportAlias(
  ctx: ScriptCompileContext,
  imported: string,
): string {
  // 允许 `import { ref as myRef } from 'vue'` 这种别名情况，
  // 所以绑定分析不能死看字面量名字。
  for (const binding of Object.values(ctx.imports)) {
    if (binding.source === 'vue' && binding.imported === imported) {
      return binding.local
    }
  }
  return imported
}

function canNeverBeRef(node: Node, reactiveBinding: string): boolean {
  // 一些 AST 形态天然不可能是 ref 值，提前识别后可以把绑定类别
  // 从 MAYBE_REF 收窄成 SETUP_CONST。
  if (isCallOf(node, reactiveBinding)) {
    return true
  }

  switch (node.type) {
    case 'UnaryExpression':
    case 'BinaryExpression':
    case 'ArrayExpression':
    case 'ObjectExpression':
    case 'FunctionExpression':
    case 'ArrowFunctionExpression':
    case 'UpdateExpression':
    case 'ClassExpression':
    case 'TaggedTemplateExpression':
      return true
    case 'SequenceExpression':
      return canNeverBeRef(
        node.expressions[node.expressions.length - 1],
        reactiveBinding,
      )
    case 'StringLiteral':
    case 'NumericLiteral':
    case 'BooleanLiteral':
    case 'NullLiteral':
    case 'BigIntLiteral':
    case 'TemplateLiteral':
      return true
    default:
      return false
  }
}

function isStaticNode(node: Node): boolean {
  switch (node.type) {
    case 'StringLiteral':
    case 'NumericLiteral':
    case 'BooleanLiteral':
    case 'NullLiteral':
    case 'BigIntLiteral':
      return true
    default:
      return false
  }
}

function analyzeBindingsFromOptions(
  ctx: ScriptCompileContext,
  node: ObjectExpression,
) {
  for (const property of node.properties) {
    if (
      property.type === 'ObjectProperty' &&
      !property.computed &&
      property.key.type === 'Identifier'
    ) {
      if (property.key.name === 'props') {
        for (const key of getObjectOrArrayExpressionKeys(property.value)) {
          ctx.markBinding(key, BindingTypes.PROPS)
        }
      } else if (property.key.name === 'inject') {
        for (const key of getObjectOrArrayExpressionKeys(property.value)) {
          ctx.markBinding(key, BindingTypes.OPTIONS)
        }
      } else if (
        property.value.type === 'ObjectExpression' &&
        (property.key.name === 'computed' || property.key.name === 'methods')
      ) {
        for (const key of getObjectExpressionKeys(property.value)) {
          ctx.markBinding(key, BindingTypes.OPTIONS)
        }
      }
    } else if (
      property.type === 'ObjectMethod' &&
      property.key.type === 'Identifier' &&
      (property.key.name === 'setup' || property.key.name === 'data')
    ) {
      for (const bodyItem of property.body.body) {
        if (
          bodyItem.type === 'ReturnStatement' &&
          bodyItem.argument &&
          bodyItem.argument.type === 'ObjectExpression'
        ) {
          for (const key of getObjectExpressionKeys(bodyItem.argument)) {
            ctx.markBinding(
              key,
              property.key.name === 'setup'
                ? BindingTypes.SETUP_MAYBE_REF
                : BindingTypes.DATA,
            )
          }
        }
      }
    }
  }
}

function getObjectExpressionKeys(node: ObjectExpression): string[] {
  const keys: string[] = []
  for (const prop of node.properties) {
    if (prop.type === 'SpreadElement') continue
    if (prop.key.type === 'Identifier') {
      keys.push(prop.key.name)
    } else if (prop.key.type === 'StringLiteral') {
      keys.push(prop.key.value)
    } else if (prop.key.type === 'NumericLiteral') {
      keys.push(String(prop.key.value))
    }
  }
  return keys
}

function getArrayExpressionKeys(node: import('@babel/types').ArrayExpression): string[] {
  const keys: string[] = []
  for (const element of node.elements) {
    if (element && element.type === 'StringLiteral') {
      keys.push(element.value)
    }
  }
  return keys
}

function getObjectOrArrayExpressionKeys(
  value: import('@babel/types').Node,
): string[] {
  if (value.type === 'ArrayExpression') {
    return getArrayExpressionKeys(value)
  }
  if (value.type === 'ObjectExpression') {
    return getObjectExpressionKeys(value)
  }
  return []
}
