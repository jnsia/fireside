import { config } from 'dotenv'
import { join } from 'path'
config({ path: join(process.cwd(), '.env') })

import { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage } from 'electron'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'

let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null

function createWindow(): void {
  const { screen } = require('electron')
  const primaryDisplay = screen.getPrimaryDisplay()
  const { width, height } = primaryDisplay.workAreaSize

  mainWindow = new BrowserWindow({
    width: 90,
    height: 90,
    x: Math.floor(width / 2 - 45),
    y: height - 114,
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
    {
      label: '화면 표시',
      click: () => mainWindow?.show()
    },
    {
      label: '최소화',
      click: () => mainWindow?.hide()
    },
    { type: 'separator' },
    {
      label: '종료',
      click: () => app.quit()
    }
  ])

  tray.setContextMenu(contextMenu)
  tray.setToolTip('Fireside')

  tray.on('click', () => {
    if (mainWindow?.isVisible()) {
      mainWindow.hide()
    } else {
      mainWindow?.show()
    }
  })
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.fireside')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  createWindow()
  createTray()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

// IPC: 창 크기 조절

// IPC: 불꽃 화면 좌표를 유지하면서 창 크기 변경
ipcMain.handle('window:resize', (_event,
  newW: number, newH: number,
  fireScreenX: number, fireScreenY: number,  // 현재 화면에서 불꽃 중심 절대 좌표
  fireLocalX: number,  fireLocalY: number    // 새 창에서 불꽃 중심 로컬 좌표
) => {
  if (!mainWindow) return
  const { workAreaSize } = require('electron').screen.getPrimaryDisplay()
  let x = Math.round(fireScreenX - fireLocalX)
  let y = Math.round(fireScreenY - fireLocalY)
  x = Math.max(0, Math.min(x, workAreaSize.width  - newW))
  y = Math.max(0, Math.min(y, workAreaSize.height - newH))
  mainWindow.setBounds({ x, y, width: newW, height: newH }, true)
})

// Groq 클라이언트 생성 헬퍼
async function getGroq() {
  const Groq = (await import('groq-sdk')).default
  return new Groq({ apiKey: process.env.GROQ_API_KEY })
}

// IPC: Planner가 요청을 분석해서 필요한 전문가 선발
ipcMain.handle('chat:plan', async (_event, payload: { messages: { role: string; content: string }[] }) => {
  const client = await getGroq()
  const { ORCHESTRATOR_PROMPT } = await import('./agents')

  const response = await client.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    max_tokens: 512,
    messages: [
      { role: 'system', content: ORCHESTRATOR_PROMPT },
      ...payload.messages as { role: 'user' | 'assistant'; content: string }[]
    ]
  })

  const raw = response.choices[0].message.content ?? ''

  // SPECIALISTS: developer,qa\n---\n메시지 파싱
  const match = raw.match(/SPECIALISTS:\s*([^\n]+)\n---\n?([\s\S]*)/)
  if (!match) return { agents: [], message: raw.trim() }

  const agentList = match[1].trim()
  const message   = match[2].trim()
  const selected  = agentList === 'none' ? [] : agentList.split(',').map(s => s.trim())

  return { agents: selected, message, tokens: response.usage?.total_tokens ?? 0 }
})

// IPC: 전문가 에이전트 답변
ipcMain.handle('chat:send', async (_event, payload: { agentId: string; messages: { role: string; content: string }[] }) => {
  const client = await getGroq()
  const { agents } = await import('./agents')
  const agent = agents[payload.agentId]
  if (!agent) throw new Error(`Unknown agent: ${payload.agentId}`)

  const response = await client.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    max_tokens: 768,
    messages: [
      { role: 'system', content: agent.systemPrompt },
      ...payload.messages as { role: 'user' | 'assistant'; content: string }[]
    ]
  })

  return {
    content: response.choices[0].message.content ?? '',
    tokens: response.usage?.total_tokens ?? 0
  }
})
