import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import * as Popover from "@radix-ui/react-popover";
import * as Select from "@radix-ui/react-select";
import { DayPicker } from "react-day-picker";
import { AsYouType } from "libphonenumber-js";
import { format, parseISO, isValid } from "date-fns";
import { CalendarDays, Check, ChevronDown, ChevronLeft, ChevronRight, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { RecordFieldDef } from "@/components/crm/pro-record-page/schema";

export interface EditorProps<T> {
  field: RecordFieldDef<T>;
  value: unknown;
  onChange: (value: unknown) => void;
  /** Leave edit mode keeping the value. */
  onCommit: () => void;
  /** Leave edit mode restoring the value from before editing. */
  onCancel: () => void;
  invalid: boolean;
  describedBy?: string;
  inputId: string;
}

export const inputCls =
  "h-8 w-full rounded-crm border border-crm-input bg-crm-bg px-2.5 text-sm text-crm-fg outline-none placeholder:text-crm-faint focus:border-crm-ring focus:ring-2 focus:ring-crm-ring/40 aria-[invalid=true]:border-crm-danger aria-[invalid=true]:ring-crm-danger/30";

function keyHandler(onCommit: () => void, onCancel: () => void, multiline = false) {
  return (e: KeyboardEvent<HTMLElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      onCancel();
    } else if (e.key === "Enter" && (!multiline || e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      onCommit();
    }
  };
}

export function FieldEditor<T>(props: EditorProps<T>) {
  switch (props.field.type) {
    case "phone":
      return <PhoneEditor {...props} />;
    case "money":
    case "number":
      return <NumberEditor {...props} />;
    case "date":
      return <DateEditor {...props} />;
    case "picklist":
      return <PicklistEditor {...props} />;
    case "textarea":
      return (
        <textarea
          id={props.inputId}
          autoFocus
          rows={4}
          value={String(props.value ?? "")}
          onChange={(e) => props.onChange(e.target.value)}
          onBlur={props.onCommit}
          onKeyDown={keyHandler(props.onCommit, props.onCancel, true)}
          aria-invalid={props.invalid}
          aria-describedby={props.describedBy}
          placeholder={props.field.placeholder}
          className={cn(inputCls, "h-auto resize-y py-1.5")}
        />
      );
    default:
      return (
        <input
          id={props.inputId}
          autoFocus
          type={
            props.field.type === "email" ? "email" : props.field.type === "url" ? "url" : "text"
          }
          value={String(props.value ?? "")}
          onChange={(e) => props.onChange(e.target.value)}
          onBlur={props.onCommit}
          onKeyDown={keyHandler(props.onCommit, props.onCancel)}
          aria-invalid={props.invalid}
          aria-describedby={props.describedBy}
          placeholder={props.field.placeholder}
          className={inputCls}
        />
      );
  }
}

function PhoneEditor<T>({
  field,
  value,
  onChange,
  onCommit,
  onCancel,
  invalid,
  describedBy,
  inputId,
}: EditorProps<T>) {
  const country = field.defaultCountry ?? "US";
  return (
    <input
      id={inputId}
      autoFocus
      type="tel"
      inputMode="tel"
      autoComplete="tel"
      value={String(value ?? "")}
      onChange={(e) => {
        const raw = e.target.value;
        // Format as the user types, but not while deleting (would fight the caret).
        const deleting = raw.length < String(value ?? "").length;
        onChange(deleting ? raw : new AsYouType(country).input(raw));
      }}
      onBlur={onCommit}
      onKeyDown={keyHandler(onCommit, onCancel)}
      aria-invalid={invalid}
      aria-describedby={describedBy}
      placeholder={field.placeholder ?? (country === "US" ? "(415) 555-0132" : "+44 20 7946 0958")}
      className={inputCls}
    />
  );
}

function NumberEditor<T>({
  field,
  value,
  onChange,
  onCommit,
  onCancel,
  invalid,
  describedBy,
  inputId,
}: EditorProps<T>) {
  // Edit a plain string so partial input ("12.") is allowed; parse on every change.
  const [text, setText] = useState(() => (typeof value === "number" ? String(value) : ""));
  const parse = (s: string): number | null | typeof NaN => {
    const clean = s.replace(/[\s,]/g, "").replace(/^[^\d.-]+/, "");
    if (clean === "") return null;
    const multiplier = /k$/i.test(clean) ? 1e3 : /m$/i.test(clean) ? 1e6 : 1;
    const n = Number(clean.replace(/[km]$/i, ""));
    return Number.isFinite(n) ? Math.round(n * multiplier * 100) / 100 : NaN;
  };
  return (
    <div className="relative">
      {field.type === "money" && (
        <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-crm-muted-fg">
          {field.currency ?? "USD"}
        </span>
      )}
      <input
        id={inputId}
        autoFocus
        inputMode="decimal"
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          onChange(parse(e.target.value));
        }}
        onBlur={onCommit}
        onKeyDown={keyHandler(onCommit, onCancel)}
        aria-invalid={invalid}
        aria-describedby={describedBy}
        placeholder={field.placeholder ?? (field.type === "money" ? "0.00 (or 12k, 1.5m)" : "0")}
        className={cn(inputCls, "tabular-nums", field.type === "money" && "pl-11")}
      />
    </div>
  );
}

const dayPickerClassNames = {
  root: "p-3 text-sm text-crm-fg",
  months: "relative",
  month_caption: "flex h-8 items-center justify-center font-medium",
  nav: "absolute inset-x-0 top-0 flex h-8 items-center justify-between",
  button_previous:
    "grid size-7 place-items-center rounded-crm text-crm-soft hover:bg-crm-raised disabled:opacity-40",
  button_next:
    "grid size-7 place-items-center rounded-crm text-crm-soft hover:bg-crm-raised disabled:opacity-40",
  month_grid: "mt-2 border-collapse",
  weekday: "size-8 text-[11px] font-medium text-crm-muted-fg",
  day: "p-0 text-center",
  day_button:
    "size-8 rounded-crm tabular-nums outline-none hover:bg-crm-raised focus-visible:ring-2 focus-visible:ring-crm-ring",
  selected:
    "[&>button]:bg-crm-primary [&>button]:text-crm-primary-fg [&>button]:hover:bg-crm-primary",
  today: "[&>button]:font-semibold [&>button]:text-crm-status",
  outside: "text-crm-faint",
  disabled: "opacity-40",
};

function DateEditor<T>({
  field,
  value,
  onChange,
  onCommit,
  onCancel,
  invalid,
  describedBy,
  inputId,
}: EditorProps<T>) {
  const [open, setOpen] = useState(true);
  const selected =
    typeof value === "string" && isValid(parseISO(value)) ? parseISO(value) : undefined;
  const done = useRef<"commit" | "cancel" | null>(null);
  return (
    <Popover.Root
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) (done.current === "cancel" ? onCancel : onCommit)();
      }}
    >
      <Popover.Trigger asChild>
        <button
          id={inputId}
          type="button"
          aria-invalid={invalid}
          aria-describedby={describedBy}
          className={cn(inputCls, "flex items-center gap-2 text-left")}
        >
          <CalendarDays className="size-3.5 text-crm-muted-fg" aria-hidden />
          {selected ? (
            format(selected, "d MMM yyyy")
          ) : (
            <span className="text-crm-faint">Pick a date</span>
          )}
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={6}
          onEscapeKeyDown={() => (done.current = "cancel")}
          className="z-50 rounded-crm border border-crm-border bg-crm-popover shadow-crm-overlay animate-crm-in"
        >
          <DayPicker
            mode="single"
            autoFocus
            selected={selected}
            defaultMonth={selected}
            onSelect={(d) => {
              onChange(d ? format(d, "yyyy-MM-dd") : null);
              done.current = "commit";
              setOpen(false);
              onCommit();
            }}
            captionLayout="label"
            classNames={dayPickerClassNames}
            components={{
              Chevron: ({ orientation }) =>
                orientation === "left" ? (
                  <ChevronLeft className="size-4" />
                ) : (
                  <ChevronRight className="size-4" />
                ),
            }}
          />
          {!field.required && selected && (
            <div className="border-t border-crm-border p-2">
              <button
                type="button"
                onClick={() => {
                  onChange(null);
                  done.current = "commit";
                  setOpen(false);
                  onCommit();
                }}
                className="inline-flex items-center gap-1 rounded-crm px-2 py-1 text-xs text-crm-muted-fg hover:bg-crm-raised hover:text-crm-fg"
              >
                <X className="size-3" /> Clear date
              </button>
            </div>
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

const EMPTY = "__empty__";

function PicklistEditor<T>({
  field,
  value,
  onChange,
  onCommit,
  onCancel,
  invalid,
  describedBy,
  inputId,
}: EditorProps<T>) {
  const [open, setOpen] = useState(false);
  // Open on the next frame so Radix measures the trigger after it mounts.
  useEffect(() => {
    const id = requestAnimationFrame(() => setOpen(true));
    return () => cancelAnimationFrame(id);
  }, []);
  const changed = useRef(false);
  return (
    <Select.Root
      open={open}
      value={value ? String(value) : EMPTY}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) (changed.current ? onCommit : onCancel)();
      }}
      onValueChange={(v) => {
        changed.current = true;
        onChange(v === EMPTY ? "" : v);
      }}
    >
      <Select.Trigger
        id={inputId}
        aria-invalid={invalid}
        aria-describedby={describedBy}
        className={cn(inputCls, "flex items-center justify-between gap-2 text-left")}
      >
        <Select.Value placeholder="Select…" />
        <Select.Icon>
          <ChevronDown className="size-3.5 text-crm-muted-fg" />
        </Select.Icon>
      </Select.Trigger>
      <Select.Portal>
        <Select.Content
          position="popper"
          sideOffset={4}
          className="z-50 max-h-72 min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-crm border border-crm-border bg-crm-popover shadow-crm-overlay animate-crm-in"
        >
          <Select.Viewport className="p-1">
            {!field.required && <Option value={EMPTY} label="None" />}
            {(field.options ?? []).map((o) => (
              <Option key={o.value} value={o.value} label={o.label} tone={o.tone} />
            ))}
          </Select.Viewport>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  );
}

function Option({ value, label, tone }: { value: string; label: string; tone?: string }) {
  return (
    <Select.Item
      value={value}
      className="relative flex h-8 cursor-default select-none items-center gap-2 rounded-crm pl-7 pr-2 text-sm text-crm-fg outline-none data-[highlighted]:bg-crm-raised"
    >
      <Select.ItemIndicator className="absolute left-2">
        <Check className="size-3.5" />
      </Select.ItemIndicator>
      <Select.ItemText>
        {tone ? (
          <span className={cn("rounded-full px-2 py-0.5 text-xs", tone)}>{label}</span>
        ) : (
          label
        )}
      </Select.ItemText>
    </Select.Item>
  );
}
