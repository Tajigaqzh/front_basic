import { parse as parseJS } from '@babel/parser'
import type { Node, ObjectPattern, Program, TSType } from '@babel/types'
import { BindingTypes, type BindingMetadata } from '@vue-source/compiler-core'
import type { SFCDescriptor, SFCScriptBlock } from '../parse'
import type { ModelDecl, ScriptBinding, ScriptCompileResult, SFCScriptCompileOptions } from '../compileScript'
import type { PropsDestructureBinding } from './definePropsDestructure'

export interface ScriptSetupState {
  hasDefinePropsCall: boolean
  hasDefineEmitsCall: boolean
  hasDefineModelCall: boolean
  hasDefineExposeCall: boolean
  hasDefineSlotsCall: boolean
  hasDefineOptionsCall: boolean
}

export interface ImportBinding {
  imported: string
  local: string
  source: string
  isType: boolean
  isFromSetup?: boolean
  isUsedInTemplate?: boolean
}

export class ScriptCompileContext {
  // ScriptCompileContext 是 compileScript 期间的“总账本”。
  // 它把脚本 AST、宏分析结果、运行时 options、模板使用信息都收在一起，
  // 这样不同步骤就不必互相直接传很多零散参数。
  block: SFCScriptBlock | null
  content: string
  scriptAst: Program | null
  program: Program | null
  bindings: Record<string, ScriptBinding['kind']> = {}
  bindingMetadata: BindingMetadata = {}
  imports: Record<string, ImportBinding> = {}
  propsDecl: string | null = null
  propsRuntimeDefaults: string | null = null
  propsTypeDecl: TSType | null = null
  propsDestructureDecl: ObjectPattern | null = null
  propsDestructuredBindings: Record<string, PropsDestructureBinding> = {}
  propsDestructureRestId: string | null = null
  emitsDecl: string | null = null
  modelsDecl: ModelDecl[] = []
  runtimeProps: string | null = null
  runtimeEmits: string | null = null
  runtimeModelProps: string | null = null
  runtimeOptions: string[] = []
  helperImports: string[] = []
  generatedOptionsCode = ''
  hasTopLevelAwait = false
  optionsDecl: string | null = null
  exposeDecl: string | null = null
  slotsDecl: string | null = null
  templateUsage = {
    usedImports: [] as string[],
    usedIdentifiers: [] as string[],
    vModelIdentifiers: [] as string[],
  }
  setup: ScriptSetupState = {
    hasDefinePropsCall: false,
    hasDefineEmitsCall: false,
    hasDefineModelCall: false,
    hasDefineExposeCall: false,
    hasDefineSlotsCall: false,
    hasDefineOptionsCall: false,
  }

  constructor(
    public descriptor: SFCDescriptor,
    public options: SFCScriptCompileOptions = {},
  ) {
    this.block = descriptor.scriptSetup ?? descriptor.script
    this.content = this.block?.content ?? ''
    // 普通 `<script>` 与 `<script setup>` 会分别 parse 成两份 AST，
    // 因为后续它们的处理路径并不完全相同。
    this.scriptAst =
      descriptor.script && descriptor.script.content.trim()
        ? parseJS(descriptor.script.content, {
            sourceType: 'module',
            plugins: ['typescript'],
          }).program
        : null
    this.program =
      descriptor.scriptSetup && this.content.trim()
        ? parseJS(this.content, {
            sourceType: 'module',
            plugins: ['typescript'],
          }).program
        : null
  }

  toResult(): ScriptCompileResult {
    if (this.block) {
      // 把编译期间收集到的 bindings / imports / AST 回填给 block，
      // 方便上层或调试逻辑继续读取这次编译得到的中间信息。
      this.block.bindings = this.bindingMetadata
      this.block.imports = this.imports
      if (this.scriptAst) {
        this.block.scriptAst = this.scriptAst.body
      }
      if (this.program) {
        this.block.scriptSetupAst = this.program.body
      }
    }

    return {
      filename: this.descriptor.filename,
      content: this.content,
      bindings: this.bindings,
      bindingMetadata: this.bindingMetadata,
      script: this.block,
      propsDecl: this.propsDecl,
      emitsDecl: this.emitsDecl,
      modelsDecl: this.modelsDecl,
      runtimeProps: this.runtimeProps,
      runtimeEmits: this.runtimeEmits,
      runtimeModelProps: this.runtimeModelProps,
      runtimeOptions: this.runtimeOptions,
      helperImports: this.helperImports,
      generatedOptionsCode: this.generatedOptionsCode,
      setup: {
        hasDefinePropsCall: this.setup.hasDefinePropsCall,
        hasDefineEmitsCall: this.setup.hasDefineEmitsCall,
        hasDefineModelCall: this.setup.hasDefineModelCall,
      },
      optionsDecl: this.optionsDecl,
      exposeDecl: this.exposeDecl,
      slotsDecl: this.slotsDecl,
      imports: this.imports,
      templateUsage: this.templateUsage,
    }
  }

  slice(node: Node | null | undefined): string | null {
    // 根据 Babel 节点的 start/end 直接回切源码字符串，
    // 很多宏处理逻辑都是“提取原始代码片段再拼回输出”。
    if (!node || node.start == null || node.end == null) {
      return null
    }
    return this.content.slice(node.start, node.end)
  }

  markBinding(name: string, type: BindingTypes) {
    // bindingMetadata 是 template 编译阶段最关心的上下文之一：
    // 模板里的名字到底是 props、setup const、ref 还是别的绑定类型。
    this.bindingMetadata[name] = type
  }

  helper(name: string): string {
    // helperImports 去重收集真正用到的运行时 helper，
    // 返回值则直接给字符串代码生成阶段使用。
    if (!this.helperImports.includes(name)) {
      this.helperImports.push(name)
    }
    return `_${name}`
  }

  reparse() {
    // props 解构重写、顶层 await 改写这类步骤会直接修改 content 字符串。
    // 改完后原 AST 已经过期，所以必须重新 parse。
    this.program = this.content.trim()
      ? parseJS(this.content, {
          sourceType: 'module',
          plugins: ['typescript'],
        }).program
      : null

    if (this.block && this.block === this.descriptor.scriptSetup && this.program) {
      this.block.scriptSetupAst = this.program.body
    }
  }
}
