import { useEffect, useMemo, useRef, useState } from 'react'
import styles from './FileExplorer.module.css'

type TreeItem =
  | { type: 'file'; name: string; note: NoteEntry }
  | { type: 'dir';  name: string; path: string; children: TreeItem[] }

function buildTree(notes: NoteEntry[], basePath = ''): TreeItem[] {
  const dirs: Record<string, NoteEntry[]> = {}
  const files: NoteEntry[] = []

  for (const note of notes) {
    const slash = note.rel.indexOf('/')
    if (slash === -1) {
      files.push(note)
    } else {
      const dir = note.rel.slice(0, slash)
      const rest: NoteEntry = { ...note, rel: note.rel.slice(slash + 1) }
      ;(dirs[dir] ??= []).push(rest)
    }
  }

  const dirPath = (name: string) => basePath ? `${basePath}/${name}` : name

  return [
    ...Object.entries(dirs).sort().map(([name, children]) => ({
      type: 'dir' as const, name, path: dirPath(name), children: buildTree(children, dirPath(name))
    })),
    ...files.sort((a, b) => a.name.localeCompare(b.name)).map(note => ({
      type: 'file' as const, name: note.name, note
    }))
  ]
}

interface NodeProps {
  item: TreeItem
  depth: number
  selected: NoteEntry | null
  onSelect: (note: NoteEntry) => void
  onContextMenu: (event: React.MouseEvent, item: TreeItem) => void
}

function Node({ item, depth, selected, onSelect, onContextMenu }: NodeProps) {
  const [open, setOpen] = useState(() => {
    if (item.type !== 'dir') return false
    return localStorage.getItem(`fireside-dir:${item.path}`) === 'true'
  })
  const indent = depth * 12

  const handleToggle = () => {
    const next = !open
    setOpen(next)
    if (item.type === 'dir') {
      localStorage.setItem(`fireside-dir:${item.path}`, String(next))
    }
  }

  if (item.type === 'dir') {
    return (
      <>
        <button
          className={styles.dirItem}
          style={{ paddingLeft: 10 + indent }}
          onClick={handleToggle}
          onContextMenu={(event) => onContextMenu(event, item)}
        >
          <span className={styles.arrow}>{open ? '▾' : '▸'}</span>
          <span className={styles.dirName}>{item.name}</span>
        </button>
        {open && item.children.map((child, i) => (
          <Node
            key={i}
            item={child}
            depth={depth + 1}
            selected={selected}
            onSelect={onSelect}
            onContextMenu={onContextMenu}
          />
        ))}
      </>
    )
  }

  const isActive = selected?.filePath === item.note.filePath
  return (
    <button
      className={`${styles.fileItem} ${isActive ? styles.active : ''}`}
      style={{ paddingLeft: 10 + indent + 14 }}
      onClick={() => onSelect(item.note)}
      onContextMenu={(event) => onContextMenu(event, item)}
      title={item.note.rel}
    >
      {item.name}
    </button>
  )
}

interface FileExplorerProps {
  selected: NoteEntry | null
  onSelect: (note: NoteEntry) => void
  refreshKey?: number
}

export function FileExplorer({ selected, onSelect, refreshKey = 0 }: FileExplorerProps) {
  const [notes, setNotes] = useState<NoteEntry[]>([])
  const [draftName, setDraftName] = useState('')
  const [draftMode, setDraftMode] = useState<'note' | 'folder'>('note')
  const [draftParentRel, setDraftParentRel] = useState('')
  const [showDraft, setShowDraft] = useState(false)
  const [query, setQuery] = useState('')
  const [menu, setMenu] = useState<{ x: number; y: number; target: TreeItem | null } | null>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  const reload = () => window.api.listNotes().then(setNotes)
  useEffect(() => { reload() }, [refreshKey])

  useEffect(() => {
    if (!menu) return
    const handleClose = () => setMenu(null)
    window.addEventListener('click', handleClose)
    return () => window.removeEventListener('click', handleClose)
  }, [menu])

  const openDraft = (mode: 'note' | 'folder', parentRel = '') => {
    if (parentRel) localStorage.setItem(`fireside-dir:${parentRel}`, 'true')
    setDraftMode(mode)
    setDraftParentRel(parentRel)
    setDraftName('')
    setShowDraft(true)
    setMenu(null)
  }

  const handleCreate = async () => {
    const name = draftName.trim()
    if (!name) return
    if (draftMode === 'folder') {
      await window.api.newFolder(name, draftParentRel)
      await reload()
      setDraftName('')
      setShowDraft(false)
      return
    }

    const note = await window.api.newNote(name, draftParentRel)
    await reload()
    onSelect(note)
    setDraftName('')
    setShowDraft(false)
  }

  const normalizedQuery = query.trim().toLowerCase()
  const filteredNotes = normalizedQuery
    ? notes.filter((note) => {
        const haystack = `${note.name} ${note.rel}`.toLowerCase()
        return haystack.includes(normalizedQuery)
      })
    : notes
  const tree = buildTree(filteredNotes)
  const draftParentLabel = useMemo(() => draftParentRel || 'Vault root', [draftParentRel])

  const handleContextMenu = (event: React.MouseEvent, item: TreeItem | null) => {
    event.preventDefault()
    event.stopPropagation()
    const rect = panelRef.current?.getBoundingClientRect()
    setMenu({
      x: (event.clientX - (rect?.left ?? 0)),
      y: (event.clientY - (rect?.top ?? 0)),
      target: item
    })
  }

  const menuParentRel = menu?.target?.type === 'dir' ? menu.target.path : ''

  return (
    <div ref={panelRef} className={styles.panel}>
      <div className={styles.header}>
        <div>
          <div className={styles.eyebrow}>Vault</div>
          <span className={styles.title}>Neurostars</span>
        </div>
        <button className={styles.addBtn} onClick={() => openDraft('note', '')} title="새 노트">
          New
        </button>
      </div>

      <div className={styles.searchSection}>
        <label className={styles.searchLabel}>
          <span className={styles.searchIcon}>⌕</span>
          <input
            className={styles.searchInput}
            placeholder="파일 또는 경로 검색"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <div className={styles.metaRow}>
          <span className={styles.metaBadge}>{notes.length} notes</span>
          {normalizedQuery && <span className={styles.metaHint}>{filteredNotes.length} matches</span>}
        </div>
      </div>

      {showDraft && (
        <div className={styles.newRow}>
          <div className={styles.newMeta}>
            <span className={styles.newMode}>{draftMode === 'note' ? 'New note' : 'New folder'}</span>
            <span className={styles.newPath}>{draftParentLabel}</span>
          </div>
          <input
            className={styles.newInput}
            placeholder={draftMode === 'note' ? '노트 이름' : '폴더 이름'}
            value={draftName}
            autoFocus
            onChange={e => setDraftName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleCreate(); if (e.key === 'Escape') setShowDraft(false) }}
          />
        </div>
      )}

      <div className={styles.tree} onContextMenu={(event) => handleContextMenu(event, null)}>
        {tree.length === 0
          ? <div className={styles.empty}>{normalizedQuery ? '검색 결과가 없습니다' : '노트가 없습니다'}</div>
          : tree.map((item, i) => (
              <Node
                key={i}
                item={item}
                depth={0}
                selected={selected}
                onSelect={onSelect}
                onContextMenu={handleContextMenu}
              />
            ))
        }
      </div>

      {menu && (
        <div className={styles.contextMenu} style={{ left: menu.x, top: menu.y }}>
          {(menu.target?.type === 'dir' || menu.target === null) && (
            <>
              <button className={styles.contextItem} onClick={() => openDraft('note', menuParentRel)}>
                새 노트
              </button>
              <button className={styles.contextItem} onClick={() => openDraft('folder', menuParentRel)}>
                새 폴더
              </button>
            </>
          )}
          {menu.target?.type === 'file' && (
            <>
              <button
                className={styles.contextItem}
                onClick={async () => {
                  const duplicated = await window.api.duplicateNote(menu.target.note.filePath)
                  await reload()
                  onSelect(duplicated)
                  setMenu(null)
                }}
              >
                노트 복제
              </button>
              <button
                className={`${styles.contextItem} ${styles.contextDanger}`}
                onClick={async () => {
                  await window.api.deleteNote(menu.target.note.filePath)
                  await reload()
                  setMenu(null)
                }}
              >
                노트 삭제
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
