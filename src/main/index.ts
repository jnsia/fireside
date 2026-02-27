import { config } from 'dotenv'
import { join } from 'path'
config({ path: join(process.cwd(), '.env') })

import { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage } from 'electron'
import { exec } from 'child_process'
import { promisify } from 'util'
import fs from 'fs'
import path from 'path'
import os from 'os'

const execAsync = promisify(exec)
const NEUROSTARS_PATH = (process.env.NEUROSTARS_PATH || '/Users/jnsia/Documents/Neurostars').replace(/^~/, os.homedir())

import { electronApp, optimizer, is } from '@electron-toolkit/utils'

let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null

// ── 파일시스템 헬퍼 ────────────────────────────────────────────────
function walk(dir: string): { name: string; filePath: string; rel: string }[] {
  if (!fs.existsSync(dir)) return []
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => {
    const full = path.join(dir, e.name)
    const rel  = path.relative(NEUROSTARS_PATH, full)
    if (e.isDirectory() && !e.name.startsWith('.')) return walk(full)
    if (e.isFile() && e.name.endsWith('.md')) return [{ name: e.name.replace(/\.md$/, ''), filePath: full, rel }]
    return []
  })
}

// ── OpenRouter 클라이언트 ─────────────────────────────────────────
async function getClient() {
  const OpenAI = (await import('openai')).default
  return new OpenAI({
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey: process.env.OPENROUTER_API_KEY ?? '',
    defaultHeaders: { 'HTTP-Referer': 'https://fireside.app', 'X-Title': 'Fireside' }
  })
}

const MODEL = 'openrouter/free'

// ── 에이전트 파일 도구 ─────────────────────────────────────────────
const FS_TOOLS = [
  {
    type: 'function' as const,
    function: {
      name: 'list_notes',
      description: 'Neurostars 폴더의 노트 목록(파일명, 경로, 상대경로)을 조회합니다.',
      parameters: { type: 'object', properties: {}, required: [] }
    }
  },
  {
    type: 'function' as const,
    function: {
      name: 'read_note',
      description: '노트 파일의 내용을 읽습니다.',
      parameters: {
        type: 'object',
        properties: {
          filePath: { type: 'string', description: '파일 절대 경로 (list_notes로 먼저 조회하세요)' }
        },
        required: ['filePath']
      }
    }
  },
  {
    type: 'function' as const,
    function: {
      name: 'write_note',
      description: '노트를 새로 만들거나 내용을 덮어씁니다. 파일이 없으면 생성합니다.',
      parameters: {
        type: 'object',
        properties: {
          filePath: { type: 'string', description: '파일 절대 경로' },
          content:  { type: 'string', description: '저장할 마크다운 내용' }
        },
        required: ['filePath', 'content']
      }
    }
  },
  {
    type: 'function' as const,
    function: {
      name: 'new_note',
      description: '새 노트 파일을 생성합니다. 파일명(확장자 제외)과 선택적 초기 내용을 받습니다.',
      parameters: {
        type: 'object',
        properties: {
          name:    { type: 'string', description: '파일명 (확장자 .md 제외)' },
          content: { type: 'string', description: '초기 내용 (선택, 기본: # 제목)' }
        },
        required: ['name']
      }
    }
  },
  {
    type: 'function' as const,
    function: {
      name: 'delete_note',
      description: '노트 파일을 삭제합니다. 복구 불가하므로 신중하게 사용하세요.',
      parameters: {
        type: 'object',
        properties: {
          filePath: { type: 'string', description: '파일 절대 경로' }
        },
        required: ['filePath']
      }
    }
  }
]

async function executeFsTool(name: string, args: Record<string, string>): Promise<{ result: string; filesChanged: boolean }> {
  try {
    switch (name) {
      case 'list_notes':
        return { result: JSON.stringify(walk(NEUROSTARS_PATH)), filesChanged: false }

      case 'read_note': {
        if (!args.filePath.startsWith(NEUROSTARS_PATH)) return { result: '접근 거부: 허용된 경로가 아닙니다.', filesChanged: false }
        const content = fs.readFileSync(args.filePath, 'utf-8')
        return { result: content, filesChanged: false }
      }

      case 'write_note': {
        if (!args.filePath.startsWith(NEUROSTARS_PATH)) return { result: '접근 거부', filesChanged: false }
        fs.mkdirSync(path.dirname(args.filePath), { recursive: true })
        fs.writeFileSync(args.filePath, args.content, 'utf-8')
        return { result: `저장 완료: ${path.basename(args.filePath)}`, filesChanged: true }
      }

      case 'new_note': {
        fs.mkdirSync(NEUROSTARS_PATH, { recursive: true })
        const filePath = path.join(NEUROSTARS_PATH, `${args.name}.md`)
        fs.writeFileSync(filePath, args.content || `# ${args.name}\n\n`, 'utf-8')
        return { result: JSON.stringify({ filePath, message: `'${args.name}.md' 생성 완료` }), filesChanged: true }
      }

      case 'delete_note': {
        if (!args.filePath.startsWith(NEUROSTARS_PATH)) return { result: '접근 거부', filesChanged: false }
        fs.unlinkSync(args.filePath)
        return { result: `삭제 완료: ${path.basename(args.filePath)}`, filesChanged: true }
      }

      default:
        return { result: '알 수 없는 도구입니다.', filesChanged: false }
    }
  } catch (err: any) {
    return { result: `오류: ${err.message}`, filesChanged: false }
  }
}

// ── Electron 창 ───────────────────────────────────────────────────
function createWindow(): void {
  const { screen } = require('electron')
  const primaryDisplay = screen.getPrimaryDisplay()
  const { width, height } = primaryDisplay.workAreaSize

  mainWindow = new BrowserWindow({
    width: 80,
    height: 80,
    x: Math.floor(width / 2 - 40),
    y: height - 88,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    hasShadow: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true
    }
  })

  mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })

  mainWindow.on('blur', () => {
    mainWindow?.webContents.send('window:blurred')
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

function createTray(): void {
  const icon = nativeImage.createEmpty()
  tray = new Tray(icon)

  const contextMenu = Menu.buildFromTemplate([
    { label: '화면 표시', click: () => mainWindow?.show() },
    { label: '최소화',   click: () => mainWindow?.hide() },
    { type: 'separator' },
    { label: '종료',     click: () => app.quit() }
  ])

  tray.setContextMenu(contextMenu)
  tray.setToolTip('Fireside')
  tray.on('click', () => {
    if (mainWindow?.isVisible()) mainWindow.hide()
    else mainWindow?.show()
  })
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.fireside')
  app.on('browser-window-created', (_, window) => { optimizer.watchWindowShortcuts(window) })
  createWindow()
  createTray()
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow() })
})

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })

// ── IPC: 창 ──────────────────────────────────────────────────────
ipcMain.handle('window:set-mode', (_event, mode: 'overlay' | 'window') => {
  if (!mainWindow) return
  if (mode === 'overlay') {
    mainWindow.setAlwaysOnTop(true, 'screen-saver')
    mainWindow.setSkipTaskbar(true)
    mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
  } else {
    mainWindow.setAlwaysOnTop(false)
    mainWindow.setSkipTaskbar(false)
    mainWindow.setVisibleOnAllWorkspaces(false)
    mainWindow.focus()
  }
})

ipcMain.handle('window:place', (_event, x: number, y: number, w: number, h: number) => {
  if (!mainWindow) return
  const { workArea } = require('electron').screen.getPrimaryDisplay()
  const cx = Math.max(workArea.x, Math.min(x, workArea.x + workArea.width  - w))
  const cy = Math.max(workArea.y, Math.min(y, workArea.y + workArea.height - h))
  mainWindow.setBounds({ x: cx, y: cy, width: w, height: h }, true)
})

// ── IPC: 터미널 ───────────────────────────────────────────────────
ipcMain.handle('terminal:exec', async (_event, command: string, cwd?: string) => {
  try {
    const { stdout, stderr } = await execAsync(command, {
      cwd: cwd || os.homedir(),
      timeout: 30000,
      maxBuffer: 1024 * 512,
      shell: process.env.SHELL || '/bin/zsh',
    })
    return { stdout, stderr, error: null }
  } catch (err: any) {
    return { stdout: err.stdout || '', stderr: err.stderr || '', error: err.message }
  }
})

// ── IPC: 파일시스템 ───────────────────────────────────────────────
ipcMain.handle('fs:list-notes',  async () => walk(NEUROSTARS_PATH))

ipcMain.handle('fs:read-note',   async (_event, filePath: string) =>
  fs.readFileSync(filePath, 'utf-8'))

ipcMain.handle('fs:write-note',  async (_event, filePath: string, content: string) => {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, content, 'utf-8')
})

ipcMain.handle('fs:new-note',    async (_event, name: string) => {
  fs.mkdirSync(NEUROSTARS_PATH, { recursive: true })
  const filePath = path.join(NEUROSTARS_PATH, `${name}.md`)
  if (!fs.existsSync(filePath)) fs.writeFileSync(filePath, `# ${name}\n\n`, 'utf-8')
  return filePath
})

ipcMain.handle('fs:delete-note', async (_event, filePath: string) => {
  if (!filePath.startsWith(NEUROSTARS_PATH)) throw new Error('접근 거부')
  fs.unlinkSync(filePath)
})

// ── IPC: AI 채팅 ──────────────────────────────────────────────────
ipcMain.handle('chat:plan', async (_event, payload: { messages: { role: string; content: string }[] }) => {
  const client = await getClient()
  const { ORCHESTRATOR_PROMPT } = await import('./agents')

  const response = await client.chat.completions.create({
    model: MODEL,
    max_tokens: 512,
    messages: [
      { role: 'system', content: ORCHESTRATOR_PROMPT },
      ...payload.messages as { role: 'user' | 'assistant'; content: string }[]
    ]
  })

  const raw = response.choices[0].message.content ?? ''
  const match = raw.match(/SPECIALISTS:\s*([^\n]+)\n---\n?([\s\S]*)/)
  if (!match) return { agents: [], message: raw.trim(), tokens: response.usage?.total_tokens ?? 0 }

  const agentList = match[1].trim()
  const message   = match[2].trim()
  const selected  = agentList === 'none' ? [] : agentList.split(',').map(s => s.trim())

  return { agents: selected, message, tokens: response.usage?.total_tokens ?? 0 }
})

ipcMain.handle('chat:send', async (_event, payload: { agentId: string; messages: { role: string; content: string }[] }) => {
  const client = await getClient()
  const { agents } = await import('./agents')
  const agent = agents[payload.agentId]
  if (!agent) throw new Error(`Unknown agent: ${payload.agentId}`)

  // 메시지 히스토리 (도구 호출 결과 포함)
  const messages: any[] = [
    { role: 'system', content: agent.systemPrompt },
    ...payload.messages
  ]

  let totalTokens = 0
  let filesChanged = false
  const toolActions: string[] = []

  // 도구 호출 루프
  while (true) {
    const response = await client.chat.completions.create({
      model: MODEL,
      max_tokens: 1024,
      tools: FS_TOOLS,
      tool_choice: 'auto',
      messages
    })

    totalTokens += response.usage?.total_tokens ?? 0
    const choice = response.choices[0]

    if (choice.finish_reason === 'tool_calls' && choice.message.tool_calls?.length) {
      // 어시스턴트 메시지 (tool_calls 포함) 추가
      messages.push(choice.message)

      // 각 도구 실행
      for (const call of choice.message.tool_calls) {
        let args: any
        try {
          args = JSON.parse(call.function.arguments)
        } catch (err) {
          console.error('Failed to parse tool arguments:', call.function.arguments, err)
          messages.push({
            role: 'tool',
            tool_call_id: call.id,
            content: `Error: Invalid JSON arguments provided. ${err}`
          })
          continue
        }
        const { result, filesChanged: fc } = await executeFsTool(call.function.name, args)
        if (fc) filesChanged = true
        toolActions.push(call.function.name)
        messages.push({ role: 'tool', tool_call_id: call.id, content: result })
      }
    } else {
      // 최종 응답
      return {
        content: choice.message.content ?? '',
        tokens: totalTokens,
        filesChanged,
        toolActions
      }
    }
  }
})
