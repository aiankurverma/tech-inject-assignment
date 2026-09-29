import * as React from "react";
import { ChevronDown, ChevronUp, GripVertical, Layers, Plus, X } from "lucide-react";
import {
  Rule,
  RuleGroup,
  type ActionProps,
  type CombinatorSelectorProps,
  type NotToggleProps,
  type Path,
  type RuleGroupProps,
  type RuleProps,
  type ShiftActionsProps,
  type ValueSelectorProps,
} from "react-querybuilder";
import { cn } from "@/lib/utils";
import { inputCls } from "@/components/crm/pro-query-builder/value-editor";

/* ---------------------------------- Drag and drop -------------------------------------------- *
 * react-querybuilder's own DnD needs react-dnd, which is not on the Kitbase allow-list. The
 * builder already exposes `actions.moveRule(from, to)`, so we only add a thin native HTML5 drag
 * layer (handle + drop indicator); the tree mutation itself stays in the library. Keyboard users
 * reorder with the shift up/down buttons (also library-provided).
 * --------------------------------------------------------------------------------------------- */

const DragContext = React.createContext<{
  dragging: React.MutableRefObject<Path | null>;
}>({ dragging: { current: null } });

export function DragProvider({ children }: { children: React.ReactNode }) {
  const dragging = React.useRef<Path | null>(null);
  const value = React.useMemo(() => ({ dragging }), []);
  return <DragContext.Provider value={value}>{children}</DragContext.Provider>;
}

const isAncestor = (a: Path, b: Path) => a.length <= b.length && a.every((v, i) => b[i] === v);

function useDropTarget(
  path: Path,
  targetPath: (p: Path) => Path,
  move: RuleProps["actions"]["moveRule"],
  disabled?: boolean,
) {
  const { dragging } = React.useContext(DragContext);
  const [over, setOver] = React.useState(false);
  return {
    over,
    handlers: disabled
      ? {}
      : {
          onDragOver: (e: React.DragEvent) => {
            const from = dragging.current;
            if (!from || isAncestor(from, path)) return;
            e.preventDefault();
            e.stopPropagation();
            e.dataTransfer.dropEffect = "move";
            if (!over) setOver(true);
          },
          onDragLeave: () => setOver(false),
          onDrop: (e: React.DragEvent) => {
            const from = dragging.current;
            setOver(false);
            if (!from || isAncestor(from, path)) return;
            e.preventDefault();
            e.stopPropagation();
            move(from, targetPath(path));
            dragging.current = null;
          },
        },
  };
}

function DragHandleButton({
  path,
  label,
  disabled,
}: {
  path: Path;
  label: string;
  disabled?: boolean;
}) {
  const { dragging } = React.useContext(DragContext);
  if (path.length === 0) return null;
  return (
    <span
      draggable={!disabled}
      aria-hidden
      title={`Drag to move ${label}`}
      onDragStart={(e) => {
        dragging.current = path;
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", path.join("."));
      }}
      onDragEnd={() => (dragging.current = null)}
      className={cn(
        "grid h-[30px] w-4 shrink-0 cursor-grab place-items-center text-crm-faint hover:text-crm-soft active:cursor-grabbing",
        disabled && "pointer-events-none opacity-40",
      )}
    >
      <GripVertical className="size-3.5" />
    </span>
  );
}

export function DraggableRule(props: RuleProps) {
  const { over, handlers } = useDropTarget(
    props.path,
    (p) => p,
    props.actions.moveRule,
    props.disabled,
  );
  return (
    <div
      {...handlers}
      className={cn(
        "relative flex items-start gap-1 rounded-crm",
        over &&
          "before:absolute before:inset-x-0 before:-top-1 before:h-0.5 before:rounded-full before:bg-crm-primary",
      )}
    >
      <DragHandleButton path={props.path} label="condition" disabled={props.disabled} />
      <Rule {...props} />
    </div>
  );
}

export function DraggableRuleGroup(props: RuleGroupProps) {
  const { over, handlers } = useDropTarget(
    props.path,
    (p) => [...p, props.ruleGroup.rules.length],
    props.actions.moveRule,
    props.disabled,
  );
  return (
    <div
      {...handlers}
      className={cn("flex items-start gap-1 rounded-crm", over && "ring-1 ring-crm-primary/70")}
    >
      <DragHandleButton path={props.path} label="group" disabled={props.disabled} />
      <RuleGroup {...props} />
    </div>
  );
}

/* ---------------------------------- Themed controls ------------------------------------------ */

export function ProActionElement({
  label,
  title,
  handleOnClick,
  disabled,
  className,
  testID,
}: ActionProps) {
  const isRemove = testID === "remove-rule" || testID === "remove-group";
  const isGroup = testID === "add-group";
  return (
    <button
      type="button"
      title={title}
      aria-label={isRemove ? title : undefined}
      disabled={disabled}
      onClick={(e) => handleOnClick(e)}
      className={cn(
        "inline-flex h-[30px] shrink-0 items-center gap-1 rounded-full px-2.5 text-xs outline-none focus-visible:ring-2 focus-visible:ring-crm-ring/60 disabled:pointer-events-none disabled:opacity-40",
        isRemove
          ? "w-[30px] justify-center px-0 text-crm-subtle hover:bg-crm-danger/15 hover:text-crm-danger"
          : "bg-crm-raised text-crm-fg shadow-crm-raised hover:bg-crm-muted",
        className,
      )}
    >
      {isRemove ? (
        <X className="size-3.5" />
      ) : isGroup ? (
        <Layers className="size-3.5" />
      ) : (
        <Plus className="size-3.5" />
      )}
      {!isRemove && label}
    </button>
  );
}

export function ProValueSelector({
  options,
  value,
  handleOnChange,
  disabled,
  title,
  className,
}: ValueSelectorProps) {
  return (
    <select
      aria-label={title}
      title={title}
      disabled={disabled}
      value={value ?? ""}
      onChange={(e) => handleOnChange(e.target.value)}
      className={cn(inputCls, "max-w-[190px]", className)}
    >
      {options.map((o) =>
        "options" in o ? (
          <optgroup key={o.label} label={o.label}>
            {(o.options as { name: string; label: string }[]).map((c) => (
              <option key={c.name} value={c.name}>
                {c.label}
              </option>
            ))}
          </optgroup>
        ) : (
          <option key={o.name} value={o.name}>
            {o.label}
          </option>
        ),
      )}
    </select>
  );
}

/** AND / OR segmented toggle (radiogroup). */
export function ProCombinator({
  options,
  value,
  handleOnChange,
  disabled,
  title,
}: CombinatorSelectorProps) {
  const flat = options.filter(
    (o): o is { name: string; label: string; value: string } => "name" in o,
  );
  return (
    <div
      role="radiogroup"
      aria-label={title ?? "Combinator"}
      className="inline-flex rounded-full bg-crm-bg p-0.5 ring-1 ring-crm-border"
    >
      {flat.map((o) => {
        const on = o.name === value;
        return (
          <button
            key={o.name}
            type="button"
            role="radio"
            aria-checked={on}
            disabled={disabled}
            onClick={() => handleOnChange(o.name)}
            onKeyDown={(e) => {
              if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
                e.preventDefault();
                const i = flat.findIndex((x) => x.name === value);
                const next =
                  flat[(i + (e.key === "ArrowRight" ? 1 : flat.length - 1)) % flat.length];
                if (next) handleOnChange(next.name);
              }
            }}
            tabIndex={on ? 0 : -1}
            className={cn(
              "h-6 rounded-full px-2.5 text-[11px] font-semibold uppercase tracking-wide outline-none focus-visible:ring-2 focus-visible:ring-crm-ring/60",
              on ? "bg-crm-primary text-crm-primary-fg" : "text-crm-muted-fg hover:text-crm-fg",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function ProNotToggle({ checked, handleOnChange, disabled }: NotToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={!!checked}
      aria-label="Negate group (NOT)"
      disabled={disabled}
      onClick={() => handleOnChange(!checked)}
      className={cn(
        "h-6 rounded-full px-2 text-[11px] font-semibold uppercase tracking-wide outline-none ring-1 focus-visible:ring-2 focus-visible:ring-crm-ring/60",
        checked
          ? "bg-crm-danger/15 text-crm-danger ring-crm-danger/40"
          : "text-crm-subtle ring-crm-border hover:text-crm-fg",
      )}
    >
      Not
    </button>
  );
}

export function ProShiftActions({
  shiftUp,
  shiftDown,
  shiftUpDisabled,
  shiftDownDisabled,
  disabled,
  path,
}: ShiftActionsProps) {
  if (path.length === 0) return null;
  const btn =
    "grid h-[14px] w-5 place-items-center rounded-sm text-crm-subtle hover:bg-crm-muted hover:text-crm-fg disabled:opacity-30 outline-none focus-visible:ring-2 focus-visible:ring-crm-ring/60";
  return (
    <span className="inline-flex flex-col">
      <button
        type="button"
        aria-label="Move up"
        className={btn}
        disabled={disabled || shiftUpDisabled}
        onClick={shiftUp}
      >
        <ChevronUp className="size-3" />
      </button>
      <button
        type="button"
        aria-label="Move down"
        className={btn}
        disabled={disabled || shiftDownDisabled}
        onClick={shiftDown}
      >
        <ChevronDown className="size-3" />
      </button>
    </span>
  );
}
