import { useState, useCallback, useEffect } from 'react'
import { AnimatePresence } from 'framer-motion'
import { AGENTS } from '@entities/agent/model'
import { Campfire } from '@widgets/Campfire/Campfire'
import { AgentBubble } from '@shared/ui/AgentBubble/AgentBubble'
import { FileExplorer } from '@widgets/FileExplorer/FileExplorer'
import { MarkdownEditor } from '@widgets/MarkdownEditor/MarkdownEditor'
import { Dashboard } from '@widgets/Dashboard/Dashboard'
import { AgentChat } from '@features/agent-chat/ui/AgentChat'
import { SiaMode } from '@features/sia-mode/ui/SiaMode'
import { JunjaMode } from '@features/junja-mode/ui/JunjaMode'
import { AerokMode } from '@features/aerok-mode/ui/AerokMode'
import { Settings } from '@widgets/Settings/Settings'
import { ensureFiresideScaffold } from '@shared/lib/firesideDataMd'
import styles from './App.module.css'

const COL_W = 80
const COL_H = 80
const EXP_W = 1300
const EXP_H = 900

type ModeId = 'default' | 'sia' | 'junja' | 'aerok'

const MODE_LABELS: Record<ModeId, string> = {
  default: '기본',
  sia: '시아',
  junja: '준자',
  aerok: '애록'
}


const AGENT_RADIUS = 85
const FIRE_LOCAL = { x: 1300 / 2, y: 130 }

function getAgentPos(index: number, total: number) {
  const startDeg = 20
  const endDeg = 160
  const deg = startDeg + (index / (total - 1)) * (endDeg - startDeg)
  const rad = (deg * Math.PI) / 180
  return {
    position: 'absolute' as const,
    left: `${FIRE_LOCAL.x + Math.cos(rad) * AGENT_RADIUS - 26}px`,
    top: `${FIRE_LOCAL.y - Math.sin(rad) * AGENT_RADIUS - 26}px`
  }
}

export default function App() {
  const [expanded, setExpanded] = useState(false)
  const [mode, setMode] = useState<ModeId>('default')
  const [agentChatId, setAgentChatId] = useState<string | null>(null)
  const [fileRefreshKey, setFileRefreshKey] = useState(0)
  const [showSettings, setShowSettings] = useState(false)

  const [tabs, setTabs] = useState<NoteEntry[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('fireside-tabs') ?? '[]')
    } catch {
      return []
    }
  })
  const [activeTabPath, setActiveTabPath] = useState<string | null>(() => localStorage.getItem('fireside-active-tab'))

  const selectedNote = tabs.find((tab) => tab.filePath === activeTabPath) ?? null

  const handleExpand = useCallback(() => {
    const x = Math.round((window.screen.availWidth - EXP_W) / 2)
    const y = Math.round((window.screen.availHeight - EXP_H) / 2)
    window.api.setWindowMode('window')
    setExpanded(true)
    window.api.animatePlaceWindow(x, y, EXP_W, EXP_H, 240)
  }, [])

  const handleCollapse = useCallback(() => {
    const x = Math.round((window.screen.availWidth - COL_W) / 2)
    const y = window.screen.availHeight - COL_H - 40
    window.api
      .animatePlaceWindow(x, y, COL_W, COL_H, 200)
      .catch(() => undefined)
      .finally(() => {
        window.api.setWindowMode('overlay')
        setExpanded(false)
      })
  }, [])


  useEffect(() => {
    ensureFiresideScaffold()
      .then(() => setFileRefreshKey((prev) => prev + 1))
      .catch(console.error)
  }, [])

  const handleSelect = useCallback((note: NoteEntry) => {
    setTabs((prev) => {
      if (prev.find((tab) => tab.filePath === note.filePath)) return prev
      const next = [...prev, note]
      localStorage.setItem('fireside-tabs', JSON.stringify(next))
      return next
    })
    setActiveTabPath(note.filePath)
    localStorage.setItem('fireside-active-tab', note.filePath)
  }, [])

  const handleTabClick = useCallback((note: NoteEntry) => {
    setActiveTabPath(note.filePath)
    localStorage.setItem('fireside-active-tab', note.filePath)
  }, [])

  const closeTab = useCallback(
    (filePath: string) => {
      const idx = tabs.findIndex((tab) => tab.filePath === filePath)
      if (idx === -1) return
      const next = tabs.filter((tab) => tab.filePath !== filePath)
      localStorage.setItem('fireside-tabs', JSON.stringify(next))
      setTabs(next)
      setActiveTabPath((prev) => {
        if (prev !== filePath) return prev
        const newActive = (next[idx] ?? next[idx - 1])?.filePath ?? null
        if (newActive) localStorage.setItem('fireside-active-tab', newActive)
        else localStorage.removeItem('fireside-active-tab')
        return newActive
      })
    },
    [tabs]
  )

  const handleCloseTab = useCallback(
    (filePath: string, event: React.MouseEvent) => {
      event.stopPropagation()
      closeTab(filePath)
    },
    [closeTab]
  )

  useEffect(() => {
    if (!expanded) return

    const handleKeyDown = (e: KeyboardEvent) => {
      const activeIndex = tabs.findIndex((tab) => tab.filePath === activeTabPath)

      // ⌘W — 현재 탭 닫기
      if (e.metaKey && e.key === 'w') {
        e.preventDefault()
        if (activeTabPath) closeTab(activeTabPath)
        return
      }

      // ⌘Shift+[ — 이전 탭
      if (e.metaKey && e.shiftKey && e.key === '[') {
        e.preventDefault()
        if (activeIndex > 0) handleTabClick(tabs[activeIndex - 1])
        return
      }

      // ⌘Shift+] — 다음 탭
      if (e.metaKey && e.shiftKey && e.key === ']') {
        e.preventDefault()
        if (activeIndex < tabs.length - 1) handleTabClick(tabs[activeIndex + 1])
        return
      }

      // ⌃Tab — 다음 탭 (순환)
      if (e.ctrlKey && !e.shiftKey && e.key === 'Tab') {
        e.preventDefault()
        if (tabs.length > 0) handleTabClick(tabs[(activeIndex + 1) % tabs.length])
        return
      }

      // ⌃Shift+Tab — 이전 탭 (순환)
      if (e.ctrlKey && e.shiftKey && e.key === 'Tab') {
        e.preventDefault()
        if (tabs.length > 0) handleTabClick(tabs[(activeIndex - 1 + tabs.length) % tabs.length])
        return
      }

      // ⌘1-⌘9 — 탭 번호로 이동 (⌘9 = 마지막 탭)
      if (e.metaKey && /^[1-9]$/.test(e.key)) {
        e.preventDefault()
        const tab = e.key === '9' ? tabs[tabs.length - 1] : tabs[parseInt(e.key) - 1]
        if (tab) handleTabClick(tab)
        return
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [expanded, tabs, activeTabPath, closeTab, handleTabClick])

  const onFilesChanged = useCallback(() => {
    setFileRefreshKey((prev) => prev + 1)
  }, [])

  useEffect(() => {
    if (mode === 'default') setAgentChatId(null)
  }, [mode])

  const activeAgent = AGENTS.find((agent) => agent.id === agentChatId) ?? null
  const showChatPane = mode !== 'default'

  const renderWorkspace = () => {
    if (mode === 'sia') return <SiaMode />
    if (mode === 'junja') return <JunjaMode />
    if (mode === 'aerok') return <AerokMode />

    return (
      <div className={styles.defaultLayout}>
        <div className={styles.defaultSidebar}>
          <FileExplorer selected={selectedNote} onSelect={handleSelect} refreshKey={fileRefreshKey} />
        </div>
        <div className={styles.defaultMain}>
          <div className={styles.tabBar}>
            {tabs.length === 0 && <span className={styles.tabEmpty}>파일을 선택하세요</span>}
            {tabs.map((tab) => (
              <button
                key={tab.filePath}
                className={`${styles.tab} ${activeTabPath === tab.filePath ? styles.tabActive : ''}`}
                onClick={() => handleTabClick(tab)}
                title={tab.rel}
              >
                <span className={styles.tabDot} />
                <span className={styles.tabName}>{tab.name}</span>
                <span className={styles.tabClose} onClick={(event) => handleCloseTab(tab.filePath, event)}>
                  ×
                </span>
              </button>
            ))}
          </div>
          <div className={styles.editorContent}>
            <MarkdownEditor note={selectedNote} />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.root}>
      {!expanded && (
        <div className={styles.collapsed}>
          <Campfire onClick={handleExpand} collapsed={true} />
        </div>
      )}

      {expanded && (
        <div className={styles.windowFrame}>
          {showSettings && (
            <Settings
              onClose={() => setShowSettings(false)}
              onVaultChanged={() => setFileRefreshKey((prev) => prev + 1)}
            />
          )}
          <div className={styles.titleBar}>
            <span className={styles.titleIcon}>🔥</span>
            <span className={styles.titleText}>Fireside · {MODE_LABELS[mode]} 모드</span>
            <div className={styles.titleSpacer} />
            <button
              className={styles.modeResetBtn}
              onClick={() => {
                setMode('default')
                setAgentChatId(null)
              }}
              title="기본 모드"
            >
              기본
            </button>
            <button className={styles.iconBtn} onClick={() => setShowSettings(true)} title="설정">
              ⚙
            </button>
            <button className={styles.titleClose} onClick={handleCollapse} title="접기">
              ⌃
            </button>
          </div>

          <div className={styles.workspace}>
            <div className={styles.workspaceMain}>{renderWorkspace()}</div>
            {mode === 'default' && (
              <aside className={styles.infoPane}>
                <Dashboard refreshKey={fileRefreshKey} onSelectNote={handleSelect} />
              </aside>
            )}
            {showChatPane && (
              <aside className={styles.chatPane}>
                {activeAgent ? (
                  <AgentChat agent={activeAgent} onClose={() => setAgentChatId(null)} onFilesChanged={onFilesChanged} />
                ) : (
                  <Dashboard refreshKey={fileRefreshKey} onSelectNote={handleSelect} />
                )}
              </aside>
            )}
          </div>

          <div className={styles.bottomSection}>
            <AnimatePresence>
              {AGENTS.map((agent, index) => (
                <AgentBubble
                  key={agent.id}
                  agent={agent}
                  style={getAgentPos(index, AGENTS.length)}
                  floatIndex={index}
                  onClick={() => {
                    setMode(agent.id as ModeId)
                    setAgentChatId(agent.id)
                  }}
                />
              ))}
            </AnimatePresence>
            <div className={styles.campfireBottom}>
              <Campfire
                onClick={() => {
                  setMode('default')
                  setAgentChatId(null)
                }}
                collapsed={false}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
