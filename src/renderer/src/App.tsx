import { useState, useCallback, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AGENTS } from "./agents";
import { Campfire } from "./components/Campfire/Campfire";
import { AgentBubble } from "./components/AgentBubble/AgentBubble";
import { Dashboard } from "./components/Dashboard/Dashboard";
import { AgentChat } from "./components/AgentChat/AgentChat";
import { FileExplorer } from "./components/FileExplorer/FileExplorer";
import { MarkdownEditor } from "./components/MarkdownEditor/MarkdownEditor";
import { TerminalPanel } from "./components/TerminalPanel/TerminalPanel";
import styles from "./App.module.css";

const COL_W = 80,
  COL_H = 80;
const EXP_W = 1300,
  EXP_H = 900;

// 하단 섹션 에이전트 호형 배치 (bottomSection height: 180px)
const AGENT_RADIUS = 85;
const FIRE_LOCAL = { x: 1300 / 2, y: 130 };

function getAgentPos(index: number, total: number) {
  const startDeg = 20,
    endDeg = 160;
  const deg = startDeg + (index / (total - 1)) * (endDeg - startDeg);
  const rad = (deg * Math.PI) / 180;
  return {
    position: "absolute" as const,
    left: `${FIRE_LOCAL.x + Math.cos(rad) * AGENT_RADIUS - 26}px`,
    top: `${FIRE_LOCAL.y - Math.sin(rad) * AGENT_RADIUS - 26}px`,
  };
}

export default function App() {
  const [expanded, setExpanded] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [agentChatId, setAgentChatId] = useState<string | null>(null);
  const [fileRefreshKey, setFileRefreshKey] = useState(0);

  // 멀티탭 상태 (localStorage 연동)
  const [tabs, setTabs] = useState<NoteEntry[]>(() => {
    try {
      return JSON.parse(localStorage.getItem("fireside-tabs") ?? "[]");
    } catch {
      return [];
    }
  });
  const [activeTabPath, setActiveTabPath] = useState<string | null>(() =>
    localStorage.getItem("fireside-active-tab"),
  );

  const selectedNote = tabs.find((t) => t.filePath === activeTabPath) ?? null;

  const handleExpand = useCallback(() => {
    const x = Math.round((window.screen.availWidth - EXP_W) / 2);
    const y = Math.round((window.screen.availHeight - EXP_H) / 2);
    window.api.setWindowMode("window");
    window.api.placeWindow(x, y, EXP_W, EXP_H);
    setExpanded(true);
  }, []);

  const handleCollapse = useCallback(() => {
    const x = Math.round((window.screen.availWidth - COL_W) / 2);
    const y = window.screen.availHeight - COL_H - 40; // Dock을 피하기 위해 40px 여유
    window.api.setWindowMode("overlay");
    window.api.placeWindow(x, y, COL_W, COL_H);
    setExpanded(false);
    setChatOpen(false);
    setAgentChatId(null);
  }, []);

  useEffect(() => {
    if (!expanded) return;
    const unbind = window.api.onBlur(() => {
      handleCollapse();
    });
    return () => unbind();
  }, [expanded, handleCollapse]);

  const handleSelect = useCallback((note: NoteEntry) => {
    setTabs((prev) => {
      if (prev.find((t) => t.filePath === note.filePath)) return prev;
      const next = [...prev, note];
      localStorage.setItem("fireside-tabs", JSON.stringify(next));
      return next;
    });
    setActiveTabPath(note.filePath);
    localStorage.setItem("fireside-active-tab", note.filePath);
  }, []);

  const handleTabClick = useCallback((note: NoteEntry) => {
    setActiveTabPath(note.filePath);
    localStorage.setItem("fireside-active-tab", note.filePath);
  }, []);

  const handleCloseTab = useCallback(
    (filePath: string, e: React.MouseEvent) => {
      e.stopPropagation();
      setTabs((prev) => {
        const next = prev.filter((t) => t.filePath !== filePath);
        localStorage.setItem("fireside-tabs", JSON.stringify(next));
        return next;
      });
      setActiveTabPath((prev) => {
        if (prev !== filePath) return prev;
        const idx = tabs.findIndex((t) => t.filePath === filePath);
        const remaining = tabs.filter((t) => t.filePath !== filePath);
        const newActive =
          remaining[Math.min(idx, remaining.length - 1)]?.filePath ?? null;
        if (newActive) localStorage.setItem("fireside-active-tab", newActive);
        else localStorage.removeItem("fireside-active-tab");
        return newActive;
      });
    },
    [tabs],
  );

  const openGroupChat = useCallback(() => {
    setAgentChatId(null);
    setChatOpen((v) => !v);
  }, []);

  const openAgentChat = useCallback((agentId: string) => {
    setChatOpen(false);
    setAgentChatId((prev) => (prev === agentId ? null : agentId));
  }, []);

  const onFilesChanged = useCallback(() => {
    setFileRefreshKey((k) => k + 1);
  }, []);

  const activeAgent = AGENTS.find((a) => a.id === agentChatId) ?? null;

  return (
    <div className={styles.root}>
      {/* 접힘: 캠프파이어 아이콘 */}
      {!expanded && (
        <div className={styles.collapsed}>
          <Campfire onClick={handleExpand} collapsed={true} />
        </div>
      )}

      {/* 펼침: 앱 창 */}
      {expanded && (
        <div className={styles.windowFrame}>
          {/* 타이틀바 */}
          <div className={styles.titleBar}>
            <span className={styles.titleIcon}>🔥</span>
            <span className={styles.titleText}>Fireside</span>
            <div className={styles.titleSpacer} />
            <button
              className={styles.titleClose}
              onClick={handleCollapse}
              title="접기"
            >
              ⌃
            </button>
          </div>

          {/* 3패널 워크스페이스 */}
          <div className={styles.workspace}>
            <div className={styles.explorerPane}>
              <FileExplorer
                selected={selectedNote}
                onSelect={handleSelect}
                refreshKey={fileRefreshKey}
              />
            </div>

            <div className={styles.editorPane}>
              <div className={styles.tabBar}>
                {tabs.length === 0 && (
                  <span className={styles.tabEmpty}>파일을 선택하세요</span>
                )}
                {tabs.map((tab) => (
                  <button
                    key={tab.filePath}
                    className={`${styles.tab} ${activeTabPath === tab.filePath ? styles.tabActive : ""}`}
                    onClick={() => handleTabClick(tab)}
                  >
                    <span className={styles.tabName}>{tab.name}</span>
                    <span
                      className={styles.tabClose}
                      onClick={(e) => handleCloseTab(tab.filePath, e)}
                    >
                      ×
                    </span>
                  </button>
                ))}
              </div>
              <div className={styles.editorContent}>
                <MarkdownEditor note={selectedNote} />
              </div>
            </div>

            <div className={styles.chatPane}>
              {activeAgent ? (
                <AgentChat
                  key={activeAgent.id}
                  agent={activeAgent}
                  onFilesChanged={onFilesChanged}
                  isPanel={true}
                />
              ) : (
                <Dashboard refreshKey={fileRefreshKey} />
              )}
            </div>
          </div>

          {/* 하단: 에이전트 반원 + 캠프파이어 */}
          <div className={styles.bottomSection}>
            <AnimatePresence>
              {AGENTS.map((agent, i) => (
                <AgentBubble
                  key={agent.id}
                  agent={agent}
                  style={getAgentPos(i, AGENTS.length)}
                  floatIndex={i}
                  onClick={() => openAgentChat(agent.id)}
                />
              ))}
            </AnimatePresence>
            <div className={styles.campfireBottom}>
              <Campfire onClick={() => {}} collapsed={false} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
