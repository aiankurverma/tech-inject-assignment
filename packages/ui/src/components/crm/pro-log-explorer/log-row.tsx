import * as React from "react";
import { format } from "date-fns";
import { ChevronRight, Link2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { payloadOf, type LogLevel, type PreparedLog } from "@/hooks/use-log-index";
import { parseAnsi, type AnsiSpan } from "@/components/crm/pro-log-explorer/ansi";

export const levelTone: Record<LogLevel, string> = {
  trace: "text-crm-faint",
  debug: "text-crm-subtle",
  info: "text-[#60a5fa]",
  warn: "text-crm-warning",
  error: "text-crm-danger",
  fatal: "text-crm-danger font-semibold",
};

const rowTone: Partial<Record<LogLevel, string>> = {
  warn: "bg-crm-warning/5",
  error: "bg-crm-danger/5",
  fatal: "bg-crm-danger/10",
};

/** Overlays search matches onto ANSI spans (splitting spans at match boundaries). */
function highlight(spans: AnsiSpan[], plain: string, re: RegExp | null) {
  if (!re) return spans.map((s) => ({ ...s, hit: false }));
  const ranges: [number, number][] = [];
  re.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(plain)) && ranges.length < 200) {
    if (m[0] === "") {
      re.lastIndex++;
      continue;
    }
    ranges.push([m.index, m.index + m[0].length]);
  }
  if (!ranges.length) return spans.map((s) => ({ ...s, hit: false }));
  const out: (AnsiSpan & { hit: boolean })[] = [];
  let pos = 0;
  let r = 0;
  for (const s of spans) {
    let i = 0;
    while (i < s.text.length) {
      const abs = pos + i;
      while (r < ranges.length && ranges[r]![1] <= abs) r++;
      const cur = ranges[r];
      const inHit = !!cur && cur[0] <= abs;
      const boundary = cur ? (inHit ? cur[1] : cur[0]) : Infinity;
      const take = Math.min(s.text.length - i, boundary - abs);
      out.push({ text: s.text.slice(i, i + take), style: s.style, hit: inHit });
      i += take;
    }
    pos += s.text.length;
  }
  return out;
}

export interface LogRowProps {
  log: PreparedLog;
  lineNo: number;
  active: boolean;
  expanded: boolean;
  search: RegExp | null;
  showSource: boolean;
  onToggle: (id: string) => void;
  onActivate: (id: string) => void;
  onPermalink?: (id: string) => void;
}

export const LogRow = React.memo(function LogRow({
  log,
  lineNo,
  active,
  expanded,
  search,
  showSource,
  onToggle,
  onActivate,
  onPermalink,
}: LogRowProps) {
  const { entry, ts, plain, expandable } = log;
  const pieces = React.useMemo(
    () => highlight(parseAnsi(entry.message), plain, search),
    [entry.message, plain, search],
  );
  const payload = expanded ? payloadOf(log) : null;

  return (
    <div
      role="row"
      id={`log-${entry.id}`}
      aria-selected={active}
      aria-expanded={expandable ? expanded : undefined}
      onClick={() => onActivate(entry.id)}
      onDoubleClick={() => expandable && onToggle(entry.id)}
      className={cn(
        "group/log border-l-2 border-transparent",
        rowTone[entry.level],
        active && "border-crm-primary bg-crm-primary/10",
      )}
    >
      <div className="flex min-h-5 items-start gap-2 pr-3">
        <span className="w-14 shrink-0 select-none pr-1 text-right text-crm-faint" role="cell">
          {lineNo}
        </span>
        <button
          type="button"
          tabIndex={-1}
          aria-label={expanded ? "Collapse fields" : "Expand fields"}
          onClick={(e) => {
            e.stopPropagation();
            onToggle(entry.id);
          }}
          className={cn("mt-0.5 shrink-0 text-crm-subtle", !expandable && "invisible")}
        >
          <ChevronRight className={cn("size-3.5 transition-transform", expanded && "rotate-90")} />
        </button>
        <time
          role="cell"
          dateTime={new Date(ts).toISOString()}
          className="shrink-0 whitespace-nowrap text-crm-muted-fg"
        >
          {format(ts, "HH:mm:ss.SSS")}
        </time>
        <span role="cell" className={cn("w-11 shrink-0 uppercase", levelTone[entry.level])}>
          {entry.level}
        </span>
        {showSource && (
          <span role="cell" className="w-28 shrink-0 truncate text-crm-soft" title={entry.source}>
            {entry.source ?? ""}
          </span>
        )}
        <span role="cell" className="min-w-0 flex-1 whitespace-pre-wrap break-all text-crm-fg">
          {pieces.map((p, i) => (
            <span
              key={i}
              style={{ color: p.style.fg, backgroundColor: p.hit ? undefined : p.style.bg }}
              className={cn(
                p.style.bold && "font-semibold",
                p.style.dim && "opacity-60",
                p.style.italic && "italic",
                p.style.underline && "underline",
                p.hit && "rounded-sm bg-crm-warning/40 text-crm-fg",
              )}
            >
              {p.text}
            </span>
          ))}
        </span>
        {onPermalink && (
          <button
            type="button"
            tabIndex={-1}
            aria-label="Copy link to line"
            title="Copy link to line"
            onClick={(e) => {
              e.stopPropagation();
              onPermalink(entry.id);
            }}
            className="mt-0.5 shrink-0 text-crm-subtle opacity-0 hover:text-crm-fg group-hover/log:opacity-100"
          >
            <Link2 className="size-3.5" />
          </button>
        )}
      </div>
      {payload && (
        <dl className="mb-1 ml-[5.5rem] mr-3 grid grid-cols-[minmax(8rem,auto)_1fr] gap-x-4 gap-y-0.5 rounded-crm border border-crm-border bg-crm-card px-3 py-2">
          {Object.entries(payload).map(([k, v]) => (
            <React.Fragment key={k}>
              <dt className="text-[#93c5fd]">{k}</dt>
              <dd className="min-w-0 whitespace-pre-wrap break-all text-crm-soft">
                {typeof v === "string" ? v : JSON.stringify(v, null, 2)}
              </dd>
            </React.Fragment>
          ))}
        </dl>
      )}
    </div>
  );
});
