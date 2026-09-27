import { useMemo, useState } from "react";
import { highlight } from "sugar-high";
import { FileCode2, Terminal, WrapText } from "lucide-react";
import { CopyButton } from "./CopyButton";

const LANGUAGES: Record<string, string> = {
  ts: "ts",
  tsx: "tsx",
  js: "js",
  jsx: "jsx",
  mjs: "js",
  css: "css",
  json: "json",
  html: "html",
  md: "md",
  sh: "bash",
};

/** Guess a short language tag from a label such as "src/button.tsx" or "terminal". */
function languageOf(label: string | undefined): string | null {
  if (!label) return null;
  if (label === "terminal") return "bash";
  const ext = /\.([a-z0-9]+)$/i.exec(label)?.[1]?.toLowerCase();
  return ext ? (LANGUAGES[ext] ?? ext) : null;
}

/** Read-only highlighted code with a filename/language header, wrap toggle and copy button. */
export function CodeBlock({
  code,
  label,
  maxHeight = 480,
  language,
}: {
  code: string;
  label?: string;
  maxHeight?: number;
  language?: string;
}) {
  const html = useMemo(() => highlight(code), [code]);
  const [wrap, setWrap] = useState(false);
  const lang = language ?? languageOf(label);
  const hasLongLines = useMemo(() => code.split("\n").some((l) => l.length > 72), [code]);
  const HeaderIcon = lang === "bash" ? Terminal : FileCode2;

  return (
    <div className="overflow-hidden rounded-xl border border-neutral-200 bg-neutral-50 [.dark_&]:border-neutral-800 [.dark_&]:bg-neutral-900/40">
      <div className="flex h-11 items-center gap-2 border-b border-neutral-200 bg-white pr-1.5 pl-3.5 [.dark_&]:border-neutral-800 [.dark_&]:bg-neutral-950">
        <HeaderIcon
          className="size-3.5 shrink-0 text-neutral-400 [.dark_&]:text-neutral-500"
          aria-hidden
        />
        <span className="min-w-0 truncate font-mono text-xs text-neutral-600 [.dark_&]:text-neutral-400">
          {label ?? "code"}
        </span>
        <span className="ml-auto flex items-center gap-1">
          {lang ? (
            <span className="mr-1 rounded border border-neutral-200 px-1.5 py-0.5 font-mono text-[10px] tracking-wide text-neutral-500 uppercase [.dark_&]:border-neutral-800 [.dark_&]:text-neutral-400">
              {lang}
            </span>
          ) : null}
          {hasLongLines ? (
            <button
              type="button"
              onClick={() => setWrap((w) => !w)}
              aria-pressed={wrap}
              aria-label="Wrap long lines"
              title="Wrap long lines"
              className={`inline-flex size-8 items-center justify-center rounded-md transition-colors focus-visible:outline-2 focus-visible:outline-neutral-900 [.dark_&]:focus-visible:outline-neutral-100 ${
                wrap
                  ? "bg-neutral-100 text-neutral-950 [.dark_&]:bg-neutral-800 [.dark_&]:text-neutral-50"
                  : "text-neutral-500 hover:bg-neutral-100 hover:text-neutral-950 [.dark_&]:text-neutral-400 [.dark_&]:hover:bg-neutral-800 [.dark_&]:hover:text-neutral-50"
              }`}
            >
              <WrapText className="size-4" aria-hidden />
            </button>
          ) : null}
          <CopyButton
            getText={() => code}
            label={`Copy ${label ?? "code"}`}
            variant="ghost"
            className="size-8"
          />
        </span>
      </div>
      <pre
        className={`code-block overflow-auto p-4 text-[13px] leading-6 ${
          wrap ? "break-words whitespace-pre-wrap" : "whitespace-pre"
        }`}
        style={{ maxHeight }}
        tabIndex={0}
      >
        <code dangerouslySetInnerHTML={{ __html: html }} />
      </pre>
    </div>
  );
}
