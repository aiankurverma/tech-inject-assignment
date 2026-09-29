import * as React from "react";
import {
  FloatingFocusManager,
  FloatingList,
  FloatingPortal,
  autoUpdate,
  flip,
  offset,
  shift,
  useClick,
  useDismiss,
  useFloating,
  useInteractions,
  useListItem,
  useListNavigation,
  useRole,
} from "@floating-ui/react";
import { addDays, addHours, nextMonday, setHours, startOfHour, format } from "date-fns";
import { Clock } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SnoozeOption {
  label: string;
  at: (now: Date) => Date;
}

export const DEFAULT_SNOOZE_OPTIONS: SnoozeOption[] = [
  { label: "In 1 hour", at: (n) => startOfHour(addHours(n, 1)) },
  { label: "In 3 hours", at: (n) => startOfHour(addHours(n, 3)) },
  { label: "Tomorrow morning", at: (n) => setHours(startOfHour(addDays(n, 1)), 9) },
  { label: "Next week", at: (n) => setHours(startOfHour(nextMonday(n)), 9) },
];

interface SnoozeMenuProps {
  onSnooze: (until: Date) => void;
  options?: SnoozeOption[];
  now?: Date;
  disabled?: boolean;
  /** Compact icon trigger (row hover) vs labelled button (bulk bar). */
  compact?: boolean;
  label?: string;
}

export function SnoozeMenu({
  onSnooze,
  options = DEFAULT_SNOOZE_OPTIONS,
  now,
  disabled,
  compact,
  label = "Snooze",
}: SnoozeMenuProps) {
  const [open, setOpen] = React.useState(false);
  const [active, setActive] = React.useState<number | null>(null);
  const elementsRef = React.useRef<Array<HTMLElement | null>>([]);
  const { refs, floatingStyles, context } = useFloating({
    open,
    onOpenChange: setOpen,
    placement: "bottom-end",
    middleware: [offset(6), flip(), shift({ padding: 8 })],
    whileElementsMounted: autoUpdate,
  });
  const { getReferenceProps, getFloatingProps, getItemProps } = useInteractions([
    useClick(context),
    useDismiss(context),
    useRole(context, { role: "menu" }),
    useListNavigation(context, {
      listRef: elementsRef,
      activeIndex: active,
      onNavigate: setActive,
      loop: true,
    }),
  ]);
  const base = now ?? new Date();

  return (
    <>
      <button
        ref={refs.setReference}
        type="button"
        disabled={disabled}
        aria-label={compact ? label : undefined}
        title={compact ? label : undefined}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-crm text-xs text-crm-soft transition-colors hover:bg-crm-muted hover:text-crm-fg focus-visible:ring-2 focus-visible:ring-crm-ring focus-visible:outline-none disabled:opacity-40",
          compact ? "size-7 justify-center" : "h-8 px-2.5",
        )}
        {...getReferenceProps({ onClick: (e) => e.stopPropagation() })}
      >
        <Clock className="size-3.5" aria-hidden />
        {!compact && label}
      </button>
      {open && (
        <FloatingPortal>
          <FloatingFocusManager context={context} modal={false}>
            <div
              ref={refs.setFloating}
              style={floatingStyles}
              className="z-50 min-w-52 animate-crm-in rounded-crm border border-crm-border bg-crm-popover p-1 shadow-crm-overlay"
              {...getFloatingProps()}
            >
              <FloatingList elementsRef={elementsRef}>
                {options.map((o) => (
                  <SnoozeItem
                    key={o.label}
                    option={o}
                    now={base}
                    getItemProps={getItemProps}
                    active={active}
                    onPick={(d) => {
                      onSnooze(d);
                      setOpen(false);
                    }}
                  />
                ))}
              </FloatingList>
            </div>
          </FloatingFocusManager>
        </FloatingPortal>
      )}
    </>
  );
}

function SnoozeItem({
  option,
  now,
  onPick,
  getItemProps,
  active,
}: {
  option: SnoozeOption;
  now: Date;
  onPick: (d: Date) => void;
  getItemProps: ReturnType<typeof useInteractions>["getItemProps"];
  active: number | null;
}) {
  const { ref, index } = useListItem({ label: option.label });
  const at = option.at(now);
  return (
    <button
      ref={ref}
      type="button"
      role="menuitem"
      tabIndex={active === index ? 0 : -1}
      className={cn(
        "flex w-full items-center justify-between gap-6 rounded-[6px] px-2.5 py-1.5 text-left text-sm text-crm-fg outline-none",
        active === index && "bg-crm-muted",
      )}
      {...getItemProps({
        onClick: (e) => {
          e.stopPropagation();
          onPick(at);
        },
      })}
    >
      {option.label}
      <span className="text-xs text-crm-muted-fg tabular-nums">{format(at, "EEE HH:mm")}</span>
    </button>
  );
}
