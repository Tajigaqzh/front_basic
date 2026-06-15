import type * as monaco from 'monaco-editor'
import { message, Modal, Select } from 'antd'
import { FilePlus2, FolderPlus, Highlighter, MessageSquarePlus, PencilLine, Play, PlugZap, Send, Trash2 } from 'lucide-react'
import type { CSSProperties, KeyboardEvent } from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { BrowserRouter, Navigate, NavLink, Route, Routes } from 'react-router-dom'
import * as Y from 'yjs'
import { createEncodedRange } from './collab/relativePosition'
import { AwarenessState, Role, UserProfile, YjsMessageProvider } from './collab/yjsMessageProvider'
import MonacoCodeEditor from './editor/MonacoCodeEditor'
import type { AnnotationKind, AnnotationRecord } from './types'

const DEFAULT_SERVER_URL = 'ws://localhost:8080/collab'
const DEFAULT_FILE_ID = 'main-file'
const LANGUAGE_OPTIONS = [
  { id: 'javascript', label: 'JS', extension: 'js' },
  { id: 'typescript', label: 'TS', extension: 'ts' },
  { id: 'java', label: 'Java', extension: 'java' }
] as const

type CodeLanguage = typeof LANGUAGE_OPTIONS[number]['id']
type WorkspaceProps = {
  clientTitle: string
  defaultName: string
  fixedRole: Role
}
type ExecutionResult = {
  success: boolean
  language: string | null
  exitCode: number | null
  durationMs: number
  stdout: string
  stderr: string
  stackTrace: string
  error: string | null
}
type SubmissionResult = {
  success: boolean
  submissionId: string | null
  savedPath: string | null
  error: string | null
}
type WorkspaceItem = {
  id: string
  parentId: string | null
  name: string
  kind: 'file' | 'folder'
  language?: CodeLanguage
  createdAt: number
}
type PendingWorkspaceInput = {
  kind: 'file' | 'folder'
  parentId: string | null
  defaultName: string
}
type WorkspaceMaps = {
  meta: Y.Map<string>
  files: Y.Map<WorkspaceItem>
  comments: Y.Map<AnnotationRecord>
  highlights: Y.Map<AnnotationRecord>
  remarks: Y.Map<AnnotationRecord>
}

function createClientId() {
  const stored = localStorage.getItem('collab-client-id')
  if (stored) {
    return stored
  }
  const next = crypto.randomUUID()
  localStorage.setItem('collab-client-id', next)
  return next
}

function useViewportSize() {
  const [size, setSize] = useState(() => ({
    width: window.innerWidth,
    height: window.innerHeight
  }))

  useEffect(() => {
    function handleResize() {
      setSize({
        width: window.innerWidth,
        height: window.innerHeight
      })
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  return size
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Navigate replace to="/operator" />} path="/" />
        <Route
          element={<CollabWorkspace clientTitle="操作端 A" defaultName="Alice" fixedRole="A" />}
          path="/operator"
        />
        <Route
          element={<CollabWorkspace clientTitle="监视端 B" defaultName="Bob" fixedRole="B" />}
          path="/monitor"
        />
        <Route element={<Navigate replace to="/operator" />} path="*" />
      </Routes>
    </BrowserRouter>
  )
}

function CollabWorkspace({ clientTitle, defaultName, fixedRole }: WorkspaceProps) {
  const viewport = useViewportSize()
  const [serverUrl, setServerUrl] = useState(DEFAULT_SERVER_URL)
  const [roomId, setRoomId] = useState('demo-room')
  const [name, setName] = useState(defaultName)
  const role = fixedRole
  const [language, setLanguage] = useState<CodeLanguage>('javascript')
  const [status, setStatus] = useState<'idle' | 'connecting' | 'connected' | 'disconnected'>('idle')
  const [users, setUsers] = useState<AwarenessState[]>([])
  const [remotePresence, setRemotePresence] = useState<Record<string, AwarenessState>>({})
  const [ydoc, setYdoc] = useState<Y.Doc | null>(null)
  const [codeText, setCodeText] = useState<Y.Text | null>(null)
  const [draftCode, setDraftCode] = useState('')
  const [workspaceItems, setWorkspaceItems] = useState<WorkspaceItem[]>([])
  const [activeFileId, setActiveFileId] = useState(DEFAULT_FILE_ID)
  const [selectedItemId, setSelectedItemId] = useState<string | null>(DEFAULT_FILE_ID)
  const [pendingWorkspaceInput, setPendingWorkspaceInput] = useState<PendingWorkspaceInput | null>(null)
  const [selection, setSelection] = useState<monaco.Selection | null>(null)
  const [comments, setComments] = useState<AnnotationRecord[]>([])
  const [highlights, setHighlights] = useState<AnnotationRecord[]>([])
  const [remarks, setRemarks] = useState<AnnotationRecord[]>([])
  const [executionResult, setExecutionResult] = useState<ExecutionResult | null>(null)
  const [isExecuting, setIsExecuting] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const providerRef = useRef<YjsMessageProvider | null>(null)
  const mapsRef = useRef<WorkspaceMaps | null>(null)

  const user = useMemo<UserProfile>(() => ({
    clientId: createClientId(),
    name,
    role,
    color: role === 'A' ? '#2563eb' : role === 'B' ? '#16a34a' : '#64748b'
  }), [name, role])

  const permission = {
    canEditCode: role === 'A' || role === 'B',
    canChangeLanguage: role === 'A' || role === 'B',
    canComment: role === 'A' || role === 'B',
    canHighlight: role === 'A' || role === 'B',
    canRemark: role === 'A' || role === 'B'
  }
  const activeLanguage = LANGUAGE_OPTIONS.find((item) => item.id === language) ?? LANGUAGE_OPTIONS[0]
  const activeFile = workspaceItems.find((item) => item.id === activeFileId && item.kind === 'file')
  const selectedItem = selectedItemId ? workspaceItems.find((item) => item.id === selectedItemId) : null
  const creationParentId = selectedItem?.kind === 'folder' ? selectedItem.id : selectedItem?.parentId ?? null
  const visibleComments = comments.filter((item) => (item.fileId ?? DEFAULT_FILE_ID) === activeFileId)
  const visibleHighlights = highlights.filter((item) => (item.fileId ?? DEFAULT_FILE_ID) === activeFileId)
  const visibleRemarks = remarks.filter((item) => (item.fileId ?? DEFAULT_FILE_ID) === activeFileId)

  function activateFile(fileId: string, doc: Y.Doc, meta: Y.Map<string>, files: Y.Map<WorkspaceItem>) {
    const file = files.get(fileId)
    if (!file || file.kind !== 'file') {
      return
    }

    setActiveFileId(fileId)
    setSelectedItemId(fileId)
    setCodeText(doc.getText(fileTextKey(fileId)))
    setDraftCode(doc.getText(fileTextKey(fileId)).toString())
    setLanguage(file.language ?? 'javascript')
    if (meta.get('language') !== (file.language ?? 'javascript')) {
      meta.set('language', file.language ?? 'javascript')
    }
  }

  function connect() {
    providerRef.current?.destroy()

    const nextDoc = new Y.Doc()
    const nextMeta = nextDoc.getMap<string>('meta')
    const nextFiles = nextDoc.getMap<WorkspaceItem>('files')
    const nextComments = nextDoc.getMap<AnnotationRecord>('comments')
    const nextHighlights = nextDoc.getMap<AnnotationRecord>('highlights')
    const nextRemarks = nextDoc.getMap<AnnotationRecord>('remarks')
    mapsRef.current = {
      meta: nextMeta,
      files: nextFiles,
      comments: nextComments,
      highlights: nextHighlights,
      remarks: nextRemarks
    }

    const syncMeta = () => {
      const currentFile = nextFiles.get(activeFileId)
      if (currentFile?.kind === 'file') {
        setLanguage(currentFile.language ?? 'javascript')
      }
    }

    const syncFiles = () => {
      const nextItems = sortWorkspaceItems(Array.from(nextFiles.values()))
      setWorkspaceItems(nextItems)

      if (!nextFiles.get(activeFileId)) {
        const firstFile = nextItems.find((item) => item.kind === 'file')
        if (firstFile) {
          activateFile(firstFile.id, nextDoc, nextMeta, nextFiles)
        }
      }
    }

    const syncAnnotations = () => {
      setComments(Array.from(nextComments.values()))
      setHighlights(Array.from(nextHighlights.values()))
      setRemarks(Array.from(nextRemarks.values()))
    }

    nextMeta.observe(syncMeta)
    nextFiles.observe(syncFiles)
    nextComments.observe(syncAnnotations)
    nextHighlights.observe(syncAnnotations)
    nextRemarks.observe(syncAnnotations)

    providerRef.current = new YjsMessageProvider({
      serverUrl,
      roomId,
      user,
      doc: nextDoc,
      onStatusChange: setStatus,
      onUsersChange: setUsers,
      onAwarenessChange: (presence) => {
        setRemotePresence((current) => ({
          ...current,
          [presence.clientId]: presence
        }))
      },
      onSnapshotApplied: () => {
        ensureDefaultFile(nextDoc, nextFiles, nextMeta, language)
        if (!nextMeta.get('language')) {
          nextMeta.set('language', language)
        }
        activateFile(nextFiles.get(activeFileId)?.kind === 'file' ? activeFileId : DEFAULT_FILE_ID, nextDoc, nextMeta, nextFiles)
        syncFiles()
      }
    })

    ensureDefaultFile(nextDoc, nextFiles, nextMeta, language)
    setYdoc(nextDoc)
    activateFile(nextFiles.get(activeFileId)?.kind === 'file' ? activeFileId : DEFAULT_FILE_ID, nextDoc, nextMeta, nextFiles)
    syncMeta()
    syncFiles()
    syncAnnotations()
  }

  function handleLanguageChange(nextLanguage: CodeLanguage) {
    if (!permission.canChangeLanguage) {
      return
    }

    setLanguage(nextLanguage)
    mapsRef.current?.meta.set('language', nextLanguage)
    if (activeFile) {
      mapsRef.current?.files.set(activeFile.id, {
        ...activeFile,
        language: nextLanguage
      })
    }
  }

  function handleSelectFile(fileId: string) {
    if (!ydoc || !mapsRef.current) {
      return
    }
    activateFile(fileId, ydoc, mapsRef.current.meta, mapsRef.current.files)
    setSelection(null)
    setExecutionResult(null)
  }

  function handleSelectFolder(folderId: string) {
    setSelectedItemId(folderId)
  }

  function createWorkspaceFile() {
    if (!ydoc || !mapsRef.current) {
      return
    }

    setPendingWorkspaceInput({
      kind: 'file',
      parentId: creationParentId,
      defaultName: nextAvailableName(workspaceItems, creationParentId, 'solution.js')
    })
  }

  function createWorkspaceFolder() {
    if (!mapsRef.current) {
      return
    }

    setPendingWorkspaceInput({
      kind: 'folder',
      parentId: creationParentId,
      defaultName: nextAvailableName(workspaceItems, creationParentId, 'question')
    })
  }

  function commitWorkspaceInput(rawName: string) {
    const maps = mapsRef.current
    if (!ydoc || !maps || !pendingWorkspaceInput) {
      return
    }

    const sanitizedName = sanitizeItemName(rawName)
    if (!sanitizedName) {
      setPendingWorkspaceInput(null)
      return
    }

    const name = nextAvailableName(workspaceItems, pendingWorkspaceInput.parentId, sanitizedName)
    const item: WorkspaceItem = {
      id: crypto.randomUUID(),
      parentId: pendingWorkspaceInput.parentId,
      name,
      kind: pendingWorkspaceInput.kind,
      language: pendingWorkspaceInput.kind === 'file' ? languageFromFileName(name) ?? language : undefined,
      createdAt: Date.now()
    }

    maps.files.set(item.id, item)
    setPendingWorkspaceInput(null)

    if (item.kind === 'file') {
      activateFile(item.id, ydoc, maps.meta, maps.files)
    } else {
      setSelectedItemId(item.id)
    }
  }

  function deleteWorkspaceItem(itemId: string) {
    const maps = mapsRef.current
    if (!ydoc || !maps) {
      return
    }

    const item = maps.files.get(itemId)
    if (!item) {
      return
    }

    const idsToDelete = collectDescendantIds(workspaceItems, itemId)
    const deleteTarget = item.kind === 'folder' ? '文件夹' : '文件'

    Modal.confirm({
      title: `删除${deleteTarget}`,
      content: item.kind === 'folder'
        ? `确定删除文件夹“${item.name}”及其所有子项吗？`
        : `确定删除文件“${item.name}”吗？`,
      okText: '删除',
      okButtonProps: { danger: true },
      cancelText: '取消',
      onOk: () => {
        for (const id of idsToDelete) {
          maps.files.delete(id)
          deleteAnnotationsForFile(maps.comments, id)
          deleteAnnotationsForFile(maps.highlights, id)
          deleteAnnotationsForFile(maps.remarks, id)
        }

        setPendingWorkspaceInput(null)

        if (idsToDelete.includes(activeFileId)) {
          const nextFile = workspaceItems.find((candidate) => candidate.kind === 'file' && !idsToDelete.includes(candidate.id))
          if (nextFile) {
            activateFile(nextFile.id, ydoc, maps.meta, maps.files)
          } else {
            setActiveFileId('')
            setSelectedItemId(null)
            setCodeText(null)
            setDraftCode('')
          }
          setExecutionResult(null)
          setSelection(null)
        } else if (selectedItemId && idsToDelete.includes(selectedItemId)) {
          setSelectedItemId(activeFileId || null)
        }
      }
    })
  }

  function addAnnotation(kind: AnnotationKind) {
    if (!selection || !codeText || !mapsRef.current) {
      return
    }

    const model = codeText.toString()
    const startOffset = getOffsetFromSelectionText(model, selection, 'start')
    const endOffset = getOffsetFromSelectionText(model, selection, 'end')
    if (startOffset === endOffset) {
      return
    }

    const range = createEncodedRange(codeText, startOffset, endOffset)
    const content = window.prompt(kind === 'highlight' ? '高亮说明' : kind === 'remark' ? '备注内容' : '注释内容')
    if (!content) {
      return
    }

    const record: AnnotationRecord = {
      id: crypto.randomUUID(),
      kind,
      fileId: activeFileId,
      authorId: user.clientId,
      authorName: user.name,
      content,
      color: kind === 'highlight' ? '#facc15' : undefined,
      ...range,
      createdAt: Date.now(),
      updatedAt: Date.now()
    }

    if (kind === 'comment') {
      mapsRef.current.comments.set(record.id, record)
    } else if (kind === 'highlight') {
      mapsRef.current.highlights.set(record.id, record)
    } else {
      mapsRef.current.remarks.set(record.id, record)
    }
  }

  function handleCursorChange(cursorSelection: monaco.Selection | null) {
    providerRef.current?.sendAwareness({
      ...user,
      cursor: cursorSelection
        ? {
          anchorLineNumber: cursorSelection.selectionStartLineNumber,
          anchorColumn: cursorSelection.selectionStartColumn,
          positionLineNumber: cursorSelection.positionLineNumber,
          positionColumn: cursorSelection.positionColumn
        }
        : undefined
    })
  }

  async function handleExecute() {
    const code = draftCode || codeText?.toString() || ''
    if (!code.trim() || isExecuting) {
      return
    }

    setIsExecuting(true)
    setExecutionResult(null)

    try {
      const response = await fetch('http://localhost:8080/api/execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          language,
          fileName: activeFile?.name ?? `main.${activeLanguage.extension}`,
          code
        })
      })

      const payload = await response.json() as ExecutionResult
      setExecutionResult(payload)
    } catch (error) {
      setExecutionResult({
        success: false,
        language,
        exitCode: null,
        durationMs: 0,
        stdout: '',
        stderr: '',
        stackTrace: error instanceof Error ? error.stack ?? error.message : String(error),
        error: 'request-failed'
      })
    } finally {
      setIsExecuting(false)
    }
  }

  async function handleSubmitWorkspace() {
    if (!ydoc || workspaceItems.length === 0 || isSubmitting) {
      return
    }

    setIsSubmitting(true)

    try {
      const files = workspaceItems.map((item) => ({
        id: item.id,
        parentId: item.parentId,
        name: item.name,
        kind: item.kind,
        language: item.language ?? null,
        code: item.kind === 'file' ? ydoc.getText(fileTextKey(item.id)).toString() : null
      }))

      const response = await fetch('http://localhost:8080/api/submissions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          roomId,
          clientId: user.clientId,
          userName: user.name,
          role: user.role,
          files
        })
      })

      const payload = await response.json() as SubmissionResult
      if (response.ok && payload.success) {
        message.success('提交成功')
      } else {
        message.error(payload.error ?? '提交失败')
      }
    } catch (error) {
      message.error(error instanceof Error ? error.message : '提交失败')
    } finally {
      setIsSubmitting(false)
    }
  }

  const consoleHeight = Math.max(128, Math.min(220, Math.floor(viewport.height * 0.24)))

  return (
    <main
      className="app"
      style={{
        '--viewport-height': `${viewport.height}px`,
        '--console-height': `${consoleHeight}px`
      } as CSSProperties}
    >
      <aside className="sidebar">
        <section className="panel">
          <div className="panelTitle">Connection</div>
          <nav className="routeTabs" aria-label="Client routes">
            <NavLink to="/operator">操作端 A</NavLink>
            <NavLink to="/monitor">监视端 B</NavLink>
          </nav>
          <div className="clientSummary">
            <span>{clientTitle}</span>
            <strong>{role}</strong>
          </div>
          <label>
            Server
            <input value={serverUrl} onChange={(event) => setServerUrl(event.target.value)} />
          </label>
          <label>
            Room
            <input value={roomId} onChange={(event) => setRoomId(event.target.value)} />
          </label>
          <label>
            Name
            <input value={name} onChange={(event) => setName(event.target.value)} />
          </label>
          <button className="primaryButton" type="button" onClick={connect}>
            <PlugZap size={16} />
            Connect
          </button>
          <div className={`status ${status}`}>{status}</div>
        </section>

        <section className="panel">
          <div className="panelHeader">
            <div className="panelTitle">Files</div>
            <div className="panelTools">
              <button type="button" title="新建文件" disabled={!ydoc} onClick={createWorkspaceFile}>
                <FilePlus2 size={15} />
              </button>
              <button type="button" title="新建文件夹" disabled={!ydoc} onClick={createWorkspaceFolder}>
                <FolderPlus size={15} />
              </button>
            </div>
          </div>
          <WorkspaceTree
            activeFileId={activeFileId}
            items={workspaceItems}
            pendingInput={pendingWorkspaceInput}
            selectedItemId={selectedItemId}
            onCancelInput={() => setPendingWorkspaceInput(null)}
            onCommitInput={commitWorkspaceInput}
            onDeleteItem={deleteWorkspaceItem}
            onSelectFile={handleSelectFile}
            onSelectFolder={handleSelectFolder}
          />
          {!ydoc ? <div className="empty">Connect 后可新建文件和文件夹</div> : null}
        </section>

        <section className="panel">
          <div className="panelTitle">Actions</div>
          <div className="buttonGrid">
            <button type="button" disabled={!permission.canComment || !selection} onClick={() => addAnnotation('comment')}>
              <MessageSquarePlus size={16} />
              Comment
            </button>
            <button type="button" disabled={!permission.canHighlight || !selection} onClick={() => addAnnotation('highlight')}>
              <Highlighter size={16} />
              Highlight
            </button>
            <button type="button" disabled={!permission.canRemark || !selection} onClick={() => addAnnotation('remark')}>
              <PencilLine size={16} />
              Remark
            </button>
          </div>
        </section>

        <AnnotationList title="Comments" items={visibleComments} />
        <AnnotationList title="Highlights" items={visibleHighlights} />
        <AnnotationList title="Remarks" items={visibleRemarks} />

        <section className="panel">
          <div className="panelTitle">Online</div>
          <div className="list">
            {users.map((item) => (
              <div className="listItem" key={item.clientId}>
                <span>{item.name}</span>
                <strong>{item.role}</strong>
              </div>
            ))}
            {Object.values(remotePresence).map((item) => (
              <div className="listItem muted" key={`presence-${item.clientId}`}>
                <span>{item.name}</span>
                <strong>{item.cursor ? `${item.cursor.positionLineNumber}:${item.cursor.positionColumn}` : 'live'}</strong>
              </div>
            ))}
          </div>
        </section>
      </aside>

      <section className="editorShell">
        <header className="toolbar">
          <div>
            <h1>{activeFile?.name ?? `main.${activeLanguage.extension}`}</h1>
            <p>Monaco + Yjs collaborative editor</p>
          </div>
          <div className="toolbarActions" aria-label="Editor controls">
            <label className="languageSelect">
              <span>Language</span>
              <Select<CodeLanguage>
                aria-label="Code language"
                disabled={!permission.canChangeLanguage}
                onChange={handleLanguageChange}
                options={LANGUAGE_OPTIONS.map((item) => ({
                  label: item.label,
                  value: item.id
                }))}
                size="middle"
                value={language}
              />
            </label>
            <span>{permission.canEditCode ? 'Editable' : 'Read only'}</span>
            <button className="submitButton" type="button" disabled={!ydoc || isSubmitting} onClick={handleSubmitWorkspace}>
              <Send size={16} />
              {isSubmitting ? '提交中' : '提交'}
            </button>
            <button className="executeButton" type="button" disabled={isExecuting} onClick={handleExecute}>
              <Play size={16} />
              {isExecuting ? '执行中' : '执行'}
            </button>
          </div>
        </header>
        <div className="editorArea">
          <MonacoCodeEditor
            codeText={codeText}
            comments={visibleComments}
            highlights={visibleHighlights}
            language={language}
            onCodeChange={setDraftCode}
            onCursorChange={handleCursorChange}
            onSelectionChange={setSelection}
            readOnly={!permission.canEditCode}
            remarks={visibleRemarks}
            ydoc={ydoc}
          />
        </div>
        <section className="executionPanel" aria-label="Execution result">
          <div className="executionSummary">
            <strong>Console</strong>
            {executionResult ? (
              <>
              <strong className={executionResult.success ? 'executionOk' : 'executionError'}>
                {executionResult.success ? 'Success' : 'Failed'}
              </strong>
              <span>{`Exit ${executionResult.exitCode ?? '-'}`}</span>
              <span>{`${executionResult.durationMs}ms`}</span>
              </>
            ) : (
              <span>等待执行</span>
            )}
          </div>
          <div className="executionOutput">
            {executionResult ? (
              <>
                {executionResult.error ? <pre>{executionResult.error}</pre> : null}
                {executionResult.stdout ? <pre>{executionResult.stdout}</pre> : null}
                {executionResult.stderr ? <pre>{executionResult.stderr}</pre> : null}
                {executionResult.stackTrace && executionResult.stackTrace !== executionResult.stderr ? (
                  <pre>{executionResult.stackTrace}</pre>
                ) : null}
                {!executionResult.error && !executionResult.stdout && !executionResult.stderr && !executionResult.stackTrace ? (
                  <pre>No output</pre>
                ) : null}
              </>
            ) : (
              <pre>点击执行后会在这里显示 stdout、stderr 和堆栈信息。</pre>
            )}
          </div>
        </section>
      </section>
    </main>
  )
}

function AnnotationList({ title, items }: { title: string; items: AnnotationRecord[] }) {
  return (
    <section className="panel">
      <div className="panelTitle">{title}</div>
      <div className="list">
        {items.length === 0 ? <div className="empty">No items</div> : null}
        {items.map((item) => (
          <div className="annotationItem" key={item.id}>
            <strong>{item.authorName}</strong>
            <span>{item.content}</span>
          </div>
        ))}
      </div>
    </section>
  )
}

function WorkspaceTree({
  activeFileId,
  items,
  pendingInput,
  selectedItemId,
  onCancelInput,
  onCommitInput,
  onDeleteItem,
  onSelectFolder,
  onSelectFile
}: {
  activeFileId: string
  items: WorkspaceItem[]
  pendingInput: PendingWorkspaceInput | null
  selectedItemId: string | null
  onCancelInput: () => void
  onCommitInput: (name: string) => void
  onDeleteItem: (itemId: string) => void
  onSelectFolder: (folderId: string) => void
  onSelectFile: (fileId: string) => void
}) {
  const roots = items.filter((item) => item.parentId === null)

  return (
    <div className="workspaceTree">
      {roots.length === 0 ? <div className="empty">No files</div> : null}
      {pendingInput?.parentId === null ? (
        <WorkspaceInlineInput
          defaultName={pendingInput.defaultName}
          level={0}
          onCancel={onCancelInput}
          onCommit={onCommitInput}
        />
      ) : null}
      {roots.map((item) => (
        <WorkspaceTreeItem
          activeFileId={activeFileId}
          item={item}
          items={items}
          key={item.id}
          level={0}
          pendingInput={pendingInput}
          selectedItemId={selectedItemId}
          onCancelInput={onCancelInput}
          onCommitInput={onCommitInput}
          onDeleteItem={onDeleteItem}
          onSelectFolder={onSelectFolder}
          onSelectFile={onSelectFile}
        />
      ))}
    </div>
  )
}

function WorkspaceTreeItem({
  activeFileId,
  item,
  items,
  level,
  pendingInput,
  selectedItemId,
  onCancelInput,
  onCommitInput,
  onDeleteItem,
  onSelectFolder,
  onSelectFile
}: {
  activeFileId: string
  item: WorkspaceItem
  items: WorkspaceItem[]
  level: number
  pendingInput: PendingWorkspaceInput | null
  selectedItemId: string | null
  onCancelInput: () => void
  onCommitInput: (name: string) => void
  onDeleteItem: (itemId: string) => void
  onSelectFolder: (folderId: string) => void
  onSelectFile: (fileId: string) => void
}) {
  const children = items.filter((child) => child.parentId === item.id)

  return (
    <>
      <button
        className={`workspaceItem ${item.id === activeFileId ? 'active' : ''} ${item.id === selectedItemId ? 'selected' : ''}`}
        style={{ paddingLeft: 10 + level * 16 }}
        type="button"
        onClick={() => item.kind === 'folder' ? onSelectFolder(item.id) : onSelectFile(item.id)}
      >
        <span className="workspaceItemMain">
          <span>{item.kind === 'folder' ? '▸' : ''}</span>
          <span>{item.name}</span>
        </span>
        <span
          className="workspaceDeleteButton"
          role="button"
          tabIndex={0}
          title="删除"
          onClick={(event) => {
            event.stopPropagation()
            onDeleteItem(item.id)
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault()
              event.stopPropagation()
              onDeleteItem(item.id)
            }
          }}
        >
          <Trash2 size={14} />
        </span>
      </button>
      {pendingInput?.parentId === item.id ? (
        <WorkspaceInlineInput
          defaultName={pendingInput.defaultName}
          level={level + 1}
          onCancel={onCancelInput}
          onCommit={onCommitInput}
        />
      ) : null}
      {children.map((child) => (
        <WorkspaceTreeItem
          activeFileId={activeFileId}
          item={child}
          items={items}
          key={child.id}
          level={level + 1}
          pendingInput={pendingInput}
          selectedItemId={selectedItemId}
          onCancelInput={onCancelInput}
          onCommitInput={onCommitInput}
          onDeleteItem={onDeleteItem}
          onSelectFolder={onSelectFolder}
          onSelectFile={onSelectFile}
        />
      ))}
    </>
  )
}

function WorkspaceInlineInput({
  defaultName,
  level,
  onCancel,
  onCommit
}: {
  defaultName: string
  level: number
  onCancel: () => void
  onCommit: (name: string) => void
}) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [value, setValue] = useState(defaultName)

  useEffect(() => {
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [])

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') {
      event.preventDefault()
      onCommit(value)
    }

    if (event.key === 'Escape') {
      event.preventDefault()
      onCancel()
    }
  }

  return (
    <div className="workspaceInlineInput" style={{ paddingLeft: 10 + level * 16 }}>
      <input
        aria-label="文件或文件夹名称"
        ref={inputRef}
        value={value}
        onBlur={onCancel}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={handleKeyDown}
      />
    </div>
  )
}

function getOffsetFromSelectionText(text: string, selection: monaco.Selection, edge: 'start' | 'end') {
  const line = edge === 'start' ? selection.startLineNumber : selection.endLineNumber
  const column = edge === 'start' ? selection.startColumn : selection.endColumn
  const lines = text.split('\n')
  let offset = 0
  for (let index = 0; index < line - 1; index += 1) {
    offset += (lines[index]?.length ?? 0) + 1
  }
  return offset + column - 1
}

function isCodeLanguage(value: unknown): value is CodeLanguage {
  return LANGUAGE_OPTIONS.some((item) => item.id === value)
}

function fileTextKey(fileId: string) {
  return `code:${fileId}`
}

function ensureDefaultFile(doc: Y.Doc, files: Y.Map<WorkspaceItem>, meta: Y.Map<string>, language: CodeLanguage) {
  if (!files.get(DEFAULT_FILE_ID)) {
    files.set(DEFAULT_FILE_ID, {
      id: DEFAULT_FILE_ID,
      parentId: null,
      name: `main.${LANGUAGE_OPTIONS.find((item) => item.id === language)?.extension ?? 'js'}`,
      kind: 'file',
      language,
      createdAt: Date.now()
    })
  }

  if (!meta.get('activeFileId')) {
    meta.set('activeFileId', DEFAULT_FILE_ID)
  }

  doc.getText(fileTextKey(DEFAULT_FILE_ID))
}

function sortWorkspaceItems(items: WorkspaceItem[]) {
  return [...items].sort((left, right) => {
    if (left.kind !== right.kind) {
      return left.kind === 'folder' ? -1 : 1
    }
    return left.name.localeCompare(right.name)
  })
}

function sanitizeItemName(name: string) {
  return name.trim().replace(/[\\/]/g, '-')
}

function nextAvailableName(items: WorkspaceItem[], parentId: string | null, baseName: string) {
  const names = new Set(items.filter((item) => item.parentId === parentId).map((item) => item.name))
  if (!names.has(baseName)) {
    return baseName
  }

  const dotIndex = baseName.lastIndexOf('.')
  const stem = dotIndex > 0 ? baseName.slice(0, dotIndex) : baseName
  const extension = dotIndex > 0 ? baseName.slice(dotIndex) : ''
  let index = 2
  while (names.has(`${stem}-${index}${extension}`)) {
    index += 1
  }
  return `${stem}-${index}${extension}`
}

function collectDescendantIds(items: WorkspaceItem[], rootId: string) {
  const ids = [rootId]
  const queue = [rootId]

  while (queue.length > 0) {
    const parentId = queue.shift()
    for (const item of items) {
      if (item.parentId === parentId) {
        ids.push(item.id)
        queue.push(item.id)
      }
    }
  }

  return ids
}

function deleteAnnotationsForFile(map: Y.Map<AnnotationRecord>, fileId: string) {
  for (const [annotationId, annotation] of map.entries()) {
    if ((annotation.fileId ?? DEFAULT_FILE_ID) === fileId) {
      map.delete(annotationId)
    }
  }
}

function languageFromFileName(name: string): CodeLanguage | null {
  const extension = name.split('.').pop()?.toLowerCase()
  const match = LANGUAGE_OPTIONS.find((item) => item.extension === extension)
  return match?.id ?? null
}
