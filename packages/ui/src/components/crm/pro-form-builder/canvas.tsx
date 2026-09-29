import * as React from "react";
import { Copy, GitBranch, GripVertical, Plus, Trash2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { FieldType, FormField } from "@/components/crm/pro-form-renderer/schema";
import { labelForType, useBuilder } from "@/components/crm/pro-form-builder/store";
import { DND_MOVE, DND_NEW, FIELD_ICONS } from "@/components/crm/pro-form-builder/palette";

const hasType = (e: React.DragEvent, t: string) => Array.from(e.dataTransfer.types).includes(t);

/** Page tabs (drop a field on a tab to move it there) plus add / remove page. */
export function PageTabs({ disabled }: { disabled?: boolean }) {
  const pages = useBuilder((s) => s.schema.pages);
  const pageId = useBuilder((s) => s.pageId);
  const setPage = useBuilder((s) => s.setPage);
  const addPage = useBuilder((s) => s.addPage);
  const removePage = useBuilder((s) => s.removePage);
  const moveField = useBuilder((s) => s.moveField);
  const select = useBuilder((s) => s.select);
  const [over, setOver] = React.useState<string | null>(null);
  const tabs = React.useRef<(HTMLButtonElement | null)[]>([]);

  const onKey = (e: React.KeyboardEvent, i: number) => {
    const n = pages.length;
    const to =
      e.key === "ArrowRight"
        ? (i + 1) % n
        : e.key === "ArrowLeft"
          ? (i - 1 + n) % n
          : e.key === "Home"
            ? 0
            : e.key === "End"
              ? n - 1
              : -1;
    if (to < 0) return;
    e.preventDefault();
    setPage(pages[to]!.id);
    tabs.current[to]?.focus();
  };

  return (
    <div className="flex items-center gap-1 overflow-x-auto border-b border-crm-border pb-2">
      <div role="tablist" aria-label="Form pages" className="flex items-center gap-1">
        {pages.map((p, i) => {
          const active = p.id === pageId;
          return (
            <div
              key={p.id}
              className={cn(
                "group flex items-center rounded-full transition-colors",
                active ? "bg-crm-raised shadow-crm-raised" : "hover:bg-crm-muted",
                over === p.id && "ring-2 ring-crm-primary",
              )}
              onDragOver={(e) => {
                if (!hasType(e, DND_MOVE) || active) return;
                e.preventDefault();
                setOver(p.id);
              }}
              onDragLeave={() => setOver(null)}
              onDrop={(e) => {
                setOver(null);
                const id = e.dataTransfer.getData(DND_MOVE);
                if (id) {
                  e.preventDefault();
                  moveField(id, p.fields.length, p.id);
                }
              }}
            >
              <button
                ref={(el) => {
                  tabs.current[i] = el;
                }}
                type="button"
                role="tab"
                aria-selected={active}
                tabIndex={active ? 0 : -1}
                onKeyDown={(e) => onKey(e, i)}
                onClick={() => {
                  setPage(p.id);
                  select({ kind: "page", id: p.id });
                }}
                className={cn(
                  "cursor-pointer rounded-full py-1 pr-2 pl-3 text-xs whitespace-nowrap outline-none focus-visible:ring-2 focus-visible:ring-crm-ring/60",
                  active ? "text-crm-fg" : "text-crm-muted-fg",
                )}
              >
                <span className="tabular-nums text-crm-subtle">{i + 1}</span>{" "}
                {p.title || "Untitled"}
                <span className="ml-1.5 text-crm-subtle tabular-nums">{p.fields.length}</span>
                {p.logic?.rules.length ? (
                  <GitBranch
                    className="ml-1 inline size-3 text-crm-primary"
                    aria-label="Has page logic"
                  />
                ) : null}
              </button>
              {pages.length > 1 && !disabled ? (
                <button
                  type="button"
                  aria-label={`Delete ${p.title}`}
                  onClick={() => removePage(p.id)}
                  className="mr-1 cursor-pointer rounded-full p-0.5 text-crm-subtle opacity-0 outline-none group-hover:opacity-100 hover:text-crm-danger focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-crm-ring/60"
                >
                  <X className="size-3" />
                </button>
              ) : null}
            </div>
          );
        })}
      </div>
      <button
        type="button"
        onClick={addPage}
        disabled={disabled}
        className="ml-1 flex shrink-0 cursor-pointer items-center gap-1 rounded-full px-2.5 py-1 text-xs text-crm-muted-fg outline-none hover:bg-crm-muted hover:text-crm-fg focus-visible:ring-2 focus-visible:ring-crm-ring/60 disabled:opacity-50"
      >
        <Plus className="size-3" aria-hidden /> Page
      </button>
    </div>
  );
}

/**
 * Canvas for the active page. Native HTML5 drag and drop (palette -> canvas, row reorder, row ->
 * page tab) with a drop indicator, plus a full keyboard path: Alt+Up/Down to move, Delete to remove,
 * Ctrl/Cmd+D to duplicate, Up/Down to move focus.
 */
export function BuilderCanvas({ disabled }: { disabled?: boolean }) {
  const page = useBuilder(
    (s) => s.schema.pages.find((p) => p.id === s.pageId) ?? s.schema.pages[0],
  );
  const selectedId = useBuilder((s) => (s.selection?.kind === "field" ? s.selection.id : null));
  const addField = useBuilder((s) => s.addField);
  const moveField = useBuilder((s) => s.moveField);
  const removeField = useBuilder((s) => s.removeField);
  const duplicateField = useBuilder((s) => s.duplicateField);
  const select = useBuilder((s) => s.select);
  const [dropIndex, setDropIndex] = React.useState<number | null>(null);
  const [draggingId, setDraggingId] = React.useState<string | null>(null);
  const [announce, setAnnounce] = React.useState("");
  const rows = React.useRef(new Map<string, HTMLElement>());
  const listRef = React.useRef<HTMLUListElement>(null);

  const fields = page?.fields ?? [];

  const focusRow = (id: string | undefined) =>
    id && requestAnimationFrame(() => rows.current.get(id)?.focus());

  const indexFromEvent = (e: React.DragEvent) => {
    const els = fields.map((f) => rows.current.get(f.id));
    for (let i = 0; i < els.length; i++) {
      const r = els[i]?.getBoundingClientRect();
      if (r && e.clientY < r.top + r.height / 2) return i;
    }
    return fields.length;
  };

  const onDragOver = (e: React.DragEvent) => {
    if (disabled || (!hasType(e, DND_NEW) && !hasType(e, DND_MOVE))) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = hasType(e, DND_NEW) ? "copy" : "move";
    const i = indexFromEvent(e);
    if (i !== dropIndex) setDropIndex(i);
  };

  const onDrop = (e: React.DragEvent) => {
    const at = dropIndex ?? fields.length;
    setDropIndex(null);
    setDraggingId(null);
    const type = e.dataTransfer.getData(DND_NEW) as FieldType;
    const id = e.dataTransfer.getData(DND_MOVE);
    if (!type && !id) return;
    e.preventDefault();
    if (type) {
      addField(type, at);
      setAnnounce(`${labelForType(type)} added at position ${at + 1}`);
    } else if (page) {
      moveField(id, at, page.id);
      setAnnounce(`Field moved to position ${Math.min(at + 1, fields.length)}`);
      focusRow(id);
    }
  };

  const onRowKey = (e: React.KeyboardEvent, f: FormField, i: number) => {
    if (e.target !== e.currentTarget || disabled) return;
    if (e.altKey && (e.key === "ArrowUp" || e.key === "ArrowDown")) {
      e.preventDefault();
      const to = e.key === "ArrowUp" ? i - 1 : i + 2;
      if (to < 0 || to > fields.length) return;
      moveField(f.id, to);
      setAnnounce(
        `${f.label} moved to position ${e.key === "ArrowUp" ? i : i + 2} of ${fields.length}`,
      );
      focusRow(f.id);
    } else if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      e.preventDefault();
      focusRow(fields[i + (e.key === "ArrowUp" ? -1 : 1)]?.id);
    } else if (e.key === "Delete" || e.key === "Backspace") {
      e.preventDefault();
      removeField(f.id);
      setAnnounce(`${f.label} removed`);
      focusRow((fields[i + 1] ?? fields[i - 1])?.id);
    } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "d") {
      e.preventDefault();
      duplicateField(f.id);
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      select({ kind: "field", id: f.id });
    }
  };

  // Stable callbacks so memoised rows only re-render when their own field changes.
  const keyRef = React.useRef(onRowKey);
  keyRef.current = onRowKey;
  const stableKey = React.useCallback(
    (e: React.KeyboardEvent, f: FormField, i: number) => keyRef.current(e, f, i),
    [],
  );
  const registerRow = React.useCallback((id: string, el: HTMLElement | null) => {
    if (el) rows.current.set(id, el);
    else rows.current.delete(id);
  }, []);
  const endDrag = React.useCallback(() => {
    setDraggingId(null);
    setDropIndex(null);
  }, []);

  return (
    <div
      className="flex min-h-0 flex-1 flex-col"
      onDragOver={onDragOver}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setDropIndex(null);
      }}
      onDrop={onDrop}
    >
      <p className="sr-only" aria-live="polite">
        {announce}
      </p>
      {fields.length === 0 ? (
        <div
          className={cn(
            "m-1 flex flex-1 flex-col items-center justify-center gap-1 rounded-crm border border-dashed px-6 py-16 text-center",
            dropIndex !== null ? "border-crm-primary bg-crm-primary/5" : "border-crm-input/50",
          )}
        >
          <Plus className="size-5 text-crm-subtle" aria-hidden />
          <p className="text-sm text-crm-fg">Drag fields here</p>
          <p className="text-xs text-crm-subtle">or click a field type in the palette</p>
        </div>
      ) : (
        <ul
          ref={listRef}
          aria-label={`Fields on ${page?.title ?? "page"}. Alt plus arrow keys reorder.`}
          className="flex flex-col gap-1.5 overflow-y-auto p-1"
        >
          {fields.map((f, i) => (
            <React.Fragment key={f.id}>
              {dropIndex === i ? <DropLine /> : null}
              <FieldRow
                field={f}
                index={i}
                selected={f.id === selectedId}
                dragging={f.id === draggingId}
                disabled={disabled}
                registerRow={registerRow}
                onSelect={select}
                onKeyDown={stableKey}
                onRemove={removeField}
                onDuplicate={duplicateField}
                onDragStart={setDraggingId}
                onDragEnd={endDrag}
              />
            </React.Fragment>
          ))}
          {dropIndex === fields.length ? <DropLine /> : null}
        </ul>
      )}
    </div>
  );
}

function DropLine() {
  return (
    <li
      aria-hidden
      className="h-0.5 rounded-full bg-crm-primary shadow-[0_0_0_2px_rgba(97,71,255,0.25)]"
    />
  );
}

interface FieldRowProps {
  field: FormField;
  index: number;
  selected: boolean;
  dragging: boolean;
  disabled?: boolean;
  registerRow: (id: string, el: HTMLElement | null) => void;
  onSelect: (s: { kind: "field"; id: string }) => void;
  onKeyDown: (e: React.KeyboardEvent, f: FormField, i: number) => void;
  onRemove: (id: string) => void;
  onDuplicate: (id: string) => void;
  onDragStart: (id: string) => void;
  onDragEnd: () => void;
}

const FieldRow = React.memo(function FieldRow({
  field: f,
  index,
  selected,
  dragging,
  disabled,
  registerRow,
  onSelect,
  onKeyDown,
  onRemove,
  onDuplicate,
  onDragStart,
  onDragEnd,
}: FieldRowProps) {
  const Icon = FIELD_ICONS[f.type];
  const rules = f.logic?.rules.length ?? 0;
  return (
    <li
      ref={(el) => registerRow(f.id, el)}
      tabIndex={0}
      aria-selected={selected}
      aria-label={`${f.label}, ${labelForType(f.type)}${f.required ? ", required" : ""}`}
      draggable={!disabled}
      onDragStart={(e) => {
        e.dataTransfer.setData(DND_MOVE, f.id);
        e.dataTransfer.effectAllowed = "move";
        onDragStart(f.id);
      }}
      onDragEnd={onDragEnd}
      onClick={() => onSelect({ kind: "field", id: f.id })}
      onKeyDown={(e) => onKeyDown(e, f, index)}
      className={cn(
        "group flex cursor-pointer items-center gap-2.5 rounded-crm border bg-crm-raised px-2.5 py-2 outline-none transition-[border-color,opacity,box-shadow]",
        "focus-visible:ring-2 focus-visible:ring-crm-ring/60",
        selected
          ? "border-crm-primary/70 shadow-crm-raised"
          : "border-crm-border hover:border-crm-input",
        dragging && "opacity-40",
        f.type === "heading" && "bg-crm-card",
      )}
    >
      <GripVertical className="size-3.5 shrink-0 cursor-grab text-crm-subtle" aria-hidden />
      <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-crm-card text-crm-muted-fg">
        <Icon className="size-3.5" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-xs font-medium text-crm-fg">
          {f.label || "Untitled"}
          {f.required ? <span className="text-crm-danger"> *</span> : null}
        </span>
        <span className="block truncate font-mono text-[11px] text-crm-subtle">
          {f.type === "heading" ? "section" : f.name}
          {f.options?.length ? ` · ${f.options.length} options` : ""}
          {f.width === "half" ? " · half width" : ""}
        </span>
      </span>
      {rules ? (
        <span className="flex shrink-0 items-center gap-1 rounded-full bg-crm-primary/15 px-2 py-0.5 text-[11px] text-crm-primary">
          <GitBranch className="size-3" aria-hidden /> {rules} rule{rules > 1 ? "s" : ""}
        </span>
      ) : null}
      {!disabled ? (
        <span className="flex shrink-0 items-center opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
          <button
            type="button"
            tabIndex={-1}
            aria-label={`Duplicate ${f.label}`}
            onClick={(e) => (e.stopPropagation(), onDuplicate(f.id))}
            className="cursor-pointer rounded-full p-1 text-crm-muted-fg hover:bg-crm-muted hover:text-crm-fg"
          >
            <Copy className="size-3.5" />
          </button>
          <button
            type="button"
            tabIndex={-1}
            aria-label={`Delete ${f.label}`}
            onClick={(e) => (e.stopPropagation(), onRemove(f.id))}
            className="cursor-pointer rounded-full p-1 text-crm-muted-fg hover:bg-crm-danger/15 hover:text-crm-danger"
          >
            <Trash2 className="size-3.5" />
          </button>
        </span>
      ) : null}
    </li>
  );
});
