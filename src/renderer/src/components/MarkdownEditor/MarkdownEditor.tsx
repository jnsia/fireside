import { useState, useEffect, useRef, useCallback } from "react";
import styles from "./MarkdownEditor.module.css";

interface MarkdownEditorProps {
  note: NoteEntry | null;
}

export function MarkdownEditor({ note }: MarkdownEditorProps) {
  const [content, setContent] = useState("");
  const [saved, setSaved] = useState(true);
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 파일 로드
  useEffect(() => {
    if (!note) {
      setContent("");
      setSaved(true);
      if (editorRef.current) editorRef.current.value = "";
      return;
    }
    window.api.readNote(note.filePath).then((txt) => {
      setContent(txt);
      setSaved(true);
      if (editorRef.current) {
        editorRef.current.value = txt;
      }
    });
  }, [note?.filePath]);

  // 저장 로직
  const saveContent = useCallback(
    (text: string) => {
      if (!note) return;
      if (saveTimer.current) clearTimeout(saveTimer.current);
      setSaved(false);
      saveTimer.current = setTimeout(() => {
        window.api.writeNote(note.filePath, text).then(() => setSaved(true));
      }, 800);
    },
    [note],
  );

  const applyText = useCallback((text: string) => {
    setContent(text);
    saveContent(text);
  }, [saveContent]);

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    applyText(e.currentTarget.value);
  };

  const replaceLine = (
    value: string,
    lineStart: number,
    lineEnd: number,
    lineText: string,
  ) => `${value.slice(0, lineStart)}${lineText}${value.slice(lineEnd)}`;

  const getLineBounds = (value: string, pos: number) => {
    const lineStart = value.lastIndexOf("\n", Math.max(0, pos - 1)) + 1;
    const lineEndIdx = value.indexOf("\n", pos);
    const lineEnd = lineEndIdx === -1 ? value.length : lineEndIdx;
    return { lineStart, lineEnd };
  };

  const setSelection = (start: number, end = start) => {
    requestAnimationFrame(() => {
      const el = editorRef.current;
      if (!el) return;
      el.selectionStart = start;
      el.selectionEnd = end;
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const el = editorRef.current;
    if (!el) return;
    const value = el.value;
    const start = el.selectionStart;
    const end = el.selectionEnd;

    if ((e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey && /^[1-6]$/.test(e.key)) {
      e.preventDefault();
      const level = Number(e.key);
      const { lineStart, lineEnd } = getLineBounds(value, start);
      const line = value.slice(lineStart, lineEnd);
      const indent = line.match(/^\t*/)?.[0] ?? "";
      const noIndent = line.slice(indent.length);
      const withoutHeading = noIndent.replace(/^#{1,6}\s+/, "");
      const existingLevel = noIndent.match(/^(#{1,6})\s+/)?.[1]?.length ?? 0;
      const nextLine =
        existingLevel === level
          ? `${indent}${withoutHeading}`
          : `${indent}${"#".repeat(level)} ${withoutHeading}`;
      const next = replaceLine(value, lineStart, lineEnd, nextLine);
      const diff = nextLine.length - line.length;
      applyText(next);
      setSelection(start + diff, end + diff);
      return;
    }

    if (e.key === "Tab") {
      e.preventDefault();
      if (start !== end) {
        const { lineStart } = getLineBounds(value, start);
        const { lineEnd } = getLineBounds(value, end);
        const selected = value.slice(lineStart, lineEnd);
        const lines = selected.split("\n");
        if (e.shiftKey) {
          let removedBeforeStart = 0;
          let removedBeforeEnd = 0;
          const nextLines = lines.map((line, index) => {
            if (line.startsWith("\t")) {
              if (index === 0) removedBeforeStart += 1;
              removedBeforeEnd += 1;
              return line.slice(1);
            }
            return line;
          });
          const nextSelected = nextLines.join("\n");
          const next = `${value.slice(0, lineStart)}${nextSelected}${value.slice(lineEnd)}`;
          applyText(next);
          setSelection(
            Math.max(lineStart, start - removedBeforeStart),
            Math.max(lineStart, end - removedBeforeEnd),
          );
        } else {
          const nextSelected = lines.map((line) => `\t${line}`).join("\n");
          const next = `${value.slice(0, lineStart)}${nextSelected}${value.slice(lineEnd)}`;
          applyText(next);
          setSelection(start + 1, end + lines.length);
        }
        return;
      }

      if (e.shiftKey) {
        const { lineStart } = getLineBounds(value, start);
        if (value[lineStart] === "\t") {
          const next = `${value.slice(0, lineStart)}${value.slice(lineStart + 1)}`;
          applyText(next);
          setSelection(Math.max(lineStart, start - 1));
        }
      } else {
        const next = `${value.slice(0, start)}\t${value.slice(end)}`;
        applyText(next);
        setSelection(start + 1);
      }
      return;
    }

    if (e.key === "Enter") {
      const { lineStart, lineEnd } = getLineBounds(value, start);
      const line = value.slice(lineStart, lineEnd);
      const match = line.match(/^(\t*)-\s(?:\[( |x|X)\]\s)?(.*)$/);
      if (!match) return;

      e.preventDefault();
      const indent = match[1];
      const hasCheckbox = typeof match[2] === "string";
      const body = match[3] ?? "";

      const continuation = body.trim()
        ? `\n${indent}- ${hasCheckbox ? "[ ] " : ""}`
        : "\n";
      const next = `${value.slice(0, start)}${continuation}${value.slice(end)}`;
      applyText(next);
      setSelection(start + continuation.length);
    }
  };

  const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0;

  return (
    <div className={styles.panel}>
      {/* 툴바 */}
      <div className={styles.toolbar}>
        <div className={styles.toolbarLeft}>
          <span className={styles.fileIcon}>📄</span>
          <span className={styles.noteName}>
            {note ? note.name : "Neurostars"}
          </span>
          <span
            className={`${styles.saveDot} ${saved ? styles.saveDotSaved : styles.saveDotPending}`}
            title={saved ? "저장됨" : "저장 중..."}
          />
        </div>
        <div className={styles.toolbarRight}>
          {wordCount > 0 && (
            <span className={styles.wordCount}>
              {wordCount.toLocaleString()}단어
            </span>
          )}
        </div>
      </div>

      {/* 본문 영역 (Live Editor) */}
      {note ? (
        <div className={styles.editorWrapper}>
          <textarea
            ref={editorRef}
            className={styles.liveEditor}
            value={content}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            spellCheck={false}
          />
        </div>
      ) : (
        <div className={styles.placeholder}>
          <div className={styles.placeholderIcon}>📝</div>
          <div className={styles.placeholderText}>
            파일 탐색기에서 노트를 선택하세요
          </div>
          <div className={styles.placeholderSub}>
            또는 + 버튼으로 새 노트를 만드세요
          </div>
        </div>
      )}
    </div>
  );
}
