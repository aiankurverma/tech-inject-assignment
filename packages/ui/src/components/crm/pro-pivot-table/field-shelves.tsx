import * as React from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import * as Popover from "@radix-ui/react-popover";
import { Check, Columns3, Filter, GripVertical, MoreHorizontal, Rows3, Sigma } from "lucide-react";
import { cn } from "@/lib/utils";
import { AGGREGATOR_LABELS, type PivotAggregator, type PivotField } from "@/lib/pro-pivot";
import type { PivotAction, PivotLayout, PivotZone } from "@/hooks/use-pivot-config";

const ZONES: {
  zone: PivotZone;
  label: string;
  icon: React.ReactNode;
  accepts: "dimension" | "measure";
}[] = [
  {
    zone: "filters",
    label: "Filters",
    icon: <Filter className="size-3.5" />,
    accepts: "dimension",
  },
  { zone: "cols", label: "Columns", icon: <Columns3 className="size-3.5" />, accepts: "dimension" },
  { zone: "rows", label: "Rows", icon: <Rows3 className="size-3.5" />, accepts: "dimension" },
  { zone: "values", label: "Values", icon: <Sigma className="size-3.5" />, accepts: "measure" },
];
const ZONE_LABEL: Record<PivotZone, string> = {
  rows: "Rows",
  cols: "Columns",
  values: "Values",
  filters: "Filters",
};

interface DragPayload {
  field: string;
  from: PivotZone | null;
  index: number;
}

const accepts = <T,>(f: PivotField<T> | undefined, a: "dimension" | "measure") =>
  !!f && (f.kind === "both" || f.kind === a);

export interface FieldShelvesProps<T> {
  fields: PivotField<T>[];
  layout: PivotLayout;
  dispatch: (a: PivotAction) => void;
  /** Distinct members per dimension for the filter popovers (computed lazily). */
  getMembers: (field: string) => string[];
  disabled?: boolean;
}

export function FieldShelves<T>({
  fields,
  layout,
  dispatch,
  getMembers,
  disabled,
}: FieldShelvesProps<T>) {
  const byKey = React.useMemo(() => new Map(fields.map((f) => [f.key, f])), [fields]);
  const drag = React.useRef<DragPayload | null>(null);
  const [overZone, setOverZone] = React.useState<PivotZone | null>(null);
  const used = new Set([...layout.rows, ...layout.cols]);
  const list = (z: PivotZone) =>
    z === "values"
      ? layout.values.map((v) => v.field)
      : z === "filters"
        ? layout.filterFields
        : layout[z];

  const drop = (zone: PivotZone, index?: number) => {
    const p = drag.current;
    drag.current = null;
    setOverZone(null);
    if (!p) return;
    const acc = ZONES.find((z) => z.zone === zone)!.accepts;
    if (!accepts(byKey.get(p.field), acc)) return;
    if (p.from === zone && index !== undefined) {
      dispatch({ type: "reorder", zone, from: p.index, to: index > p.index ? index - 1 : index });
    } else if (p.from !== zone) {
      dispatch({
        type: "move",
        field: p.field,
        from: p.from,
        fromIndex: p.from ? p.index : undefined,
        to: zone,
        index,
      });
    }
  };

  const startDrag = (payload: DragPayload) => (e: React.DragEvent) => {
    drag.current = payload;
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", payload.field);
  };

  return (
    <div className="flex flex-col gap-2">
      <div
        role="list"
        aria-label="Available fields"
        className="flex flex-wrap items-center gap-1.5"
      >
        <span className="mr-1 text-[11px] font-medium uppercase tracking-wide text-crm-subtle">
          Fields
        </span>
        {fields.map((f) => {
          const inUse = used.has(f.key);
          return (
            <DropdownMenu.Root key={f.key}>
              <DropdownMenu.Trigger
                role="listitem"
                disabled={disabled}
                draggable={!disabled}
                onDragStart={startDrag({ field: f.key, from: null, index: -1 })}
                className={cn(
                  "inline-flex h-6 cursor-grab items-center gap-1 rounded-full border border-crm-border px-2 text-[11px] outline-none hover:border-crm-ring focus-visible:ring-2 focus-visible:ring-crm-ring/60",
                  inUse ? "text-crm-subtle" : "text-crm-soft",
                )}
                aria-label={`${f.label} field, open to add`}
              >
                <GripVertical className="size-3 text-crm-faint" aria-hidden />
                {f.label}
              </DropdownMenu.Trigger>
              <MenuContent>
                {ZONES.filter((z) => accepts(f, z.accepts)).map((z) => (
                  <MenuItem
                    key={z.zone}
                    onSelect={() =>
                      dispatch({ type: "move", field: f.key, from: null, to: z.zone })
                    }
                  >
                    Add to {z.label}
                  </MenuItem>
                ))}
              </MenuContent>
            </DropdownMenu.Root>
          );
        })}
      </div>

      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {ZONES.map(({ zone, label, icon, accepts: acc }) => {
          const items = list(zone);
          return (
            <div
              key={zone}
              role="group"
              aria-label={`${label} shelf`}
              onDragOver={(e) => {
                if (!drag.current || !accepts(byKey.get(drag.current.field), acc)) return;
                e.preventDefault();
                if (overZone !== zone) setOverZone(zone);
              }}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node)) setOverZone(null);
              }}
              onDrop={(e) => {
                e.preventDefault();
                drop(zone);
              }}
              className={cn(
                "flex min-h-[64px] flex-col gap-1.5 rounded-crm border border-dashed border-crm-border bg-crm-bg/50 p-2 transition-colors",
                overZone === zone && "border-crm-primary bg-crm-primary/5",
              )}
            >
              <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-crm-muted-fg">
                {icon}
                {label}
              </span>
              <div className="flex flex-wrap gap-1">
                {items.length === 0 && (
                  <span className="text-[11px] text-crm-faint">
                    Drop {acc === "measure" ? "measures" : "fields"} here
                  </span>
                )}
                {items.map((key, i) => {
                  const f = byKey.get(key);
                  const valueDef = zone === "values" ? layout.values[i] : undefined;
                  const excluded = zone === "filters" ? (layout.filters[key]?.length ?? 0) : 0;
                  return (
                    <Chip
                      key={`${key}-${i}`}
                      label={
                        valueDef
                          ? `${AGGREGATOR_LABELS[valueDef.agg]} of ${f?.label ?? key}`
                          : (f?.label ?? key)
                      }
                      badge={excluded ? `${excluded} hidden` : undefined}
                      disabled={disabled}
                      onDragStart={startDrag({ field: key, from: zone, index: i })}
                      onDropBefore={() => drop(zone, i)}
                    >
                      {valueDef && (
                        <DropdownMenu.Sub>
                          <DropdownMenu.SubTrigger className={menuItemCls}>
                            Summarise by
                          </DropdownMenu.SubTrigger>
                          <DropdownMenu.Portal>
                            <DropdownMenu.SubContent className={menuCls} sideOffset={4}>
                              {(Object.keys(AGGREGATOR_LABELS) as PivotAggregator[]).map((a) => (
                                <MenuItem
                                  key={a}
                                  onSelect={() => dispatch({ type: "setAgg", index: i, agg: a })}
                                >
                                  <span className="w-3.5">
                                    {valueDef.agg === a && <Check className="size-3.5" />}
                                  </span>
                                  {AGGREGATOR_LABELS[a]}
                                </MenuItem>
                              ))}
                            </DropdownMenu.SubContent>
                          </DropdownMenu.Portal>
                        </DropdownMenu.Sub>
                      )}
                      <MenuItem
                        disabled={i === 0}
                        onSelect={() => dispatch({ type: "reorder", zone, from: i, to: i - 1 })}
                      >
                        Move earlier
                      </MenuItem>
                      <MenuItem
                        disabled={i === items.length - 1}
                        onSelect={() => dispatch({ type: "reorder", zone, from: i, to: i + 1 })}
                      >
                        Move later
                      </MenuItem>
                      {ZONES.filter((z) => z.zone !== zone && accepts(f, z.accepts)).map((z) => (
                        <MenuItem
                          key={z.zone}
                          onSelect={() =>
                            dispatch({
                              type: "move",
                              field: key,
                              from: zone,
                              fromIndex: i,
                              to: z.zone,
                            })
                          }
                        >
                          Move to {ZONE_LABEL[z.zone]}
                        </MenuItem>
                      ))}
                      <DropdownMenu.Separator className="my-1 h-px bg-crm-border" />
                      <MenuItem
                        danger
                        onSelect={() => dispatch({ type: "remove", zone, index: i })}
                      >
                        Remove
                      </MenuItem>
                    </Chip>
                  );
                })}
              </div>
              {zone === "filters" && layout.filterFields.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {layout.filterFields.map((key) => (
                    <FilterPopover
                      key={key}
                      label={byKey.get(key)?.label ?? key}
                      members={getMembers(key)}
                      excluded={layout.filters[key] ?? []}
                      onChange={(ex) => dispatch({ type: "setFilter", field: key, excluded: ex })}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

const menuCls =
  "z-50 min-w-40 rounded-crm border border-crm-border bg-crm-popover p-1 text-xs text-crm-fg shadow-crm-overlay";
const menuItemCls =
  "flex cursor-pointer items-center gap-2 rounded-[6px] px-2 py-1.5 outline-none select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-40 data-[highlighted]:bg-crm-muted";

function MenuContent({ children }: { children: React.ReactNode }) {
  return (
    <DropdownMenu.Portal>
      <DropdownMenu.Content className={menuCls} sideOffset={4} align="start">
        {children}
      </DropdownMenu.Content>
    </DropdownMenu.Portal>
  );
}

function MenuItem({
  children,
  onSelect,
  disabled,
  danger,
}: {
  children: React.ReactNode;
  onSelect: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <DropdownMenu.Item
      disabled={disabled}
      onSelect={onSelect}
      className={cn(menuItemCls, danger && "text-crm-danger")}
    >
      {children}
    </DropdownMenu.Item>
  );
}

function Chip({
  label,
  badge,
  disabled,
  children,
  onDragStart,
  onDropBefore,
}: {
  label: string;
  badge?: string;
  disabled?: boolean;
  children: React.ReactNode;
  onDragStart: (e: React.DragEvent) => void;
  onDropBefore: () => void;
}) {
  const [over, setOver] = React.useState(false);
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger
        disabled={disabled}
        draggable={!disabled}
        onDragStart={onDragStart}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOver(false);
          onDropBefore();
        }}
        aria-label={`${label}, field options`}
        className={cn(
          "relative inline-flex h-6 max-w-full cursor-grab items-center gap-1 rounded-full bg-crm-raised pr-1 pl-2 text-[11px] text-crm-fg shadow-crm-raised outline-none hover:bg-crm-muted focus-visible:ring-2 focus-visible:ring-crm-ring/60 active:cursor-grabbing",
          over &&
            "before:absolute before:inset-y-0 before:-left-1 before:w-0.5 before:rounded-full before:bg-crm-primary",
        )}
      >
        <span className="truncate">{label}</span>
        {badge && (
          <span className="rounded-full bg-crm-warning/15 px-1.5 text-[10px] text-crm-warning">
            {badge}
          </span>
        )}
        <MoreHorizontal className="size-3 text-crm-subtle" aria-hidden />
      </DropdownMenu.Trigger>
      <MenuContent>{children}</MenuContent>
    </DropdownMenu.Root>
  );
}

function FilterPopover({
  label,
  members,
  excluded,
  onChange,
}: {
  label: string;
  members: string[];
  excluded: string[];
  onChange: (ex: string[]) => void;
}) {
  const [q, setQ] = React.useState("");
  const ex = React.useMemo(() => new Set(excluded), [excluded]);
  const shown = React.useMemo(() => {
    const s = q.trim().toLowerCase();
    return s ? members.filter((m) => m.toLowerCase().includes(s)) : members;
  }, [members, q]);
  const toggle = (m: string) =>
    onChange(ex.has(m) ? excluded.filter((x) => x !== m) : [...excluded, m]);
  return (
    <Popover.Root>
      <Popover.Trigger className="inline-flex h-6 items-center gap-1 rounded-full border border-crm-border px-2 text-[11px] text-crm-soft outline-none hover:text-crm-fg focus-visible:ring-2 focus-visible:ring-crm-ring/60">
        <Filter className="size-3" aria-hidden />
        {label}: {excluded.length ? `${members.length - excluded.length}/${members.length}` : "All"}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          sideOffset={4}
          align="start"
          className="z-50 w-60 rounded-crm border border-crm-border bg-crm-popover p-2 text-xs text-crm-fg shadow-crm-overlay"
        >
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={`Search ${label.toLowerCase()}...`}
            aria-label={`Search ${label}`}
            className="mb-1.5 h-7 w-full rounded-crm border border-crm-input bg-crm-bg px-2 text-xs outline-none focus-visible:ring-2 focus-visible:ring-crm-ring/60"
          />
          <div className="mb-1.5 flex justify-between text-[11px]">
            <button
              type="button"
              className="text-crm-primary hover:underline"
              onClick={() => onChange([])}
            >
              Select all
            </button>
            <button
              type="button"
              className="text-crm-subtle hover:underline"
              onClick={() => onChange([...members])}
            >
              Clear all
            </button>
          </div>
          <div className="max-h-56 overflow-auto">
            {shown.map((m) => (
              <label
                key={m}
                className="flex cursor-pointer items-center gap-2 rounded-[6px] px-1.5 py-1 hover:bg-crm-muted"
              >
                <input
                  type="checkbox"
                  checked={!ex.has(m)}
                  onChange={() => toggle(m)}
                  className="accent-crm-primary"
                />
                <span className="truncate">{m}</span>
              </label>
            ))}
            {shown.length === 0 && <p className="py-3 text-center text-crm-subtle">No matches</p>}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
