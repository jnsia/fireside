/// <reference types="vite/client" />

interface Window {
  api: {
    planChat: (messages: { role: string; content: string }[]) => Promise<{ agents: string[]; message: string; tokens: number }>
    sendChat: (agentId: string, messages: { role: string; content: string }[]) => Promise<{ content: string; tokens: number }>
    resize: (newW: number, newH: number, fireScreenX: number, fireScreenY: number, fireLocalX: number, fireLocalY: number) => Promise<void>
  }
}
