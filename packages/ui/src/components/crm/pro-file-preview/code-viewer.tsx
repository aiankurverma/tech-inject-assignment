import * as React from "react";
import {
  createHighlighter,
  createJavaScriptRegexEngine,
  type BundledLanguage,
  type Highlighter,
} from "shiki";
import { Check, Copy, FileWarning, WrapText } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  detectLanguage,
  type PreviewFile,
  type PreviewSource,
} from "@/components/crm/pro-file-preview/types";
import {
  Spinner,
  ToolButton,
  ToolDivider,
  Toolbar,
  ViewerMessage,
} from "@/components/crm/pro-file-preview/toolbar";

const THEME = "github-dark-default";
/** Above this size syntax highlighting is skipped: tokenising megabytes blocks the main thread. */
const HIGHLIGHT_LIMIT = 250_000;

// One highlighter for the whole page; grammars are loaded on demand and cached by shiki.
// The pure-JS regex engine avoids fetching a WASM binary (works under strict CSPs).
let highlighterPromise: Promise<Highlighter> | null = null;
function getHighlighter() {
  highlighterPromise ??= createHighlighter({
    themes: [THEME],
    langs: [],
    engine: createJavaScriptRegexEngine(),
  });
  return highlighterPromise;
}

async function readText(file: PreviewFile, signal: AbortSignal): Promise<string> {
  if (file.content !== undefined) return file.content;
  const src: PreviewSource | undefined = file.src;
  if (!src) throw new Error("No content");
  if (typeof src === "string") {
    const res = await fetch(src, { signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.text();
  }
  if (src instanceof Blob) return src.text();
  return new TextDecoder().decode(src);
}

type State =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; text: string; html: string | null };

/** Syntax-highlighted source with line numbers, wrap toggle and copy. */
export function CodeViewer({ file }: { file: PreviewFile }) {
  const language = detectLanguage(file);
  const [state, setState] = React.useState<State>({ status: "loading" });
  const [wrap, setWrap] = React.useState(false);
  const [copied, setCopied] = React.useState(false);

  React.useEffect(() => {
    const ctrl = new AbortController();
    let alive = true;
    setState({ status: "loading" });
    (async () => {
      try {
        const text = await readText(file, ctrl.signal);
        let html: string | null = null;
        if (text.length <= HIGHLIGHT_LIMIT && language !== "text") {
          const hl = await getHighlighter();
          const lang = language as BundledLanguage;
          if (!hl.getLoadedLanguages().includes(lang)) {
            await hl.loadLanguage(lang).catch(() => undefined);
          }
          if (hl.getLoadedLanguages().includes(lang)) {
            html = hl.codeToHtml(text, { lang, theme: THEME });
          }
        }
        if (alive) setState({ status: "ready", text, html });
      } catch (err) {
        if (alive && !ctrl.signal.aborted)
          setState({ status: "error", message: (err as Error).message });
      }
    })();
    return () => {
      alive = false;
      ctrl.abort();
    };
  }, [file, language]);

  const lineCount = React.useMemo(
    () => (state.status === "ready" ? state.text.split("\n").length : 0),
    [state],
  );
  // One text node for the gutter instead of N elements keeps 50k-line files cheap.
  const gutter = React.useMemo(
    () => Array.from({ length: lineCount }, (_, i) => i + 1).join("\n"),
    [lineCount],
  );

  const copy = async () => {
    if (state.status !== "ready") return;
    try {
      await navigator.clipboard.writeText(state.text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked (sandboxed iframe); nothing to do */
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <Toolbar label="Code controls">
        <span className="rounded-crm border border-crm-border bg-crm-muted px-1.5 py-0.5 font-mono text-[11px] text-crm-fg">
          {language}
        </span>
        {state.status === "ready" && (
          <span className="text-xs tabular-nums text-crm-muted-fg">
            {lineCount.toLocaleString()} lines
            {state.html === null && language !== "text" && " - plain text (large file)"}
          </span>
        )}
        <span className="ml-auto" />
        <ToolButton label="Toggle line wrap (W)" active={wrap} onClick={() => setWrap((w) => !w)}>
          <WrapText className="h-4 w-4" />
        </ToolButton>
        <ToolDivider />
        <ToolButton label={copied ? "Copied" : "Copy contents"} onClick={copy}>
          {copied ? <Check className="h-4 w-4 text-crm-success" /> : <Copy className="h-4 w-4" />}
        </ToolButton>
      </Toolbar>
      <div
        className="min-h-0 flex-1 overflow-auto bg-crm-bg"
        tabIndex={0}
        aria-label={`${file.name} source`}
      >
        {state.status === "loading" && <Spinner label="Highlighting" />}
        {state.status === "error" && (
          <ViewerMessage
            icon={<FileWarning className="h-8 w-8" />}
            title="Could not load file"
            detail={state.message}
          />
        )}
        {state.status === "ready" && (
          <div
            className={cn(
              "kb-code grid grid-cols-[auto_1fr] font-mono text-[12.5px] leading-5",
              wrap && "kb-code-wrap",
            )}
          >
            <style>{CODE_CSS}</style>
            <pre
              aria-hidden
              className="sticky left-0 select-none border-r border-crm-border bg-crm-bg px-3 py-3 text-right text-crm-faint"
            >
              {gutter}
            </pre>
            {state.html ? (
              <div className="min-w-0 px-4 py-3" dangerouslySetInnerHTML={{ __html: state.html }} />
            ) : (
              <pre className="min-w-0 px-4 py-3 text-crm-fg">
                <code>{state.text}</code>
              </pre>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

const CODE_CSS = `
.kb-code pre.shiki{background:transparent!important;margin:0;}
.kb-code pre{margin:0;white-space:pre;}
.kb-code-wrap pre{white-space:pre-wrap;word-break:break-word;}
.kb-code-wrap [aria-hidden]{display:none}
.kb-code-wrap{grid-template-columns:1fr}
`;
