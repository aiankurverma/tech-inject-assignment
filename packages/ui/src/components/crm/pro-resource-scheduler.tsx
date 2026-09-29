import * as React from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { TZDate } from "@date-fns/tz";
import { format } from "date-fns";
import { AlertTriangle, ChevronLeft, ChevronRight, Globe, Search } from "lucide-react";
import { Button } from "@/components/crm/button";
import { EventPopover } from "@/components/crm/pro-resource-scheduler/event-popover";
import { layoutRow, type RowLayout } from "@/components/crm/pro-resource-scheduler/layout";
import { expandEvent } from "@/components/crm/pro-resource-scheduler/recurrence";
import { ResourceRow, rowHeight } from "@/components/crm/pro-resource-scheduler/resource-row";
import {
  createSchedulerStore,
  type DragPreview,
} from "@/components/crm/pro-resource-scheduler/store";
import { buildScale, shiftAnchor } from "@/components/crm/pro-resource-scheduler/time-scale";
import type {
  SchedulerChange,
  SchedulerEvent,
  SchedulerOccurrence,
  SchedulerResource,
  SchedulerView,
} from "@/components/crm/pro-resource-scheduler/types";
import { useSchedulerDrag } from "@/hooks/use-scheduler-drag";
import { cn } from "@/lib/utils";

export * from "@/components/crm/pro-resource-scheduler/types";
export {
  expandEvent,
  describeRecurrence,
} from "@/components/crm/pro-resource-scheduler/recurrence";

export interface ProResourceSchedulerProps {
  resources: SchedulerResource[];
  /** Controlled events. Pair with `onEventsChange`. */
  events?: SchedulerEvent[];
  defaultEvents?: SchedulerEvent[];
  onEventsChange?: (next: SchedulerEvent[]) => void;
  /** Semantic change log (create / update / detach occurrence / delete). */
  onChange?: (change: SchedulerChange) => void;
  view?: SchedulerView;
  defaultView?: SchedulerView;
  onViewChange?: (v: SchedulerView) => void;
  /** Date shown (any instant inside the range). */
  date?: Date;
  defaultDate?: Date;
  onDateChange?: (d: Date) => void;
  timeZone?: string;
  defaultTimeZone?: string;
  onTimeZoneChange?: (tz: string) => void;
  /** Zones offered in the switcher. */
  timeZones?: string[];
  weekStartsOn?: 0 | 1;
  /** When false, drops that overlap another booking are rejected. Default true (flagged only). */
  allowConflicts?: boolean;
  readOnly?: boolean;
  loading?: boolean;
  /** Title for drag-created bookings. */
  newEventTitle?: string;
  labelWidth?: number;
  height?: number;
  renderEventDetails?: (occ: SchedulerOccurrence) => React.ReactNode;
  className?: string;
}

const VIEWS: SchedulerView[] = ["day", "week", "month"];
let seq = 0;

function useControllable<T>(value: T | undefined, initial: T, onChange?: (v: T) => void) {
  const [inner, setInner] = React.useState(initial);
  const current = value !== undefined ? value : inner;
  const set = React.useCallback(
    (v: T) => {
      if (value === undefined) setInner(v);
      onChange?.(v);
    },
    [value, onChange],
  );
  return [current, set] as const;
}

export function ProResourceScheduler({
  resources,
  events: controlledEvents,
  defaultEvents = [],
  onEventsChange,
  onChange,
  view: viewProp,
  defaultView = "week",
  onViewChange,
  date: dateProp,
  defaultDate,
  onDateChange,
  timeZone: tzProp,
  defaultTimeZone,
  onTimeZoneChange,
  timeZones,
  weekStartsOn = 1,
  allowConflicts = true,
  readOnly,
  loading,
  newEventTitle = "New booking",
  labelWidth = 200,
  height = 620,
  renderEventDetails,
  className,
}: ProResourceSchedulerProps) {
  const localTz = React.useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone, []);
  const [events, setEvents] = useControllable(controlledEvents, defaultEvents, onEventsChange);
  const [view, setView] = useControllable(viewProp, defaultView, onViewChange);
  const [date, setDate] = useControllable(dateProp, defaultDate ?? new Date(), onDateChange);
  const [tz, setTz] = useControllable(tzProp, defaultTimeZone ?? localTz, onTimeZoneChange);
  const [filter, setFilter] = React.useState("");
  const q = React.useDeferredValue(filter.trim().toLowerCase());
  const [announce, setAnnounce] = React.useState("");
  const [store] = React.useState(createSchedulerStore);
  const [selected, setSelected] = React.useState<SchedulerOccurrence | null>(null);
  const barRefs = React.useRef(new Map<string, HTMLElement>());
  const [anchorEl, setAnchorEl] = React.useState<HTMLElement | null>(null);
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const timelineRef = React.useRef<HTMLDivElement>(null);

  const scale = React.useMemo(
    () => buildScale(view, +date, tz, weekStartsOn),
    [view, date, tz, weekStartsOn],
  );

  const shown = React.useMemo(
    () =>
      q
        ? resources.filter(
            (r) => r.name.toLowerCase().includes(q) || r.subtitle?.toLowerCase().includes(q),
          )
        : resources,
    [resources, q],
  );

  const { occByResource, layouts, conflicts } = React.useMemo(() => {
    const occByResource = new Map<string, SchedulerOccurrence[]>();
    for (const ev of events) {
      for (const o of expandEvent(ev, scale.start, scale.end, tz)) {
        const list = occByResource.get(o.resourceId);
        if (list) list.push(o);
        else occByResource.set(o.resourceId, [o]);
      }
    }
    const conflicts = new Set<string>();
    const layouts = new Map<string, RowLayout>();
    for (const [rid, list] of occByResource) layouts.set(rid, layoutRow(list, conflicts));
    return { occByResource, layouts, conflicts };
  }, [events, scale.start, scale.end, tz]);

  const disabledResources = React.useMemo(
    () => new Set(resources.filter((r) => r.disabled).map((r) => r.id)),
    [resources],
  );
  const resourceById = React.useMemo(() => new Map(resources.map((r) => [r.id, r])), [resources]);
  const EMPTY: RowLayout = React.useMemo(() => ({ items: [], lanes: 1 }), []);

  const virtualizer = useVirtualizer({
    count: loading ? 14 : shown.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: (i) => (loading ? 38 : rowHeight(layouts.get(shown[i]!.id)?.lanes ?? 1)),
    getItemKey: (i) => (loading ? `sk-${i}` : shown[i]!.id),
    overscan: 6,
  });
  React.useEffect(() => virtualizer.measure(), [layouts, shown, virtualizer]);

  // Scroll to "now" (or range start) when the range changes.
  React.useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const now = Date.now();
    const target =
      now > scale.start && now < scale.end
        ? scale.toX(now)
        : scale.view === "day"
          ? scale.toX(scale.start + 7 * 3_600_000)
          : 0;
    el.scrollLeft = Math.max(0, target - 120);
  }, [scale]);

  const fmt = (t: number, p: string) => format(new TZDate(t, tz), p);

  const commit = React.useCallback(
    (p: DragPreview, occ: SchedulerOccurrence | null) => {
      setSelected(null);
      store.getState().select(null);
      if (!allowConflicts && p.conflict) {
        setAnnounce("Rejected: that time overlaps another booking.");
        return;
      }
      const iso = (t: number) => new Date(t).toISOString();
      if (!occ) {
        const ev: SchedulerEvent = {
          id: `evt-${Date.now().toString(36)}-${++seq}`,
          resourceId: p.resourceId,
          title: newEventTitle,
          start: iso(p.start),
          end: iso(p.end),
        };
        setEvents([...events, ev]);
        onChange?.({ type: "create", event: ev });
        setAnnounce(`Created booking ${fmt(p.start, "EEE HH:mm")} to ${fmt(p.end, "HH:mm")}.`);
        return;
      }
      if (p.start === occ.start && p.end === occ.end && p.resourceId === occ.resourceId) return;
      const ev = occ.event;
      if (ev.recurrence && occ.occurrenceStart !== undefined) {
        const series: SchedulerEvent = {
          ...ev,
          recurrence: {
            ...ev.recurrence,
            exdates: [...(ev.recurrence.exdates ?? []), iso(occ.occurrenceStart)],
          },
        };
        const single: SchedulerEvent = {
          ...ev,
          id: `${ev.id}-x${++seq}`,
          recurrence: undefined,
          resourceId: p.resourceId,
          start: iso(p.start),
          end: iso(p.end),
        };
        setEvents([...events.map((e) => (e.id === ev.id ? series : e)), single]);
        onChange?.({ type: "detach", series, event: single });
      } else {
        const next: SchedulerEvent = {
          ...ev,
          resourceId: p.resourceId,
          start: iso(p.start),
          end: iso(p.end),
        };
        setEvents(events.map((e) => (e.id === ev.id ? next : e)));
        onChange?.({ type: "update", event: next, previous: ev });
      }
      const res = resourceById.get(p.resourceId)?.name ?? "";
      setAnnounce(
        `${ev.title} moved to ${res}, ${fmt(p.start, "EEE HH:mm")} to ${fmt(p.end, "HH:mm")}${p.conflict ? " (conflict)" : ""}.`,
      );
    },
    // fmt depends on tz only
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [allowConflicts, events, newEventTitle, onChange, resourceById, setEvents, store, tz],
  );

  const remove = React.useCallback(
    (occ: SchedulerOccurrence, series: boolean) => {
      const ev = occ.event;
      if (ev.recurrence && occ.occurrenceStart !== undefined && !series) {
        const next: SchedulerEvent = {
          ...ev,
          recurrence: {
            ...ev.recurrence,
            exdates: [
              ...(ev.recurrence.exdates ?? []),
              new Date(occ.occurrenceStart).toISOString(),
            ],
          },
        };
        setEvents(events.map((e) => (e.id === ev.id ? next : e)));
        onChange?.({ type: "delete", event: ev, occurrenceStart: occ.occurrenceStart });
      } else {
        setEvents(events.filter((e) => e.id !== ev.id));
        onChange?.({ type: "delete", event: ev });
      }
      setSelected(null);
      store.getState().select(null);
      setAnnounce(`Deleted ${ev.title}.`);
    },
    [events, onChange, setEvents, store],
  );

  const openOcc = React.useCallback(
    (occ: SchedulerOccurrence) => {
      setSelected(occ);
      setAnchorEl(barRefs.current.get(occ.key) ?? null);
      store.getState().select(occ.key);
    },
    [store],
  );
  const close = React.useCallback(() => {
    setSelected(null);
    store.getState().select(null);
  }, [store]);

  const onPointerDown = useSchedulerDrag({
    scale,
    store,
    occByResource,
    timelineRef,
    scrollRef,
    disabledResources,
    onCommit: commit,
    onClick: openOcc,
    readOnly,
  });

  const onKeyNudge = React.useCallback(
    (occ: SchedulerOccurrence, e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        return openOcc(occ);
      }
      if (readOnly || occ.event.locked) return;
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        return remove(occ, false);
      }
      const dir = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
      if (!dir) return;
      e.preventDefault();
      const step = scale.snapMs * dir;
      const start = e.shiftKey ? occ.start : occ.start + step;
      const end = Math.max(start + scale.snapMs, occ.end + step);
      const others = occByResource.get(occ.resourceId) ?? [];
      const conflict = others.some(
        (o) => o.event.id !== occ.event.id && o.start < end && start < o.end,
      );
      commit(
        {
          mode: "move",
          key: occ.key,
          eventId: occ.event.id,
          resourceId: occ.resourceId,
          start,
          end,
          conflict,
        },
        occ,
      );
    },
    [commit, occByResource, openOcc, readOnly, remove, scale.snapMs],
  );

  const setBarRef = React.useCallback((key: string, el: HTMLElement | null) => {
    if (el) barRefs.current.set(key, el);
    else barRefs.current.delete(key);
  }, []);

  const zones = React.useMemo(
    () => [
      ...new Set([
        tz,
        localTz,
        ...(timeZones ?? [
          "UTC",
          "America/New_York",
          "Europe/London",
          "Asia/Kolkata",
          "Asia/Tokyo",
        ]),
      ]),
    ],
    [tz, localTz, timeZones],
  );
  const now = Date.now();
  const nowX = now >= scale.start && now < scale.end ? scale.toX(now) : null;
  const rangeLabel =
    view === "day"
      ? fmt(scale.start, "EEEE, d MMMM yyyy")
      : view === "week"
        ? `${fmt(scale.start, "d MMM")} – ${fmt(scale.end - 1, "d MMM yyyy")}`
        : fmt(scale.start, "MMMM yyyy");

  return (
    <div
      className={cn(
        "flex w-full flex-col overflow-hidden rounded-crm border border-crm-border bg-crm-bg text-crm-fg shadow-crm-raised",
        className,
      )}
    >
      <div className="flex flex-wrap items-center gap-2 border-b border-crm-border px-3 py-2">
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant="ghost"
            aria-label="Previous"
            onClick={() => setDate(new Date(shiftAnchor(view, +date, -1, tz)))}
          >
            <ChevronLeft className="size-3.5" />
          </Button>
          <Button size="sm" onClick={() => setDate(new Date())}>
            Today
          </Button>
          <Button
            size="sm"
            variant="ghost"
            aria-label="Next"
            onClick={() => setDate(new Date(shiftAnchor(view, +date, 1, tz)))}
          >
            <ChevronRight className="size-3.5" />
          </Button>
        </div>
        <h2 className="text-sm font-medium" aria-live="polite">
          {rangeLabel}
        </h2>
        {conflicts.size > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full bg-crm-danger/15 px-2 py-0.5 text-[11px] text-crm-danger">
            <AlertTriangle className="size-3" aria-hidden />
            {conflicts.size} conflicting
          </span>
        )}
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <label className="relative flex items-center">
            <Search className="pointer-events-none absolute left-2 size-3.5 text-crm-muted-fg" />
            <span className="sr-only">Filter resources</span>
            <input
              type="search"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder={`Filter ${resources.length.toLocaleString()} resources`}
              className="h-7 w-48 rounded-full border border-crm-border bg-crm-raised pr-2 pl-7 text-xs outline-none focus:ring-2 focus:ring-crm-ring"
            />
          </label>
          <label className="flex items-center gap-1 text-xs text-crm-muted-fg">
            <Globe className="size-3.5" aria-hidden />
            <span className="sr-only">Time zone</span>
            <select
              value={tz}
              onChange={(e) => setTz(e.target.value)}
              className="h-7 rounded-full border border-crm-border bg-crm-raised px-2 text-xs text-crm-fg"
            >
              {zones.map((z) => (
                <option key={z} value={z}>
                  {z}
                </option>
              ))}
            </select>
          </label>
          <div role="radiogroup" aria-label="Zoom" className="flex rounded-full bg-crm-muted p-0.5">
            {VIEWS.map((v) => (
              <button
                key={v}
                role="radio"
                aria-checked={view === v}
                onClick={() => setView(v)}
                className={cn(
                  "rounded-full px-2.5 py-1 text-xs capitalize",
                  view === v ? "bg-crm-raised text-crm-fg shadow-crm-raised" : "text-crm-muted-fg",
                )}
              >
                {v}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div
        ref={scrollRef}
        role="grid"
        aria-label="Resource schedule"
        aria-rowcount={shown.length + 1}
        aria-busy={loading || undefined}
        className="relative overflow-auto overscroll-contain"
        style={{ height }}
      >
        <div style={{ width: labelWidth + scale.width }}>
          <div role="row" className="sticky top-0 z-30 flex border-b border-crm-border bg-crm-card">
            <div
              role="columnheader"
              className="sticky left-0 z-10 flex shrink-0 items-end border-r border-crm-border bg-crm-card px-3 pb-1.5 text-[11px] text-crm-muted-fg"
              style={{ width: labelWidth }}
            >
              {shown.length.toLocaleString()} resources
            </div>
            <div className="relative h-12 shrink-0" style={{ width: scale.width }}>
              {scale.major.map((m) => (
                <div
                  key={m.x}
                  className="absolute top-0 h-6 truncate border-l border-crm-border px-1.5 pt-1 text-[11px] font-medium text-crm-soft"
                  style={{ left: m.x, width: m.w }}
                >
                  {m.label}
                </div>
              ))}
              {scale.minor.map((m) => (
                <div
                  key={m.x}
                  role="columnheader"
                  className={cn(
                    "absolute top-6 h-6 border-l border-crm-border pt-1 pl-1 text-[10px]",
                    m.weekend ? "text-crm-subtle" : "text-crm-muted-fg",
                  )}
                  style={{ left: m.x }}
                >
                  {m.label}
                </div>
              ))}
            </div>
          </div>

          <div
            ref={timelineRef}
            className="pointer-events-none absolute"
            style={{ left: labelWidth, top: 0, width: scale.width, height: 1 }}
          />
          <div className="relative" style={{ height: virtualizer.getTotalSize() }}>
            <div
              aria-hidden
              className="pointer-events-none absolute inset-y-0"
              style={{ left: labelWidth, width: scale.width }}
            >
              {scale.minor.map((m, i) => {
                const next = scale.minor[i + 1]?.x ?? scale.width;
                return (
                  <div
                    key={m.x}
                    className={cn(
                      "absolute inset-y-0 border-l border-crm-border/60",
                      m.weekend && "bg-crm-muted/15",
                    )}
                    style={{ left: m.x, width: next - m.x }}
                  />
                );
              })}
              {nowX !== null && (
                <div
                  className="absolute inset-y-0 z-10 w-px bg-crm-danger"
                  style={{ left: nowX }}
                />
              )}
            </div>
            {virtualizer.getVirtualItems().map((v) => {
              const style: React.CSSProperties = {
                position: "absolute",
                top: 0,
                left: 0,
                transform: `translateY(${v.start}px)`,
              };
              if (loading) {
                return (
                  <div
                    key={v.key}
                    style={{ ...style, height: v.size, width: labelWidth + scale.width }}
                    className="flex items-center gap-3 border-b border-crm-border px-3"
                  >
                    <div className="h-3 w-32 animate-pulse rounded bg-crm-muted" />
                    <div
                      className="h-4 animate-pulse rounded bg-crm-muted/60"
                      style={{
                        marginLeft: 60 + ((v.index * 97) % 300),
                        width: 120 + ((v.index * 53) % 160),
                      }}
                    />
                  </div>
                );
              }
              const r = shown[v.index]!;
              return (
                <div key={v.key} style={style}>
                  <ResourceRow
                    resource={r}
                    rowIndex={v.index}
                    layout={layouts.get(r.id) ?? EMPTY}
                    scale={scale}
                    conflicts={conflicts}
                    store={store}
                    labelWidth={labelWidth}
                    onPointerDown={onPointerDown}
                    onKeyNudge={onKeyNudge}
                    setBarRef={setBarRef}
                  />
                </div>
              );
            })}
          </div>
          {!loading && shown.length === 0 && (
            <p className="sticky left-0 p-6 text-sm text-crm-muted-fg">
              {q ? `No resources match "${q}".` : "No resources to schedule."}
            </p>
          )}
        </div>
      </div>
      <div className="flex items-center justify-between border-t border-crm-border px-3 py-1.5 text-[11px] text-crm-muted-fg">
        <span>
          Drag empty space to book · drag bars to move or across rows · edges to resize · arrows
          nudge, shift+arrows resize
        </span>
        <span role="status" aria-live="polite" className="truncate pl-3 text-crm-soft">
          {announce}
        </span>
      </div>
      <EventPopover
        occ={selected}
        anchor={anchorEl}
        resource={selected ? resourceById.get(selected.resourceId) : undefined}
        timeZone={tz}
        conflict={!!selected && conflicts.has(selected.key)}
        readOnly={readOnly}
        onClose={close}
        onDelete={remove}
        renderDetails={renderEventDetails}
      />
    </div>
  );
}
