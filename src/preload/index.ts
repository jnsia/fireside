import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('api', {
  planChat: (messages: { role: string; content: string }[]) =>
    ipcRenderer.invoke('chat:plan', { messages }),

  sendChat: (agentId: string, messages: { role: string; content: string }[]) =>
    ipcRenderer.invoke('chat:send', { agentId, messages }),

  setWindowMode: (mode: 'overlay' | 'window') =>
    ipcRenderer.invoke('window:set-mode', mode),

  placeWindow: (x: number, y: number, w: number, h: number) =>
    ipcRenderer.invoke('window:place', x, y, w, h),

  onBlur: (callback: () => void) => {
    const listener = () => callback()
    ipcRenderer.on('window:blurred', listener)
    return () => ipcRenderer.removeListener('window:blurred', listener)
  },

  // 터미널
  terminalExec: (command: string, cwd?: string) =>
    ipcRenderer.invoke('terminal:exec', command, cwd),

  // 파일시스템 (Neurostars)
  listNotes: () => ipcRenderer.invoke('fs:list-notes'),
  readNote: (filePath: string) => ipcRenderer.invoke('fs:read-note', filePath),
  writeNote: (filePath: string, content: string) => ipcRenderer.invoke('fs:write-note', filePath, content),
  newNote: (name: string) => ipcRenderer.invoke('fs:new-note', name),
  deleteNote: (filePath: string) => ipcRenderer.invoke('fs:delete-note', filePath),
})
