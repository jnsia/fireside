import { useEffect, useMemo, useState } from 'react'
import styles from './AerokMode.module.css'

type MaterialType = 'word' | 'sentence' | 'quote'

interface MaterialItem {
  id: string
  type: MaterialType
  text: string
}

interface AerokState {
  materials: MaterialItem[]
  draft: string
}

const STORAGE_KEY = 'fireside-aerok-state'

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
  draft: ''
}

function createId() {
  return `mat-${Date.now()}-${Math.floor(Math.random() * 1000)}`
}

function loadState(): AerokState {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '') as AerokState
    if (!Array.isArray(parsed.materials)) return DEFAULT_STATE
    return parsed
  } catch {
    return DEFAULT_STATE
  }
}

export function AerokMode() {
  const [state, setState] = useState<AerokState>(() => loadState())

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  }, [state])

  const grouped = useMemo(
    () => ({
      word: state.materials.filter((item) => item.type === 'word'),
      sentence: state.materials.filter((item) => item.type === 'sentence'),
      quote: state.materials.filter((item) => item.type === 'quote')
    }),
    [state.materials]
  )

  const addMaterial = (type: MaterialType) => {
    const text = window.prompt(`${TYPE_LABEL[type]} 추가`)?.trim()
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

  return (
    <div className={styles.layout}>
      <aside className={styles.sidebar}>
        <div className={styles.sectionTitle}>글감 목록</div>
        {(['word', 'sentence', 'quote'] as MaterialType[]).map((type) => (
          <section key={type} className={styles.materialSection}>
            <header className={styles.materialHeader}>
              <span>{TYPE_LABEL[type]}</span>
              <button className={styles.addBtn} onClick={() => addMaterial(type)}>
                +
              </button>
            </header>
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
        <div className={styles.editorHeader}>글 작성 에디터</div>
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
