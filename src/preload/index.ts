import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('api', {
  planChat: (messages: { role: string; content: string }[]) =>
    ipcRenderer.invoke('chat:plan', { messages }),

  sendChat: (agentId: string, messages: { role: string; content: string }[]) =>
    ipcRenderer.invoke('chat:send', { agentId, messages }),

  resize: (newW: number, newH: number, fireScreenX: number, fireScreenY: number, fireLocalX: number, fireLocalY: number) =>
    ipcRenderer.invoke('window:resize', newW, newH, fireScreenX, fireScreenY, fireLocalX, fireLocalY),

})
