import { useEffect, useRef, useState } from "react";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import {
  autocompletion,
  type Completion,
  type CompletionContext,
  completionKeymap,
} from "@codemirror/autocomplete";
import { markdown } from "@codemirror/lang-markdown";
import { defaultHighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { EditorSelection, EditorState, RangeSetBuilder } from "@codemirror/state";
import { searchKeymap } from "@codemirror/search";
import {
  Decoration,
  drawSelection,
  EditorView,
  highlightActiveLine,
  keymap,
  placeholder,
  ViewPlugin,
  type ViewUpdate,
  WidgetType,
} from "@codemirror/view";
import styles from "./MarkdownEditor.module.css";

type MarkdownEditorProps = Readonly<{
  note: NoteEntry | null;
}>;

const SLASH_COMMANDS: Array<Completion & { build: (indent: string) => { text: string; anchor: number } }> = [
  {
    label: "Heading 1",
    detail: "#",
    type: "keyword",
    info: "큰 제목",
    build: (indent) => ({ text: `${indent}# `, anchor: `${indent}# `.length }),
  },
  {
    label: "Heading 2",
    detail: "##",
    type: "keyword",
    info: "중간 제목",
    build: (indent) => ({ text: `${indent}## `, anchor: `${indent}## `.length }),
  },
  {
    label: "To-do",
    detail: "- [ ]",
    type: "keyword",
    info: "체크리스트 항목",
    build: (indent) => ({ text: `${indent}- [ ] `, anchor: `${indent}- [ ] `.length }),
  },
  {
    label: "Bullet List",
    detail: "-",
    type: "keyword",
    info: "불릿 리스트",
    build: (indent) => ({ text: `${indent}- `, anchor: `${indent}- `.length }),
  },
  {
    label: "Quote",
    detail: ">",
    type: "keyword",
    info: "인용문",
    build: (indent) => ({ text: `${indent}> `, anchor: `${indent}> `.length }),
  },
  {
    label: "Code Block",
    detail: "```",
    type: "keyword",
    info: "코드 펜스",
    build: (indent) => ({
      text: `${indent}\`\`\`\n${indent}\n${indent}\`\`\``,
      anchor: `${indent}\`\`\`\n${indent}`.length,
    }),
  },
  {
    label: "Divider",
    detail: "---",
    type: "keyword",
    info: "구분선",
    build: (indent) => ({ text: `${indent}---`, anchor: `${indent}---`.length }),
  },
];

function slashCommandCompletion(context: CompletionContext) {
  const line = context.state.doc.lineAt(context.pos);
  const before = line.text.slice(0, context.pos - line.from);
  const after = line.text.slice(context.pos - line.from);
  const match = before.match(/^(\s*)\/([\w-]*)$/);

  if (!match || /\S/.test(after)) return null;

  const indent = match[1] ?? "";
  const query = (match[2] ?? "").toLowerCase();
  const from = context.pos - query.length - 1;
  const options = SLASH_COMMANDS
    .filter((command) => {
      const haystack = `${command.label} ${command.detail ?? ""} ${typeof command.info === "string" ? command.info : ""}`.toLowerCase();
      return haystack.includes(query);
    })
    .map((command) => ({
      ...command,
      apply: (view: EditorView, _completion: Completion, fromPos: number, toPos: number) => {
        const built = command.build(indent);
        const anchor = line.from + built.anchor;
        view.dispatch({
          changes: { from: line.from, to: line.to, insert: built.text },
          selection: { anchor },
        });
        view.focus();
      },
    }));

  if (options.length === 0) return null;

  return {
    from,
    to: context.pos,
    options,
    validFor: /^[\w-]*$/,
  };
}

class BulletWidget extends WidgetType {
  toDOM() {
    const span = document.createElement("span");
    span.className = "md-bullet-widget";
    span.textContent = "•";
    span.setAttribute("aria-hidden", "true");
    return span;
  }
}

class CheckboxWidget extends WidgetType {
  constructor(
    readonly checked: boolean,
    readonly lineFrom: number,
  ) {
    super();
  }

  eq(other: CheckboxWidget) {
    return other.checked === this.checked && other.lineFrom === this.lineFrom;
  }

  toDOM() {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `md-checkbox-widget${this.checked ? " md-checkbox-widget-done" : ""}`;
    button.dataset.lineFrom = String(this.lineFrom);
    button.textContent = this.checked ? "✓" : "";
    button.setAttribute("aria-label", this.checked ? "체크 해제" : "체크");
    return button;
  }

  ignoreEvent() {
    return false;
  }
}

class HiddenSyntaxWidget extends WidgetType {
  toDOM() {
    const span = document.createElement("span");
    span.setAttribute("aria-hidden", "true");
    return span;
  }
}

const listDecorations = ViewPlugin.fromClass(
  class {
    decorations;

    constructor(view: EditorView) {
      this.decorations = this.buildDecorations(view);
    }

    update(update: ViewUpdate) {
      if (update.docChanged || update.viewportChanged || update.selectionSet) {
        this.decorations = this.buildDecorations(update.view);
      }
    }

    buildDecorations(view: EditorView) {
      const builder = new RangeSetBuilder<Decoration>();
      const activeLineNumber = view.state.doc.lineAt(view.state.selection.main.head).number;

      for (const { from, to } of view.visibleRanges) {
        let line = view.state.doc.lineAt(from);
        while (line.from <= to) {
          const checklistMatch = line.text.match(/^(\s*)-\s\[( |x|X)\]\s?(.*)$/);
          if (checklistMatch) {
            const markerStart = line.from + checklistMatch[1].length;
            const markerEnd = markerStart + 6;
            const contentStart = markerEnd;
            const checked = checklistMatch[2].toLowerCase() === "x";
            const isActiveLine = line.number === activeLineNumber;

            builder.add(
              line.from,
              line.from,
              Decoration.line({
                attributes: {
                  class: `checklist-line ${checked ? "checklist-line-done" : ""}`.trim(),
                },
              }),
            );

            if (!isActiveLine) {
              builder.add(
                markerStart,
                markerEnd,
                Decoration.replace({
                  widget: new CheckboxWidget(checked, line.from),
                }),
              );
            }

            if (checked && contentStart < line.to && !isActiveLine) {
              builder.add(
                contentStart,
                line.to,
                Decoration.mark({
                  class: "checklist-content-done",
                }),
              );
            }
          } else {
            const bulletMatch = line.text.match(/^(\s*)-\s(.*)$/);
            if (bulletMatch) {
              const markerStart = line.from + bulletMatch[1].length;
              const markerEnd = markerStart + 2;
              const isActiveLine = line.number === activeLineNumber;

              if (!isActiveLine) {
                builder.add(
                  markerStart,
                  markerEnd,
                  Decoration.replace({
                    widget: new BulletWidget(),
                  }),
                );
              }
            }
          }

          if (line.to >= to) break;
          line = view.state.doc.line(line.number + 1);
        }
      }

      return builder.finish();
    }
  },
  {
    decorations: (value) => value.decorations,
  },
);

const headingDecorations = ViewPlugin.fromClass(
  class {
    decorations;

    constructor(view: EditorView) {
      this.decorations = this.buildDecorations(view);
    }

    update(update: ViewUpdate) {
      if (update.docChanged || update.viewportChanged || update.selectionSet) {
        this.decorations = this.buildDecorations(update.view);
      }
    }

    buildDecorations(view: EditorView) {
      const builder = new RangeSetBuilder<Decoration>();
      const activeLineNumber = view.state.doc.lineAt(view.state.selection.main.head).number;

      for (const { from, to } of view.visibleRanges) {
        let line = view.state.doc.lineAt(from);
        while (line.from <= to) {
          const match = line.text.match(/^(\s*)(#{1,6})(\s+)(.*)$/);
          if (match) {
            const level = Math.min(match[2].length, 6);
            const syntaxFrom = line.from + match[1].length;
            const syntaxTo = syntaxFrom + match[2].length + match[3].length;
            const isActiveLine = line.number === activeLineNumber;

            builder.add(
              line.from,
              line.from,
              Decoration.line({
                attributes: {
                  class: `md-heading md-heading-${level}`,
                },
              }),
            );

            builder.add(
              syntaxFrom,
              syntaxTo,
              isActiveLine
                ? Decoration.mark({
                    class: "md-heading-syntax-active",
                  })
                : Decoration.replace({
                    widget: new HiddenSyntaxWidget(),
                  }),
            );
          }

          if (line.to >= to) break;
          line = view.state.doc.line(line.number + 1);
        }
      }

      return builder.finish();
    }
  },
  {
    decorations: (value) => value.decorations,
  },
);

const editorTheme = EditorView.theme({
  "&": {
    height: "100%",
    background: "transparent",
    color: "rgba(244, 229, 203, 0.96)",
    fontSize: "16px",
  },
  ".cm-scroller": {
    overflow: "auto",
    fontFamily: "'Pretendard', -apple-system, BlinkMacSystemFont, system-ui, sans-serif",
    lineHeight: "1.82",
    padding: "40px 64px 52px",
  },
  ".cm-content": {
    padding: "0",
    caretColor: "rgba(255, 226, 176, 0.96)",
  },
  ".cm-line": {
    padding: "0",
  },
  ".cm-cursor, .cm-dropCursor": {
    borderLeftColor: "rgba(255, 226, 176, 0.96)",
  },
  ".cm-selectionBackground, &.cm-focused .cm-selectionBackground, ::selection": {
    backgroundColor: "rgba(255, 156, 63, 0.22)",
  },
  ".cm-activeLine": {
    backgroundColor: "rgba(255, 196, 124, 0.06)",
  },
  ".cm-gutters": {
    display: "none",
  },
  ".cm-placeholder": {
    color: "rgba(198, 173, 132, 0.36)",
  },
  ".cm-tooltip-autocomplete": {
    border: "1px solid rgba(255, 195, 122, 0.16)",
    background: "rgba(19, 15, 12, 0.96)",
    backdropFilter: "blur(10px)",
    borderRadius: "14px",
    boxShadow: "0 18px 40px rgba(0, 0, 0, 0.34), inset 0 1px 0 rgba(255, 255, 255, 0.03)",
    padding: "8px",
  },
  ".cm-tooltip-autocomplete > ul": {
    fontFamily: "'Pretendard', -apple-system, BlinkMacSystemFont, system-ui, sans-serif",
  },
  ".cm-tooltip-autocomplete ul li": {
    borderRadius: "10px",
    padding: "10px 12px",
    color: "rgba(244, 229, 203, 0.88)",
  },
  ".cm-tooltip-autocomplete ul li[aria-selected]": {
    background: "rgba(255, 196, 124, 0.1)",
    color: "rgba(255, 241, 214, 0.96)",
  },
  ".cm-completionLabel": {
    fontWeight: "600",
  },
  ".cm-completionDetail": {
    color: "rgba(205, 184, 149, 0.54)",
  },
  ".cm-completionIcon": {
    display: "none",
  },
});

export function MarkdownEditor({ note }: MarkdownEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const notePathRef = useRef<string | null>(null);
  const noteListRef = useRef<NoteEntry[]>([]);

  const [saved, setSaved] = useState(true);
  const [wordCount, setWordCount] = useState(0);

  useEffect(() => {
    window.api.listNotes().then((notes) => {
      noteListRef.current = notes;
    });
  }, [note?.filePath]);

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      viewRef.current?.destroy();
      viewRef.current = null;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }

    if (!note || !containerRef.current) {
      notePathRef.current = null;
      setSaved(true);
      setWordCount(0);
      viewRef.current?.destroy();
      viewRef.current = null;
      return;
    }

    notePathRef.current = note.filePath;
    setSaved(true);

    window.api.readNote(note.filePath).then((text) => {
      if (cancelled || !containerRef.current || notePathRef.current !== note.filePath) return;

      setWordCount(text.trim() ? text.trim().split(/\s+/).length : 0);
      viewRef.current?.destroy();

      const updateListener = EditorView.updateListener.of((update) => {
        if (!update.docChanged) return;

        const nextText = update.state.doc.toString();
        setSaved(false);
        setWordCount(nextText.trim() ? nextText.trim().split(/\s+/).length : 0);

        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        saveTimerRef.current = setTimeout(() => {
          if (notePathRef.current !== note.filePath) return;
          window.api.writeNote(note.filePath, nextText).then(() => {
            if (notePathRef.current === note.filePath) setSaved(true);
          });
        }, 500);
      });

      const checkboxToggleHandler = EditorView.domEventHandlers({
        mousedown: (event, view) => {
          const target = event.target;
          if (!(target instanceof HTMLElement)) return false;
          const button = target.closest(".md-checkbox-widget");
          if (!button) return false;

          const lineFrom = Number(button.getAttribute("data-line-from"));
          if (!Number.isFinite(lineFrom)) return false;

          const line = view.state.doc.lineAt(lineFrom);
          const match = line.text.match(/^(\s*-\s\[)( |x|X)(\]\s?)/);
          if (!match) return false;

          const nextMark = match[2].toLowerCase() === "x" ? " " : "x";
          view.dispatch({
            changes: {
              from: line.from + match[1].length,
              to: line.from + match[1].length + 1,
              insert: nextMark,
            },
          });
          event.preventDefault();
          return true;
        },
      });

      const wikiLinkCompletion = (context: CompletionContext) => {
        const line = context.state.doc.lineAt(context.pos);
        const before = line.text.slice(0, context.pos - line.from);
        const match = before.match(/\[\[([^\]]*)$/);
        if (!match) return null;

        const query = (match[1] ?? "").toLowerCase();
        const from = context.pos - match[0].length;
        const options = noteListRef.current
          .map((entry) => ({
            label: entry.rel.replace(/\.md$/i, ""),
            detail: entry.rel,
            type: "text" as const,
            info: "노트 링크",
          }))
          .filter((entry) => entry.label.toLowerCase().includes(query) || entry.detail.toLowerCase().includes(query))
          .slice(0, 12)
          .map((entry) => ({
            ...entry,
            apply: (view: EditorView, _completion: Completion, fromPos: number, toPos: number) => {
              view.dispatch({
                changes: { from: fromPos, to: toPos, insert: `[[${entry.label}]]` },
                selection: { anchor: fromPos + entry.label.length + 4 },
              });
              view.focus();
            },
          }));

        if (options.length === 0) return null;

        return {
          from,
          to: context.pos,
          options,
          validFor: /^[^\]]*$/,
        };
      };

      const handleChecklistEnter = ({ state, dispatch }: EditorView) => {
        const range = state.selection.main;
        if (!range.empty) return false;

        const line = state.doc.lineAt(range.from);
        const match = line.text.match(/^(\s*)-\s(?:\[( |x|X)\]\s)?(.*)$/);
        if (!match) return false;

        const indent = match[1] ?? "";
        const hasCheckbox = typeof match[2] === "string";
        const body = match[3] ?? "";

        if (body.trim().length === 0) {
          const removeTo = Math.min(state.doc.length, line.to + (line.to < state.doc.length ? 1 : 0));
          dispatch({
            changes: { from: line.from, to: removeTo, insert: "" },
            selection: { anchor: line.from },
          });
          return true;
        }

        const insertion = `\n${indent}- ${hasCheckbox ? "[ ] " : ""}`;
        dispatch(state.update(state.replaceSelection(insertion), {
          selection: EditorSelection.cursor(range.from + insertion.length),
          scrollIntoView: true,
        }));
        return true;
      };

      const toggleChecklistSelection = ({ state, dispatch }: EditorView) => {
        const line = state.doc.lineAt(state.selection.main.head);
        const match = line.text.match(/^(\s*-\s\[)( |x|X)(\]\s?)/);
        if (!match) return false;

        const toggleFrom = line.from + match[1].length;
        dispatch({
          changes: {
            from: toggleFrom,
            to: toggleFrom + 1,
            insert: match[2].toLowerCase() === "x" ? " " : "x",
          },
          selection: { anchor: state.selection.main.head },
        });
        return true;
      };

      const state = EditorState.create({
        doc: text,
        extensions: [
          history(),
          drawSelection(),
          EditorView.editable.of(true),
          EditorView.lineWrapping,
          highlightActiveLine(),
          checkboxToggleHandler,
          listDecorations,
          headingDecorations,
          markdown(),
          syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
          autocompletion({
            override: [slashCommandCompletion, wikiLinkCompletion],
            activateOnTyping: true,
            defaultKeymap: false,
          }),
          placeholder("여기에 마크다운을 입력하세요"),
          keymap.of([
            { key: "Enter", run: handleChecklistEnter },
            { key: "Mod-Enter", run: toggleChecklistSelection },
            indentWithTab,
            ...completionKeymap,
            ...defaultKeymap,
            ...historyKeymap,
            ...searchKeymap,
          ]),
          editorTheme,
          updateListener,
        ],
      });

      viewRef.current = new EditorView({
        state,
        parent: containerRef.current,
      });
    });

    return () => {
      cancelled = true;
    };
  }, [note?.filePath]);

  return (
    <div className={styles.panel}>
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

      {note ? (
        <div className={styles.editorWrapper}>
          <div ref={containerRef} className={styles.editorRoot} />
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
