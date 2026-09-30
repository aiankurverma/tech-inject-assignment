import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  closestCenter,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  pointerWithin,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { Group, Panel, Separator } from "react-resizable-panels";
import { Code2, Redo2, RotateCcw, Undo2 } from "lucide-react";
import { Layout } from "../components/Layout";
import { btn } from "../components/ui";
import { useSession, type ListItem } from "../context/session";
import { Canvas, type NodeDrag } from "../builder/Canvas";
import { mergePreviews, metasFrom, useCatalogCache } from "../builder/catalog";
import { generatePage } from "../builder/codegen";
import { resolveDrop } from "../builder/dnd";
import { ExportDialog } from "../builder/ExportDialog";
import { PagePreview } from "../builder/PagePreview";
import { LAYOUT_BLOCKS, Palette, type PaletteDrag } from "../builder/Palette";
import { PropsPanel } from "../builder/PropsPanel";
import { useBuilder } from "../builder/store";
import {
  canContain,
  countNodes,
  createComponentNode,
  createLayoutNode,
  findNode,
  findParent,
  usedSlugs,
} from "../builder/tree";
import type { LayoutType, NodeType, PageNode } from "../builder/types";

/** Pointer drops go to the droppable under the cursor; keyboard drags fall back to nearest centre. */
const collision: CollisionDetection = (args) => {
  const within = pointerWithin(args);
  return within.length ? within : closestCenter(args);
};

function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = window.setTimeout(() => setV(value), ms);
    return () => window.clearTimeout(t);
  }, [value, ms]);
  return v;
}

const isEditable = (el: EventTarget | null) =>
  el instanceof HTMLElement &&
  (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));

/** Nearest ancestor-or-self of the selection that may hold `type`; null when none does. */
function containerFor(tree: PageNode, selectedId: string, type: NodeType): string | null {
  let node: PageNode | null = findNode(tree, selectedId) ?? tree;
  while (node && !canContain(node.type, type)) node = findParent(tree, node.id)?.parent ?? null;
  return node?.id ?? null;
}

const sep =
  "shrink-0 bg-border transition-colors hover:bg-foreground/40 data-[resize-handle-active]:bg-foreground";

export function Builder() {
  const { me, components } = useSession();
  const tree = useBuilder((s) => s.tree);
  const selectedId = useBuilder((s) => s.selectedId);
  const canUndo = useBuilder((s) => s.past.length > 0);
  const canRedo = useBuilder((s) => s.future.length > 0);
  const { insert, move, undo, redo, reset } = useBuilder.getState();

  const details = useCatalogCache((s) => s.details);
  const previews = useCatalogCache((s) => s.previews);
  const { ensureDetail, ensurePreview, clear } = useCatalogCache.getState();

  const [exportOpen, setExportOpen] = useState(false);
  const [drag, setDrag] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    document.title = "Page builder · Kitbase";
  }, []);

  // Access can change with the session: refetch details and previews after sign in/out.
  const firstMe = useRef(true);
  useEffect(() => {
    if (firstMe.current) firstMe.current = false;
    else clear();
  }, [me?.email, clear]);

  const slugs = useMemo(() => usedSlugs(tree), [tree]);
  useEffect(() => {
    for (const s of slugs) {
      ensureDetail(s);
      ensurePreview(s);
    }
  }, [slugs, ensureDetail, ensurePreview, details, previews]);

  const metas = useMemo(() => metasFrom(details, slugs), [details, slugs]);
  const page = useMemo(() => generatePage(tree, metas), [tree, metas]);
  const previewCode = useDebounced(page.code, 250);
  const merged = useMemo(
    () => mergePreviews(previews, slugs, previewCode),
    [previews, slugs, previewCode],
  );
  const names = useMemo(
    () => Object.fromEntries((components ?? []).map((c) => [c.slug, c.name])),
    [components],
  );

  const say = (text: string) => {
    setNotice(text);
    window.setTimeout(() => setNotice((n) => (n === text ? null : n)), 3000);
  };

  const addNode = useCallback(
    (node: PageNode) => {
      const t = useBuilder.getState();
      const parentId = containerFor(t.tree, t.selectedId, node.type);
      if (!parentId) {
        const label = LAYOUT_BLOCKS.find((b) => b.type === node.type)?.label ?? "This";
        say(`${label} needs a row or section selected first.`);
        return;
      }
      insert(parentId, node);
    },
    [insert],
  );
  const addLayout = useCallback((type: LayoutType) => addNode(createLayoutNode(type)), [addNode]);
  const addComponent = useCallback(
    (item: ListItem) => addNode(createComponentNode(item.slug)),
    [addNode],
  );

  // Undo/redo anywhere on the page except inside text inputs.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || isEditable(e.target)) return;
      const k = e.key.toLowerCase();
      if (k === "z" && e.shiftKey) redo();
      else if (k === "z") undo();
      else if (k === "y") redo();
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const onDragStart = (e: DragStartEvent) => {
    const d = e.active.data.current as PaletteDrag | NodeDrag | undefined;
    if (!d) return;
    if (d.kind === "node") {
      const n = findNode(useBuilder.getState().tree, d.id);
      setDrag(
        n?.type === "component"
          ? (names[n.slug ?? ""] ?? n.slug ?? "Component")
          : (n?.type ?? "Node"),
      );
    } else
      setDrag(
        "layout" in d
          ? (LAYOUT_BLOCKS.find((b) => b.type === d.layout)?.label ?? d.layout)
          : d.name,
      );
  };
  const onDragEnd = (e: DragEndEvent) => {
    setDrag(null);
    const d = e.active.data.current as PaletteDrag | NodeDrag | undefined;
    if (!d || !e.over) return;
    const current = useBuilder.getState().tree;
    const target = resolveDrop(current, String(e.over.id));
    if (!target) return;
    if (d.kind === "palette") {
      const node = "layout" in d ? createLayoutNode(d.layout) : createComponentNode(d.slug);
      const parent = findNode(current, target.parentId);
      if (parent && !canContain(parent.type, node.type)) {
        say(`A ${node.type} cannot go inside a ${parent.type}.`);
        return;
      }
      insert(target.parentId, node, target.index);
    } else if (d.id !== e.over.id) {
      move(d.id, target.parentId, target.index);
    }
  };

  const count = countNodes(tree);
  const toolbar = (
    <div className="flex h-10 shrink-0 items-center gap-1 border-b border-border px-2 text-xs">
      <span className="px-1 font-medium">Structure</span>
      <span className="text-muted-foreground tabular-nums">
        {count} node{count === 1 ? "" : "s"}
      </span>
      {notice ? (
        <span role="status" className="ml-2 truncate text-muted-foreground">
          {notice}
        </span>
      ) : null}
      <span className="ml-auto flex items-center gap-0.5">
        <button
          type="button"
          onClick={undo}
          disabled={!canUndo}
          className={`${btn.ghost} size-8 px-0 disabled:opacity-40`}
          aria-label="Undo"
          title="Undo (Ctrl+Z)"
        >
          <Undo2 className="size-4" aria-hidden />
        </button>
        <button
          type="button"
          onClick={redo}
          disabled={!canRedo}
          className={`${btn.ghost} size-8 px-0 disabled:opacity-40`}
          aria-label="Redo"
          title="Redo (Ctrl+Y)"
        >
          <Redo2 className="size-4" aria-hidden />
        </button>
        <button
          type="button"
          onClick={() => {
            if (count === 0 || window.confirm("Clear the page? You can undo this.")) reset();
          }}
          disabled={count === 0}
          className={`${btn.ghost} size-8 px-0 disabled:opacity-40`}
          aria-label="Clear page"
          title="Clear page"
        >
          <RotateCcw className="size-4" aria-hidden />
        </button>
        <button
          type="button"
          onClick={() => setExportOpen(true)}
          className={`${btn.primary} ml-1 h-8 px-3 text-xs`}
        >
          <Code2 className="size-3.5" aria-hidden />
          Export
        </button>
      </span>
    </div>
  );

  return (
    <Layout bare>
      <div className="flex h-[calc(100vh-3.5rem)] flex-col">
        <DndContext
          sensors={sensors}
          collisionDetection={collision}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          onDragCancel={() => setDrag(null)}
        >
          <Group orientation="horizontal" className="min-h-0 flex-1">
            <Panel defaultSize="22%" minSize={180} className="min-w-0">
              <Palette onAddLayout={addLayout} onAddComponent={addComponent} />
            </Panel>
            <Separator className={`w-1 ${sep}`} />
            <Panel minSize={280} className="min-w-0">
              <Group orientation="vertical">
                <Panel defaultSize="55%" minSize={140}>
                  <Canvas names={names} toolbar={toolbar} />
                </Panel>
                <Separator className={`h-1 ${sep}`} />
                <Panel minSize={120}>
                  <PagePreview
                    payload={merged.payload}
                    empty={slugs.length === 0}
                    pending={merged.pending}
                    failed={merged.failed}
                  />
                </Panel>
              </Group>
            </Panel>
            <Separator className={`w-1 ${sep}`} />
            <Panel defaultSize="24%" minSize={200} className="min-w-0">
              <PropsPanel key={selectedId} />
            </Panel>
          </Group>
          <DragOverlay dropAnimation={null}>
            {drag ? (
              <div className="rounded-md border border-foreground bg-background px-2.5 py-1 text-xs font-medium shadow-lg">
                {drag}
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>
      {exportOpen ? <ExportDialog page={page} onClose={() => setExportOpen(false)} /> : null}
    </Layout>
  );
}
