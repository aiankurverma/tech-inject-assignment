import * as React from "react";
import { ArrowLeft, Inbox } from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/crm/avatar";
import { SearchInput } from "@/components/crm/search-input";
import { SegmentedControl } from "@/components/crm/segmented-control";

export interface InboxFolder {
  id: string;
  label: string;
  icon?: React.ReactNode;
}

export interface InboxThread {
  id: string;
  folder: string;
  from: string;
  subject: string;
  preview: string;
  /** ISO timestamp of the latest message. */
  at: string;
  unread?: boolean;
  starred?: boolean;
  labels?: string[];
}

export interface ShellInboxProps {
  folders: InboxFolder[];
  threads: InboxThread[];
  /** Renders the reading pane for the selected thread. */
  renderThread: (thread: InboxThread) => React.ReactNode;
  selectedId?: string | null;
  onSelect?: (id: string | null) => void;
  /** Called when a thread is opened so the host can mark it read. */
  onOpen?: (thread: InboxThread) => void;
  now?: Date;
  loading?: boolean;
  className?: string;
}

function when(iso: string, now: Date) {
  const d = new Date(iso);
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  const days = (now.getTime() - d.getTime()) / 86_400_000;
  if (days < 7) return d.toLocaleDateString("en-US", { weekday: "short" });
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/** Three-pane inbox: folders with unread counts, filterable thread list (j/k keys), reading pane. */
export function ShellInbox({
  folders,
  threads,
  renderThread,
  selectedId,
  onSelect,
  onOpen,
  now = new Date(),
  loading,
  className,
}: ShellInboxProps) {
  const [folder, setFolder] = React.useState(folders[0]?.id ?? "");
  const [query, setQuery] = React.useState("");
  const [filter, setFilter] = React.useState("all");
  const [innerSel, setInnerSel] = React.useState<string | null>(null);
  const sel = selectedId !== undefined ? selectedId : innerSel;
  const listRef = React.useRef<HTMLUListElement>(null);

  const unread = React.useMemo(() => {
    const m = new Map<string, number>();
    for (const t of threads) if (t.unread) m.set(t.folder, (m.get(t.folder) ?? 0) + 1);
    return m;
  }, [threads]);

  const visible = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return threads
      .filter((t) => t.folder === folder)
      .filter((t) => (filter === "unread" ? t.unread : filter === "starred" ? t.starred : true))
      .filter(
        (t) =>
          !q ||
          t.from.toLowerCase().includes(q) ||
          t.subject.toLowerCase().includes(q) ||
          t.preview.toLowerCase().includes(q),
      )
      .sort((a, b) => b.at.localeCompare(a.at));
  }, [threads, folder, filter, query]);

  const open = (t: InboxThread | undefined) => {
    const id = t?.id ?? null;
    if (selectedId === undefined) setInnerSel(id);
    onSelect?.(id);
    if (t) onOpen?.(t);
  };

  const selected = threads.find((t) => t.id === sel);

  const onKey = (e: React.KeyboardEvent) => {
    // Only drive thread navigation from the list itself so filters/search keep their own keys.
    if (!(e.target instanceof HTMLElement) || !listRef.current?.contains(e.target)) return;
    const i = visible.findIndex((t) => t.id === sel);
    if (e.key === "j" || e.key === "ArrowDown") {
      e.preventDefault();
      const t = visible[Math.min(i + 1, visible.length - 1)];
      open(t);
      listRef.current?.querySelector<HTMLElement>(`[data-id="${t?.id}"]`)?.focus();
    } else if (e.key === "k" || e.key === "ArrowUp") {
      e.preventDefault();
      const t = visible[Math.max(i - 1, 0)];
      open(t);
      listRef.current?.querySelector<HTMLElement>(`[data-id="${t?.id}"]`)?.focus();
    } else if (e.key === "Escape") open(undefined);
  };

  return (
    <div
      className={cn(
        "flex h-[600px] overflow-hidden rounded-crm border border-crm-border bg-crm-bg font-crm text-crm-fg",
        className,
      )}
    >
      <nav
        aria-label="Folders"
        className="hidden w-48 shrink-0 flex-col gap-0.5 border-r border-crm-border bg-crm-card p-2 md:flex"
      >
        {folders.map((f) => {
          const n = unread.get(f.id) ?? 0;
          const on = f.id === folder;
          return (
            <button
              key={f.id}
              type="button"
              aria-current={on ? "page" : undefined}
              onClick={() => {
                setFolder(f.id);
                open(undefined);
              }}
              className={cn(
                "flex h-8 items-center gap-2 rounded-md px-2 text-[13px] focus-visible:ring-2 focus-visible:ring-crm-primary focus-visible:outline-none [&_svg]:size-4",
                on
                  ? "bg-crm-muted font-medium text-crm-fg"
                  : "text-crm-muted-fg hover:bg-crm-muted/60",
              )}
            >
              {f.icon}
              <span className="flex-1 truncate text-left">{f.label}</span>
              {n ? (
                <span className="text-xs font-medium text-crm-fg tabular-nums">
                  {n}
                  <span className="sr-only"> unread</span>
                </span>
              ) : null}
            </button>
          );
        })}
      </nav>

      <section
        aria-label="Threads"
        onKeyDown={onKey}
        className={cn(
          "flex w-full min-w-0 flex-col border-r border-crm-border md:w-80 md:shrink-0",
          selected && "hidden md:flex",
        )}
      >
        <div className="flex flex-col gap-2 border-b border-crm-border p-2">
          <select
            aria-label="Folder"
            value={folder}
            onChange={(e) => {
              setFolder(e.target.value);
              open(undefined);
            }}
            className="h-8 rounded-md border border-crm-border bg-crm-card px-2 text-sm md:hidden"
          >
            {folders.map((f) => (
              <option key={f.id} value={f.id}>
                {f.label} ({unread.get(f.id) ?? 0})
              </option>
            ))}
          </select>
          <SearchInput
            size="sm"
            value={query}
            onValueChange={setQuery}
            placeholder="Search sender, subject…"
          />
          <SegmentedControl
            size="sm"
            fullWidth
            label="Thread filter"
            value={filter}
            onValueChange={setFilter}
            options={[
              { value: "all", label: "All" },
              { value: "unread", label: "Unread" },
              { value: "starred", label: "Starred" },
            ]}
          />
        </div>
        {loading ? (
          <ul aria-busy className="flex flex-col gap-2 p-3">
            {Array.from({ length: 6 }, (_, i) => (
              <li key={i} className="h-14 animate-pulse rounded-md bg-crm-muted/60" />
            ))}
          </ul>
        ) : visible.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center text-sm text-crm-soft">
            <Inbox className="size-5" aria-hidden />
            {query ? `No threads match “${query}”.` : "Nothing here. Inbox zero."}
          </div>
        ) : (
          <ul
            ref={listRef}
            className="min-h-0 flex-1 overflow-y-auto"
            role="listbox"
            aria-label="Threads"
          >
            {visible.map((t) => {
              const on = t.id === sel;
              return (
                <li
                  key={t.id}
                  data-id={t.id}
                  role="option"
                  aria-selected={on}
                  tabIndex={on || (!sel && t === visible[0]) ? 0 : -1}
                  onClick={() => open(t)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      open(t);
                    }
                  }}
                  className={cn(
                    "flex cursor-pointer gap-2.5 border-b border-crm-border/60 px-3 py-2.5 outline-none focus-visible:bg-crm-muted/60",
                    on ? "bg-crm-muted" : "hover:bg-crm-muted/40",
                  )}
                >
                  <Avatar name={t.from} size="md" />
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "flex-1 truncate text-[13px]",
                          t.unread ? "font-semibold text-crm-fg" : "text-crm-muted-fg",
                        )}
                      >
                        {t.from}
                      </span>
                      <time dateTime={t.at} className="shrink-0 text-[11px] text-crm-subtle">
                        {when(t.at, now)}
                      </time>
                    </div>
                    <span
                      className={cn(
                        "truncate text-xs",
                        t.unread ? "font-medium text-crm-fg" : "text-crm-soft",
                      )}
                    >
                      {t.unread ? <span className="sr-only">Unread: </span> : null}
                      {t.subject}
                    </span>
                    <span className="truncate text-xs text-crm-subtle">{t.preview}</span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        <p className="border-t border-crm-border px-3 py-1.5 text-[11px] text-crm-subtle">
          {visible.length} thread{visible.length === 1 ? "" : "s"} · j/k to move · Esc to close
        </p>
      </section>

      <section
        aria-label="Reading pane"
        className={cn("min-w-0 flex-1 flex-col", selected ? "flex" : "hidden md:flex")}
      >
        {selected ? (
          <>
            <button
              type="button"
              onClick={() => open(undefined)}
              className="flex items-center gap-1 border-b border-crm-border px-3 py-2 text-xs text-crm-soft md:hidden"
            >
              <ArrowLeft className="size-3.5" /> Back
            </button>
            <div className="min-h-0 flex-1 overflow-y-auto">{renderThread(selected)}</div>
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center text-sm text-crm-soft">
            Select a conversation to read it.
          </div>
        )}
      </section>
    </div>
  );
}
