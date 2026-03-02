import { useEffect, useMemo, useState } from 'react'
import { loadJunjaState, saveJunjaState, type JunjaState } from '../../lib/firesideDataMd'
import styles from './JunjaMode.module.css'

interface GoalItem {
  id: string
  text: string
  done: boolean
}

interface GameItem {
  id: string
  name: string
  shortcut: string
  description: string
}

const GAMES: GameItem[] = [
  { id: 'steam', name: 'Steam', shortcut: 'steam://open/main', description: '스팀 라이브러리 바로 열기' },
  { id: 'epic', name: 'Epic Games', shortcut: 'com.epicgames.launcher://apps', description: '에픽 런처 열기' },
  { id: 'xbox', name: 'Xbox', shortcut: 'xbox://', description: 'Xbox 앱 열기' },
  { id: 'riot', name: 'Riot Client', shortcut: 'riotclient://', description: '라이엇 클라이언트 열기' }
]

const DEFAULT_STATE: JunjaState = {
  selectedGameId: GAMES[0].id,
  goalsByGame: {
    steam: [
      { id: 'g-1', text: '이번 주 인디게임 1개 클리어', done: false },
      { id: 'g-2', text: '라이브러리 정리', done: true }
    ],
    epic: [{ id: 'g-3', text: '무료 게임 수령', done: false }],
    xbox: [],
    riot: []
  }
}

function createGoalId() {
  return `goal-${Date.now()}-${Math.floor(Math.random() * 1000)}`
}

export function JunjaMode() {
  const [state, setState] = useState<JunjaState>(DEFAULT_STATE)
  const [hydrated, setHydrated] = useState(false)
  const [newGoalText, setNewGoalText] = useState('')

  useEffect(() => {
    let mounted = true
    loadJunjaState(DEFAULT_STATE)
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
    saveJunjaState(state).catch(console.error)
  }, [state, hydrated])

  const selectedGame = useMemo(
    () => GAMES.find((game) => game.id === state.selectedGameId) ?? GAMES[0],
    [state.selectedGameId]
  )

  const goals = state.goalsByGame[selectedGame.id] ?? []

  const toggleGoal = (goalId: string) => {
    setState((prev) => ({
      ...prev,
      goalsByGame: {
        ...prev.goalsByGame,
        [selectedGame.id]: (prev.goalsByGame[selectedGame.id] ?? []).map((goal) =>
          goal.id === goalId ? { ...goal, done: !goal.done } : goal
        )
      }
    }))
  }

  const addGoal = (rawText?: string) => {
    const text = (rawText ?? '').trim()
    if (!text) return
    setState((prev) => ({
      ...prev,
      goalsByGame: {
        ...prev.goalsByGame,
        [selectedGame.id]: [...(prev.goalsByGame[selectedGame.id] ?? []), { id: createGoalId(), text, done: false }]
      }
    }))
  }

  const deleteGoal = (goalId: string) => {
    setState((prev) => ({
      ...prev,
      goalsByGame: {
        ...prev.goalsByGame,
        [selectedGame.id]: (prev.goalsByGame[selectedGame.id] ?? []).filter((goal) => goal.id !== goalId)
      }
    }))
  }

  const runShortcut = async (shortcut: string) => {
    await window.api.terminalExec(`open "${shortcut}"`)
  }

  return (
    <div className={styles.layout}>
      <aside className={styles.sidebar}>
        <div className={styles.sectionTitle}>게임별 목표 목록</div>
        <div className={styles.gameTabs}>
          {GAMES.map((game) => (
            <button
              key={game.id}
              className={`${styles.gameTab} ${selectedGame.id === game.id ? styles.gameTabActive : ''}`}
              onClick={() => setState((prev) => ({ ...prev, selectedGameId: game.id }))}
            >
              <span>{game.name}</span>
              <span className={styles.badge}>{(state.goalsByGame[game.id] ?? []).filter((goal) => !goal.done).length}</span>
            </button>
          ))}
        </div>

        <div className={styles.goalList}>
          {goals.length === 0 && <div className={styles.muted}>아직 목표가 없습니다.</div>}
          {goals.map((goal) => (
            <label key={goal.id} className={styles.goalItem}>
              <input type="checkbox" checked={goal.done} onChange={() => toggleGoal(goal.id)} />
              <span className={goal.done ? styles.goalDone : ''}>{goal.text}</span>
              <button
                className={styles.goalDelete}
                onClick={(event) => {
                  event.preventDefault()
                  deleteGoal(goal.id)
                }}
              >
                삭제
              </button>
            </label>
          ))}
        </div>

        <div className={styles.inlineAdd}>
          <input
            className={styles.inlineInput}
            value={newGoalText}
            onChange={(event) => setNewGoalText(event.target.value)}
            placeholder={`${selectedGame.name} 퀘스트 입력`}
            onKeyDown={(event) => {
              if (event.key !== 'Enter') return
              addGoal(newGoalText)
              setNewGoalText('')
            }}
          />
          <button
            className={styles.addBtn}
            onClick={() => {
              addGoal(newGoalText)
              setNewGoalText('')
            }}
          >
            목표 추가
          </button>
        </div>
      </aside>

      <main className={styles.main}>
        <div className={styles.mainHeader}>게임 목록</div>
        <div className={styles.cardGrid}>
          {GAMES.map((game) => (
            <article key={game.id} className={styles.gameCard}>
              <div>
                <div className={styles.gameName}>{game.name}</div>
                <div className={styles.gameDesc}>{game.description}</div>
              </div>
              <button className={styles.launchBtn} onClick={() => runShortcut(game.shortcut)}>
                바로가기 실행
              </button>
            </article>
          ))}
        </div>
      </main>
    </div>
  )
}
