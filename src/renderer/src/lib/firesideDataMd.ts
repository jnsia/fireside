import type { Message } from '../types'

const ROOT_DIR = '99_Fireside'

let neurostarsPathCache: string | null = null

async function getNeurostarsPath() {
  if (neurostarsPathCache) return neurostarsPathCache
  neurostarsPathCache = await window.api.neurostarsPath()
  return neurostarsPathCache
}

async function resolveRelPath(relPath: string) {
  const notes = await window.api.listNotes()
  return notes.find((note) => note.rel === relPath) ?? null
}

async function resolveAbsolutePath(relPath: string) {
  const existing = await resolveRelPath(relPath)
  if (existing) return existing.filePath
  const base = await getNeurostarsPath()
  return `${base}/${relPath}`
}

async function readDataFile(relPath: string): Promise<string | null> {
  const fullRel = `${ROOT_DIR}/${relPath}`
  const existing = await resolveRelPath(fullRel)
  if (!existing) return null
  return window.api.readNote(existing.filePath)
}

async function writeDataFile(relPath: string, content: string): Promise<void> {
  const fullRel = `${ROOT_DIR}/${relPath}`
  const absPath = await resolveAbsolutePath(fullRel)
  await window.api.writeNote(absPath, content)
}

function parseBlockSection(content: string, heading: string) {
  const pattern = new RegExp(`## ${heading}\\n([\\s\\S]*?)(?=\\n## |$)`)
  return content.match(pattern)?.[1]?.trim() ?? ''
}

function parseNumber(value: string) {
  if (!value.trim()) return null
  const n = Number(value.trim())
  return Number.isFinite(n) ? n : null
}

function parseBool(value: string) {
  return value.trim().toLowerCase() === 'true'
}

function toLineValue(text: string) {
  return text.replace(/\n/g, '\\n')
}

function fromLineValue(text: string) {
  return text.replace(/\\n/g, '\n')
}

export type IssueStatus = 'todo' | 'in_progress' | 'done'

export interface SiaState {
  projects: { id: string; name: string; sprint: { active: boolean; startedAt: number | null; endedAt: number | null } }[]
  issues: { id: string; projectId: string; title: string; status: IssueStatus }[]
  selectedProjectId: string
}

export interface JunjaState {
  selectedGameId: string
  goalsByGame: Record<string, { id: string; text: string; done: boolean }[]>
}

export interface AerokState {
  materials: { id: string; type: 'word' | 'sentence' | 'quote'; text: string }[]
  writings: { id: string; title: string; content: string; updatedAt: number }[]
  draft: string
}

export interface GroupChatState {
  messages: Message[]
  totalTokens: number
}

export interface AgentChatState {
  messages: Message[]
}

export async function loadSiaState(fallback: SiaState): Promise<SiaState> {
  const content = await readDataFile('sia/projects/index.md')
  if (!content) {
    await saveSiaState(fallback)
    return fallback
  }

  const selectedProjectId = content.match(/selected_project:\s*(.+)/)?.[1]?.trim() || fallback.selectedProjectId

  const projectsSection = parseBlockSection(content, 'Projects')
  const projectMatches = Array.from(
    projectsSection.matchAll(
      /- id: (.+)\n  name: (.+)\n  sprint_active: (true|false)\n  sprint_started_at: *(.*)\n  sprint_ended_at: *(.*)/g
    )
  )

  const projects =
    projectMatches.length > 0
      ? projectMatches.map((m) => ({
          id: m[1].trim(),
          name: fromLineValue(m[2].trim()),
          sprint: {
            active: parseBool(m[3]),
            startedAt: parseNumber(m[4]),
            endedAt: parseNumber(m[5])
          }
        }))
      : fallback.projects

  const issuesSection = parseBlockSection(content, 'Issues')
  const issueMatches = Array.from(
    issuesSection.matchAll(/- id: (.+)\n  project_id: (.+)\n  status: (todo|in_progress|done)\n  title: (.*)/g)
  )

  const issues =
    issueMatches.length > 0
      ? issueMatches.map((m) => ({
          id: m[1].trim(),
          projectId: m[2].trim(),
          status: m[3].trim() as IssueStatus,
          title: fromLineValue(m[4])
        }))
      : fallback.issues

  return { projects, issues, selectedProjectId }
}

export async function saveSiaState(state: SiaState): Promise<void> {
  const projects = state.projects
    .map(
      (p) =>
        `- id: ${p.id}\n  name: ${toLineValue(p.name)}\n  sprint_active: ${p.sprint.active}\n  sprint_started_at: ${p.sprint.startedAt ?? ''}\n  sprint_ended_at: ${p.sprint.endedAt ?? ''}`
    )
    .join('\n\n')

  const issues = state.issues
    .map(
      (i) =>
        `- id: ${i.id}\n  project_id: ${i.projectId}\n  status: ${i.status}\n  title: ${toLineValue(i.title)}`
    )
    .join('\n\n')

  const md = [
    '# Sia Data',
    '',
    `selected_project: ${state.selectedProjectId}`,
    '',
    '## Projects',
    projects || '- id: ',
    '',
    '## Issues',
    issues || '- id: '
  ].join('\n')

  await writeDataFile('sia/projects/index.md', md)
}

export async function loadJunjaState(fallback: JunjaState): Promise<JunjaState> {
  const content = await readDataFile('junja/goals/index.md')
  if (!content) {
    await saveJunjaState(fallback)
    return fallback
  }

  const selectedGameId = content.match(/selected_game:\s*(.+)/)?.[1]?.trim() || fallback.selectedGameId

  const goalsSection = parseBlockSection(content, 'Goals')
  const goalMatches = Array.from(goalsSection.matchAll(/- game_id: (.+)\n  goal_id: (.+)\n  done: (true|false)\n  text: (.*)/g))

  if (goalMatches.length === 0) return { ...fallback, selectedGameId }

  const goalsByGame: Record<string, { id: string; text: string; done: boolean }[]> = {}
  for (const m of goalMatches) {
    const gameId = m[1].trim()
    if (!goalsByGame[gameId]) goalsByGame[gameId] = []
    goalsByGame[gameId].push({
      id: m[2].trim(),
      done: parseBool(m[3]),
      text: fromLineValue(m[4])
    })
  }

  return { selectedGameId, goalsByGame: { ...fallback.goalsByGame, ...goalsByGame } }
}

export async function saveJunjaState(state: JunjaState): Promise<void> {
  const goals = Object.entries(state.goalsByGame)
    .flatMap(([gameId, items]) =>
      items.map(
        (g) => `- game_id: ${gameId}\n  goal_id: ${g.id}\n  done: ${g.done}\n  text: ${toLineValue(g.text)}`
      )
    )
    .join('\n\n')

  const md = ['# Junja Goals', '', `selected_game: ${state.selectedGameId}`, '', '## Goals', goals || '- game_id: '].join('\n')
  await writeDataFile('junja/goals/index.md', md)
}

export async function loadAerokState(fallback: AerokState): Promise<AerokState> {
  const content = await readDataFile('aerok/materials/index.md')
  if (!content) {
    await saveAerokState(fallback)
    return fallback
  }

  const materialsSection = parseBlockSection(content, 'Materials')
  const materialMatches = Array.from(materialsSection.matchAll(/- id: (.+)\n  type: (word|sentence|quote)\n  text: (.*)/g))

  const materials =
    materialMatches.length > 0
      ? materialMatches.map((m) => ({
          id: m[1].trim(),
          type: m[2].trim() as 'word' | 'sentence' | 'quote',
          text: fromLineValue(m[3])
        }))
      : fallback.materials

  const writingsSection = parseBlockSection(content, 'Writings')
  const writingMatches = Array.from(
    writingsSection.matchAll(/- id: (.+)\n  title: (.*)\n  updated_at: (\d+)\n```text\n([\s\S]*?)\n```/g)
  )

  const writings =
    writingMatches.length > 0
      ? writingMatches.map((m) => ({
          id: m[1].trim(),
          title: fromLineValue(m[2]),
          updatedAt: Number(m[3]),
          content: m[4]
        }))
      : fallback.writings

  const draft = content.match(/## Draft\n```text\n([\s\S]*?)\n```/)?.[1] ?? fallback.draft

  return { materials, writings, draft }
}

export async function saveAerokState(state: AerokState): Promise<void> {
  const materials = state.materials
    .map((m) => `- id: ${m.id}\n  type: ${m.type}\n  text: ${toLineValue(m.text)}`)
    .join('\n\n')

  const writings = state.writings
    .map(
      (w) => `- id: ${w.id}\n  title: ${toLineValue(w.title)}\n  updated_at: ${w.updatedAt}\n\`\`\`text\n${w.content}\n\`\`\``
    )
    .join('\n\n')

  const md = [
    '# Aerok Materials',
    '',
    '## Materials',
    materials || '- id: ',
    '',
    '## Writings',
    writings || '- id: ',
    '',
    '## Draft',
    '```text',
    state.draft,
    '```'
  ].join('\n')

  await writeDataFile('aerok/materials/index.md', md)
}

function parseChatMessages(section: string) {
  return Array.from(
    section.matchAll(/### message\nrole: (user|assistant)\ntimestamp: (\d+)\nagent_id: *(.*)\n```text\n([\s\S]*?)\n```/g)
  ).map((m) => ({
    role: m[1] as 'user' | 'assistant',
    timestamp: Number(m[2]),
    agentId: m[3].trim() || undefined,
    content: m[4]
  }))
}

function renderChatMessages(messages: Message[]) {
  return messages
    .map(
      (m) =>
        `### message\nrole: ${m.role}\ntimestamp: ${m.timestamp}\nagent_id: ${m.agentId ?? ''}\n\`\`\`text\n${m.content}\n\`\`\``
    )
    .join('\n\n')
}

export async function loadAgentChatState(agentId: string, fallback: AgentChatState): Promise<AgentChatState> {
  const content = await readDataFile(`chat/agent-${agentId}.md`)
  if (!content) {
    await saveAgentChatState(agentId, fallback)
    return fallback
  }
  const section = parseBlockSection(content, 'Messages')
  if (!section) return fallback
  return { messages: parseChatMessages(section) }
}

export async function saveAgentChatState(agentId: string, state: AgentChatState): Promise<void> {
  const md = ['# Agent Chat', '', `agent_id: ${agentId}`, '', '## Messages', renderChatMessages(state.messages)].join('\n')
  await writeDataFile(`chat/agent-${agentId}.md`, md)
}

export async function loadGroupChatState(fallback: GroupChatState): Promise<GroupChatState> {
  const content = await readDataFile('chat/group.md')
  if (!content) {
    await saveGroupChatState(fallback)
    return fallback
  }
  const totalTokens = Number(content.match(/total_tokens: *(\d+)/)?.[1] ?? fallback.totalTokens)
  const section = parseBlockSection(content, 'Messages')
  const messages = section ? parseChatMessages(section) : fallback.messages
  return { messages, totalTokens }
}

export async function saveGroupChatState(state: GroupChatState): Promise<void> {
  const md = ['# Group Chat', '', `total_tokens: ${state.totalTokens}`, '', '## Messages', renderChatMessages(state.messages)].join('\n')
  await writeDataFile('chat/group.md', md)
}

export async function ensureFiresideScaffold(): Promise<void> {
  if (!(await readDataFile('sia/projects/index.md'))) {
    await saveSiaState({
      projects: [{ id: 'proj-fireside', name: 'Fireside', sprint: { active: false, startedAt: null, endedAt: null } }],
      issues: [],
      selectedProjectId: 'proj-fireside'
    })
  }
  if (!(await readDataFile('junja/goals/index.md'))) {
    await saveJunjaState({ selectedGameId: 'steam', goalsByGame: { steam: [], epic: [], xbox: [], riot: [] } })
  }
  if (!(await readDataFile('aerok/materials/index.md'))) await saveAerokState({ materials: [], writings: [], draft: '' })
  if (!(await readDataFile('chat/group.md'))) await saveGroupChatState({ messages: [], totalTokens: 0 })
  for (const id of ['sia', 'aerok', 'junja']) {
    if (!(await readDataFile(`chat/agent-${id}.md`))) await saveAgentChatState(id, { messages: [] })
  }
}
