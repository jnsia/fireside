import { useState, useEffect } from 'react'
import styles from './Settings.module.css'

type SettingsProps = Readonly<{
  onClose: () => void
  onVaultChanged: () => void
}>

export function Settings({ onClose, onVaultChanged }: SettingsProps) {
  const [vaultPath, setVaultPath] = useState('')
  const [dailyNoteFolder, setDailyNoteFolder] = useState('')
  const [workLogFolder, setWorkLogFolder] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [model, setModel] = useState('')
  const [shell, setShell] = useState('')
  const [originalVaultPath, setOriginalVaultPath] = useState('')

  useEffect(() => {
    window.api.getConfig().then((config) => {
      setVaultPath(config.vaultPath)
      setDailyNoteFolder(config.dailyNoteFolder)
      setWorkLogFolder(config.workLogFolder)
      setApiKey(config.apiKey)
      setModel(config.model)
      setShell(config.shell)
      setOriginalVaultPath(config.vaultPath)
    })
  }, [])

  const handleBrowse = async () => {
    const selected = await window.api.selectDirectory()
    if (selected) setVaultPath(selected)
  }

  const handleBrowseRelative = async (setter: (v: string) => void) => {
    const selected = await window.api.selectDirectory()
    if (!selected) return
    if (selected.startsWith(vaultPath + '/')) {
      setter(selected.slice(vaultPath.length + 1))
    } else {
      setter(selected)
    }
  }

  const handleSave = async () => {
    await window.api.setConfig('vaultPath', vaultPath)
    await window.api.setConfig('dailyNoteFolder', dailyNoteFolder)
    await window.api.setConfig('workLogFolder', workLogFolder)
    await window.api.setConfig('apiKey', apiKey)
    await window.api.setConfig('model', model)
    await window.api.setConfig('shell', shell)

    if (vaultPath !== originalVaultPath) {
      onVaultChanged()
    }
    onClose()
  }

  return (
    <div className={styles.overlay}>
      <div className={styles.panel}>
        <div className={styles.header}>
          <span className={styles.title}>설정</span>
          <button className={styles.closeBtn} onClick={onClose}>×</button>
        </div>

        <div className={styles.body}>
          <section className={styles.section}>
            <div className={styles.sectionTitle}>VAULT</div>
            <div className={styles.field}>
              <label className={styles.label}>경로</label>
              <div className={styles.pathRow}>
                <input
                  className={styles.input}
                  value={vaultPath}
                  onChange={(e) => setVaultPath(e.target.value)}
                  spellCheck={false}
                />
                <button className={styles.browseBtn} onClick={handleBrowse}>찾아보기</button>
              </div>
            </div>
          </section>

          <section className={styles.section}>
            <div className={styles.sectionTitle}>NOTE FOLDERS</div>
            <div className={styles.field}>
              <label className={styles.label}>데일리</label>
              <div className={styles.pathRow}>
                <input
                  className={styles.input}
                  value={dailyNoteFolder}
                  onChange={(e) => setDailyNoteFolder(e.target.value)}
                  spellCheck={false}
                />
                <button className={styles.browseBtn} onClick={() => handleBrowseRelative(setDailyNoteFolder)}>찾아보기</button>
              </div>
            </div>
            <div className={styles.field}>
              <label className={styles.label}>업무 일지</label>
              <div className={styles.pathRow}>
                <input
                  className={styles.input}
                  value={workLogFolder}
                  onChange={(e) => setWorkLogFolder(e.target.value)}
                  spellCheck={false}
                />
                <button className={styles.browseBtn} onClick={() => handleBrowseRelative(setWorkLogFolder)}>찾아보기</button>
              </div>
            </div>
          </section>

          <section className={styles.section}>
            <div className={styles.sectionTitle}>AI</div>
            <div className={styles.field}>
              <label className={styles.label}>API Key</label>
              <input
                className={styles.input}
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                spellCheck={false}
              />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>모델</label>
              <input
                className={styles.input}
                value={model}
                onChange={(e) => setModel(e.target.value)}
                spellCheck={false}
              />
            </div>
          </section>

          <section className={styles.section}>
            <div className={styles.sectionTitle}>TERMINAL</div>
            <div className={styles.field}>
              <label className={styles.label}>셸</label>
              <input
                className={styles.input}
                value={shell}
                onChange={(e) => setShell(e.target.value)}
                spellCheck={false}
              />
            </div>
          </section>
        </div>

        <div className={styles.footer}>
          <button className={styles.cancelBtn} onClick={onClose}>취소</button>
          <button className={styles.saveBtn} onClick={handleSave}>저장</button>
        </div>
      </div>
    </div>
  )
}
