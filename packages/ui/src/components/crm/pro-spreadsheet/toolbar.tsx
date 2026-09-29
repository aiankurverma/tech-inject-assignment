import * as React from "react";
import {
  Calendar,
  DollarSign,
  Hash,
  Percent,
  Redo2,
  Snowflake,
  Type,
  Undo2,
  WrapText,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { rangeLabel, type CellRange } from "@/components/crm/pro-spreadsheet/address";
import type { EditState } from "@/components/crm/pro-spreadsheet/grid";
import type { CellFormat } from "@/components/crm/pro-spreadsheet/store";

const FORMATS: {
  value: CellFormat;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { value: "general", label: "General", icon: WrapText },
  { value: "number", label: "Number (2 decimals)", icon: Hash },
  { value: "currency", label: "Currency", icon: DollarSign },
  { value: "percent", label: "Percent", icon: Percent },
  { value: "date", label: "Date", icon: Calendar },
  { value: "text", label: "Plain text", icon: Type },
];

function ToolButton({
  label,
  pressed,
  className,
  children,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { label: string; pressed?: boolean }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={pressed}
      className={cn(
        "inline-flex size-7 items-center justify-center rounded-crm text-crm-muted-fg transition-colors hover:bg-crm-muted hover:text-crm-fg focus-visible:ring-2 focus-visible:ring-crm-ring focus-visible:outline-none disabled:pointer-events-none disabled:opacity-40",
        pressed && "bg-crm-primary/15 text-crm-primary",
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

export interface SpreadsheetToolbarProps {
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  format: CellFormat;
  onFormat: (f: CellFormat) => void;
  frozen: boolean;
  onToggleFreeze: () => void;
  readOnly: boolean;
}

export function SpreadsheetToolbar(p: SpreadsheetToolbarProps) {
  return (
    <div
      role="toolbar"
      aria-label="Spreadsheet tools"
      className="flex items-center gap-1 border-b border-crm-border bg-crm-card px-2 py-1"
    >
      <ToolButton label="Undo (Ctrl+Z)" disabled={p.readOnly || !p.canUndo} onClick={p.onUndo}>
        <Undo2 className="size-4" />
      </ToolButton>
      <ToolButton label="Redo (Ctrl+Y)" disabled={p.readOnly || !p.canRedo} onClick={p.onRedo}>
        <Redo2 className="size-4" />
      </ToolButton>
      <span className="mx-1 h-5 w-px bg-crm-border" aria-hidden />
      <div role="group" aria-label="Number format" className="flex items-center gap-0.5">
        {FORMATS.map(({ value, label, icon: Icon }) => (
          <ToolButton
            key={value}
            label={label}
            pressed={p.format === value}
            disabled={p.readOnly}
            onClick={() => p.onFormat(value)}
          >
            <Icon className="size-4" />
          </ToolButton>
        ))}
      </div>
      <span className="mx-1 h-5 w-px bg-crm-border" aria-hidden />
      <ToolButton
        label={p.frozen ? "Unfreeze panes" : "Freeze panes above and left of the active cell"}
        pressed={p.frozen}
        disabled={p.readOnly}
        onClick={p.onToggleFreeze}
      >
        <Snowflake className="size-4" />
      </ToolButton>
    </div>
  );
}

export interface FormulaBarProps {
  selection: CellRange;
  raw: string;
  editing: EditState | null;
  readOnly: boolean;
  onFocus: () => void;
  onChange: (value: string) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
}

export function FormulaBar(p: FormulaBarProps) {
  const id = React.useId();
  return (
    <div className="flex items-center border-b border-crm-border bg-crm-bg text-[13px]">
      <output
        htmlFor={id}
        className="w-24 shrink-0 truncate border-r border-crm-border px-2 py-1 font-medium text-crm-fg tabular-nums"
        aria-label="Selected range"
      >
        {rangeLabel(p.selection)}
      </output>
      <span className="px-2 font-serif text-crm-soft italic select-none" aria-hidden>
        fx
      </span>
      <input
        id={id}
        aria-label="Formula bar"
        spellCheck={false}
        readOnly={p.readOnly}
        value={p.editing ? p.editing.value : p.raw}
        onFocus={p.onFocus}
        onChange={(e) => p.onChange(e.target.value)}
        onKeyDown={p.onKeyDown}
        className="min-w-0 flex-1 bg-transparent py-1 pr-2 font-mono text-crm-fg outline-none placeholder:text-crm-soft"
        placeholder={p.readOnly ? "" : "Type a value or =FORMULA()"}
      />
    </div>
  );
}
