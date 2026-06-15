import Editor, { OnMount } from '@monaco-editor/react'
import type * as monaco from 'monaco-editor'
import { useEffect, useRef } from 'react'
import * as Y from 'yjs'
import { MonacoBinding } from 'y-monaco'
import { resolveEncodedRange } from '../collab/relativePosition'
import type { AnnotationRecord } from '../types'

type MonacoCodeEditorProps = {
  ydoc: Y.Doc | null
  codeText: Y.Text | null
  language: string
  readOnly: boolean
  comments: AnnotationRecord[]
  highlights: AnnotationRecord[]
  remarks: AnnotationRecord[]
  onCodeChange: (code: string) => void
  onSelectionChange: (selection: monaco.Selection | null) => void
  onCursorChange: (selection: monaco.Selection | null) => void
}

export default function MonacoCodeEditor({
  ydoc,
  codeText,
  language,
  readOnly,
  comments,
  highlights,
  remarks,
  onCodeChange,
  onSelectionChange,
  onCursorChange
}: MonacoCodeEditorProps) {
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null)
  const monacoRef = useRef<typeof monaco | null>(null)
  const bindingRef = useRef<MonacoBinding | null>(null)
  const decorationIdsRef = useRef<string[]>([])

  const handleMount: OnMount = (editor, monacoApi) => {
    editorRef.current = editor
    monacoRef.current = monacoApi

    editor.onDidChangeCursorSelection((event) => {
      onSelectionChange(event.selection.isEmpty() ? null : event.selection)
      onCursorChange(event.selection)
    })

    onCodeChange(editor.getValue())
    editor.onDidChangeModelContent(() => {
      onCodeChange(editor.getValue())
    })
  }

  useEffect(() => {
    const editor = editorRef.current
    const model = editor?.getModel()
    if (!editor || !model || !codeText) {
      return
    }

    bindingRef.current?.destroy()
    if (model.getValue() !== codeText.toString()) {
      model.setValue(codeText.toString())
    }
    bindingRef.current = new MonacoBinding(codeText, model, new Set([editor]))

    return () => {
      bindingRef.current?.destroy()
      bindingRef.current = null
    }
  }, [codeText])

  useEffect(() => {
    editorRef.current?.updateOptions({ readOnly })
  }, [readOnly])

  useEffect(() => {
    const monacoApi = monacoRef.current
    const model = editorRef.current?.getModel()
    if (monacoApi && model) {
      monacoApi.editor.setModelLanguage(model, language)
    }
  }, [language])

  useEffect(() => {
    const editor = editorRef.current
    const monacoApi = monacoRef.current
    const model = editor?.getModel()
    if (!editor || !monacoApi || !model || !ydoc) {
      return
    }

    const nextDecorations: monaco.editor.IModelDeltaDecoration[] = []
    for (const item of comments) {
      pushDecoration(nextDecorations, ydoc, model, monacoApi, item, 'commentDecoration')
    }
    for (const item of highlights) {
      pushDecoration(nextDecorations, ydoc, model, monacoApi, item, 'highlightDecoration')
    }
    for (const item of remarks) {
      pushDecoration(nextDecorations, ydoc, model, monacoApi, item, 'remarkDecoration')
    }

    decorationIdsRef.current = editor.deltaDecorations(decorationIdsRef.current, nextDecorations)
  }, [ydoc, comments, highlights, remarks])

  return (
    <Editor
      height="100%"
      language={language}
      onMount={handleMount}
      options={{
        fontSize: 14,
        glyphMargin: true,
        minimap: { enabled: false },
        readOnly,
        scrollBeyondLastLine: false,
        tabSize: 2
      }}
      theme="vs"
    />
  )
}

function pushDecoration(
  decorations: monaco.editor.IModelDeltaDecoration[],
  ydoc: Y.Doc,
  model: monaco.editor.ITextModel,
  monacoApi: typeof monaco,
  item: AnnotationRecord,
  className: string
) {
  const range = resolveEncodedRange(ydoc, item)
  if (!range) {
    return
  }

  const start = model.getPositionAt(range.start)
  const end = model.getPositionAt(range.end)
  decorations.push({
    range: new monacoApi.Range(start.lineNumber, start.column, end.lineNumber, end.column),
    options: {
      className,
      hoverMessage: { value: item.content },
      stickiness: monacoApi.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges
    }
  })
}
