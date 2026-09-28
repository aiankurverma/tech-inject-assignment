import * as React from "react";
import { Check, ChevronDown, Lock, SkipForward, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/crm/button";
import { ProgressRing } from "@/components/crm/progress";

export type ChecklistItemStatus = "todo" | "done" | "skipped";

export interface ChecklistItem {
  id: string;
  title: string;
  description?: string;
  /** Estimated minutes to finish; summed into "time left". */
  minutes?: number;
  /** Label for the call-to-action button. */
  actionLabel?: string;
  /** Items that must be done (or skipped) first. */
  dependsOn?: string[];
  /** Required items cannot be skipped. */
  required?: boolean;
  group?: string;
}

export interface OnboardingChecklistProps {
  items: ChecklistItem[];
  /** Controlled status map. */
  status?: Record<string, ChecklistItemStatus>;
  defaultStatus?: Record<string, ChecklistItemStatus>;
  onStatusChange?: (status: Record<string, ChecklistItemStatus>) => void;
  /** Called when the item's CTA is pressed (open the relevant screen). */
  onAction?: (id: string) => void;
  onDismiss?: () => void;
  title?: string;
  className?: string;
}

/** Getting-started checklist with dependencies, skip rules, time-left estimate, grouped sections and a progress ring. */
export function OnboardingChecklist({
  items,
  status,
  defaultStatus = {},
  onStatusChange,
  onAction,
  onDismiss,
  title = "Get started",
  className,
}: OnboardingChecklistProps) {
  const [inner, setInner] = React.useState(defaultStatus);
  const current = status ?? inner;
  const stateOf = (id: string): ChecklistItemStatus => current[id] ?? "todo";
  const firstOpen = items.find((i) => stateOf(i.id) === "todo")?.id ?? null;
  const [open, setOpen] = React.useState<string | null>(firstOpen);
  const [collapsed, setCollapsed] = React.useState(false);
  const listId = React.useId();

  const set = (id: string, s: ChecklistItemStatus) => {
    const next = { ...current, [id]: s };
    if (status === undefined) setInner(next);
    onStatusChange?.(next);
    if (s !== "todo") {
      const after = items.find((i) => i.id !== id && (next[i.id] ?? "todo") === "todo");
      setOpen(after?.id ?? null);
    }
  };

  const resolved = items.filter((i) => stateOf(i.id) !== "todo").length;
  const doneCount = items.filter((i) => stateOf(i.id) === "done").length;
  const minutesLeft = items
    .filter((i) => stateOf(i.id) === "todo")
    .reduce((s, i) => s + (i.minutes ?? 0), 0);
  const complete = items.length > 0 && resolved === items.length;
  const lockedBy = (i: ChecklistItem) =>
    (i.dependsOn ?? [])
      .filter((d) => stateOf(d) === "todo")
      .map((d) => items.find((x) => x.id === d)?.title ?? d);

  const groups = React.useMemo(() => {
    const m = new Map<string, ChecklistItem[]>();
    for (const i of items) {
      const g = i.group ?? "";
      m.set(g, [...(m.get(g) ?? []), i]);
    }
    return [...m.entries()];
  }, [items]);

  return (
    <section
      aria-label={title}
      className={cn(
        "flex w-full max-w-md flex-col rounded-crm border border-crm-border bg-crm-card font-crm text-crm-fg shadow-crm-raised",
        className,
      )}
    >
      <header className="flex items-center gap-3 p-4">
        <ProgressRing
          value={items.length ? (resolved / items.length) * 100 : 0}
          size={44}
          stroke={4}
          tone={complete ? "success" : "primary"}
          label={`${resolved} of ${items.length} steps complete`}
        />
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-medium">{complete ? "You're all set" : title}</h2>
          <p className="text-xs text-crm-muted-fg">
            {complete
              ? `${doneCount} done, ${resolved - doneCount} skipped`
              : `${resolved}/${items.length} complete${minutesLeft ? ` · about ${minutesLeft} min left` : ""}`}
          </p>
        </div>
        <button
          type="button"
          aria-expanded={!collapsed}
          aria-controls={listId}
          aria-label={collapsed ? "Expand checklist" : "Collapse checklist"}
          onClick={() => setCollapsed((c) => !c)}
          className="grid size-7 cursor-pointer place-items-center rounded-md text-crm-subtle outline-none hover:bg-crm-muted hover:text-crm-fg focus-visible:ring-2 focus-visible:ring-crm-ring/60"
        >
          <ChevronDown className={cn("size-4 transition-transform", collapsed && "-rotate-90")} />
        </button>
        {onDismiss ? (
          <button
            type="button"
            aria-label="Dismiss checklist"
            onClick={onDismiss}
            className="grid size-7 cursor-pointer place-items-center rounded-md text-crm-subtle outline-none hover:bg-crm-muted hover:text-crm-fg focus-visible:ring-2 focus-visible:ring-crm-ring/60"
          >
            <X className="size-4" />
          </button>
        ) : null}
      </header>

      {items.length === 0 ? (
        <p className="border-t border-crm-border p-4 text-xs text-crm-subtle">
          Nothing to set up yet.
        </p>
      ) : null}

      <div id={listId} hidden={collapsed} className="border-t border-crm-border">
        {groups.map(([group, list]) => (
          <div key={group || "_"}>
            {group ? (
              <p className="crm-eyebrow px-4 pt-3 pb-1 text-crm-subtle uppercase">{group}</p>
            ) : null}
            <ul className="flex flex-col p-2">
              {list.map((item) => {
                const s = stateOf(item.id);
                const blockers = lockedBy(item);
                const locked = s === "todo" && blockers.length > 0;
                const expanded = open === item.id;
                const panelId = `${listId}-${item.id}`;
                return (
                  <li key={item.id} className="rounded-lg">
                    <button
                      type="button"
                      aria-expanded={expanded}
                      aria-controls={panelId}
                      onClick={() => setOpen(expanded ? null : item.id)}
                      className="flex w-full cursor-pointer items-center gap-3 rounded-lg px-2 py-2 text-left outline-none hover:bg-crm-raised focus-visible:ring-2 focus-visible:ring-crm-ring/60"
                    >
                      <span
                        aria-hidden
                        className={cn(
                          "grid size-5 shrink-0 place-items-center rounded-full border",
                          s === "done" && "border-crm-success bg-crm-success text-crm-bg",
                          s === "skipped" && "border-crm-border bg-crm-muted text-crm-subtle",
                          s === "todo" && "border-crm-input text-crm-subtle",
                        )}
                      >
                        {s === "done" ? (
                          <Check className="size-3" strokeWidth={3} />
                        ) : s === "skipped" ? (
                          <SkipForward className="size-2.5" />
                        ) : locked ? (
                          <Lock className="size-2.5" />
                        ) : null}
                      </span>
                      <span
                        className={cn(
                          "min-w-0 flex-1 truncate text-sm",
                          s !== "todo" && "text-crm-subtle line-through",
                        )}
                      >
                        {item.title}
                        <span className="sr-only">
                          {s === "done"
                            ? " (done)"
                            : s === "skipped"
                              ? " (skipped)"
                              : locked
                                ? " (locked)"
                                : ""}
                        </span>
                      </span>
                      {item.minutes && s === "todo" ? (
                        <span className="crm-caption text-crm-subtle tabular-nums">
                          {item.minutes} min
                        </span>
                      ) : null}
                    </button>
                    <div id={panelId} hidden={!expanded} className="flex flex-col gap-3 px-10 pb-3">
                      {item.description ? (
                        <p className="text-xs leading-5 text-crm-muted-fg">{item.description}</p>
                      ) : null}
                      {locked ? (
                        <p className="text-xs text-crm-warning">
                          Finish first: {blockers.join(", ")}
                        </p>
                      ) : null}
                      <div className="flex flex-wrap gap-2">
                        {s === "todo" ? (
                          <>
                            <Button
                              size="sm"
                              variant="primary"
                              disabled={locked}
                              onClick={() => onAction?.(item.id)}
                            >
                              {item.actionLabel ?? "Start"}
                            </Button>
                            <Button
                              size="sm"
                              disabled={locked}
                              onClick={() => set(item.id, "done")}
                            >
                              Mark done
                            </Button>
                            {!item.required ? (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => set(item.id, "skipped")}
                              >
                                Skip
                              </Button>
                            ) : null}
                          </>
                        ) : (
                          <Button size="sm" variant="ghost" onClick={() => set(item.id, "todo")}>
                            Reopen
                          </Button>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
