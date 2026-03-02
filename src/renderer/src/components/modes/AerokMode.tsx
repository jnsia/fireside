import { useEffect, useMemo, useState } from 'react'
import { loadAerokState, saveAerokState, type AerokState } from '../../lib/firesideDataMd'
import styles from './AerokMode.module.css'

type MaterialType = 'word' | 'sentence' | 'quote'

interface MaterialItem {
  id: string
  type: MaterialType
  text: string
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
  draft: ''
}

function createId() {
  return `mat-${Date.now()}-${Math.floor(Math.random() * 1000)}`
}

export function AerokMode() {
  const [state, setState] = useState<AerokState>(DEFAULT_STATE)
  const [hydrated, setHydrated] = useState(false)
  const [drafts, setDrafts] = useState<Record<MaterialType, string>>({
    word: '',
    sentence: '',
    quote: ''
  })

  useEffect(() => {
    let mounted = true
    loadAerokState(DEFAULT_STATE)
      .then((loaded) => {
        if (mounted) setState(loaded)
      })
      .finally(() => {
        if (mounted) setHydrated(true)
      })
    return () => {
      mounted = false
    }
  }, [])

  useEffect(() => {
    if (!hydrated) return
    saveAerokState(state).catch(console.error)
  }, [state, hydrated])

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

  return (
    <div className={styles.layout}>
      <aside className={styles.sidebar}>
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
