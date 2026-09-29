import * as React from "react";
import { useStore } from "zustand";
import { useVirtualizer } from "@tanstack/react-virtual";
import { addDays, format, startOfDay, startOfWeek } from "date-fns";
import { cn } from "@/lib/utils";
import { buildHierarchy, computeSchedule, dayIndex, fromDay, toDate } from "@/lib/gantt-schedule";
import { createGanttStore, GanttStoreContext, useGantt } from "@/hooks/use-gantt-store";
import { DAY_WIDTH, TimelineHeader } from "@/components/crm/pro-gantt-roadmap/timeline-header";
import { TaskBar } from "@/components/crm/pro-gantt-roadmap/task-bar";
import { DependencyLayer } from "@/components/crm/pro-gantt-roadmap/dependency-layer";
import { GridCell } from "@/components/crm/pro-gantt-roadmap/grid-cell";
import { GanttToolbar } from "@/components/crm/pro-gantt-roadmap/gantt-toolbar";
import { TaskTooltip } from "@/components/crm/pro-gantt-roadmap/task-tooltip";
import type {
  DayTask,
  GanttRow,
  GanttTask,
  GanttZoom,
} from "@/components/crm/pro-gantt-roadmap/types";

export type { GanttTask, GanttZoom } from "@/components/crm/pro-gantt-roadmap/types";
export { computeSchedule, autoSchedule } from "@/lib/gantt-schedule";

export interface ProGanttRoadmapProps {
  /** Controlled tasks. Pair with `onTasksChange`. */
  tasks?: GanttTask[];
  /** Uncontrolled initial tasks. */
  defaultTasks?: GanttTask[];
  /** Fires after a drag/resize/keyboard move is committed (successors already auto-scheduled). */
  onTasksChange?: (tasks: GanttTask[], changedId: string) => void;
  onTaskOpen?: (task: GanttTask) => void;
  defaultZoom?: GanttZoom;
  /** Parent ids collapsed on first render. */
  defaultCollapsed?: string[];
  /** Push successors when a predecessor moves past them. */
  autoSchedule?: boolean;
  showCritical?: boolean;
  showBaseline?: boolean;
  readOnly?: boolean;
  /** Reference "today" for the marker and Today button. */
  today?: Date;
  title?: string;
  height?: number | string;
  rowHeight?: number;
  gridWidth?: number;
  loading?: boolean;
  className?: string;
}

const HEADER_H = 56;

export function ProGanttRoadmap(props: ProGanttRoadmapProps) {
  const [store] = React.useState(() =>
    createGanttStore({
      tasks: props.tasks ?? props.defaultTasks ?? [],
      zoom: props.defaultZoom,
      collapsed: props.defaultCollapsed,
      showCritical: props.showCritical,
      showBaseline: props.showBaseline,
      autoSchedule: props.autoSchedule,
    }),
  );
  // Controlled sync.
  React.useEffect(() => {
    if (props.tasks && props.tasks !== store.getState().tasks)
      store.getState().setTasks(props.tasks);
  }, [props.tasks, store]);
  return (
    <GanttStoreContext.Provider value={store}>
      <GanttView {...props} />
    </GanttStoreContext.Provider>
  );
}

function flatten(
  children: Map<string | null, GanttTask[]>,
  collapsed: ReadonlySet<string>,
): GanttRow[] {
  const rows: GanttRow[] = [];
  const stack: { t: GanttTask; depth: number }[] = [];
  const roots = children.get(null) ?? [];
  for (let i = roots.length - 1; i >= 0; i--) stack.push({ t: roots[i]!, depth: 0 });
  const guard = new Set<string>();
  while (stack.length) {
    const { t, depth } = stack.pop()!;
    if (guard.has(t.id)) continue;
    guard.add(t.id);
    const kids = children.get(t.id) ?? [];
    const expanded = !collapsed.has(t.id);
    rows.push({ task: t, depth, hasChildren: kids.length > 0, expanded, index: rows.length });
    if (expanded)
      for (let i = kids.length - 1; i >= 0; i--) stack.push({ t: kids[i]!, depth: depth + 1 });
  }
  return rows;
}

function GanttView({
  onTasksChange,
  onTaskOpen,
  readOnly,
  today: todayProp,
  title = "Roadmap",
  height = 640,
  rowHeight = 36,
  gridWidth = 340,
  loading,
  className,
}: ProGanttRoadmapProps) {
  const store = React.useContext(GanttStoreContext)!;
  const tasks = useGantt((s) => s.tasks);
  const collapsed = useGantt((s) => s.collapsed);
  const zoom = useGantt((s) => s.zoom);
  const selectedId = useGantt((s) => s.selectedId);
  const showCritical = useGantt((s) => s.showCritical);
  const toggle = useStore(store, (s) => s.toggle);
  const dw = DAY_WIDTH[zoom];
  const today = React.useMemo(() => startOfDay(todayProp ?? new Date()), [todayProp]);

  const { children, span, summaryIds } = React.useMemo(() => buildHierarchy(tasks), [tasks]);
  const schedule = React.useMemo(() => computeSchedule(tasks, summaryIds), [tasks, summaryIds]);
  const rows = React.useMemo(() => flatten(children, collapsed), [children, collapsed]);

  // Timeline axis.
  const { origin, total, projectEnd } = React.useMemo(() => {
    let min = Infinity;
    let max = -Infinity;
    for (const t of tasks) {
      min = Math.min(min, toDate(t.start).getTime(), toDate(t.baselineStart ?? t.start).getTime());
      max = Math.max(max, toDate(t.end).getTime(), toDate(t.baselineEnd ?? t.end).getTime());
    }
    if (!Number.isFinite(min)) {
      min = today.getTime();
      max = addDays(today, 90).getTime();
    }
    const origin = startOfWeek(addDays(new Date(min), -14), { weekStartsOn: 1 });
    const total = Math.max(dayIndex(origin, new Date(max)) + 45, 120);
    return { origin, total, projectEnd: Number.isFinite(max) ? new Date(max) : null };
  }, [tasks, today]);

  const days = React.useMemo(() => {
    const m = new Map<string, DayTask>();
    for (const t of tasks) {
      const sp = span.get(t.id);
      const s = summaryIds.has(t.id) && sp ? new Date(sp.s) : t.start;
      const e = summaryIds.has(t.id) && sp ? new Date(sp.e) : t.end;
      m.set(t.id, {
        id: t.id,
        s: dayIndex(origin, s),
        e: dayIndex(origin, e),
        bs: t.baselineStart != null ? dayIndex(origin, t.baselineStart) : undefined,
        be: t.baselineEnd != null ? dayIndex(origin, t.baselineEnd) : undefined,
      });
    }
    return m;
  }, [tasks, span, summaryIds, origin]);

  const { rowIndex, rowIds, preds, succs } = React.useMemo(() => {
    const rowIndex = new Map<string, number>();
    const rowIds = rows.map((r, i) => {
      rowIndex.set(r.task.id, i);
      return r.task.id;
    });
    const preds = new Map<string, string[]>();
    const succs = new Map<string, string[]>();
    for (const t of tasks) {
      if (!t.dependencies?.length) continue;
      preds.set(t.id, t.dependencies);
      for (const p of t.dependencies) {
        const l = succs.get(p);
        if (l) l.push(t.id);
        else succs.set(p, [t.id]);
      }
    }
    return { rowIndex, rowIds, preds, succs };
  }, [rows, tasks]);

  const scrollRef = React.useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => rowHeight,
    getItemKey: (i) => rows[i]?.task.id ?? i,
    paddingStart: HEADER_H,
    scrollPaddingStart: HEADER_H,
    overscan: 10,
  });
  const vItems = virtualizer.getVirtualItems();
  const timelineW = total * dw;

  // Keep the date under the viewport centre stable across zoom changes.
  const pendingCenter = React.useRef<number | null>(null);
  const setZoom = (z: GanttZoom) => {
    const el = scrollRef.current;
    if (el) pendingCenter.current = (el.scrollLeft + (el.clientWidth - gridWidth) / 2) / dw;
    store.getState().setZoom(z);
  };
  React.useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el || pendingCenter.current == null) return;
    el.scrollLeft = pendingCenter.current * dw - (el.clientWidth - gridWidth) / 2;
    pendingCenter.current = null;
  }, [dw, gridWidth]);

  const scrollToDay = React.useCallback(
    (d: number) => {
      const el = scrollRef.current;
      if (el) el.scrollTo({ left: Math.max(0, d * dw - (el.clientWidth - gridWidth) / 3) });
    },
    [dw, gridWidth],
  );
  React.useEffect(() => {
    scrollToDay(dayIndex(origin, today));
    // only on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const commit = React.useCallback(
    (id: string, ds: number, de: number) => {
      const next = store.getState().commit(id, ds, de);
      if (next) onTasksChange?.(next, id);
    },
    [store, onTasksChange],
  );

  const [hover, setHoverState] = React.useState<{ id: string; el: HTMLElement } | null>(null);
  const onHover = React.useCallback((id: string | null, el: HTMLElement | null) => {
    setHoverState(id && el ? { id, el } : null);
  }, []);
  const preview = useGantt((s) => s.preview);
  const hoverTask = hover && !preview ? (tasks.find((t) => t.id === hover.id) ?? null) : null;

  // Keyboard (treegrid with aria-activedescendant).
  const gridId = React.useId();
  const activeIdx = selectedId != null ? (rowIndex.get(selectedId) ?? -1) : -1;
  const selectRow = (i: number) => {
    const r = rows[Math.max(0, Math.min(rows.length - 1, i))];
    if (!r) return;
    store.getState().select(r.task.id);
    virtualizer.scrollToIndex(r.index, { align: "auto" });
    const d = days.get(r.task.id);
    const el = scrollRef.current;
    if (d && el) {
      const x = d.s * dw;
      if (x < el.scrollLeft || x > el.scrollLeft + el.clientWidth - gridWidth - 40)
        scrollToDay(d.s);
    }
  };
  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return;
    const row = rows[activeIdx];
    let handled = true;
    if (e.key === "ArrowDown") selectRow(activeIdx + 1);
    else if (e.key === "ArrowUp") selectRow(activeIdx < 0 ? 0 : activeIdx - 1);
    else if (e.key === "Home") selectRow(0);
    else if (e.key === "End") selectRow(rows.length - 1);
    else if (e.key === "PageDown") selectRow(activeIdx + 15);
    else if (e.key === "PageUp") selectRow(activeIdx - 15);
    else if (row && e.altKey && (e.key === "ArrowRight" || e.key === "ArrowLeft")) {
      if (readOnly || row.hasChildren) handled = false;
      else {
        const d = e.key === "ArrowRight" ? 1 : -1;
        if (e.shiftKey) commit(row.task.id, 0, d);
        else commit(row.task.id, d, d);
      }
    } else if (row && e.key === "ArrowRight") {
      if (row.hasChildren && !row.expanded) toggle(row.task.id, true);
      else selectRow(activeIdx + 1);
    } else if (row && e.key === "ArrowLeft") {
      if (row.hasChildren && row.expanded) toggle(row.task.id, false);
      else if (row.task.parentId && rowIndex.has(row.task.parentId))
        selectRow(rowIndex.get(row.task.parentId)!);
    } else if (row && e.key === "Enter") onTaskOpen?.(row.task);
    else handled = false;
    if (handled) e.preventDefault();
  };

  const todayX = dayIndex(origin, today) * dw;
  const weekendBg =
    zoom === "day"
      ? {
          backgroundImage: `repeating-linear-gradient(90deg, transparent 0 ${5 * dw}px, var(--color-crm-raised) ${5 * dw}px ${7 * dw}px)`,
          backgroundPositionX: `${(((dayIndex(origin, startOfWeek(origin, { weekStartsOn: 1 })) % 7) + 7) % 7) * dw}px`,
        }
      : undefined;

  const first = vItems[0]?.index ?? 0;
  const last = vItems[vItems.length - 1]?.index ?? -1;
  const active = rows[activeIdx];

  return (
    <section
      aria-label={title}
      className={cn(
        "flex flex-col overflow-hidden rounded-crm border border-crm-border bg-crm-card text-crm-fg shadow-crm-raised",
        className,
      )}
      style={{ height }}
    >
      <GanttToolbar
        title={title}
        stats={{
          tasks: tasks.length,
          critical: schedule.critical.size,
          end: projectEnd,
          cycles: schedule.cyclic.size,
        }}
        onZoom={setZoom}
        onToday={() => scrollToDay(dayIndex(origin, today))}
        onExpandAll={() => store.setState({ collapsed: new Set() })}
        onCollapseAll={() => store.setState({ collapsed: new Set(summaryIds) })}
      />
      {loading ? (
        <div aria-busy="true" aria-label="Loading roadmap" className="flex-1 space-y-2 p-4">
          {Array.from({ length: 10 }, (_, i) => (
            <div key={i} className="flex animate-pulse items-center gap-4">
              <div className="h-3 w-56 rounded bg-crm-muted" />
              <div
                className="h-4 rounded bg-crm-muted"
                style={{ marginLeft: (i * 37) % 200, width: 80 + ((i * 53) % 160) }}
              />
            </div>
          ))}
        </div>
      ) : !tasks.length ? (
        <div className="flex flex-1 items-center justify-center p-6 text-sm text-crm-muted-fg">
          No tasks yet. Add tasks with start and end dates to plan your roadmap.
        </div>
      ) : (
        <div
          ref={scrollRef}
          role="treegrid"
          aria-label={`${title} tasks`}
          aria-rowcount={rows.length}
          aria-activedescendant={active ? `${gridId}-${active.task.id}` : undefined}
          aria-readonly={readOnly || undefined}
          tabIndex={0}
          onKeyDown={onKeyDown}
          className="relative min-h-0 flex-1 overflow-auto overscroll-contain focus-visible:outline-none"
        >
          <div
            className="relative"
            style={{ width: gridWidth + timelineW, height: virtualizer.getTotalSize() }}
          >
            <TimelineHeader
              scrollRef={scrollRef}
              origin={origin}
              total={total}
              zoom={zoom}
              gridWidth={gridWidth}
              height={HEADER_H}
              key={zoom}
              corner={
                <div className="flex w-full items-center px-3 pb-2 crm-eyebrow text-crm-muted-fg">
                  <span className="flex-1">Task</span>
                  <span className="w-16">Start</span>
                  <span className="w-10 text-right">Dur</span>
                </div>
              }
            />
            <div
              aria-hidden
              className="absolute bottom-0"
              style={{ left: gridWidth, top: HEADER_H, width: timelineW, ...weekendBg }}
            />
            {todayX >= 0 && todayX <= timelineW && (
              <div
                aria-hidden
                className="absolute bottom-0 w-px bg-crm-primary"
                style={{ left: gridWidth + todayX, top: HEADER_H - 4 }}
              >
                <span className="absolute -top-1 -left-[3px] size-[7px] rounded-full bg-crm-primary" />
              </div>
            )}
            <DependencyLayer
              first={first}
              last={last}
              rowIndex={rowIndex}
              rowIds={rowIds}
              days={days}
              preds={preds}
              succs={succs}
              schedule={schedule}
              dayWidth={dw}
              rowHeight={rowHeight}
              top={HEADER_H}
              left={gridWidth}
              width={timelineW}
              height={rows.length * rowHeight}
            />
            {vItems.map((vi) => {
              const row = rows[vi.index]!;
              const t = row.task;
              const d = days.get(t.id)!;
              const summary = row.hasChildren;
              const sp = span.get(t.id);
              const crit = showCritical && schedule.critical.has(t.id) && !summary;
              const conflict = (t.dependencies ?? []).some((p) =>
                schedule.violations.has(`${p}->${t.id}`),
              );
              const selected = t.id === selectedId;
              return (
                <div
                  key={vi.key}
                  id={`${gridId}-${t.id}`}
                  role="row"
                  aria-level={row.depth + 1}
                  aria-expanded={row.hasChildren ? row.expanded : undefined}
                  aria-selected={selected}
                  aria-rowindex={vi.index + 1}
                  aria-label={`${t.name}, ${format(toDate(t.start), "d MMM")}${t.milestone ? " milestone" : ` to ${format(toDate(t.end), "d MMM")}`}${crit ? ", critical" : ""}`}
                  onClick={() => store.getState().select(t.id)}
                  onDoubleClick={() => onTaskOpen?.(t)}
                  className={cn(
                    "group/row absolute top-0 left-0 flex border-b border-crm-border/60",
                    selected ? "bg-crm-muted/40" : "hover:bg-crm-raised/60",
                  )}
                  style={{
                    transform: `translateY(${vi.start}px)`,
                    height: rowHeight,
                    width: gridWidth + timelineW,
                  }}
                >
                  <GridCell
                    row={row}
                    width={gridWidth}
                    start={summary && sp ? new Date(sp.s) : toDate(t.start)}
                    days={Math.max(0, d.e - d.s)}
                    critical={crit}
                    selected={selected}
                    onToggle={toggle}
                  />
                  <div
                    role="gridcell"
                    className="absolute inset-y-0 z-10"
                    style={{ left: gridWidth, width: timelineW }}
                  >
                    <TaskBar
                      id={t.id}
                      name={t.name}
                      s={d.s}
                      e={d.e}
                      bs={d.bs}
                      be={d.be}
                      dayWidth={dw}
                      rowHeight={rowHeight}
                      progress={summary && sp ? sp.progress / (sp.weight || 1) : (t.progress ?? 0)}
                      summary={summary}
                      milestone={!!t.milestone}
                      critical={crit}
                      conflict={conflict}
                      color={t.color}
                      readOnly={readOnly}
                      onCommit={commit}
                      onHover={onHover}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
      <TaskTooltip
        task={hoverTask}
        anchor={hover?.el ?? null}
        slack={hoverTask ? schedule.slack.get(hoverTask.id) : undefined}
        critical={!!hoverTask && schedule.critical.has(hoverTask.id)}
      />
      <p className="sr-only" aria-live="polite">
        {active
          ? `${active.task.name}: ${format(toDate(active.task.start), "d MMM yyyy")}${active.task.milestone ? "" : ` to ${format(fromDay(origin, days.get(active.task.id)?.e ?? 0), "d MMM yyyy")}`}`
          : ""}
      </p>
    </section>
  );
}
