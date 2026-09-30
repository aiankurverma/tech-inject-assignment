import { useMemo, useState, type ReactNode } from "react";
import { useDraggable } from "@dnd-kit/core";
import {
  ChevronRight,
  Columns3,
  GripVertical,
  LayoutPanelTop,
  Lock,
  Rows3,
  Search,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useSession, type ListItem } from "../context/session";
import { groupByCategory, rankSearch } from "../lib/catalogue";
import { inputClass, Skeleton } from "../components/ui";
import type { LayoutType } from "./types";

/** What a palette drag carries; the canvas turns it into a node on drop. */
export type PaletteDrag =
  { kind: "palette"; layout: LayoutType } | { kind: "palette"; slug: string; name: string };

export const LAYOUT_BLOCKS: { type: LayoutType; label: string; icon: LucideIcon; hint: string }[] =
  [
    {
      type: "section",
      label: "Section",
      icon: LayoutPanelTop,
      hint: "Vertical block with an optional title",
    },
    { type: "row", label: "Row", icon: Columns3, hint: "Children side by side" },
    { type: "column", label: "Column", icon: Rows3, hint: "Vertical stack inside a row" },
  ];

function PaletteItem({
  id,
  data,
  disabled,
  title,
  onAdd,
  children,
}: {
  id: string;
  data: PaletteDrag;
  disabled?: boolean;
  title?: string;
  onAdd: () => void;
  children: ReactNode;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id, data, disabled });
  return (
    <div
      ref={setNodeRef}
      className={`group flex h-8 items-center gap-1 rounded-md pr-1 pl-1.5 text-sm transition-colors ${
        disabled ? "text-muted-foreground/60" : "hover:bg-muted/60"
      } ${isDragging ? "opacity-40" : ""}`}
      title={title}
    >
      <button
        type="button"
        disabled={disabled}
        onClick={onAdd}
        className="flex min-w-0 flex-1 items-center gap-2 rounded text-left disabled:cursor-not-allowed"
      >
        {children}
      </button>
      <button
        type="button"
        {...listeners}
        {...attributes}
        disabled={disabled}
        aria-label="Drag to canvas"
        className="inline-flex size-6 shrink-0 cursor-grab touch-none items-center justify-center rounded text-muted-foreground/60 opacity-0 group-hover:opacity-100 hover:bg-muted hover:text-foreground focus-visible:opacity-100 disabled:cursor-not-allowed active:cursor-grabbing"
      >
        <GripVertical className="size-3.5" aria-hidden />
      </button>
    </div>
  );
}

/** Left rail: layout blocks plus every registry component, searchable and grouped by category. */
export function Palette({
  onAddLayout,
  onAddComponent,
}: {
  onAddLayout: (type: LayoutType) => void;
  onAddComponent: (item: ListItem) => void;
}) {
  const { components, componentsError } = useSession();
  const [query, setQuery] = useState("");
  const [closed, setClosed] = useState<Set<string>>(() => new Set());
  const groups = useMemo(
    () => groupByCategory(rankSearch(components ?? [], query)),
    [components, query],
  );
  const searching = query.trim().length > 0;

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border p-3">
        <label className="relative block">
          <Search
            className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search components"
            aria-label="Search components"
            className={`${inputClass} h-8 pl-8 text-xs`}
          />
        </label>
      </div>
      <div className="scroll-thin flex-1 overflow-y-auto p-2">
        {!searching ? (
          <section className="mb-3">
            <p className="mb-1 px-1.5 text-[11px] font-medium text-muted-foreground">Layout</p>
            {LAYOUT_BLOCKS.map((b) => (
              <PaletteItem
                key={b.type}
                id={`palette:layout:${b.type}`}
                data={{ kind: "palette", layout: b.type }}
                title={b.hint}
                onAdd={() => onAddLayout(b.type)}
              >
                <b.icon className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                <span className="truncate">{b.label}</span>
              </PaletteItem>
            ))}
          </section>
        ) : null}

        {componentsError ? (
          <p className="px-1.5 text-xs text-red-700 dark:text-red-300">{componentsError}</p>
        ) : null}
        {!components && !componentsError ? (
          <div className="space-y-2 px-1.5" role="status" aria-label="Loading components">
            {Array.from({ length: 8 }, (_, i) => (
              <Skeleton key={i} className="h-5" />
            ))}
          </div>
        ) : null}
        {components && !groups.length ? (
          <p className="px-1.5 py-4 text-center text-xs text-muted-foreground">
            No components match.
          </p>
        ) : null}
        {groups.map((g) => {
          const open = searching || !closed.has(g.category);
          return (
            <section key={g.category} className="mb-1">
              <button
                type="button"
                aria-expanded={open}
                onClick={() =>
                  setClosed((prev) => {
                    const next = new Set(prev);
                    if (!next.delete(g.category)) next.add(g.category);
                    return next;
                  })
                }
                className="flex h-7 w-full items-center gap-1 rounded-md px-1.5 text-left text-[11px] font-medium text-muted-foreground hover:bg-muted/60 hover:text-foreground"
              >
                <ChevronRight
                  className={`size-3 transition-transform ${open ? "rotate-90" : ""}`}
                  aria-hidden
                />
                <span className="min-w-0 flex-1 truncate">{g.category}</span>
                <span className="tabular-nums opacity-70">{g.items.length}</span>
              </button>
              {open
                ? g.items.map((c) => {
                    const locked = !!c.locked;
                    return (
                      <PaletteItem
                        key={c.slug}
                        id={`palette:component:${c.slug}`}
                        data={{ kind: "palette", slug: c.slug, name: c.name }}
                        disabled={locked}
                        title={
                          locked
                            ? c.locked === "sign_in_required"
                              ? "Sign in to use this component"
                              : "Premium plan required"
                            : c.description
                        }
                        onAdd={() => onAddComponent(c)}
                      >
                        <span className="truncate">{c.name}</span>
                        {locked ? (
                          <Lock className="ml-auto size-3 shrink-0" aria-label="Locked" />
                        ) : null}
                      </PaletteItem>
                    );
                  })
                : null}
            </section>
          );
        })}
      </div>
    </div>
  );
}
