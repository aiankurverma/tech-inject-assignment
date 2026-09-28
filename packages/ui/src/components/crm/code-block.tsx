import * as React from "react";
import { Check, ChevronDown, Copy, WrapText } from "lucide-react";
import { cn } from "@/lib/utils";

export type CodeLanguage = "ts" | "js" | "json" | "bash" | "sql" | "http" | "text";

type TokenKind = "kw" | "str" | "num" | "com" | "key" | "plain";
interface Token {
  kind: TokenKind;
  text: string;
}

const KEYWORDS: Record<CodeLanguage, string[]> = {
  ts: "const let var function return if else for while import from export default async await new class interface type extends implements true false null undefined try catch throw of in as".split(
    " ",
  ),
  js: "const let var function return if else for while import from export default async await new class true false null undefined try catch throw of in".split(
    " ",
  ),
  json: ["true", "false", "null"],
  bash: "curl export echo cd npm npx git if then fi for do done sudo".split(" "),
  sql: "select from where and or join left right inner on group by order limit insert into values update set delete as having count sum avg distinct is not null in".split(
    " ",
  ),
  http: "GET POST PUT PATCH DELETE HTTP".split(" "),
  text: [],
};

const tokenClass: Record<TokenKind, string> = {
  kw: "text-[#b69cff]",
  str: "text-[#8fd6a5]",
  num: "text-[#f5b36b]",
  com: "text-crm-subtle italic",
  key: "text-[#7cc4ff]",
  plain: "",
};

/** Tiny line tokenizer: comments, strings, numbers, keywords. Deliberately light — no grammar. */
export function tokenizeLine(line: string, language: CodeLanguage): Token[] {
  if (language === "text") return [{ kind: "plain", text: line }];
  const caseless = language === "sql";
  const kw = new Set(KEYWORDS[language]);
  const comment = language === "bash" ? "#" : language === "sql" ? "--" : "//";
  const re =
    /("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)|(-?\b\d+(?:\.\d+)?\b)|([A-Za-z_$][\w$]*)|(\s+|.)/g;
  const out: Token[] = [];
  const idx = language === "json" || language === "http" ? -1 : line.indexOf(comment);
  // Only treat as a comment when no quote precedes it (avoids "http://" inside strings).
  const cut = idx >= 0 && !/["'`]/.test(line.slice(0, idx)) ? idx : line.length;
  const body = line.slice(0, cut);
  const rest = line.slice(cut);
  let m: RegExpExecArray | null;
  while ((m = re.exec(body))) {
    const [text, str, num, word] = m;
    if (str) {
      const isKey = language === "json" && /^\s*:/.test(body.slice(re.lastIndex));
      out.push({ kind: isKey ? "key" : "str", text });
    } else if (num) out.push({ kind: "num", text });
    else if (word)
      out.push({ kind: kw.has(caseless ? word.toLowerCase() : word) ? "kw" : "plain", text });
    else out.push({ kind: "plain", text });
  }
  if (rest) out.push({ kind: "com", text: rest });
  return out;
}

/** Parses `[3, "5-7"]` into a Set of 1-based line numbers. */
function parseHighlights(input: (number | string)[] = []): Set<number> {
  const set = new Set<number>();
  for (const item of input) {
    if (typeof item === "number") set.add(item);
    else {
      const [a = NaN, b = NaN] = item.split("-").map((n) => parseInt(n, 10));
      if (Number.isFinite(a)) for (let i = a; i <= (Number.isFinite(b) ? b : a); i++) set.add(i);
    }
  }
  return set;
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      ta.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

export interface CodeBlockTab {
  label: string;
  code: string;
  language?: CodeLanguage;
}

export interface CodeBlockProps {
  /** Source to render. Ignored when `tabs` is given. */
  code?: string;
  language?: CodeLanguage;
  /** Several variants of the same snippet (e.g. cURL / Node / SQL). */
  tabs?: CodeBlockTab[];
  filename?: string;
  showLineNumbers?: boolean;
  /** 1-based lines or ranges, e.g. `[2, "5-7"]`. */
  highlightLines?: (number | string)[];
  /** Collapse beyond this many lines with a "Show all" toggle. */
  maxLines?: number;
  /** Start with soft wrapping on. Users can toggle it. */
  defaultWrap?: boolean;
  /** Mask matches (e.g. API keys) in the rendered view; copy still returns the real text. */
  redact?: RegExp;
  onCopy?: (code: string) => void;
  className?: string;
}

/** Read-only code panel with light highlighting, line numbers, tabs, wrapping, collapse and copy. */
export function CodeBlock({
  code = "",
  language = "text",
  tabs,
  filename,
  showLineNumbers = true,
  highlightLines,
  maxLines,
  defaultWrap = false,
  redact,
  onCopy,
  className,
}: CodeBlockProps) {
  const [tab, setTab] = React.useState(0);
  const [wrap, setWrap] = React.useState(defaultWrap);
  const [expanded, setExpanded] = React.useState(false);
  const [copied, setCopied] = React.useState<"ok" | "fail" | null>(null);
  const baseId = React.useId();
  const active = tabs?.length ? tabs[Math.min(tab, tabs.length - 1)] : undefined;
  const source = (active?.code ?? code).replace(/\n$/, "");
  const lang = active?.language ?? language;
  const lines = source.split("\n");
  const marks = React.useMemo(() => parseHighlights(highlightLines), [highlightLines]);
  // Always mask every match, even if the caller forgot the `g` flag.
  const redactAll = React.useMemo(
    () =>
      redact
        ? new RegExp(redact.source, redact.flags.includes("g") ? redact.flags : redact.flags + "g")
        : null,
    [redact],
  );
  const overflow = !!maxLines && lines.length > maxLines;
  const collapsed = overflow && !expanded;
  const visible = collapsed ? lines.slice(0, maxLines) : lines;

  React.useEffect(() => {
    if (!copied) return;
    const t = window.setTimeout(() => setCopied(null), 1800);
    return () => window.clearTimeout(t);
  }, [copied]);

  const doCopy = async () => {
    const ok = await copyText(source);
    setCopied(ok ? "ok" : "fail");
    if (ok) onCopy?.(source);
  };

  const onTabKey = (e: React.KeyboardEvent) => {
    if (!tabs?.length) return;
    let next = tab;
    if (e.key === "ArrowRight") next = (tab + 1) % tabs.length;
    else if (e.key === "ArrowLeft") next = (tab - 1 + tabs.length) % tabs.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = tabs.length - 1;
    else return;
    e.preventDefault();
    setTab(next);
    document.getElementById(`${baseId}-tab-${next}`)?.focus();
  };

  const iconBtn =
    "cursor-pointer rounded-md outline-none hover:bg-crm-muted focus-visible:ring-2 focus-visible:ring-crm-primary [&_svg]:size-3.5";

  return (
    <div
      className={cn(
        "overflow-hidden rounded-crm border border-crm-border bg-crm-surface font-crm shadow-crm-raised",
        className,
      )}
    >
      <div className="flex min-h-9 items-center gap-2 border-b border-crm-border bg-crm-raised px-2">
        {tabs?.length ? (
          <div
            role="tablist"
            aria-label="Code variants"
            className="flex min-w-0 gap-0.5 overflow-x-auto"
            onKeyDown={onTabKey}
          >
            {tabs.map((t, i) => (
              <button
                key={t.label}
                id={`${baseId}-tab-${i}`}
                role="tab"
                type="button"
                aria-selected={i === tab}
                aria-controls={`${baseId}-panel`}
                tabIndex={i === tab ? 0 : -1}
                onClick={() => setTab(i)}
                className={cn(
                  "h-7 shrink-0 cursor-pointer rounded-md px-2 text-xs font-medium outline-none focus-visible:ring-2 focus-visible:ring-crm-primary",
                  i === tab ? "bg-crm-muted text-crm-fg" : "text-crm-subtle hover:text-crm-fg",
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
        ) : (
          <span className="truncate px-1 text-xs text-crm-soft">
            {filename ?? lang.toUpperCase()}
          </span>
        )}
        <div className="ml-auto flex shrink-0 items-center gap-1">
          <button
            type="button"
            aria-pressed={wrap}
            aria-label="Wrap long lines"
            title="Wrap long lines"
            onClick={() => setWrap((w) => !w)}
            className={cn(
              iconBtn,
              "grid size-7 place-items-center",
              wrap ? "text-crm-fg" : "text-crm-subtle",
            )}
          >
            <WrapText />
          </button>
          <button
            type="button"
            onClick={doCopy}
            aria-label={copied === "ok" ? "Copied" : "Copy code"}
            className={cn(
              iconBtn,
              "inline-flex h-7 items-center gap-1 px-2 text-xs text-crm-soft hover:text-crm-fg",
            )}
          >
            {copied === "ok" ? <Check className="text-crm-success" /> : <Copy />}
            {copied === "ok" ? "Copied" : copied === "fail" ? "Copy failed" : "Copy"}
          </button>
        </div>
      </div>
      <span role="status" aria-live="polite" className="sr-only">
        {copied === "ok"
          ? "Code copied to clipboard"
          : copied === "fail"
            ? "Could not copy code"
            : ""}
      </span>
      <div
        id={`${baseId}-panel`}
        role={tabs?.length ? "tabpanel" : "region"}
        aria-labelledby={tabs?.length ? `${baseId}-tab-${tab}` : undefined}
        aria-label={tabs?.length ? undefined : (filename ?? `${lang} code`)}
        tabIndex={0}
        className="relative overflow-x-auto py-2 text-[12.5px] leading-5 outline-none focus-visible:ring-2 focus-visible:ring-crm-primary focus-visible:ring-inset"
      >
        {source.length === 0 ? (
          <p className="px-4 py-3 text-xs text-crm-subtle">Nothing to show.</p>
        ) : (
          <pre className="m-0 font-mono">
            <code className="block min-w-full">
              {visible.map((line, i) => {
                const n = i + 1;
                const hl = marks.has(n);
                const shown = redactAll
                  ? line.replace(
                      redactAll,
                      (s) => s.slice(0, 4) + "•".repeat(Math.max(4, s.length - 4)),
                    )
                  : line;
                return (
                  <span
                    key={n}
                    data-highlighted={hl || undefined}
                    className={cn(
                      "flex border-l-2 border-transparent pr-4",
                      hl && "border-crm-primary bg-crm-primary/10",
                    )}
                  >
                    {showLineNumbers && (
                      <span
                        aria-hidden
                        className="w-10 shrink-0 pr-3 text-right text-crm-subtle tabular-nums select-none"
                      >
                        {n}
                      </span>
                    )}
                    <span
                      className={cn(
                        "min-w-0 text-crm-fg",
                        !showLineNumbers && "pl-4",
                        wrap ? "break-all whitespace-pre-wrap" : "whitespace-pre",
                      )}
                    >
                      {tokenizeLine(shown, lang).map((t, j) => (
                        <span key={j} className={tokenClass[t.kind]}>
                          {t.text}
                        </span>
                      ))}
                      {line === "" ? "​" : null}
                    </span>
                  </span>
                );
              })}
            </code>
          </pre>
        )}
        {collapsed && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-crm-surface to-transparent" />
        )}
      </div>
      {overflow ? (
        <button
          type="button"
          aria-expanded={expanded}
          aria-controls={`${baseId}-panel`}
          onClick={() => setExpanded((v) => !v)}
          className="flex w-full cursor-pointer items-center justify-center gap-1 border-t border-crm-border py-1.5 text-xs text-crm-soft outline-none hover:bg-crm-raised hover:text-crm-fg focus-visible:ring-2 focus-visible:ring-crm-primary [&_svg]:size-3.5"
        >
          <ChevronDown className={cn("transition-transform", expanded && "rotate-180")} />
          {expanded ? "Show less" : `Show all ${lines.length} lines`}
        </button>
      ) : null}
    </div>
  );
}
