import * as React from "react";
import { AlertTriangle, CheckCircle2, Sparkles, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";
import { Progress } from "@/components/crm/progress";
import { SegmentedControl } from "@/components/crm/segmented-control";

export type RoomCleanStatus = "dirty" | "cleaning" | "clean" | "inspected" | "out-of-order";
export type RoomOccupancy = "vacant" | "occupied" | "departure" | "arrival";

export interface HousekeepingRoom {
  number: string;
  floor: number;
  type: string;
  status: RoomCleanStatus;
  occupancy: RoomOccupancy;
  attendant?: string;
  /** Guest arriving today expects room by this time, e.g. "14:00". */
  dueBy?: string;
  note?: string;
}

export interface HotelHousekeepingProps {
  rooms: HousekeepingRoom[];
  onRoomsChange?: (rooms: HousekeepingRoom[]) => void;
  attendants: string[];
  /** Cleaning credits per room type (default 1). Departures count 1.5x. */
  credits?: Record<string, number>;
  className?: string;
}

const flow: RoomCleanStatus[] = ["dirty", "cleaning", "clean", "inspected"];

const statusStyle: Record<RoomCleanStatus, { label: string; cls: string }> = {
  dirty: { label: "Dirty", cls: "border-tag-red-border bg-tag-red-bg text-tag-red-text" },
  cleaning: {
    label: "Cleaning",
    cls: "border-tag-amber-border bg-tag-amber-bg text-tag-amber-text",
  },
  clean: { label: "Clean", cls: "border-tag-blue-border bg-tag-blue-bg text-tag-blue-text" },
  inspected: {
    label: "Inspected",
    cls: "border-tag-green-border bg-tag-green-bg text-tag-green-text",
  },
  "out-of-order": {
    label: "Out of order",
    cls: "border-tag-neutral-border bg-tag-neutral-bg text-tag-neutral-text line-through",
  },
};

const occLabel: Record<RoomOccupancy, string> = {
  vacant: "VAC",
  occupied: "OCC",
  departure: "DEP",
  arrival: "ARR",
};

/** Room status board: advance cleaning status, assign attendants, balance workload credits. */
export function HotelHousekeeping({
  rooms: roomsProp,
  onRoomsChange,
  attendants,
  credits = {},
  className,
}: HotelHousekeepingProps) {
  const [inner, setInner] = React.useState(roomsProp);
  const rooms = onRoomsChange ? roomsProp : inner;
  const update = (next: HousekeepingRoom[]) => {
    setInner(next);
    onRoomsChange?.(next);
  };
  const patch = (num: string, p: Partial<HousekeepingRoom>) =>
    update(rooms.map((r) => (r.number === num ? { ...r, ...p } : r)));

  const [filter, setFilter] = React.useState<"all" | RoomCleanStatus | "priority">("all");

  const creditOf = (r: HousekeepingRoom) =>
    (credits[r.type] ?? 1) * (r.occupancy === "departure" ? 1.5 : 1);

  const workload = React.useMemo(() => {
    const m = new Map<string, { total: number; done: number }>();
    for (const a of attendants) m.set(a, { total: 0, done: 0 });
    for (const r of rooms) {
      if (!r.attendant || r.status === "out-of-order") continue;
      const w = m.get(r.attendant) ?? { total: 0, done: 0 };
      w.total += creditOf(r);
      if (r.status === "clean" || r.status === "inspected") w.done += creditOf(r);
      m.set(r.attendant, w);
    }
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rooms, attendants, credits]);

  const isPriority = (r: HousekeepingRoom) =>
    r.occupancy === "arrival" && r.status !== "inspected" && r.status !== "out-of-order";

  const visible = rooms.filter((r) =>
    filter === "all" ? true : filter === "priority" ? isPriority(r) : r.status === filter,
  );
  const floors = Array.from(new Set(visible.map((r) => r.floor))).sort((a, b) => a - b);
  const sellable = rooms.filter((r) => r.status !== "out-of-order");
  const ready = sellable.filter((r) => r.status === "inspected").length;
  const unassigned = rooms.filter(
    (r) => !r.attendant && r.status !== "inspected" && r.status !== "out-of-order",
  ).length;

  const advance = (r: HousekeepingRoom) => {
    if (r.status === "out-of-order") return;
    const i = flow.indexOf(r.status);
    patch(r.number, { status: flow[(i + 1) % flow.length] });
  };

  const countOf = (s: RoomCleanStatus) => rooms.filter((r) => r.status === s).length;

  return (
    <section
      aria-label="Housekeeping board"
      className={cn(
        "flex flex-col gap-3 rounded-crm border border-crm-border bg-crm-card p-3 font-crm text-crm-fg shadow-crm-raised",
        className,
      )}
    >
      <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-center">
        <Progress
          label={`${ready} of ${sellable.length} rooms ready`}
          value={ready}
          max={Math.max(1, sellable.length)}
          tone="success"
          showValue
        />
        {unassigned > 0 && (
          <span className="inline-flex items-center gap-1 text-xs text-crm-warning">
            <AlertTriangle className="size-3.5" /> {unassigned} rooms unassigned
          </span>
        )}
      </div>

      <SegmentedControl
        label="Filter rooms"
        size="sm"
        value={filter}
        onValueChange={(v) => setFilter(v as typeof filter)}
        className="max-w-full overflow-x-auto"
        options={[
          { value: "all", label: "All", count: rooms.length },
          { value: "priority", label: "Arrivals first", count: rooms.filter(isPriority).length },
          { value: "dirty", label: "Dirty", count: countOf("dirty") },
          { value: "cleaning", label: "Cleaning", count: countOf("cleaning") },
          { value: "clean", label: "Clean", count: countOf("clean") },
          { value: "inspected", label: "Inspected", count: countOf("inspected") },
        ]}
      />

      <div className="grid gap-3 lg:grid-cols-[1fr_220px]">
        <div className="flex flex-col gap-3">
          {floors.length === 0 && (
            <p className="py-8 text-center text-xs text-crm-soft">No rooms in this view.</p>
          )}
          {floors.map((f) => (
            <div key={f}>
              <h4 className="crm-eyebrow mb-1.5 text-crm-soft">Floor {f}</h4>
              <ul className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-2">
                {visible
                  .filter((r) => r.floor === f)
                  .sort((a, b) => a.number.localeCompare(b.number))
                  .map((r) => {
                    const s = statusStyle[r.status];
                    const ooo = r.status === "out-of-order";
                    return (
                      <li
                        key={r.number}
                        className={cn(
                          "flex flex-col gap-1.5 rounded-crm border border-crm-border p-2 text-xs",
                          isPriority(r) && "ring-1 ring-crm-warning/60",
                        )}
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-sm font-medium tabular-nums">{r.number}</span>
                          <span className="crm-caption text-crm-soft">
                            {r.type} · {occLabel[r.occupancy]}
                          </span>
                        </div>
                        <button
                          type="button"
                          disabled={ooo}
                          onClick={() => advance(r)}
                          aria-label={`Room ${r.number}: ${s.label}. Advance status`}
                          className={cn(
                            "inline-flex h-6 items-center justify-center gap-1 rounded-full border px-2 font-medium focus-visible:ring-2 focus-visible:ring-crm-ring/60 focus-visible:outline-none disabled:cursor-not-allowed",
                            s.cls,
                          )}
                        >
                          {r.status === "inspected" ? (
                            <CheckCircle2 className="size-3" />
                          ) : r.status === "cleaning" ? (
                            <Sparkles className="size-3" />
                          ) : null}
                          {s.label}
                        </button>
                        <label className="flex items-center gap-1 text-crm-soft">
                          <UserRound className="size-3 shrink-0" />
                          <span className="sr-only">Attendant for room {r.number}</span>
                          <select
                            value={r.attendant ?? ""}
                            disabled={ooo}
                            onChange={(e) =>
                              patch(r.number, { attendant: e.target.value || undefined })
                            }
                            className="h-6 min-w-0 flex-1 rounded-crm border border-crm-input/70 bg-crm-raised px-1 text-crm-fg focus-visible:ring-2 focus-visible:ring-crm-ring/60 focus-visible:outline-none"
                          >
                            <option value="">Unassigned</option>
                            {attendants.map((a) => (
                              <option key={a} value={a}>
                                {a}
                              </option>
                            ))}
                          </select>
                        </label>
                        {(r.dueBy || r.note) && (
                          <p className="crm-caption text-crm-soft">
                            {r.dueBy && <span className="text-crm-warning">Due {r.dueBy}. </span>}
                            {r.note}
                          </p>
                        )}
                      </li>
                    );
                  })}
              </ul>
            </div>
          ))}
        </div>

        <aside aria-label="Attendant workload" className="flex flex-col gap-2">
          <h4 className="crm-eyebrow text-crm-soft">Workload (credits)</h4>
          {Array.from(workload.entries()).map(([name, w]) => (
            <Progress
              key={name}
              size="sm"
              label={`${name} · ${w.done}/${w.total}`}
              value={w.done}
              max={Math.max(1, w.total)}
              tone={w.total > 12 ? "danger" : w.total > 9 ? "warning" : "primary"}
            />
          ))}
          <p className="crm-caption text-crm-soft">
            Departures weigh 1.5x. Over 12 credits flags an overloaded attendant.
          </p>
        </aside>
      </div>
    </section>
  );
}
