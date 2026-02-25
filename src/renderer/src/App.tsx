import { useState, useCallback, useRef } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { AGENTS } from './agents'
import { Campfire } from './components/Campfire/Campfire'
import { AgentBubble } from './components/AgentBubble/AgentBubble'
import { GroupChat } from './components/GroupChat/GroupChat'
import styles from './App.module.css'

const COL_W = 90, COL_H = 90
const EXP_W = 340

// bottomSection 고정 높이: 에이전트 반원 + 캠프파이어
const BOTTOM_H = 260
const AGENT_RADIUS = 105
// bottomSection 안에서 캠프파이어 중심 로컬 좌표
const FIRE_LOCAL = { x: EXP_W / 2, y: BOTTOM_H - 105 }

const FIRE_COL = { x: COL_W / 2, y: COL_H / 2 }
// 전체 창 기준 캠프파이어 중심 (항상 하단 고정)
const getFireExp = () => ({ x: EXP_W / 2, y: window.screen.availHeight - 105 })

// 반원 배치 (bottomSection 기준 absolute)
function getAgentPos(index: number, total: number) {
  const startDeg = 20, endDeg = 160
  const deg = startDeg + (index / (total - 1)) * (endDeg - startDeg)
  const rad = (deg * Math.PI) / 180
  return {
    position: 'absolute' as const,
    left: `${FIRE_LOCAL.x + Math.cos(rad) * AGENT_RADIUS - 26}px`,
    top:  `${FIRE_LOCAL.y - Math.sin(rad) * AGENT_RADIUS - 26}px`,
  }
}

function fireScreenPos(localFire: { x: number; y: number }) {
  return { x: window.screenX + localFire.x, y: window.screenY + localFire.y }
}

export default function App() {
  const [expanded, setExpanded] = useState(false)
  const [chatOpen, setChatOpen] = useState(false)
  const [hovered, setHovered] = useState(false)
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleMouseEnter = useCallback(() => {
    if (leaveTimer.current) clearTimeout(leaveTimer.current)
    setHovered(true)
  }, [])

  const handleMouseLeave = useCallback(() => {
    leaveTimer.current = setTimeout(() => setHovered(false), 300)
  }, [])

  const resize = useCallback((
    newW: number, newH: number,
    fromFire: { x: number; y: number },
    toFire: { x: number; y: number }
  ) => {
    const screen = fireScreenPos(fromFire)
    window.api.resize(newW, newH, screen.x, screen.y, toFire.x, toFire.y)
  }, [])

  const handleExpand = useCallback(() => {
    setExpanded(true)
    resize(EXP_W, window.screen.availHeight, FIRE_COL, getFireExp())
  }, [resize])

  const handleChatToggle = useCallback(() => {
    setChatOpen(prev => !prev)
  }, [])

  const handleCollapse = useCallback(() => {
    setExpanded(false)
    setChatOpen(false)
    resize(COL_W, COL_H, getFireExp(), FIRE_COL)
  }, [resize])

  return (
    <div
      className={styles.root}
      onMouseEnter={expanded ? handleMouseEnter : undefined}
      onMouseLeave={expanded ? handleMouseLeave : undefined}
    >
      {/* 접힘 상태 */}
      {!expanded && (
        <div className={styles.collapsed}>
          <Campfire onClick={handleExpand} collapsed={true} />
        </div>
      )}

      {/* 펼침 상태 */}
      {expanded && (
        <>
          {/* 상단 공간 — 채팅이 채우거나 빈 공간 */}
          <div className={styles.topArea}>
            <AnimatePresence>
              {chatOpen && (
                <motion.div
                  className={styles.chat}
                  key="chat"
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ type: 'spring', stiffness: 320, damping: 30 }}
                >
                  <GroupChat onClose={() => setChatOpen(false)} />
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* 하단 섹션: 에이전트 반원 + 캠프파이어 */}
          <div className={styles.bottomSection}>
            <AnimatePresence>
              {AGENTS.map((agent, i) => (
                <AgentBubble
                  key={agent.id}
                  agent={agent}
                  style={getAgentPos(i, AGENTS.length)}
                  floatIndex={i}
                />
              ))}
            </AnimatePresence>
            <div className={styles.campfireExpanded}>
              <Campfire onClick={handleChatToggle} collapsed={false} />
            </div>
            {/* 접기 버튼 — 에이전트 영역 오른쪽 위 */}
            <AnimatePresence>
              {expanded && (
                <motion.button
                  className={styles.collapseBtn}
                  onClick={handleCollapse}
                  animate={{ opacity: hovered ? 1 : 0, scale: hovered ? 1 : 0.8 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={{ duration: 0.2 }}
                  title="접기"
                >✕</motion.button>
              )}
            </AnimatePresence>
          </div>
        </>
      )}

    </div>
  )
}
