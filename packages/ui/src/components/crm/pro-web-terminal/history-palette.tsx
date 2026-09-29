import * as React from "react";
import { formatDistanceToNowStrict } from "date-fns";
import { History } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CommandEntry } from "@/components/crm/pro-web-terminal/types";

export interface HistoryPaletteProps {
  history: CommandEntry[];
  onRun: (command: string, execute: boolean) => void;
  onClose: () => void;
}

/** Subsequence fuzzy score: higher is better, -1 means no match. */
function score(text: string, q: string) {
  if (!q) return 0;
  let ti = 0;
  let s = 0;
  let streak = 0;
  for (const ch of q) {
    const i = text.indexOf(ch, ti);
    if (i < 0) return -1;
    streak = i === ti ? streak + 1 : 0;
    s += 1 + streak * 2 - Math.min(i - ti, 5) * 0.2;
    ti = i + 1;
  }
  return s;
}

/** Deduplicated, fuzzy-searchable command history (most recent first). Enter runs, Shift+Enter inserts. */
export function HistoryPalette({ history, onRun, onClose }: HistoryPaletteProps) {
  const id = React.useId();
  const [q, setQ] = React.useState("");
  const [active, setActive] = React.useState(0);
  const listRef = React.useRef<HTMLUListElement>(null);
  const unique = React.useMemo(() => {
    const seen = new Map<string, CommandEntry & { count: number }>();
    for (let i = history.length - 1; i >= 0; i--) {
      const h = history[i]!;
      const prev = seen.get(h.command);
      if (prev) prev.count++;
      else seen.set(h.command, { ...h, count: 1 });
    }
    return [...seen.values()];
  }, [history]);
  const items = React.useMemo(() => {
    const needle = q.toLowerCase();
    if (!needle) return unique.slice(0, 200);
    return unique
      .map((h) => ({ h, s: score(h.command.toLowerCase(), needle) }))
      .filter((x) => x.s >= 0)
      .sort((a, b) => b.s - a.s)
      .slice(0, 200)
      .map((x) => x.h);
  }, [unique, q]);
  React.useEffect(() => setActive(0), [q]);
  React.useEffect(() => {
    listRef.current?.querySelector(`[data-i="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  const pick = (i: number, execute: boolean) => {
    const it = items[i];
    if (it) onRun(it.command, execute);
  };

  return (
    <div
      className="absolute inset-0 z-20 flex items-start justify-center bg-black/40 pt-12"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command history"
        className="w-[min(560px,92%)] overflow-hidden rounded-crm border border-crm-border bg-crm-popover shadow-crm-overlay"
      >
        <div className="flex items-center gap-2 border-b border-crm-border px-3">
          <History className="size-4 text-crm-muted-fg" aria-hidden />
          <input
            autoFocus
            role="combobox"
            aria-expanded="true"
            aria-controls={`${id}-l`}
            aria-activedescendant={items[active] ? `${id}-${active}` : undefined}
            placeholder="Search command history…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setActive((a) => Math.min(items.length - 1, a + 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setActive((a) => Math.max(0, a - 1));
              } else if (e.key === "Enter") {
                e.preventDefault();
                pick(active, !e.shiftKey);
              } else if (e.key === "Escape") {
                e.preventDefault();
                onClose();
              }
            }}
            className="h-10 flex-1 bg-transparent text-sm text-crm-fg outline-none placeholder:text-crm-muted-fg"
          />
        </div>
        <ul id={`${id}-l`} ref={listRef} role="listbox" className="max-h-72 overflow-y-auto p-1">
          {items.length === 0 && (
            <li className="px-3 py-6 text-center text-xs text-crm-muted-fg">
              {history.length ? "No matching commands" : "No commands run yet"}
            </li>
          )}
          {items.map((h, i) => (
            <li
              key={h.command}
              id={`${id}-${i}`}
              data-i={i}
              role="option"
              aria-selected={i === active}
              onMouseMove={() => setActive(i)}
              onClick={() => pick(i, true)}
              className={cn(
                "flex cursor-pointer items-center gap-3 rounded px-3 py-1.5",
                i === active && "bg-crm-muted",
              )}
            >
              <code className="flex-1 truncate font-mono text-xs text-crm-fg">{h.command}</code>
              {h.count > 1 && <span className="text-[10px] text-crm-muted-fg">×{h.count}</span>}
              <span className="text-[10px] text-crm-muted-fg">
                {formatDistanceToNowStrict(h.at, { addSuffix: true })}
              </span>
            </li>
          ))}
        </ul>
        <div className="border-t border-crm-border px-3 py-1.5 text-[10px] text-crm-muted-fg">
          ↵ run · ⇧↵ insert · esc close
        </div>
      </div>
    </div>
  );
}
