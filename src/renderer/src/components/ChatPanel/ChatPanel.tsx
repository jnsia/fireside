import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import type { Agent } from '../../types'
import { useChatStore } from '../../store/chatStore'
import styles from './ChatPanel.module.css'

interface ChatPanelProps {
  agent: Agent
  onClose: () => void
}

export function ChatPanel({ agent, onClose }: ChatPanelProps) {
  const { messages, sendMessage, loading } = useChatStore(agent.id)
  const [input, setInput] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  const handleSend = async () => {
    const text = input.trim()
    if (!text || loading) return
    setInput('')
    await sendMessage(text)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <motion.div
      className={styles.panel}
      initial={{ opacity: 0, x: -16 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ type: 'spring', stiffness: 350, damping: 28 }}
    >
        <div className={styles.header}>
          <span className={styles.headerEmoji}>{agent.emoji}</span>
          <div className={styles.headerInfo}>
            <div className={styles.headerName}>{agent.name}</div>
            <div className={styles.headerRole}>{agent.role}</div>
          </div>
          <button className={styles.closeBtn} onClick={onClose}>✕</button>
        </div>

        <div className={styles.messages}>
          {messages.length === 0 && (
            <div className={styles.empty}>
              🔥<br />
              {agent.name}에게 무엇이든 물어보세요
            </div>
          )}
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`${styles.message} ${msg.role === 'user' ? styles.userMessage : styles.assistantMessage}`}
            >
              {msg.content}
            </div>
          ))}
          {loading && (
            <div className={styles.loading}>
              {agent.name} 가 생각 중...
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        <div className={styles.inputRow}>
          <textarea
            className={styles.input}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="메시지 입력 (Enter 전송, Shift+Enter 줄바꿈)"
            rows={2}
          />
          <button
            className={styles.sendBtn}
            onClick={handleSend}
            disabled={loading || !input.trim()}
          >
            ↑
          </button>
        </div>
    </motion.div>
  )
}
