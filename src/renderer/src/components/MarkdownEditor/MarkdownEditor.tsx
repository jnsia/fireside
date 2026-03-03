import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import styles from "./MarkdownEditor.module.css";

interface MarkdownEditorProps {
  note: NoteEntry | null;
}

export function MarkdownEditor({ note }: MarkdownEditorProps) {
  const [content, setContent] = useState("");
  const [saved, setSaved] = useState(true);
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
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

  const handleScroll = (e: React.UIEvent<HTMLTextAreaElement>) => {
    if (!previewRef.current) return;
    previewRef.current.scrollTop = e.currentTarget.scrollTop;
    previewRef.current.scrollLeft = e.currentTarget.scrollLeft;
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

  const renderInline = useCallback((text: string, keyBase: string) => {
    if (!text) return [<span key={`${keyBase}-empty`}> </span>];
    const chunks: React.ReactNode[] = [];
    const tokenRegex = /(`[^`]+`)|(\[[^\]]+\]\([^)]+\))/g;
    let last = 0;
    let tokenIndex = 0;

    for (const match of text.matchAll(tokenRegex)) {
      const m = match[0];
      const index = match.index ?? 0;
      if (index > last) {
        chunks.push(
          <span key={`${keyBase}-plain-${tokenIndex}`}>{text.slice(last, index)}</span>,
        );
      }

      if (m.startsWith("`")) {
        chunks.push(
          <span key={`${keyBase}-code-${tokenIndex}`} className={styles.inlineCode}>
            {m}
          </span>,
        );
      } else {
        chunks.push(
          <span key={`${keyBase}-link-${tokenIndex}`} className={styles.inlineLink}>
            {m}
          </span>,
        );
      }
      tokenIndex += 1;
      last = index + m.length;
    }

    if (last < text.length) {
      chunks.push(<span key={`${keyBase}-tail`}>{text.slice(last)}</span>);
    }

    return chunks.length > 0 ? chunks : [<span key={`${keyBase}-raw`}>{text}</span>];
  }, []);

  const previewLines = useMemo(() => {
    const lines = content.split("\n");
    const result: React.ReactNode[] = [];
    let inCodeBlock = false;

    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];
      const tabs = line.match(/^\t*/)?.[0] ?? "";
      const body = line.slice(tabs.length);
      const key = `line-${index}`;

      const fence = body.match(/^```/);
      if (fence) {
        result.push(
          <div key={key} className={`${styles.previewLine} ${styles.codeFenceLine}`}>
            <span className={styles.previewText}>
              <span className={styles.indentToken}>{tabs}</span>
              <span className={styles.syntaxToken}>{body || " "}</span>
            </span>
          </div>,
        );
        inCodeBlock = !inCodeBlock;
        continue;
      }

      if (inCodeBlock) {
        result.push(
          <div key={key} className={`${styles.previewLine} ${styles.codeBlockLine}`}>
            <span className={styles.previewText}>
              <span className={styles.indentToken}>{tabs}</span>
              <span>{body || " "}</span>
            </span>
          </div>,
        );
        continue;
      }

      const heading = body.match(/^(#{1,6})(\s+)(.*)$/);
      if (heading) {
        const level = Math.min(6, heading[1].length);
        result.push(
          <div key={key} className={`${styles.previewLine} ${styles[`heading${level}`]}`}>
            <span className={styles.previewText}>
              <span className={styles.indentToken}>{tabs}</span>
              <span className={styles.syntaxToken}>{heading[1]}{heading[2]}</span>
              {renderInline(heading[3], key)}
            </span>
          </div>,
        );
        continue;
      }

      const checkbox = body.match(/^(- \[( |x|X)\]\s?)(.*)$/);
      if (checkbox) {
        const checked = checkbox[2].toLowerCase() === "x";
        result.push(
          <div
            key={key}
            className={`${styles.previewLine} ${styles.checkboxLine} ${
              checked ? styles.checkboxLineChecked : ""
            }`}
          >
            <span className={styles.previewText}>
              <span className={styles.indentToken}>{tabs}</span>
              <span className={styles.listToken}>{checkbox[1]}</span>
              {renderInline(checkbox[3], key)}
            </span>
          </div>,
        );
        continue;
      }

      const bullet = body.match(/^(-\s+)(.*)$/);
      if (bullet) {
        result.push(
          <div key={key} className={`${styles.previewLine} ${styles.bulletLine}`}>
            <span className={styles.previewText}>
              <span className={styles.indentToken}>{tabs}</span>
              <span className={styles.listToken}>{bullet[1]}</span>
              {renderInline(bullet[2], key)}
            </span>
          </div>,
        );
        continue;
      }

      const quote = body.match(/^(>\s?)(.*)$/);
      if (quote) {
        result.push(
          <div key={key} className={`${styles.previewLine} ${styles.quoteLine}`}>
            <span className={styles.previewText}>
              <span className={styles.indentToken}>{tabs}</span>
              <span className={styles.syntaxToken}>{quote[1]}</span>
              {renderInline(quote[2], key)}
            </span>
          </div>,
        );
        continue;
      }

      const hr = body.match(/^([-*_])(?:\s*\1){2,}\s*$/);
      if (hr) {
        result.push(
          <div key={key} className={`${styles.previewLine} ${styles.hrLine}`}>
            <span className={styles.previewText}>
              <span className={styles.indentToken}>{tabs}</span>
              <span className={styles.syntaxToken}>{body}</span>
            </span>
          </div>,
        );
        continue;
      }

      result.push(
        <div key={key} className={styles.previewLine}>
          <span className={styles.previewText}>
            <span className={styles.indentToken}>{tabs}</span>
            {renderInline(body, key)}
          </span>
        </div>,
      );
    }

    return result;
  }, [content, renderInline]);

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
          <div ref={previewRef} className={styles.previewLayer} aria-hidden>
            {previewLines}
          </div>
          <textarea
            ref={editorRef}
            className={styles.liveEditor}
            value={content}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            onScroll={handleScroll}
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
