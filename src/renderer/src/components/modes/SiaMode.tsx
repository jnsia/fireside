import { useEffect, useMemo, useState } from 'react'
import { loadSiaState, saveSiaState, type SiaState } from '../../lib/firesideDataMd'
import styles from './SiaMode.module.css'

type IssueStatus = 'todo' | 'in_progress' | 'done'

interface Sprint {
  active: boolean
  startedAt: number | null
  endedAt: number | null
}

interface SiaProject {
  id: string
  name: string
  sprint: Sprint
}

interface SiaIssue {
  id: string
  projectId: string
  title: string
  status: IssueStatus
}

const DEFAULT_STATE: SiaState = {
  projects: [
    {
      id: 'proj-fireside',
      name: 'Fireside',
      sprint: { active: false, startedAt: null, endedAt: null }
    },
    {
      id: 'proj-neurostars',
      name: 'Neurostars',
      sprint: { active: false, startedAt: null, endedAt: null }
    }
  ],
  issues: [
    { id: 'iss-1', projectId: 'proj-fireside', title: '모드 전환 UX 다듬기', status: 'todo' },
    { id: 'iss-2', projectId: 'proj-fireside', title: '칸반 드래그/드롭 연결', status: 'in_progress' },
    { id: 'iss-3', projectId: 'proj-neurostars', title: '데일리 로그 템플릿 정리', status: 'done' }
  ],
  selectedProjectId: 'proj-fireside'
}

const STATUS_META: Record<IssueStatus, { label: string; color: string }> = {
  todo: { label: '할 일', color: '#f59e0b' },
  in_progress: { label: '진행 중', color: '#60a5fa' },
  done: { label: '완료', color: '#4ade80' }
}

function createId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1000)}`
}

export function SiaMode() {
  const [state, setState] = useState<SiaState>(DEFAULT_STATE)
  const [draggingIssueId, setDraggingIssueId] = useState<string | null>(null)
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    let mounted = true
    loadSiaState(DEFAULT_STATE)
      .then((loaded) => {
        if (!mounted) return
        setState(loaded)
      })
      .finally(() => {
        if (mounted) setHydrated(true)
      })
    return () => {
      mounted = false
    }
  }, [])

  useEffect(() => {
    if (!hydrated) return
    saveSiaState(state).catch(console.error)
  }, [state, hydrated])

  const selectedProject =
    state.projects.find((project) => project.id === state.selectedProjectId) ?? state.projects[0] ?? null

  const projectIssues = useMemo(
    () => state.issues.filter((issue) => issue.projectId === selectedProject?.id),
    [state.issues, selectedProject?.id]
  )

  const statusCounts = useMemo(
    () => ({
      todo: projectIssues.filter((i) => i.status === 'todo').length,
      in_progress: projectIssues.filter((i) => i.status === 'in_progress').length,
      done: projectIssues.filter((i) => i.status === 'done').length
    }),
    [projectIssues]
  )

  const updateProject = (projectId: string, updater: (project: SiaProject) => SiaProject) => {
    setState((prev) => ({
      ...prev,
      projects: prev.projects.map((project) => (project.id === projectId ? updater(project) : project))
    }))
  }

  const handleStartSprint = () => {
    if (!selectedProject || selectedProject.sprint.active) return
    updateProject(selectedProject.id, (project) => ({
      ...project,
      sprint: { active: true, startedAt: Date.now(), endedAt: null }
    }))
  }

  const handleEndSprint = () => {
    if (!selectedProject || !selectedProject.sprint.active) return
    updateProject(selectedProject.id, (project) => ({
      ...project,
      sprint: { ...project.sprint, active: false, endedAt: Date.now() }
    }))
  }

  const addIssue = (status: IssueStatus = 'todo') => {
    if (!selectedProject) return
    const title = window.prompt('새 이슈 제목을 입력하세요')?.trim()
    if (!title) return

    setState((prev) => ({
      ...prev,
      issues: [...prev.issues, { id: createId('iss'), projectId: selectedProject.id, title, status }]
    }))
  }

  const updateIssueStatus = (issueId: string, status: IssueStatus) => {
    setState((prev) => ({
      ...prev,
      issues: prev.issues.map((issue) => (issue.id === issueId ? { ...issue, status } : issue))
    }))
  }

  const editIssue = (issueId: string) => {
    const issue = state.issues.find((item) => item.id === issueId)
    if (!issue) return
    const nextTitle = window.prompt('이슈 제목 수정', issue.title)?.trim()
    if (!nextTitle) return
    setState((prev) => ({
      ...prev,
      issues: prev.issues.map((item) => (item.id === issueId ? { ...item, title: nextTitle } : item))
    }))
  }

  const deleteIssue = (issueId: string) => {
    if (!window.confirm('이 이슈를 삭제할까요?')) return
    setState((prev) => ({
      ...prev,
      issues: prev.issues.filter((item) => item.id !== issueId)
    }))
  }

  useEffect(() => {
    if (selectedProject) return
    if (!state.projects[0]) return
    setState((prev) => ({ ...prev, selectedProjectId: prev.projects[0].id }))
  }, [selectedProject, state.projects])

  if (!selectedProject) {
    return <div className={styles.empty}>프로젝트가 없습니다.</div>
  }

  const columns: IssueStatus[] = ['todo', 'in_progress', 'done']

  return (
    <div className={styles.layout}>
      <aside className={styles.sidebar}>
        <div className={styles.sectionTitle}>프로젝트 목록</div>
        <div className={styles.projectList}>
          {state.projects.map((project) => {
            const count = state.issues.filter((issue) => issue.projectId === project.id && issue.status !== 'done').length
            return (
              <button
                key={project.id}
                className={`${styles.projectBtn} ${project.id === selectedProject.id ? styles.projectBtnActive : ''}`}
                onClick={() => setState((prev) => ({ ...prev, selectedProjectId: project.id }))}
              >
                <span>{project.name}</span>
                <span className={styles.badge}>{count}</span>
              </button>
            )
          })}
        </div>

        <div className={styles.sectionTitle}>프로젝트별 이슈</div>
        <div className={styles.issueSummary}>
          {projectIssues.length === 0 && <div className={styles.muted}>이슈가 없습니다.</div>}
          {projectIssues.map((issue) => (
            <div key={issue.id} className={styles.issueSummaryItem}>
              <span className={styles.issueDot} style={{ background: STATUS_META[issue.status].color }} />
              <span className={styles.issueText}>{issue.title}</span>
            </div>
          ))}
        </div>

        <div className={styles.sidebarActions}>
          <button className={styles.actionBtn} onClick={handleStartSprint} disabled={selectedProject.sprint.active}>
            스프린트 시작
          </button>
          <button className={styles.actionBtn} onClick={handleEndSprint} disabled={!selectedProject.sprint.active}>
            스프린트 마감
          </button>
          <button className={styles.actionBtn} onClick={() => addIssue('todo')}>
            이슈 추가
          </button>
        </div>
      </aside>

      <main className={styles.main}>
        <div className={styles.topbar}>
          <div>
            <div className={styles.projectName}>{selectedProject.name}</div>
            <div className={styles.sprintMeta}>
              {selectedProject.sprint.active ? '진행 중 스프린트' : '대기 중'}
              {selectedProject.sprint.startedAt
                ? ` · 시작: ${new Date(selectedProject.sprint.startedAt).toLocaleDateString()}`
                : ''}
              {selectedProject.sprint.endedAt
                ? ` · 마감: ${new Date(selectedProject.sprint.endedAt).toLocaleDateString()}`
                : ''}
            </div>
          </div>
          <div className={styles.topbarActions}>
            <button className={styles.actionBtn} onClick={handleStartSprint} disabled={selectedProject.sprint.active}>
              스프린트 시작
            </button>
            <button className={styles.actionBtn} onClick={handleEndSprint} disabled={!selectedProject.sprint.active}>
              스프린트 마감
            </button>
            <button className={styles.actionBtn} onClick={() => addIssue('todo')}>
              이슈 추가
            </button>
          </div>
        </div>

        <div className={styles.board}>
          {columns.map((status) => {
            const issues = projectIssues.filter((issue) => issue.status === status)
            return (
              <section
                key={status}
                className={styles.column}
                onDragOver={(event) => event.preventDefault()}
                onDrop={() => {
                  if (!draggingIssueId) return
                  updateIssueStatus(draggingIssueId, status)
                  setDraggingIssueId(null)
                }}
              >
                <header className={styles.columnHeader}>
                  <span>{STATUS_META[status].label}</span>
                  <span className={styles.badge}>{statusCounts[status]}</span>
                </header>

                <div className={styles.cards}>
                  {issues.map((issue) => (
                    <article
                      key={issue.id}
                      className={styles.card}
                      draggable
                      onDragStart={() => setDraggingIssueId(issue.id)}
                      onDragEnd={() => setDraggingIssueId(null)}
                    >
                      <div className={styles.cardTitle}>{issue.title}</div>
                      <div className={styles.cardActions}>
                        <button className={styles.cardBtn} onClick={() => editIssue(issue.id)}>
                          수정
                        </button>
                        <button className={styles.cardBtnDanger} onClick={() => deleteIssue(issue.id)}>
                          삭제
                        </button>
                      </div>
                    </article>
                  ))}
                </div>

                <footer className={styles.columnFooter}>
                  <button className={styles.footerAddBtn} onClick={() => addIssue(status)}>
                    + 이 열에 추가
                  </button>
                </footer>
              </section>
            )
          })}
        </div>
      </main>
    </div>
  )
}
