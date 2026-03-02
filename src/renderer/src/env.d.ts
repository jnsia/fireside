/// <reference types="vite/client" />

interface NoteEntry { name: string; filePath: string; rel: string }
interface ExecResult { stdout: string; stderr: string; error: string | null }
interface ChatResult  { content: string; tokens: number; filesChanged: boolean; toolActions: string[] }

interface Window {
  api: {
    planChat: (messages: { role: string; content: string }[]) => Promise<{ agents: string[]; message: string; tokens: number }>
    sendChat: (agentId: string, messages: { role: string; content: string }[]) => Promise<ChatResult>
    setWindowMode: (mode: 'overlay' | 'window') => Promise<void>
    placeWindow: (x: number, y: number, w: number, h: number) => Promise<void>
    onBlur: (callback: () => void) => () => void
    terminalExec: (command: string, cwd?: string) => Promise<ExecResult>
    neurostarsPath: () => Promise<string>
    listNotes:  () => Promise<NoteEntry[]>
    readNote:   (filePath: string) => Promise<string>
    writeNote:  (filePath: string, content: string) => Promise<void>
    newNote:    (name: string) => Promise<string>
    deleteNote: (filePath: string) => Promise<void>
  }
}
