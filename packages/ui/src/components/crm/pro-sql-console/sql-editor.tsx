import * as React from "react";
import * as ReactCodeMirror from "@uiw/react-codemirror";
import { autocompletion, type CompletionSource } from "@codemirror/autocomplete";
import { lintGutter, linter } from "@codemirror/lint";
import { Prec } from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";
import {
  sqlCompletionSource,
  sqlLintSource,
  type SchemaIndex,
} from "@/components/crm/pro-sql-console/sql-analysis";
import { sqlLanguage, statementAt } from "@/components/crm/pro-sql-console/sql-language";

// Some bundlers/CDN runtimes wrap the CJS default export one level deeper; unwrap it.
type CodeMirrorComponent = typeof ReactCodeMirror.default;
const cmModule = ReactCodeMirror.default as CodeMirrorComponent | { default: CodeMirrorComponent };
const CodeMirror: CodeMirrorComponent = "default" in cmModule ? cmModule.default : cmModule;

export interface RunTarget {
  sql: string;
  /** Offset of `sql` inside the document (maps error positions back). */
  from: number;
}

/** What ⌘Enter runs: the selection if any, else the statement under the cursor. */
export function runTargetOf(view: EditorView, all = false): RunTarget {
  const doc = view.state.doc.toString();
  if (all) return { sql: doc, from: 0 };
  const sel = view.state.selection.main;
  if (!sel.empty) return { sql: doc.slice(sel.from, sel.to), from: sel.from };
  const s = statementAt(doc, sel.head);
  return { sql: s.text, from: s.from };
}

export interface SqlEditorProps {
  value: string;
  onChange: (value: string) => void;
  schema: SchemaIndex;
  onRun: (target: RunTarget) => void;
  onViewChange?: (view: EditorView | null) => void;
  readOnly?: boolean;
  placeholder?: string;
  className?: string;
}

/** CodeMirror 6 (via @uiw/react-codemirror) with the in-house SQL mode, completion and lint. */
export function SqlEditor({
  value,
  onChange,
  schema,
  onRun,
  onViewChange,
  readOnly,
  placeholder = "SELECT * FROM …",
  className,
}: SqlEditorProps) {
  // Extensions are built once; they read the latest schema and callbacks through refs so
  // CodeMirror never reconfigures (which would reset undo history and cursor).
  const schemaRef = React.useRef(schema);
  const runRef = React.useRef(onRun);
  React.useEffect(() => {
    schemaRef.current = schema;
    runRef.current = onRun;
  });

  const extensions = React.useMemo(() => {
    const getSchema = () => schemaRef.current;
    const run = (all: boolean) => (view: EditorView) => {
      runRef.current(runTargetOf(view, all));
      return true;
    };
    return [
      sqlLanguage(),
      autocompletion({
        override: [sqlCompletionSource(getSchema) as CompletionSource],
        activateOnTyping: true,
        icons: false,
      }),
      linter(sqlLintSource(getSchema), { delay: 350 }),
      lintGutter(),
      EditorView.lineWrapping,
      EditorView.contentAttributes.of({ "aria-label": "SQL query editor" }),
      Prec.highest(
        keymap.of([
          { key: "Mod-Enter", run: run(false) },
          { key: "Shift-Mod-Enter", run: run(true) },
        ]),
      ),
    ];
  }, []);

  return (
    <CodeMirror
      value={value}
      onChange={onChange}
      extensions={extensions}
      theme="none"
      height="100%"
      className={className}
      readOnly={readOnly}
      placeholder={placeholder}
      onCreateEditor={(view) => onViewChange?.(view)}
      basicSetup={{
        autocompletion: false,
        foldGutter: false,
        highlightActiveLine: true,
        highlightSelectionMatches: true,
        syntaxHighlighting: false,
        searchKeymap: true,
      }}
    />
  );
}
