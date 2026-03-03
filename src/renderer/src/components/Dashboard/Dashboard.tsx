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
}

export function Dashboard({ refreshKey }: DashboardProps) {
  const [now, setNow] = useState(new Date());
  const [timeline, setTimeline] = useState<TimelineItem[]>([]);
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [loading, setLoading] = useState(true);

  // 1. 날짜 관련 계산
  const year = now.getFullYear();
  const month = now.getMonth();
  const date = now.getDate();

  // YYMMDD 형식 생성
  const getYYMMDD = (d: Date) => {
    const yy = String(d.getFullYear()).slice(2);
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yy}${mm}${dd}`;
  };
  const todayKey = getYYMMDD(now);

  // 2. 타임라인 데이터 로드
  const fetchTimeline = useCallback(async () => {
    setLoading(true);
    try {
      const filename = `${getYYMMDD(now)}.md`;
      const path = `02_Areas/Life/Daily Log/${filename}`;

      // 전체 목록에서 경로 찾기
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
            // 형식: - [x] 07:50 - 08:20 기상 / 준비
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
  }, [now]);

  useEffect(() => {
    fetchTimeline();
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, [fetchTimeline, refreshKey]);

  // 3. 달력 렌더링 도우미
  const renderCalendar = () => {
    const startDay = new Date(year, month, 1).getDay();
    const lastDate = new Date(year, month + 1, 0).getDate();
    const days = [];

    // 빈 칸
    for (let i = 0; i < startDay; i++)
      days.push(<div key={`empty-${i}`} className={styles.dayEmpty} />);
    // 날짜
    for (let i = 1; i <= lastDate; i++) {
      const isToday =
        i === date &&
        month === new Date().getMonth() &&
        year === new Date().getFullYear();
      days.push(
        <div key={i} className={`${styles.day} ${isToday ? styles.today : ""}`}>
          {i}
        </div>,
      );
    }

    return (
      <div className={styles.calendarGrid}>
        {["S", "M", "T", "W", "T", "F", "S"].map((d) => (
          <div key={d} className={styles.dayHeader}>
            {d}
          </div>
        ))}
        {days}
      </div>
    );
  };

  return (
    <div className={styles.container}>
      {/* 캘린더 섹션 */}
      <section className={styles.section}>
        <div className={styles.header}>
          <span className={styles.title}>
            {year}년 {month + 1}월
          </span>
        </div>
        {renderCalendar()}
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

      <section className={styles.section}>
        <div className={styles.header}>
          <span className={styles.title}>할 일 목록</span>
          <span className={styles.subtitle}>{todayKey}</span>
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
    </div>
  );
}
