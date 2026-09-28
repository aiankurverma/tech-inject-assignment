import * as React from "react";
import { Check, ChevronDown, Search, UserX } from "lucide-react";
import { Avatar } from "@/components/crm/avatar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/crm/popover";
import { cn } from "@/lib/utils";

export interface Assignee {
  id: string;
  name: string;
  email?: string;
  src?: string;
  team?: string;
  /** Open items currently owned; drives the workload meter. */
  openItems?: number;
  /** Out of office people are listed but flagged. */
  outOfOffice?: boolean;
  disabled?: boolean;
}

interface BaseProps {
  people: Assignee[];
  /** Soft cap for the workload meter; people above it are flagged as overloaded. */
  capacity?: number;
  /** Id of the viewer, offered first as "Assign to me". */
  currentUserId?: string;
  placeholder?: string;
  disabled?: boolean;
  loading?: boolean;
  className?: string;
  "aria-label"?: string;
}

export interface SingleAssigneePickerProps extends BaseProps {
  multiple?: false;
  value?: string | null;
  defaultValue?: string | null;
  onValueChange?: (id: string | null) => void;
  /** Show an "Unassigned" option. */
  allowUnassigned?: boolean;
}

export interface MultiAssigneePickerProps extends BaseProps {
  multiple: true;
  value?: string[];
  defaultValue?: string[];
  onValueChange?: (ids: string[]) => void;
  /** Maximum assignees (e.g. 1 owner + 2 collaborators). */
  max?: number;
}

export type AssigneePickerProps = SingleAssigneePickerProps | MultiAssigneePickerProps;

const UNASSIGNED = "__unassigned__";

/**
 * Owner selector with search across name, email and team, "Assign to me", grouping by team,
 * workload meter against capacity, out-of-office flags and single or multi selection.
 */
export function AssigneePicker(props: AssigneePickerProps) {
  const {
    people,
    capacity = 20,
    currentUserId,
    placeholder = "Assign owner",
    disabled,
    loading,
    className,
  } = props;
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [active, setActive] = React.useState(0);
  const listId = React.useId();

  const initial: string[] = props.multiple
    ? (props.defaultValue ?? [])
    : props.defaultValue
      ? [props.defaultValue]
      : [];
  const [inner, setInner] = React.useState<string[]>(initial);
  const selected: string[] = props.multiple
    ? (props.value ?? inner)
    : props.value !== undefined
      ? props.value
        ? [props.value]
        : []
      : inner;

  const setSelected = (ids: string[]) => {
    if (props.value === undefined) setInner(ids);
    if (props.multiple) props.onValueChange?.(ids);
    else props.onValueChange?.(ids[0] ?? null);
  };

  const q = query.trim().toLowerCase();
  const filtered = people.filter(
    (p) =>
      !q ||
      p.name.toLowerCase().includes(q) ||
      p.email?.toLowerCase().includes(q) ||
      p.team?.toLowerCase().includes(q),
  );
  const me = filtered.find((p) => p.id === currentUserId);
  const rest = filtered.filter((p) => p.id !== currentUserId);
  const groups = new Map<string, Assignee[]>();
  for (const p of rest) {
    const k = p.team ?? "Everyone";
    groups.set(k, [...(groups.get(k) ?? []), p]);
  }

  const options: { id: string; person?: Assignee; group: string }[] = [];
  if (!props.multiple && props.allowUnassigned && !q) options.push({ id: UNASSIGNED, group: "" });
  if (me) options.push({ id: me.id, person: me, group: "You" });
  for (const [g, list] of groups)
    for (const p of list) options.push({ id: p.id, person: p, group: g });

  const max = props.multiple ? props.max : 1;
  const full = props.multiple && max !== undefined && selected.length >= max;

  const choose = (id: string) => {
    if (id === UNASSIGNED) {
      setSelected([]);
      setOpen(false);
      return;
    }
    const person = people.find((p) => p.id === id);
    if (!person || person.disabled) return;
    if (props.multiple) {
      if (selected.includes(id)) setSelected(selected.filter((s) => s !== id));
      else if (!full) setSelected([...selected, id]);
    } else {
      setSelected([id]);
      setOpen(false);
    }
  };

  React.useEffect(() => setActive(0), [query, open]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const d = e.key === "ArrowDown" ? 1 : -1;
      setActive((a) => (a + d + options.length) % Math.max(options.length, 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const o = options[active];
      if (o) choose(o.id);
    }
  };

  React.useEffect(() => {
    document.getElementById(`${listId}-${active}`)?.scrollIntoView({ block: "nearest" });
  }, [active, listId]);

  const chosen = selected
    .map((id) => people.find((p) => p.id === id))
    .filter((p): p is Assignee => !!p);

  let lastGroup: string | null = null;

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setQuery("");
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          aria-label={props["aria-label"] ?? "Assignee"}
          aria-haspopup="listbox"
          className={cn(
            "inline-flex h-[30px] max-w-full items-center gap-1.5 rounded-full bg-crm-raised pr-2 pl-1 font-crm text-xs text-crm-fg shadow-crm-raised outline-none",
            "hover:bg-crm-muted focus-visible:ring-2 focus-visible:ring-crm-ring/60 disabled:opacity-50",
            chosen.length === 0 && "pl-2.5 text-crm-soft",
            className,
          )}
        >
          {chosen.length === 0 ? (
            <span>{placeholder}</span>
          ) : chosen.length === 1 && chosen[0] ? (
            <>
              <Avatar name={chosen[0].name} src={chosen[0].src} size="sm" />
              <span className="truncate">{chosen[0].name}</span>
            </>
          ) : (
            <>
              <span className="flex">
                {chosen.slice(0, 3).map((p, i) => (
                  <Avatar
                    key={p.id}
                    name={p.name}
                    src={p.src}
                    size="sm"
                    className={cn("rounded-full ring-2 ring-crm-raised", i > 0 && "-ml-1.5")}
                  />
                ))}
              </span>
              <span className="truncate">{chosen.length} assignees</span>
            </>
          )}
          <ChevronDown className="size-3 shrink-0 text-crm-subtle" aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[300px] p-0" onKeyDown={onKeyDown}>
        <div className="flex items-center gap-2 border-b border-crm-border px-3 py-2">
          <Search className="size-3.5 text-crm-subtle" aria-hidden />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, email or team"
            role="combobox"
            aria-expanded
            aria-controls={listId}
            aria-activedescendant={options.length ? `${listId}-${active}` : undefined}
            aria-label="Search people"
            className="h-7 flex-1 bg-transparent text-sm text-crm-fg outline-none placeholder:text-crm-subtle"
          />
          {props.multiple && max !== undefined ? (
            <span className="crm-caption text-crm-subtle tabular-nums">
              {selected.length}/{max}
            </span>
          ) : null}
        </div>
        <ul
          id={listId}
          role="listbox"
          aria-multiselectable={props.multiple || undefined}
          className="max-h-72 overflow-y-auto p-1"
        >
          {loading ? (
            <li className="px-3 py-6 text-center crm-caption text-crm-soft">Loading people…</li>
          ) : options.length === 0 ? (
            <li className="px-3 py-6 text-center crm-caption text-crm-soft">
              No one matches “{query}”
            </li>
          ) : (
            options.map((o, i) => {
              const header = o.group && o.group !== lastGroup ? o.group : null;
              lastGroup = o.group;
              const isSel = o.id === UNASSIGNED ? selected.length === 0 : selected.includes(o.id);
              const p = o.person;
              const load = p?.openItems ?? 0;
              const pct = Math.min(100, (load / capacity) * 100);
              const over = load > capacity;
              const blocked = !!p?.disabled || (!isSel && full);
              return (
                <React.Fragment key={o.id}>
                  {header ? (
                    <li role="presentation" className="px-2 pt-2 pb-1 crm-eyebrow text-crm-subtle">
                      {header}
                    </li>
                  ) : null}
                  <li
                    id={`${listId}-${i}`}
                    role="option"
                    aria-selected={isSel}
                    aria-disabled={blocked || undefined}
                    onMouseEnter={() => setActive(i)}
                    onClick={() => !blocked && choose(o.id)}
                    className={cn(
                      "flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5",
                      i === active && "bg-crm-muted",
                      blocked && "cursor-not-allowed opacity-45",
                    )}
                  >
                    {p ? (
                      <Avatar name={p.name} src={p.src} size="md" />
                    ) : (
                      <span className="grid size-8 place-items-center rounded-full border border-dashed border-crm-input text-crm-subtle">
                        <UserX className="size-3.5" aria-hidden />
                      </span>
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5 text-sm text-crm-fg">
                        <span className="truncate">
                          {p ? (p.id === currentUserId ? `${p.name} (me)` : p.name) : "Unassigned"}
                        </span>
                        {p?.outOfOffice ? (
                          <span className="shrink-0 rounded-full bg-crm-warning/15 px-1.5 text-[10px] text-crm-warning">
                            OOO
                          </span>
                        ) : null}
                      </span>
                      {p ? (
                        <span className="mt-1 flex items-center gap-2">
                          <span
                            className="h-1 w-16 overflow-hidden rounded-full bg-crm-track"
                            aria-hidden
                          >
                            <span
                              className={cn(
                                "block h-full rounded-full",
                                over
                                  ? "bg-crm-danger"
                                  : pct > 75
                                    ? "bg-crm-warning"
                                    : "bg-crm-success",
                              )}
                              style={{ width: `${pct}%` }}
                            />
                          </span>
                          <span
                            className={cn(
                              "crm-caption tabular-nums",
                              over ? "text-crm-danger" : "text-crm-subtle",
                            )}
                          >
                            {load} open{over ? " · over capacity" : ""}
                          </span>
                        </span>
                      ) : null}
                    </span>
                    {isSel ? <Check className="size-3.5 text-crm-status" aria-hidden /> : null}
                  </li>
                </React.Fragment>
              );
            })
          )}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
