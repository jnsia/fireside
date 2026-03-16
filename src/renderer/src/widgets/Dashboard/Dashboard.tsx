import { useState, useEffect, useCallback } from "react";
import styles from "./Dashboard.module.css";

interface TimelineItem {
  time: string;
  content: string;
  completed: boolean;
}

interface TodoItem {
  id: string;
  text: string;
  done: boolean;
}

interface DashboardProps {
  refreshKey?: number;
  onSelectNote: (note: NoteEntry) => void;
}

export function Dashboard({ refreshKey, onSelectNote }: DashboardProps) {
  const [now, setNow] = useState(new Date());
  const [timeline, setTimeline] = useState<TimelineItem[]>([]);
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [dailyNoteFolder, setDailyNoteFolder] = useState('02_Areas/Life/Daily Log');
  const [workLogFolder, setWorkLogFolder] = useState('02_Areas/Work');

  useEffect(() => {
    window.api.getConfig().then((config) => {
      setDailyNoteFolder(config.dailyNoteFolder);
      setWorkLogFolder(config.workLogFolder);
    });
  }, []);

  // 날짜 관련 계산
  const year = now.getFullYear();
  const month = now.getMonth();
  const date = now.getDate();

  const getYYMMDD = (d: Date) => {
    const yy = String(d.getFullYear()).slice(2);
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yy}${mm}${dd}`;
  };
  const todayKey = getYYMMDD(now);

  // 타임라인 데이터 로드
  const fetchTimeline = useCallback(async () => {
    setLoading(true);
    try {
      const filename = `${getYYMMDD(now)}.md`;
      const path = `${dailyNoteFolder}/${filename}`;

      const allNotes = await window.api.listNotes();
      const dailyNote = allNotes.find((n: any) => n.rel === path);

      if (dailyNote) {
        const content = await window.api.readNote(dailyNote.filePath);
        const lines = content.split("\n");
        const timelineItems: TimelineItem[] = [];
        const todoItems: TodoItem[] = [];
        let inSchedule = false;
        let inTodo = false;

        for (let i = 0; i < lines.length; i += 1) {
          const line = lines[i];
          const trimmed = line.trim();

          if (line.includes("## Schedule")) {
            inSchedule = true;
            inTodo = false;
            continue;
          }
          if (/^##\s+(Todo|To-do|Tasks|Task|할 일)\s*$/i.test(trimmed)) {
            inTodo = true;
            inSchedule = false;
            continue;
          }
          if (trimmed.startsWith("## ")) {
            inSchedule = false;
            inTodo = false;
          }

          if (inSchedule && trimmed.startsWith("- [")) {
            const match = line.match(/- \[(x| )\] ([\d: \-]+) (.*)/);
            if (match) {
              timelineItems.push({
                completed: match[1] === "x",
                time: match[2].trim(),
                content: match[3].trim(),
              });
            }
          }

          if (inTodo && trimmed.startsWith("- [")) {
            const match = trimmed.match(/^- \[(x| )\]\s+(.*)$/i);
            if (match) {
              todoItems.push({
                id: `todo-${i}`,
                done: match[1].toLowerCase() === "x",
                text: match[2].trim(),
              });
            }
          }
        }

        setTimeline(timelineItems);
        setTodos(todoItems);
      } else {
        setTimeline([]);
        setTodos([]);
      }
    } catch (e) {
      console.error("Failed to fetch timeline:", e);
    } finally {
      setLoading(false);
    }
  }, [now, dailyNoteFolder]);

  useEffect(() => {
    fetchTimeline();
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, [fetchTimeline, refreshKey]);

  // 오늘 노트 열기 (업무 일지 → 데일리 순서로 열어 데일리가 포커스됨)
  const handleOpenToday = useCallback(async () => {
    const key = getYYMMDD(now);
    const filename = `${key}.md`;
    const allNotes = await window.api.listNotes();

    const workNote = allNotes.find((n) => n.rel === `${workLogFolder}/${filename}`);
    if (workNote) {
      onSelectNote(workNote);
    } else {
      try {
        const created = await window.api.newNote(key, workLogFolder);
        onSelectNote(created);
      } catch {}
    }

    const dailyNote = allNotes.find((n) => n.rel === `${dailyNoteFolder}/${filename}`);
    if (dailyNote) {
      onSelectNote(dailyNote);
    } else {
      try {
        const created = await window.api.newNote(key, dailyNoteFolder);
        onSelectNote(created);
      } catch {}
    }
  }, [now, dailyNoteFolder, workLogFolder, onSelectNote]);

  // 달력 날짜 클릭 → 해당 일자 데일리 노트 열기
  const handleDateClick = useCallback(async (dayNum: number) => {
    const d = new Date(year, month, dayNum);
    const key = getYYMMDD(d);
    const allNotes = await window.api.listNotes();
    const note = allNotes.find((n) => n.rel === `${dailyNoteFolder}/${key}.md`);
    if (note) {
      onSelectNote(note);
    } else {
      try {
        const created = await window.api.newNote(key, dailyNoteFolder);
        onSelectNote(created);
      } catch {}
    }
  }, [year, month, dailyNoteFolder, onSelectNote]);

  // 달력 렌더링
  const renderCalendar = () => {
    const startDay = new Date(year, month, 1).getDay();
    const lastDate = new Date(year, month + 1, 0).getDate();
    const days = [];

    for (let i = 0; i < startDay; i++)
      days.push(<div key={`empty-${i}`} className={styles.dayEmpty} />);

    for (let i = 1; i <= lastDate; i++) {
      const isToday =
        i === date &&
        month === new Date().getMonth() &&
        year === new Date().getFullYear();
      days.push(
        <div
          key={i}
          className={`${styles.day} ${isToday ? styles.today : ""}`}
          onClick={() => handleDateClick(i)}
        >
          {i}
        </div>,
      );
    }

    return (
      <div className={styles.calendarGrid}>
        {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
          <div key={i} className={styles.dayHeader}>
            {d}
          </div>
        ))}
        {days}
      </div>
    );
  };

  return (
    <div className={styles.container}>
      {/* 오늘 열기 버튼 */}
      <button className={styles.todayBtn} onClick={handleOpenToday}>
        <span className={styles.todayBtnDot} />
        오늘 노트 열기
        <span className={styles.todayBtnDate}>{todayKey}</span>
      </button>

      {/* 할일 섹션 */}
      <section className={styles.section}>
        <div className={styles.header}>
          <span className={styles.title}>할 일 목록</span>
        </div>

        <div className={styles.todoList}>
          {todos.length === 0 && <div className={styles.empty}>마크다운 할 일이 없습니다.</div>}
          {todos.map((todo) => (
            <div key={todo.id} className={styles.todoItem}>
              <label className={styles.todoLabel}>
                <input type="checkbox" checked={todo.done} readOnly />
                <span className={todo.done ? styles.todoDone : ""}>{todo.text}</span>
              </label>
            </div>
          ))}
        </div>
      </section>

      {/* 타임라인 섹션 */}
      <section className={`${styles.section} ${styles.timelineSection}`}>
        <div className={styles.header}>
          <span className={styles.title}>오늘의 타임라인</span>
          <span className={styles.subtitle}>{getYYMMDD(now)}</span>
        </div>

        <div className={styles.timeline}>
          {loading ? (
            <div className={styles.loading}>로딩 중...</div>
          ) : timeline.length > 0 ? (
            timeline.map((item, i) => (
              <div
                key={i}
                className={`${styles.item} ${item.completed ? styles.completed : ""}`}
              >
                <div className={styles.timeLineCol}>
                  <div className={styles.dot} />
                  {i !== timeline.length - 1 && <div className={styles.line} />}
                </div>
                <div className={styles.itemContent}>
                  <div className={styles.itemTime}>{item.time}</div>
                  <div className={styles.itemText}>{item.content}</div>
                </div>
              </div>
            ))
          ) : (
            <div className={styles.empty}>오늘의 일정이 없습니다.</div>
          )}
        </div>
      </section>

      {/* 캘린더 섹션 */}
      <section className={styles.section}>
        <div className={styles.header}>
          <span className={styles.title}>
            {year}년 {month + 1}월
          </span>
        </div>
        {renderCalendar()}
      </section>
    </div>
  );
}
