import { useMemo, useState } from 'react'
import { loadAerokState, saveAerokState, type AerokState } from '@shared/lib/firesideDataMd'
import { useMarkdownState } from '@shared/hooks/useMarkdownState'
import styles from './AerokMode.module.css'

type MaterialType = 'word' | 'sentence' | 'quote'

type MaterialItem = {
  id: string
  type: MaterialType
  text: string
}

type WritingItem = {
  id: string
  title: string
  content: string
  updatedAt: number
}

const TYPE_LABEL: Record<MaterialType, string> = {
  word: '단어',
  sentence: '문장',
  quote: '인용문'
}

const DEFAULT_STATE: AerokState = {
  materials: [
    { id: 'm-1', type: 'word', text: '잔향' },
    { id: 'm-2', type: 'sentence', text: '새벽은 늘 천천히 불을 밝힌다.' },
    { id: 'm-3', type: 'quote', text: '좋은 문장은 오래 남는다.' }
  ],
  writings: [],
  draft: ''
}

function createId() {
  return `mat-${Date.now()}-${Math.floor(Math.random() * 1000)}`
}

function createWritingId() {
  return `writing-${Date.now()}-${Math.floor(Math.random() * 1000)}`
}

function getWritingTitle(text: string) {
  const firstLine = text
    .split('\n')
    .map((line) => line.trim())
    .find((line) => line.length > 0)
  if (!firstLine) return '제목 없는 글'
  return firstLine.replace(/^#+\s*/, '').slice(0, 34)
}

function formatUpdatedAt(value: number) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '방금 전'
  return `${date.getMonth() + 1}/${date.getDate()} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

export function AerokMode() {
  const [state, setState] = useMarkdownState(loadAerokState, saveAerokState, DEFAULT_STATE)
  const [selectedWritingId, setSelectedWritingId] = useState<string | null>(null)
  const [drafts, setDrafts] = useState<Record<MaterialType, string>>({
    word: '',
    sentence: '',
    quote: ''
  })

  const grouped = useMemo(
    () => ({
      word: state.materials.filter((item) => item.type === 'word'),
      sentence: state.materials.filter((item) => item.type === 'sentence'),
      quote: state.materials.filter((item) => item.type === 'quote')
    }),
    [state.materials]
  )

  const addMaterial = (type: MaterialType, rawText?: string) => {
    const text = (rawText ?? '').trim()
    if (!text) return
    setState((prev) => ({
      ...prev,
      materials: [...prev.materials, { id: createId(), type, text }]
    }))
  }

  const deleteMaterial = (id: string) => {
    setState((prev) => ({
      ...prev,
      materials: prev.materials.filter((item) => item.id !== id)
    }))
  }

  const selectWriting = (writing: WritingItem) => {
    setSelectedWritingId(writing.id)
    setState((prev) => ({ ...prev, draft: writing.content }))
  }

  const clearDraft = () => {
    setSelectedWritingId(null)
    setState((prev) => ({ ...prev, draft: '' }))
  }

  const saveWriting = () => {
    const content = state.draft.trim()
    if (!content) return

    const now = Date.now()
    const nextTitle = getWritingTitle(content)
    const nextId = selectedWritingId ?? createWritingId()
    const isEditing = Boolean(selectedWritingId)

    if (!isEditing) setSelectedWritingId(nextId)

    setState((prev) => {
      if (isEditing) {
        return {
          ...prev,
          writings: prev.writings.map((writing) =>
            writing.id === nextId
              ? { ...writing, title: nextTitle, content: prev.draft, updatedAt: now }
              : writing
          )
        }
      }

      return {
        ...prev,
        writings: [{ id: nextId, title: nextTitle, content: prev.draft, updatedAt: now }, ...prev.writings]
      }
    })
  }

  const deleteWriting = (id: string) => {
    const isSelected = selectedWritingId === id
    if (isSelected) setSelectedWritingId(null)
    setState((prev) => ({
      ...prev,
      writings: prev.writings.filter((writing) => writing.id !== id),
      draft: isSelected ? '' : prev.draft
    }))
  }

  return (
    <div className={styles.layout}>
      <aside className={styles.sidebar}>
        <div className={styles.sectionTitle}>작성된 글</div>
        <section className={styles.materialSection}>
          <div className={styles.writingActions}>
            <button className={styles.addBtn} onClick={saveWriting}>
              {selectedWritingId ? '수정 저장' : '새 글 저장'}
            </button>
            <button className={styles.secondaryBtn} onClick={clearDraft}>
              새 초안
            </button>
          </div>
          <div className={styles.writingList}>
            {state.writings.length === 0 && <div className={styles.muted}>저장된 글 없음</div>}
            {state.writings.map((writing) => (
              <button
                key={writing.id}
                className={`${styles.writingItem} ${selectedWritingId === writing.id ? styles.writingItemActive : ''}`}
                onClick={() => selectWriting(writing)}
              >
                <span className={styles.writingTitle}>{writing.title}</span>
                <span className={styles.writingMeta}>{formatUpdatedAt(writing.updatedAt)}</span>
                <span
                  className={styles.writingDelete}
                  onClick={(event) => {
                    event.stopPropagation()
                    deleteWriting(writing.id)
                  }}
                >
                  삭제
                </span>
              </button>
            ))}
          </div>
        </section>

        <div className={styles.sectionTitle}>글감 목록</div>
        {(['word', 'sentence', 'quote'] as MaterialType[]).map((type) => (
          <section key={type} className={styles.materialSection}>
            <header className={styles.materialHeader}>
              <span>{TYPE_LABEL[type]}</span>
            </header>
            <div className={styles.inlineAdd}>
              <input
                className={styles.inlineInput}
                value={drafts[type]}
                placeholder={`${TYPE_LABEL[type]} 입력`}
                onChange={(event) =>
                  setDrafts((prev) => ({
                    ...prev,
                    [type]: event.target.value
                  }))
                }
                onKeyDown={(event) => {
                  if (event.key !== 'Enter') return
                  addMaterial(type, drafts[type])
                  setDrafts((prev) => ({ ...prev, [type]: '' }))
                }}
              />
              <button
                className={styles.addBtn}
                onClick={() => {
                  addMaterial(type, drafts[type])
                  setDrafts((prev) => ({ ...prev, [type]: '' }))
                }}
              >
                추가
              </button>
            </div>
            <div className={styles.materialList}>
              {grouped[type].length === 0 && <div className={styles.muted}>없음</div>}
              {grouped[type].map((item) => (
                <div key={item.id} className={styles.materialItem}>
                  <span>{item.text}</span>
                  <button className={styles.deleteBtn} onClick={() => deleteMaterial(item.id)}>
                    삭제
                  </button>
                </div>
              ))}
            </div>
          </section>
        ))}
      </aside>

      <main className={styles.main}>
        <div className={styles.editorHeader}>
          글 작성 에디터
          <span className={styles.editorSub}>{selectedWritingId ? '저장 글 수정 중' : '새 글 작성 중'}</span>
        </div>
        <textarea
          className={styles.editor}
          value={state.draft}
          onChange={(event) => setState((prev) => ({ ...prev, draft: event.target.value }))}
          placeholder="오늘 쓰고 싶은 문장을 자유롭게 적어보세요"
        />
      </main>
    </div>
  )
}
