import { useId, useRef, useState } from "react";
import {
  useController,
  type Control,
  type FieldValues,
  type UseFormTrigger,
} from "react-hook-form";
import { Lock, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
import { FieldEditor } from "@/components/crm/pro-record-page/field-editors";
import { displayValue, type RecordFieldDef } from "@/components/crm/pro-record-page/schema";

export interface InlineFieldProps<T> {
  field: RecordFieldDef<T>;
  control: Control<FieldValues>;
  trigger: UseFormTrigger<FieldValues>;
  /** Whole-record lock, e.g. while loading or without edit permission. */
  disabled?: boolean;
  /** Called after a successful commit (used for auto-save). */
  onCommitted?: (name: string) => void;
}

/**
 * Read view that turns into a typed editor on click / Enter / F2. Enter or blur commits
 * (validation runs; invalid values keep the editor open), Escape restores the pre-edit value.
 */
export function InlineField<T>({
  field,
  control,
  trigger,
  disabled,
  onCommitted,
}: InlineFieldProps<T>) {
  const id = useId();
  const { field: ctl, fieldState } = useController({ name: field.name, control });
  const [editing, setEditing] = useState(false);
  const snapshot = useRef<unknown>(undefined);
  const viewRef = useRef<HTMLButtonElement>(null);
  const readOnly = field.readOnly || disabled;
  const errorId = `${id}-error`;
  const helpId = `${id}-help`;
  const shown = displayValue(field, ctl.value);

  const start = () => {
    if (readOnly) return;
    snapshot.current = ctl.value;
    setEditing(true);
  };
  const finish = () => {
    setEditing(false);
    ctl.onBlur();
    requestAnimationFrame(() => viewRef.current?.focus());
  };
  const commit = async () => {
    const ok = await trigger(field.name);
    if (!ok && ctl.value !== snapshot.current) return; // keep editing so the error can be fixed
    finish();
    if (ok && ctl.value !== snapshot.current) onCommitted?.(field.name);
  };
  const cancel = () => {
    ctl.onChange(snapshot.current);
    void trigger(field.name);
    finish();
  };

  const pill =
    field.type === "picklist" ? field.options?.find((o) => o.value === ctl.value) : undefined;
  const describedBy =
    [fieldState.error && errorId, field.help && helpId].filter(Boolean).join(" ") || undefined;

  return (
    <div className={cn("group min-w-0", field.wide && "sm:col-span-2")}>
      <div className="mb-1 flex items-center gap-1.5">
        <label
          htmlFor={editing ? `${id}-input` : `${id}-view`}
          className="text-xs font-medium text-crm-muted-fg"
        >
          {field.label}
          {field.required && !readOnly && (
            <span className="ml-0.5 text-crm-danger" aria-hidden>
              *
            </span>
          )}
        </label>
        {fieldState.isDirty && (
          <span
            className="size-1.5 rounded-full bg-crm-warning"
            title="Unsaved change"
            aria-label="Unsaved change"
          />
        )}
      </div>

      {editing ? (
        <FieldEditor
          field={field}
          value={ctl.value}
          onChange={ctl.onChange}
          onCommit={() => void commit()}
          onCancel={cancel}
          invalid={!!fieldState.error}
          describedBy={describedBy}
          inputId={`${id}-input`}
        />
      ) : (
        <button
          id={`${id}-view`}
          ref={viewRef}
          type="button"
          onClick={start}
          onKeyDown={(e) => {
            if (e.key === "F2") {
              e.preventDefault();
              start();
            }
          }}
          aria-disabled={readOnly || undefined}
          aria-invalid={!!fieldState.error || undefined}
          aria-describedby={describedBy}
          aria-label={`${field.label}: ${shown || "empty"}${readOnly ? " (read only)" : ", edit"}`}
          className={cn(
            "flex min-h-8 w-full items-center gap-2 rounded-crm border border-transparent px-2.5 text-left text-sm",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-crm-ring",
            readOnly
              ? "cursor-default text-crm-soft"
              : "hover:border-crm-border hover:bg-crm-raised/60",
            fieldState.isDirty && "bg-crm-warning/[0.06]",
            fieldState.error && "border-crm-danger/60",
          )}
        >
          <span
            className={cn(
              "min-w-0 flex-1 truncate",
              field.type === "textarea" && "whitespace-pre-line line-clamp-3",
            )}
          >
            {pill?.tone ? (
              <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", pill.tone)}>
                {pill.label}
              </span>
            ) : shown ? (
              <span
                className={cn(
                  "text-crm-fg",
                  (field.type === "money" || field.type === "number") && "tabular-nums",
                )}
              >
                {shown}
              </span>
            ) : (
              <span className="text-crm-faint">—</span>
            )}
          </span>
          {readOnly ? (
            field.readOnly && <Lock className="size-3 shrink-0 text-crm-faint" aria-hidden />
          ) : (
            <Pencil
              className="size-3 shrink-0 text-crm-muted-fg opacity-0 group-hover:opacity-100"
              aria-hidden
            />
          )}
        </button>
      )}

      {fieldState.error ? (
        <p id={errorId} role="alert" className="mt-1 text-xs text-crm-danger">
          {fieldState.error.message}
        </p>
      ) : field.help ? (
        <p id={helpId} className="mt-1 text-xs text-crm-muted-fg">
          {field.help}
        </p>
      ) : null}
    </div>
  );
}
