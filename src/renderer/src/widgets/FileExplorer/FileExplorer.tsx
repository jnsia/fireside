import { useState, useEffect } from 'react'
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
}

function Node({ item, depth, selected, onSelect }: NodeProps) {
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
        >
          <span className={styles.arrow}>{open ? '▾' : '▸'}</span>
          <span className={styles.dirName}>{item.name}</span>
        </button>
        {open && item.children.map((child, i) => (
          <Node key={i} item={child} depth={depth + 1} selected={selected} onSelect={onSelect} />
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
  const [newName, setNewName] = useState('')
  const [showNew, setShowNew] = useState(false)

  const reload = () => window.api.listNotes().then(setNotes)
  useEffect(() => { reload() }, [refreshKey])

  const handleCreate = async () => {
    const name = newName.trim()
    if (!name) return
    const filePath = await window.api.newNote(name)
    await reload()
    onSelect({ name, filePath, rel: `${name}.md` })
    setNewName('')
    setShowNew(false)
  }

  const tree = buildTree(notes)

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <span className={styles.title}>Neurostars</span>
        <button className={styles.addBtn} onClick={() => setShowNew(v => !v)} title="새 노트">+</button>
      </div>

      {showNew && (
        <div className={styles.newRow}>
          <input
            className={styles.newInput}
            placeholder="노트 이름"
            value={newName}
            autoFocus
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleCreate(); if (e.key === 'Escape') setShowNew(false) }}
          />
        </div>
      )}

      <div className={styles.tree}>
        {tree.length === 0
          ? <div className={styles.empty}>노트 없음</div>
          : tree.map((item, i) => (
              <Node key={i} item={item} depth={0} selected={selected} onSelect={onSelect} />
            ))
        }
      </div>
    </div>
  )
}
