import { useState, useEffect, useRef, useCallback } from "react";
import styles from "./MarkdownEditor.module.css";

interface MarkdownEditorProps {
  note: NoteEntry | null;
}

export function MarkdownEditor({ note }: MarkdownEditorProps) {
  const [content, setContent] = useState("");
  const [saved, setSaved] = useState(true);
  const editorRef = useRef<HTMLDivElement>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 파일 로드
  useEffect(() => {
    if (!note) {
      setContent("");
      setSaved(true);
      if (editorRef.current) editorRef.current.innerText = "";
      return;
    }
    window.api.readNote(note.filePath).then((txt) => {
      setContent(txt);
      setSaved(true);
      if (editorRef.current) {
        editorRef.current.innerText = txt;
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

  const handleInput = (e: React.FormEvent<HTMLDivElement>) => {
    const text = e.currentTarget.innerText;
    setContent(text);
    saveContent(text);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Tab") {
      e.preventDefault();
      document.execCommand("insertText", false, "  ");
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
          <div
            ref={editorRef}
            className={styles.liveEditor}
            contentEditable
            onInput={handleInput}
            onKeyDown={handleKeyDown}
            spellCheck={false}
            suppressContentEditableWarning
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
