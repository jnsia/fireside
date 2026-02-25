export interface Agent {
  id: string
  name: string
  role: string
  emoji: string
  color: string
  avatar?: string
}

export interface Message {
  role: 'user' | 'assistant'
  content: string
  agentId?: string
  timestamp: number
}

export interface ChatSession {
  agentId: string
  messages: Message[]
}

export type ViewMode = 'overlay' | 'chat' | 'meeting'
