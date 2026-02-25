import { useState, useCallback } from 'react'
import type { Message, ChatSession } from '../types'

const sessions: Record<string, ChatSession> = {}

export function useChatStore(agentId: string) {
  const [messages, setMessages] = useState<Message[]>(
    sessions[agentId]?.messages ?? []
  )
  const [loading, setLoading] = useState(false)

  const sendMessage = useCallback(async (content: string) => {
    const userMsg: Message = { role: 'user', content, timestamp: Date.now() }
    const updated = [...messages, userMsg]
    setMessages(updated)
    sessions[agentId] = { agentId, messages: updated }
    setLoading(true)

    try {
      const apiMessages = updated.map(m => ({ role: m.role, content: m.content }))
      const reply = await window.api.sendChat(agentId, apiMessages)
      const assistantMsg: Message = {
        role: 'assistant',
        content: reply,
        agentId,
        timestamp: Date.now()
      }
      const final = [...updated, assistantMsg]
      setMessages(final)
      sessions[agentId] = { agentId, messages: final }
    } finally {
      setLoading(false)
    }
  }, [agentId, messages])

  return { messages, sendMessage, loading }
}
