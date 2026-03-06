import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { AGENTS } from '@entities/agent/model'
import { loadGroupChatState, saveGroupChatState } from '@shared/lib/firesideDataMd'
import type { Message } from '@shared/types'
import styles from './GroupChat.module.css'

interface GroupChatProps {
  onClose?: () => void
  isPanel?: boolean
  onFilesChanged?: () => void
}

interface TypingState {
  agentId: string
}

export function GroupChat({ onClose, isPanel = false, onFilesChanged }: GroupChatProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [typing, setTyping] = useState<TypingState | null>(null)
  const [busy, setBusy] = useState(false)
  const [totalTokens, setTotalTokens] = useState(0)
  const [hydrated, setHydrated] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let mounted = true
    loadGroupChatState({ messages: [], totalTokens: 0 })
      .then((doc) => {
        if (!mounted) return
        setMessages(doc.messages ?? [])
        setTotalTokens(doc.totalTokens ?? 0)
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
    saveGroupChatState({ messages, totalTokens }).catch(console.error)
  }, [messages, totalTokens, hydrated])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, typing])

  const addMessage = (msg: Message, prev: Message[]): Message[] => {
    const next = [...prev, msg]
    setMessages(next)
    return next
  }

  const handleSend = async () => {
    const text = input.trim()
    if (!text || busy) return
    setInput('')
    setBusy(true)

    const userMsg: Message = { role: 'user', content: text, timestamp: Date.now() }
    let history = addMessage(userMsg, messages)

    setTyping({ agentId: 'planner' })
    try {
      const apiHistory = history.map((m) => ({ role: m.role, content: m.content }))
      const plan = await window.api.planChat(apiHistory)
      setTotalTokens((t) => t + plan.tokens)

      const plannerMsg: Message = {
        role: 'assistant',
        content: plan.message,
        agentId: 'planner',
        timestamp: Date.now()
      }
      history = addMessage(plannerMsg, history)

      const specialists = plan.agents.filter((id) => AGENTS.some((a) => a.id === id))
      for (const agentId of specialists) {
        setTyping({ agentId })
        const apiMessages = history.map((m) => ({ role: m.role, content: m.content }))
        const result = await window.api.sendChat(agentId, apiMessages)
        setTotalTokens((t) => t + result.tokens)
        const msg: Message = {
          role: 'assistant',
          content: result.content,
          agentId,
          timestamp: Date.now()
        }
        history = addMessage(msg, history)
        if (result.filesChanged) onFilesChanged?.()
      }
    } catch (e) {
      console.error(e)
    }

    setTyping(null)
    setBusy(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className={`${styles.panel} ${isPanel ? styles.isPanel : ''}`}>
      <div className={styles.header}>
        <span style={{ fontSize: 15 }}>🔥</span>
        <span className={styles.headerTitle}>Fireside Chat</span>
        <div className={styles.headerAgents}>
          {AGENTS.map((a) => (
            <div key={a.id} className={styles.agentDot} style={{ background: a.color }} />
          ))}
        </div>
        {totalTokens > 0 && (
          <span className={styles.tokenBadge} title="이 대화에서 사용한 토큰">
            {totalTokens.toLocaleString()} tok
          </span>
        )}
        {!isPanel && (
          <button className={styles.closeBtn} onClick={onClose}>
            ✕
          </button>
        )}
      </div>

      <div className={styles.messages}>
        {messages.length === 0 && (
          <div className={styles.empty}>
            🔥<br />
            무엇이든 물어보세요<br />
            기획자가 분석 후 필요한 팀원을 부를게요
          </div>
        )}

        {messages.map((msg, i) => {
          if (msg.role === 'user') {
            return (
              <motion.div key={i} className={styles.userRow} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.18 }}>
                <div className={styles.userBubble}>{msg.content}</div>
              </motion.div>
            )
          }

          const agent = AGENTS.find((a) => a.id === msg.agentId)

          return (
            <motion.div key={i} className={styles.agentRow} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.2 }}>
              <div className={styles.agentAvatar} style={{ borderColor: `${agent?.color}44` }}>
                {agent?.avatar && (
                  <img
                    className={styles.avatarImg}
                    src={agent.avatar}
                    alt={agent.name}
                    onError={(e) => {
                      ;(e.currentTarget as HTMLImageElement).style.display = 'none'
                    }}
                  />
                )}
                <span style={{ display: 'none', fontSize: 13 }}>{agent?.emoji}</span>
              </div>
              <div className={styles.agentBody}>
                <span className={styles.agentName} style={{ color: agent?.color }}>
                  {agent?.name}
                </span>
                <div className={styles.agentBubble}>{msg.content}</div>
              </div>
            </motion.div>
          )
        })}

        <AnimatePresence>
          {typing &&
            (() => {
              const agent = AGENTS.find((a) => a.id === typing.agentId)
              return (
                <motion.div key="typing" className={styles.typingRow} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}>
                  <div className={styles.agentAvatar} style={{ borderColor: `${agent?.color}44` }}>
                    {agent?.avatar && (
                      <img
                        className={styles.avatarImg}
                        src={agent.avatar}
                        alt={agent.name}
                        onError={(e) => {
                          ;(e.currentTarget as HTMLImageElement).style.display = 'none'
                        }}
                      />
                    )}
                    <span style={{ display: 'none', fontSize: 13 }}>{agent?.emoji}</span>
                  </div>
                  <div className={styles.typingBubble}>
                    <div className={styles.typingDot} />
                    <div className={styles.typingDot} />
                    <div className={styles.typingDot} />
                  </div>
                </motion.div>
              )
            })()}
        </AnimatePresence>

        <div ref={bottomRef} />
      </div>

      <div className={styles.inputRow}>
        <textarea
          className={styles.input}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="메시지 입력 (Enter 전송)"
          rows={2}
          disabled={busy}
        />
        <button className={styles.sendBtn} onClick={handleSend} disabled={busy || !input.trim()}>
          전송
        </button>
      </div>
    </div>
  )
}
