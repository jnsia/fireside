import { useState, useRef, useEffect } from 'react'
import styles from './TerminalPanel.module.css'

interface Line {
  type: 'cmd' | 'stdout' | 'stderr' | 'error'
  text: string
}

const HOME = '~'

interface TerminalPanelProps {
  autoRun?: string
}

export function TerminalPanel({ autoRun }: TerminalPanelProps) {
  const [lines, setLines] = useState<Line[]>([{ type: 'stdout', text: 'Fireside Terminal' }])
  const [input, setInput] = useState('')
  const [cwd, setCwd] = useState(HOME)
  const [history, setHistory] = useState<string[]>([])
  const [histIdx, setHistIdx] = useState(-1)
  const [busy, setBusy] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const autoRanRef = useRef(false)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [lines])

  useEffect(() => {
    if (!autoRun || autoRanRef.current) return
    autoRanRef.current = true
    const cmd = autoRun
    setLines(l => [...l, { type: 'cmd', text: `${HOME} % ${cmd}` }])
    setBusy(true)
    window.api.terminalExec(cmd).then(res => {
      if (res.stdout) setLines(l => [...l, { type: 'stdout', text: res.stdout.trimEnd() }])
      if (res.stderr) setLines(l => [...l, { type: 'stderr', text: res.stderr.trimEnd() }])
      if (res.error && !res.stderr) setLines(l => [...l, { type: 'error', text: res.error! }])
      setBusy(false)
      inputRef.current?.focus()
    }).catch(err => {
      setLines(l => [...l, { type: 'error', text: String(err) }])
      setBusy(false)
    })
  }, [])

  const resolvedCwd = (cwd: string) =>
    cwd === HOME ? undefined : cwd

  const handleExec = async () => {
    const cmd = input.trim()
    if (!cmd || busy) return
    setInput('')
    setHistIdx(-1)
    setHistory(h => [cmd, ...h].slice(0, 100))
    setLines(l => [...l, { type: 'cmd', text: `${cwd} % ${cmd}` }])
    setBusy(true)

    // cd는 cwd 상태만 업데이트
    if (cmd.startsWith('cd ')) {
      const target = cmd.slice(3).trim()
      const next = target === '~' || target === ''
        ? HOME
        : target.startsWith('/')
          ? target
          : cwd === HOME ? `/${target}` : `${cwd}/${target}`
      // 실제 존재 여부 확인
      const res = await window.api.terminalExec(`cd ${target} && pwd`, resolvedCwd(cwd))
      if (res.error || res.stderr) {
        setLines(l => [...l, { type: 'error', text: res.stderr || res.error || '' }])
      } else {
        setCwd(res.stdout.trim())
      }
      setBusy(false)
      return
    }

    const res = await window.api.terminalExec(cmd, resolvedCwd(cwd))
    if (res.stdout) setLines(l => [...l, { type: 'stdout', text: res.stdout.trimEnd() }])
    if (res.stderr) setLines(l => [...l, { type: 'stderr', text: res.stderr.trimEnd() }])
    if (res.error && !res.stderr) setLines(l => [...l, { type: 'error', text: res.error! }])
    setBusy(false)
    inputRef.current?.focus()
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') { handleExec(); return }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      const next = Math.min(histIdx + 1, history.length - 1)
      setHistIdx(next)
      setInput(history[next] ?? '')
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      const next = Math.max(histIdx - 1, -1)
      setHistIdx(next)
      setInput(next === -1 ? '' : history[next])
    }
  }

  return (
    <div className={styles.panel} onClick={() => inputRef.current?.focus()}>
      <div className={styles.output}>
        {lines.map((l, i) => (
          <pre key={i} className={styles[l.type]}>{l.text}</pre>
        ))}
        <div ref={bottomRef} />
      </div>
      <div className={styles.inputRow}>
        <span className={styles.prompt}>{cwd} %</span>
        <input
          ref={inputRef}
          className={styles.input}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={busy}
          autoFocus
          spellCheck={false}
        />
        {busy && <span className={styles.spinner}>⠋</span>}
      </div>
    </div>
  )
}
