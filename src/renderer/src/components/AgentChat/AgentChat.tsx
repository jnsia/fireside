import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { loadAgentChatState, saveAgentChatState } from '../../lib/firesideDataMd'
import type { Agent, Message } from '../../types'
import styles from './AgentChat.module.css'

const TOOL_LABELS: Record<string, string> = {
  list_notes: '📋 노트 목록 조회',
  read_note: '📖 노트 읽기',
  write_note: '✏️ 노트 수정',
  new_note: '📝 노트 생성',
  delete_note: '🗑️ 노트 삭제'
}

interface AgentChatProps {
  agent: Agent
  onClose?: () => void
  onFilesChanged: () => void
  isPanel?: boolean
}

export function AgentChat({ agent, onClose, onFilesChanged, isPanel = false }: AgentChatProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [toolActions, setToolActions] = useState<string[]>([])
  const [hydrated, setHydrated] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let mounted = true
    setHydrated(false)
    loadAgentChatState(agent.id, { messages: [] })
      .then((state) => {
        if (mounted) setMessages(state.messages ?? [])
      })
      .finally(() => {
        if (mounted) setHydrated(true)
      })
    return () => {
      mounted = false
    }
  }, [agent.id])

  useEffect(() => {
    if (!hydrated) return
    saveAgentChatState(agent.id, { messages }).catch(console.error)
  }, [messages, hydrated, agent.id])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, busy])

  const handleSend = async () => {
    const text = input.trim()
    if (!text || busy) return
    setInput('')
    setBusy(true)
    setToolActions([])

    const userMsg: Message = { role: 'user', content: text, timestamp: Date.now() }
    const history = [...messages, userMsg]
    setMessages(history)

    try {
      const apiHistory = history.map((m) => ({ role: m.role, content: m.content }))
      const result = await window.api.sendChat(agent.id, apiHistory)

      const agentMsg: Message = {
        role: 'assistant',
        content: result.content,
        agentId: agent.id,
        timestamp: Date.now()
      }
      setMessages((prev) => [...prev, agentMsg])

      if (result.toolActions?.length) setToolActions(result.toolActions)
      if (result.filesChanged) onFilesChanged()
    } catch (e) {
      console.error(e)
    }

    setBusy(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const clearHistory = async () => {
    setMessages([])
    await saveAgentChatState(agent.id, { messages: [] })
  }

  return (
    <div className={styles.panel}>
      <div className={styles.header} style={{ '--agent-color': agent.color } as React.CSSProperties}>
        <div className={styles.agentInfo}>
          <div className={styles.avatarWrap}>
            {agent.avatar ? (
              <img
                className={styles.avatar}
                src={agent.avatar}
                alt={agent.name}
                onError={(e) => {
                  ;(e.currentTarget as HTMLImageElement).style.display = 'none'
                }}
              />
            ) : (
              <span className={styles.emoji}>{agent.emoji}</span>
            )}
          </div>
          <div>
            <div className={styles.agentName} style={{ color: agent.color }}>
              {agent.name}
            </div>
            <div className={styles.agentRole}>{agent.role}</div>
          </div>
        </div>
        <div className={styles.headerActions}>
          <button className={styles.clearBtn} onClick={clearHistory} title="대화 초기화">
            ↺
          </button>
          {!isPanel && (
            <button className={styles.closeBtn} onClick={onClose}>
              ✕
            </button>
          )}
        </div>
      </div>

      <div className={styles.messages}>
        {messages.length === 0 && (
          <div className={styles.empty}>
            <span style={{ fontSize: 32 }}>{agent.emoji}</span>
            <div>무엇을 도와드릴까요?</div>
            <div className={styles.emptyHint}>파일 생성·수정·삭제도 직접 할 수 있어요</div>
          </div>
        )}

        {messages.map((msg, i) => {
          if (msg.role === 'user') {
            return (
              <motion.div key={i} className={styles.userRow} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.15 }}>
                <div className={styles.userBubble}>{msg.content}</div>
              </motion.div>
            )
          }
          return (
            <motion.div key={i} className={styles.agentRow} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.18 }}>
              <div className={styles.agentBubble} style={{ '--agent-color': agent.color } as React.CSSProperties}>
                {msg.content}
              </div>
            </motion.div>
          )
        })}

        <AnimatePresence>
          {toolActions.length > 0 && (
            <motion.div className={styles.toolBadges} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              {[...new Set(toolActions)].map((t) => (
                <span key={t} className={styles.toolBadge}>
                  {TOOL_LABELS[t] ?? t}
                </span>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {busy && (
          <motion.div className={styles.agentRow} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}>
            <div className={styles.typingBubble}>
              <span className={styles.dot} />
              <span className={styles.dot} />
              <span className={styles.dot} />
            </div>
          </motion.div>
        )}

        <div ref={bottomRef} />
      </div>

      <div className={styles.inputRow}>
        <textarea
          className={styles.input}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="메시지 입력 (Enter 전송, Shift+Enter 줄바꿈)"
          rows={2}
          disabled={busy}
        />
        <button
          className={styles.sendBtn}
          style={{ '--agent-color': agent.color } as React.CSSProperties}
          onClick={handleSend}
          disabled={busy || !input.trim()}
        >
          전송
        </button>
      </div>
    </div>
  )
}
