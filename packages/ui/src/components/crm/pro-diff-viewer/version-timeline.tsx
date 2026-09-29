import * as React from "react";
import { format, formatDistanceToNow, isToday, isYesterday, startOfDay } from "date-fns";
import { Check, Loader2, Pencil, RotateCcw, Star } from "lucide-react";
import { cn } from "@/lib/utils";

export interface DocVersion {
  id: string;
  /** Optional human name ("Before pricing change"). Named versions are starred. */
  name?: string;
  createdAt: Date | string | number;
  author: { name: string };
  content: string;
  /** Commit-style summary of the change. */
  message?: string;
}

export interface VersionTimelineProps {
  versions: DocVersion[];
  /** Currently compared (target) version id. */
  selectedId: string | null;
  /** Version the target is compared against. */
  baseId: string | null;
  currentId: string;
  onSelect: (id: string) => void;
  onSelectBase: (id: string) => void;
  onRestore?: (version: DocVersion) => Promise<void> | void;
  onRename?: (version: DocVersion, name: string) => Promise<void> | void;
  namedOnly: boolean;
  onNamedOnlyChange: (v: boolean) => void;
}

function dayLabel(d: Date) {
  if (isToday(d)) return "Today";
  if (isYesterday(d)) return "Yesterday";
  return format(d, "EEE, d MMM yyyy");
}

/** Newest-first list grouped by day, with roving focus (Up/Down/Home/End) and inline rename. */
export function VersionTimeline({
  versions,
  selectedId,
  baseId,
  currentId,
  onSelect,
  onSelectBase,
  onRestore,
  onRename,
  namedOnly,
  onNamedOnlyChange,
}: VersionTimelineProps) {
  const [renaming, setRenaming] = React.useState<string | null>(null);
  const [draft, setDraft] = React.useState("");
  const [restoring, setRestoring] = React.useState<string | null>(null);
  const [confirm, setConfirm] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const listRef = React.useRef<HTMLUListElement>(null);

  const visible = React.useMemo(() => {
    const sorted = [...versions].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
    return namedOnly ? sorted.filter((v) => v.name || v.id === currentId) : sorted;
  }, [versions, namedOnly, currentId]);

  const groups = React.useMemo(() => {
    const out: { key: number; label: string; items: DocVersion[] }[] = [];
    for (const v of visible) {
      const d = new Date(v.createdAt);
      const key = startOfDay(d).getTime();
      const last = out[out.length - 1];
      if (last?.key === key) last.items.push(v);
      else out.push({ key, label: dayLabel(d), items: [v] });
    }
    return out;
  }, [visible]);

  const focusIndex = (i: number) => {
    const items = listRef.current?.querySelectorAll<HTMLElement>("[data-version]");
    if (!items?.length) return;
    const idx = Math.max(0, Math.min(items.length - 1, i));
    items[idx]!.focus();
    onSelect(items[idx]!.dataset.version as string);
  };

  const onKey = (e: React.KeyboardEvent, i: number) => {
    const map: Record<string, number> = {
      ArrowDown: i + 1,
      ArrowUp: i - 1,
      Home: 0,
      End: visible.length - 1,
    };
    if (e.key in map) {
      e.preventDefault();
      focusIndex(map[e.key]!);
    }
  };

  const doRestore = async (v: DocVersion) => {
    if (!onRestore) return;
    setRestoring(v.id);
    setError(null);
    try {
      await onRestore(v);
      setConfirm(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Restore failed");
    } finally {
      setRestoring(null);
    }
  };

  const commitRename = async (v: DocVersion) => {
    setRenaming(null);
    if (onRename && draft.trim() !== (v.name ?? "")) await onRename(v, draft.trim());
  };

  let flatIndex = -1;
  return (
    <div className="flex h-full min-h-0 flex-col font-crm">
      <div className="flex items-center justify-between border-b border-crm-border px-3 py-2.5">
        <h3 className="text-sm font-medium text-crm-fg">Version history</h3>
        <label className="flex cursor-pointer items-center gap-1.5 text-xs text-crm-muted-fg">
          <input
            type="checkbox"
            checked={namedOnly}
            onChange={(e) => onNamedOnlyChange(e.target.checked)}
            className="accent-crm-primary"
          />
          Named only
        </label>
      </div>
      {error && (
        <p role="alert" className="border-b border-crm-border px-3 py-2 text-xs text-crm-danger">
          {error}
        </p>
      )}
      <ul
        ref={listRef}
        role="listbox"
        aria-label="Versions"
        className="min-h-0 flex-1 overflow-y-auto py-1"
      >
        {groups.map((g) => (
          <li key={g.key} role="presentation">
            <p className="sticky top-0 z-10 bg-crm-raised px-3 py-1 text-[11px] font-medium uppercase tracking-wide text-crm-subtle">
              {g.label}
            </p>
            <ul role="presentation">
              {g.items.map((v) => {
                flatIndex++;
                const i = flatIndex;
                const selected = v.id === selectedId;
                const isBase = v.id === baseId;
                const d = new Date(v.createdAt);
                return (
                  <li
                    key={v.id}
                    role="option"
                    aria-selected={selected}
                    data-version={v.id}
                    tabIndex={selected || (!selectedId && i === 0) ? 0 : -1}
                    onClick={() => onSelect(v.id)}
                    onKeyDown={(e) => {
                      if (e.target !== e.currentTarget) return;
                      onKey(e, i);
                    }}
                    className={cn(
                      "group relative mx-1 cursor-pointer rounded-crm px-2.5 py-2 outline-none",
                      "focus-visible:ring-2 focus-visible:ring-crm-ring",
                      selected ? "bg-crm-primary/15" : "hover:bg-crm-muted/60",
                    )}
                  >
                    <div className="flex items-center gap-1.5">
                      {v.name && (
                        <Star
                          className="size-3 shrink-0 fill-crm-warning text-crm-warning"
                          aria-hidden
                        />
                      )}
                      {renaming === v.id ? (
                        <input
                          autoFocus
                          aria-label="Version name"
                          value={draft}
                          onChange={(e) => setDraft(e.target.value)}
                          onClick={(e) => e.stopPropagation()}
                          onBlur={() => void commitRename(v)}
                          onKeyDown={(e) => {
                            e.stopPropagation();
                            if (e.key === "Enter") void commitRename(v);
                            if (e.key === "Escape") setRenaming(null);
                          }}
                          className="min-w-0 flex-1 rounded border border-crm-input bg-crm-bg px-1.5 py-0.5 text-sm text-crm-fg outline-none"
                        />
                      ) : (
                        <span className="min-w-0 flex-1 truncate text-sm text-crm-fg">
                          {v.name ?? format(d, "HH:mm")}
                        </span>
                      )}
                      {v.id === currentId && (
                        <span className="rounded bg-crm-success/15 px-1.5 text-[10px] font-medium text-crm-success">
                          Current
                        </span>
                      )}
                      {isBase && (
                        <span className="rounded bg-crm-muted px-1.5 text-[10px] font-medium text-crm-soft">
                          Base
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 truncate text-xs text-crm-muted-fg">
                      {v.author.name} &middot;{" "}
                      <time dateTime={d.toISOString()} title={format(d, "PPpp")}>
                        {formatDistanceToNow(d, { addSuffix: true })}
                      </time>
                    </p>
                    {v.message && (
                      <p className="mt-0.5 line-clamp-2 text-xs text-crm-subtle">{v.message}</p>
                    )}
                    <div
                      className={cn(
                        "mt-1.5 flex flex-wrap gap-1",
                        selected ? "flex" : "hidden group-focus-within:flex group-hover:flex",
                      )}
                    >
                      {!isBase && v.id !== selectedId && (
                        <ActionBtn onClick={() => onSelectBase(v.id)}>Compare from</ActionBtn>
                      )}
                      {onRename && (
                        <ActionBtn
                          onClick={() => {
                            setDraft(v.name ?? "");
                            setRenaming(v.id);
                          }}
                        >
                          <Pencil className="size-3" aria-hidden /> {v.name ? "Rename" : "Name"}
                        </ActionBtn>
                      )}
                      {onRestore && v.id !== currentId && (
                        <>
                          {confirm === v.id ? (
                            <ActionBtn
                              tone="danger"
                              disabled={restoring === v.id}
                              onClick={() => void doRestore(v)}
                            >
                              {restoring === v.id ? (
                                <Loader2 className="size-3 animate-spin" aria-hidden />
                              ) : (
                                <Check className="size-3" aria-hidden />
                              )}
                              Confirm restore
                            </ActionBtn>
                          ) : (
                            <ActionBtn onClick={() => setConfirm(v.id)}>
                              <RotateCcw className="size-3" aria-hidden /> Restore
                            </ActionBtn>
                          )}
                        </>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </li>
        ))}
        {visible.length === 0 && (
          <li className="px-3 py-8 text-center text-xs text-crm-muted-fg">
            No named versions yet.
          </li>
        )}
      </ul>
    </div>
  );
}

function ActionBtn({
  tone,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { tone?: "danger" }) {
  return (
    <button
      type="button"
      {...props}
      onClick={(e) => {
        e.stopPropagation();
        props.onClick?.(e);
      }}
      className={cn(
        "inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[11px] disabled:opacity-50",
        tone === "danger"
          ? "border-crm-danger/50 text-crm-danger hover:bg-crm-danger/10"
          : "border-crm-border text-crm-soft hover:bg-crm-muted",
        className,
      )}
    />
  );
}
