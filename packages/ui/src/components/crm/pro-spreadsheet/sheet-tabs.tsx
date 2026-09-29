import * as React from "react";
import * as Tabs from "@radix-ui/react-tabs";
import { Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SheetData } from "@/components/crm/pro-spreadsheet/store";

export interface SheetTabsProps {
  sheets: SheetData[];
  activeId: string;
  readOnly: boolean;
  onActivate: (id: string) => void;
  onAdd: () => void;
  onRename: (id: string, name: string) => void;
  onRemove: (id: string) => void;
  children: React.ReactNode;
}

/** Characters that would break Sheet!A1 references. */
const INVALID = /[!'[\]*?/\\:]/;

export function SheetTabs(p: SheetTabsProps) {
  const [renaming, setRenaming] = React.useState<string | null>(null);
  const [draft, setDraft] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  const startRename = (s: SheetData) => {
    if (p.readOnly) return;
    setRenaming(s.id);
    setDraft(s.name);
    setError(null);
  };
  const finishRename = (commit: boolean) => {
    if (!renaming) return;
    const name = draft.trim();
    if (commit) {
      if (!name) return setError("Name cannot be empty");
      if (INVALID.test(name)) return setError("Name cannot contain ! ' [ ] * ? / \\ :");
      if (p.sheets.some((s) => s.id !== renaming && s.name.toLowerCase() === name.toLowerCase()))
        return setError("A sheet with this name already exists");
      const current = p.sheets.find((s) => s.id === renaming);
      if (current && current.name !== name) p.onRename(renaming, name);
    }
    setRenaming(null);
    setError(null);
  };

  return (
    <Tabs.Root
      value={p.activeId}
      onValueChange={p.onActivate}
      activationMode="manual"
      className="flex min-h-0 flex-1 flex-col"
    >
      <Tabs.Content
        value={p.activeId}
        className="flex min-h-0 flex-1 flex-col outline-none"
        tabIndex={-1}
      >
        {p.children}
      </Tabs.Content>
      <div className="flex items-center gap-1 border-t border-crm-border bg-crm-card px-1.5 py-1">
        {!p.readOnly && (
          <button
            type="button"
            onClick={p.onAdd}
            aria-label="Add sheet"
            title="Add sheet"
            className="inline-flex size-7 items-center justify-center rounded-crm text-crm-muted-fg hover:bg-crm-muted hover:text-crm-fg focus-visible:ring-2 focus-visible:ring-crm-ring focus-visible:outline-none"
          >
            <Plus className="size-4" />
          </button>
        )}
        <Tabs.List
          aria-label="Sheets"
          className="flex min-w-0 items-center gap-0.5 overflow-x-auto"
        >
          {p.sheets.map((s) =>
            renaming === s.id ? (
              <span key={s.id} className="relative">
                <input
                  autoFocus
                  aria-label="Sheet name"
                  aria-invalid={!!error}
                  aria-describedby={error ? `${s.id}-err` : undefined}
                  value={draft}
                  onChange={(e) => {
                    setDraft(e.target.value);
                    setError(null);
                  }}
                  onBlur={() => finishRename(true)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") finishRename(true);
                    else if (e.key === "Escape") finishRename(false);
                  }}
                  className={cn(
                    "h-7 w-28 rounded-crm border bg-crm-bg px-2 text-[13px] text-crm-fg outline-none",
                    error ? "border-crm-danger" : "border-crm-primary",
                  )}
                />
                {error && (
                  <span
                    id={`${s.id}-err`}
                    role="alert"
                    className="absolute bottom-full left-0 mb-1 rounded-crm bg-crm-popover px-2 py-1 text-xs whitespace-nowrap text-crm-danger shadow-crm-raised"
                  >
                    {error}
                  </span>
                )}
              </span>
            ) : (
              <Tabs.Trigger
                key={s.id}
                value={s.id}
                onDoubleClick={() => startRename(s)}
                onKeyDown={(e) => {
                  if (e.key === "F2") startRename(s);
                  else if (e.key === "Delete" && !p.readOnly && p.sheets.length > 1)
                    p.onRemove(s.id);
                }}
                title={p.readOnly ? s.name : `${s.name} (double-click or F2 to rename)`}
                className={cn(
                  "group inline-flex h-7 max-w-40 items-center gap-1 rounded-crm px-3 text-[13px] whitespace-nowrap text-crm-muted-fg transition-colors hover:bg-crm-muted hover:text-crm-fg focus-visible:ring-2 focus-visible:ring-crm-ring focus-visible:outline-none",
                  "data-[state=active]:bg-crm-bg data-[state=active]:font-medium data-[state=active]:text-crm-primary data-[state=active]:shadow-crm-raised",
                )}
              >
                <span className="truncate">{s.name}</span>
                {!p.readOnly && p.sheets.length > 1 && (
                  <span
                    role="button"
                    tabIndex={-1}
                    aria-label={`Delete ${s.name}`}
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.stopPropagation();
                      p.onRemove(s.id);
                    }}
                    className="-mr-1 hidden rounded p-0.5 text-crm-soft group-hover:inline-flex group-data-[state=active]:inline-flex hover:bg-crm-muted hover:text-crm-danger"
                  >
                    <X className="size-3" />
                  </span>
                )}
              </Tabs.Trigger>
            ),
          )}
        </Tabs.List>
        <span className="ml-auto pr-1 text-xs text-crm-soft tabular-nums" aria-hidden>
          {p.sheets.length} sheet{p.sheets.length === 1 ? "" : "s"}
        </span>
      </div>
    </Tabs.Root>
  );
}
