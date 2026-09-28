import * as React from "react";
import * as Popover from "@radix-ui/react-popover";
import { Clock } from "lucide-react";
import { cn } from "@/lib/utils";

/** Minutes since midnight -> "HH:mm". */
export const toTimeString = (mins: number) =>
  `${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`;

const toMinutes = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
};

/** Parse free text such as "9", "930", "9:30", "9.30pm", "21:30", "noon" into "HH:mm", or null. */
export function parseTime(input: string): string | null {
  const s = input.trim().toLowerCase().replace(/\s+/g, "");
  if (!s) return null;
  if (s === "noon") return "12:00";
  if (s === "midnight") return "00:00";
  const m = s.match(/^(\d{1,2})(?:[:.h]?(\d{2}))?(a|am|p|pm)?$/);
  if (!m) return null;
  let h = Number(m[1]);
  const min = m[2] ? Number(m[2]) : 0;
  const mer = m[3]?.[0];
  if (min > 59) return null;
  if (mer) {
    if (h < 1 || h > 12) return null;
    if (mer === "p" && h !== 12) h += 12;
    if (mer === "a" && h === 12) h = 0;
  } else if (h > 23) return null;
  return toTimeString(h * 60 + min);
}

export interface TimePickerProps {
  /** 24h "HH:mm" string. */
  value?: string | null;
  onChange?: (value: string | null) => void;
  /** Minutes between suggested slots. */
  interval?: number;
  /** Earliest slot, "HH:mm". */
  min?: string;
  /** Latest slot, "HH:mm". */
  max?: string;
  /** Display as 12h ("2:30 PM") or 24h ("14:30"). */
  hourCycle?: 12 | 24;
  placeholder?: string;
  disabled?: boolean;
  invalid?: boolean;
  id?: string;
  "aria-label"?: string;
  className?: string;
}

/** Time field that accepts free entry ("9:30pm", "1430") and suggests slots in a listbox. Arrows move through slots, Enter commits, Esc closes. */
export function TimePicker({
  value,
  onChange,
  interval = 30,
  min = "00:00",
  max = "23:59",
  hourCycle = 12,
  placeholder = "Select time",
  disabled,
  invalid,
  id,
  "aria-label": ariaLabel,
  className,
}: TimePickerProps) {
  const format = React.useCallback(
    (t: string) => {
      const mins = toMinutes(t);
      if (hourCycle === 24) return t;
      const h = Math.floor(mins / 60);
      const m = mins % 60;
      return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
    },
    [hourCycle],
  );

  const slots = React.useMemo(() => {
    const out: string[] = [];
    const step = Math.max(1, interval);
    for (let t = toMinutes(min); t <= toMinutes(max); t += step) out.push(toTimeString(t));
    return out;
  }, [interval, min, max]);

  const [open, setOpen] = React.useState(false);
  const [text, setText] = React.useState(value ? format(value) : "");
  const [active, setActive] = React.useState(-1);
  const [error, setError] = React.useState(false);
  const listRef = React.useRef<HTMLUListElement>(null);
  const baseId = React.useId();
  const listId = `${baseId}-list`;
  const inputId = id ?? `${baseId}-input`;
  /** True once the user moved through slots with the arrows, so Enter picks the slot rather than the typed text. */
  const navigated = React.useRef(false);

  React.useEffect(() => {
    setText(value ? format(value) : "");
    setError(false);
  }, [value, format]);

  /** Nearest slot to the value (or to the typed text) so the list opens in context. */
  const nearest = (t: string | null) => {
    if (!t) return -1;
    const target = toMinutes(t);
    let best = 0;
    slots.forEach((s, i) => {
      if (Math.abs(toMinutes(s) - target) < Math.abs(toMinutes(slots[best] ?? s) - target))
        best = i;
    });
    return best;
  };

  React.useEffect(() => {
    if (open) setActive(nearest(value ?? null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  React.useEffect(() => {
    if (active < 0) return;
    listRef.current
      ?.querySelector<HTMLElement>(`[data-index="${active}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  const commit = (t: string | null) => {
    if (t && (toMinutes(t) < toMinutes(min) || toMinutes(t) > toMinutes(max))) {
      setError(true);
      return;
    }
    setError(false);
    setText(t ? format(t) : "");
    if (t !== value) onChange?.(t);
  };

  const commitText = () => {
    if (!text.trim()) return commit(null);
    const parsed = parseTime(text);
    if (parsed) commit(parsed);
    else setError(true);
  };

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Anchor asChild>
        <div
          className={cn(
            "flex h-9 w-full items-center gap-2 rounded-crm border border-crm-input/60 bg-crm-raised px-3 font-crm",
            "transition-[border-color,box-shadow] duration-150 ease-crm hover:border-crm-input",
            "focus-within:border-crm-ring focus-within:ring-2 focus-within:ring-crm-ring/40",
            (invalid || error) && "border-crm-danger ring-crm-danger/20",
            disabled && "cursor-not-allowed opacity-50",
            className,
          )}
        >
          <Clock aria-hidden className="size-3.5 shrink-0 text-crm-subtle" />
          <input
            id={inputId}
            role="combobox"
            autoComplete="off"
            aria-label={ariaLabel}
            aria-expanded={open}
            aria-controls={open ? listId : undefined}
            aria-autocomplete="list"
            aria-activedescendant={open && active >= 0 ? `${baseId}-opt-${active}` : undefined}
            aria-invalid={invalid || error || undefined}
            disabled={disabled}
            placeholder={placeholder}
            value={text}
            onFocus={() => setOpen(true)}
            onClick={() => setOpen(true)}
            onChange={(e) => {
              setText(e.target.value);
              setError(false);
              setOpen(true);
              navigated.current = false;
              const parsed = parseTime(e.target.value);
              if (parsed) setActive(nearest(parsed));
            }}
            onBlur={() => {
              commitText();
            }}
            onKeyDown={(e) => {
              switch (e.key) {
                case "ArrowDown":
                  e.preventDefault();
                  setOpen(true);
                  navigated.current = true;
                  setActive((a) => Math.min(slots.length - 1, a + 1));
                  break;
                case "ArrowUp":
                  e.preventDefault();
                  setOpen(true);
                  navigated.current = true;
                  setActive((a) => Math.max(0, a - 1));
                  break;
                case "Enter":
                  e.preventDefault();
                  if (open && navigated.current && active >= 0) commit(slots[active] ?? null);
                  else commitText();
                  navigated.current = false;
                  setOpen(false);
                  break;
                case "Escape":
                  setOpen(false);
                  break;
                case "Tab":
                  setOpen(false);
                  break;
              }
            }}
            className="min-w-0 flex-1 bg-transparent text-sm text-crm-fg tabular-nums outline-none placeholder:text-crm-subtle disabled:cursor-not-allowed"
          />
        </div>
      </Popover.Anchor>
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={6}
          onOpenAutoFocus={(e) => e.preventDefault()}
          onCloseAutoFocus={(e) => e.preventDefault()}
          onInteractOutside={(e) => {
            const anchor = (e.target as HTMLElement | null)?.closest("input");
            if (anchor?.id === inputId) e.preventDefault();
          }}
          className="z-50 w-[var(--radix-popover-trigger-width)] min-w-[160px] overflow-hidden rounded-xl border border-crm-border bg-crm-popover font-crm shadow-crm-overlay outline-none data-[state=open]:animate-crm-in"
        >
          <ul
            ref={listRef}
            id={listId}
            role="listbox"
            aria-label="Suggested times"
            className="max-h-60 overflow-y-auto p-1"
          >
            {slots.map((s, i) => (
              <li
                key={s}
                id={`${baseId}-opt-${i}`}
                data-index={i}
                role="option"
                aria-selected={s === value}
                onMouseMove={() => setActive(i)}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  commit(s);
                  setOpen(false);
                }}
                className={cn(
                  "cursor-pointer rounded-[8px] px-2 py-1.5 text-sm tabular-nums",
                  s === value ? "text-crm-primary" : "text-crm-fg",
                  i === active && "bg-crm-muted",
                )}
              >
                {format(s)}
              </li>
            ))}
          </ul>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
