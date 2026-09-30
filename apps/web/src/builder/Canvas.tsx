import { useCallback, type KeyboardEvent, type ReactNode } from "react";
import { useDroppable } from "@dnd-kit/core";
import {
  horizontalListSortingStrategy,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Box, ChevronDown, ChevronUp, Copy, GripVertical, Trash2 } from "lucide-react";
import { dropId } from "./dnd";
import { LAYOUT_BLOCKS } from "./Palette";
import { useBuilder } from "./store";
import { ROOT_ID } from "./tree";
import type { PageNode } from "./types";

export type NodeDrag = { kind: "node"; id: string };

const LABEL: Record<string, string> = Object.fromEntries(
  LAYOUT_BLOCKS.map((b) => [b.type, b.label]),
);

/** Short prop summary shown on a node card, e.g. `variant="primary" size="lg"`. */
function summary(props: Record<string, unknown>): string {
  return Object.entries(props)
    .filter(([, v]) => v !== undefined && v !== "" && typeof v !== "object")
    .slice(0, 3)
    .map(([k, v]) => (v === true ? k : `${k}=${JSON.stringify(v)}`))
    .join(" ");
}

function DropZone({ id, hint, wide }: { id: string; hint: string; wide?: boolean }) {
  const { setNodeRef, isOver } = useDroppable({ id: dropId(id) });
  return (
    <div
      ref={setNodeRef}
      className={`flex min-h-9 items-center justify-center rounded-md border border-dashed px-2 text-[11px] transition-colors ${
        wide ? "min-w-28 flex-1" : ""
      } ${isOver ? "border-foreground bg-muted text-foreground" : "border-border text-muted-foreground/70"}`}
    >
      {hint}
    </div>
  );
}

const iconBtn =
  "inline-flex size-6 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40 disabled:hover:bg-transparent";

function NodeCard({ node, names }: { node: PageNode; names: Record<string, string> }) {
  const selectedId = useBuilder((s) => s.selectedId);
  const { select, remove, duplicate, shift } = useBuilder.getState();
  const selected = selectedId === node.id;
  const container = node.type !== "component";
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: node.id, data: { kind: "node", id: node.id } satisfies NodeDrag });

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return;
    const mod = e.ctrlKey || e.metaKey;
    if (e.key === "Delete" || e.key === "Backspace") remove(node.id);
    else if (mod && e.key.toLowerCase() === "d") duplicate(node.id);
    else if (e.altKey && (e.key === "ArrowUp" || e.key === "ArrowLeft")) shift(node.id, -1);
    else if (e.altKey && (e.key === "ArrowDown" || e.key === "ArrowRight")) shift(node.id, 1);
    else return;
    e.preventDefault();
    e.stopPropagation();
  };

  const title =
    node.type === "component"
      ? (names[node.slug ?? ""] ?? node.slug ?? "Component")
      : LABEL[node.type];
  const detail =
    node.type === "section" && typeof node.props.title === "string"
      ? node.props.title
      : summary(node.props);

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={`${node.type === "column" ? "min-w-40 flex-1" : ""} ${isDragging ? "opacity-40" : ""}`}
    >
      <div
        role="treeitem"
        aria-selected={selected}
        aria-label={`${title}${detail ? `, ${detail}` : ""}`}
        tabIndex={0}
        onClick={(e) => {
          e.stopPropagation();
          select(node.id);
        }}
        onKeyDown={onKeyDown}
        className={`group/node rounded-lg border bg-background text-sm transition-colors focus:outline-none ${
          selected
            ? "border-foreground ring-1 ring-foreground"
            : "border-border hover:border-foreground/30 focus-visible:border-foreground/50"
        }`}
      >
        <div className="flex h-8 items-center gap-1.5 pr-1 pl-1.5">
          <button
            ref={setActivatorNodeRef}
            type="button"
            {...listeners}
            {...attributes}
            aria-label={`Drag ${title}`}
            className="inline-flex size-6 shrink-0 cursor-grab touch-none items-center justify-center rounded text-muted-foreground/70 hover:bg-muted hover:text-foreground active:cursor-grabbing"
          >
            <GripVertical className="size-3.5" aria-hidden />
          </button>
          {node.type === "component" ? (
            <Box className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
          ) : null}
          <span
            className={`truncate ${container ? "text-xs font-medium text-muted-foreground" : "font-medium"}`}
          >
            {title}
          </span>
          {detail ? (
            <span className="min-w-0 truncate font-mono text-[11px] text-muted-foreground">
              {detail}
            </span>
          ) : null}
          <span
            className={`ml-auto flex shrink-0 items-center ${
              selected ? "" : "opacity-0 group-hover/node:opacity-100 focus-within:opacity-100"
            }`}
          >
            <button
              type="button"
              className={iconBtn}
              onClick={() => shift(node.id, -1)}
              aria-label="Move up"
              title="Move up (Alt+Up)"
            >
              <ChevronUp className="size-3.5" aria-hidden />
            </button>
            <button
              type="button"
              className={iconBtn}
              onClick={() => shift(node.id, 1)}
              aria-label="Move down"
              title="Move down (Alt+Down)"
            >
              <ChevronDown className="size-3.5" aria-hidden />
            </button>
            <button
              type="button"
              className={iconBtn}
              onClick={() => duplicate(node.id)}
              aria-label="Duplicate"
              title="Duplicate (Ctrl+D)"
            >
              <Copy className="size-3.5" aria-hidden />
            </button>
            <button
              type="button"
              className={iconBtn}
              onClick={() => remove(node.id)}
              aria-label="Delete"
              title="Delete (Del)"
            >
              <Trash2 className="size-3.5" aria-hidden />
            </button>
          </span>
        </div>
        {container ? (
          <div className="border-t border-border/70 p-2">
            <Children node={node} names={names} />
          </div>
        ) : null}
      </div>
    </div>
  );
}

/** Sortable list of a container's children plus its drop zone. Rows lay out horizontally. */
function Children({ node, names }: { node: PageNode; names: Record<string, string> }) {
  const horizontal = node.type === "row";
  const hint =
    node.type === "page"
      ? "Drop a section, row or component here"
      : `Drop into ${LABEL[node.type]?.toLowerCase() ?? "container"}`;
  return (
    <SortableContext
      items={node.children.map((c) => c.id)}
      strategy={horizontal ? horizontalListSortingStrategy : verticalListSortingStrategy}
    >
      <div className={horizontal ? "flex flex-wrap items-start gap-2" : "flex flex-col gap-2"}>
        {node.children.map((child) => (
          <NodeCard key={child.id} node={child} names={names} />
        ))}
        <DropZone id={node.id} hint={node.children.length ? "+" : hint} wide={horizontal} />
      </div>
    </SortableContext>
  );
}

/** The page tree as nested cards. Must render inside the builder's DndContext. */
export function Canvas({ names, toolbar }: { names: Record<string, string>; toolbar?: ReactNode }) {
  const tree = useBuilder((s) => s.tree);
  const selectedId = useBuilder((s) => s.selectedId);
  const select = useBuilder((s) => s.select);
  const selectRoot = useCallback(() => select(ROOT_ID), [select]);
  const rootSelected = selectedId === ROOT_ID;

  return (
    <div className="flex h-full flex-col">
      {toolbar}
      <div className="scroll-thin flex-1 overflow-auto bg-subtle p-4" onClick={selectRoot}>
        <div
          role="tree"
          aria-label="Page structure"
          onClick={(e) => e.stopPropagation()}
          className={`mx-auto min-h-full max-w-3xl rounded-xl border bg-background p-3 transition-colors ${
            rootSelected ? "border-foreground ring-1 ring-foreground" : "border-border"
          }`}
        >
          <button
            type="button"
            onClick={selectRoot}
            className="mb-2 flex h-6 w-full items-center rounded px-1 text-left text-[11px] font-medium text-muted-foreground hover:bg-muted/60 hover:text-foreground"
          >
            Page
          </button>
          <Children node={tree} names={names} />
        </div>
      </div>
    </div>
  );
}
