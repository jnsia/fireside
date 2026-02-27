/// <reference types="vite/client" />

interface NoteEntry { name: string; filePath: string; rel: string }
interface ExecResult { stdout: string; stderr: string; error: string | null }
interface ChatResult  { content: string; tokens: number; filesChanged: boolean; toolActions: string[] }

interface Window {
  api: {
    planChat: (messages: { role: string; content: string }[]) => Promise<{ agents: string[]; message: string; tokens: number }>
    sendChat: (agentId: string, messages: { role: string; content: string }[]) => Promise<ChatResult>
    placeWindow: (x: number, y: number, w: number, h: number) => Promise<void>
    // 터미널
    terminalExec: (command: string, cwd?: string) => Promise<ExecResult>
    // 파일시스템
    listNotes:  () => Promise<NoteEntry[]>
    readNote:   (filePath: string) => Promise<string>
    writeNote:  (filePath: string, content: string) => Promise<void>
    newNote:    (name: string) => Promise<string>
    deleteNote: (filePath: string) => Promise<void>
  }
}
