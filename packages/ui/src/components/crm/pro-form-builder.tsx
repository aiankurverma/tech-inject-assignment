import * as React from "react";
import { useStore } from "zustand";
import { Braces, Check, Copy, Eye, Hammer, Redo2, Save, Undo2, Upload } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/crm/button";
import {
  ProFormRenderer,
  validateFormSchema,
  type AsyncValidator,
  type FormSchema,
  type FormValues,
} from "@/components/crm/pro-form-renderer";
import {
  BuilderStoreContext,
  createBuilderStore,
  emptySchema,
  useBuilder,
} from "@/components/crm/pro-form-builder/store";
import { FieldPalette } from "@/components/crm/pro-form-builder/palette";
import { BuilderCanvas, PageTabs } from "@/components/crm/pro-form-builder/canvas";
import { SettingsPanel } from "@/components/crm/pro-form-builder/settings-panel";

export { emptySchema, createField, FIELD_TEMPLATES } from "@/components/crm/pro-form-builder/store";
export type { FormSchema, FormField, FormPage } from "@/components/crm/pro-form-renderer";

type Mode = "build" | "preview" | "json";

export interface ProFormBuilderProps {
  /** Controlled schema. Pair with onChange. */
  value?: FormSchema;
  /** Uncontrolled initial schema (defaults to an empty one-page form). */
  defaultValue?: FormSchema;
  /** Fires with the new schema after every edit (immutable, structurally shared). */
  onChange?: (schema: FormSchema) => void;
  /** Shows a Save button; receives the schema only when it passes validation. */
  onSave?: (schema: FormSchema) => void | Promise<void>;
  /** Async validators available to fields and used by the live preview. */
  asyncValidators?: Record<string, AsyncValidator>;
  /** Receives preview submissions (defaults to showing the payload inline). */
  onPreviewSubmit?: (values: FormValues) => void;
  defaultMode?: Mode;
  /** Read-only inspection: nothing can be edited. */
  disabled?: boolean;
  /** Height of the builder surface. */
  height?: number | string;
  className?: string;
}

/**
 * Drag-and-drop form builder for non-developers: field palette, native DnD reorder across pages,
 * per-field validation and options, react-querybuilder conditional logic, undo/redo, live preview
 * through ProFormRenderer and a JSON view that round-trips (validated with Ajv).
 */
export function ProFormBuilder({
  value,
  defaultValue,
  onChange,
  onSave,
  asyncValidators,
  onPreviewSubmit,
  defaultMode = "build",
  disabled,
  height = 640,
  className,
}: ProFormBuilderProps) {
  const [store] = React.useState(() => createBuilderStore(value ?? defaultValue ?? emptySchema()));
  const schema = useStore(store, (s) => s.schema);

  // Controlled mode: adopt outside changes without adding them to the undo history.
  React.useEffect(() => {
    if (value && value !== store.getState().schema) store.setState({ schema: value });
  }, [value, store]);

  const onChangeRef = React.useRef(onChange);
  onChangeRef.current = onChange;
  React.useEffect(
    () =>
      store.subscribe((s, prev) => {
        if (s.schema !== prev.schema && s.schema !== value) onChangeRef.current?.(s.schema);
      }),
    [store, value],
  );

  return (
    <BuilderStoreContext.Provider value={store}>
      <BuilderShell
        schema={schema}
        onSave={onSave}
        asyncValidators={asyncValidators}
        onPreviewSubmit={onPreviewSubmit}
        defaultMode={defaultMode}
        disabled={disabled}
        height={height}
        className={className}
      />
    </BuilderStoreContext.Provider>
  );
}

function BuilderShell({
  schema,
  onSave,
  asyncValidators,
  onPreviewSubmit,
  defaultMode,
  disabled,
  height,
  className,
}: Omit<ProFormBuilderProps, "value" | "defaultValue" | "onChange"> & {
  schema: FormSchema;
  defaultMode: Mode;
}) {
  const [mode, setMode] = React.useState<Mode>(defaultMode);
  const undo = useBuilder((s) => s.undo);
  const redo = useBuilder((s) => s.redo);
  const canUndo = useBuilder((s) => s.past.length > 0);
  const canRedo = useBuilder((s) => s.future.length > 0);
  const select = useBuilder((s) => s.select);
  const check = React.useMemo(() => validateFormSchema(schema), [schema]);
  const [saveState, setSaveState] = React.useState<"idle" | "saving" | "saved" | "error">("idle");
  const validatorNames = React.useMemo(() => Object.keys(asyncValidators ?? {}), [asyncValidators]);

  React.useEffect(() => setSaveState("idle"), [schema]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (disabled || !(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== "z") return;
    const t = e.target as HTMLElement;
    if (t.closest("input, textarea, select")) return; // keep native text undo inside inputs
    e.preventDefault();
    if (e.shiftKey) redo();
    else undo();
  };

  const save = async () => {
    if (!check.ok || !onSave) return;
    setSaveState("saving");
    try {
      await onSave(check.schema);
      setSaveState("saved");
    } catch {
      setSaveState("error");
    }
  };

  const modes: { id: Mode; label: string; icon: typeof Eye }[] = [
    { id: "build", label: "Build", icon: Hammer },
    { id: "preview", label: "Preview", icon: Eye },
    { id: "json", label: "JSON", icon: Braces },
  ];

  return (
    <div
      onKeyDown={onKeyDown}
      style={{ height }}
      className={cn(
        "flex min-h-[420px] flex-col overflow-hidden rounded-crm border border-crm-border bg-crm-bg font-crm text-crm-fg shadow-crm-raised",
        className,
      )}
    >
      <div className="flex flex-wrap items-center gap-2 border-b border-crm-border px-3 py-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{schema.title || "Untitled form"}</p>
          <p className="text-[11px] text-crm-subtle">
            {check.ok ? (
              <span className="text-crm-success">Valid schema</span>
            ) : (
              <span className="text-crm-warning" title={check.errors.join("\n")}>
                {check.errors.length} issue{check.errors.length > 1 ? "s" : ""}: {check.errors[0]}
              </span>
            )}
          </p>
        </div>
        <div
          role="tablist"
          aria-label="Builder mode"
          className="flex rounded-full bg-crm-raised p-0.5 shadow-crm-raised"
        >
          {modes.map((m) => (
            <button
              key={m.id}
              type="button"
              role="tab"
              aria-selected={mode === m.id}
              onClick={() => setMode(m.id)}
              className={cn(
                "flex cursor-pointer items-center gap-1 rounded-full px-2.5 py-1 text-xs outline-none focus-visible:ring-2 focus-visible:ring-crm-ring/60",
                mode === m.id ? "bg-crm-muted text-crm-fg" : "text-crm-muted-fg hover:text-crm-fg",
              )}
            >
              <m.icon className="size-3.5" aria-hidden /> {m.label}
            </button>
          ))}
        </div>
        {!disabled ? (
          <div className="flex items-center gap-1">
            <Button
              size="sm"
              variant="ghost"
              aria-label="Undo (Ctrl+Z)"
              title="Undo (Ctrl+Z)"
              disabled={!canUndo}
              onClick={undo}
            >
              <Undo2 aria-hidden />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              aria-label="Redo (Ctrl+Shift+Z)"
              title="Redo (Ctrl+Shift+Z)"
              disabled={!canRedo}
              onClick={redo}
            >
              <Redo2 aria-hidden />
            </Button>
            {onSave ? (
              <Button
                size="sm"
                variant="primary"
                disabled={!check.ok}
                loading={saveState === "saving"}
                onClick={save}
              >
                {saveState === "saved" ? <Check aria-hidden /> : <Save aria-hidden />}
                {saveState === "saved" ? "Saved" : saveState === "error" ? "Retry save" : "Save"}
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>

      {mode === "build" ? (
        <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-[200px_minmax(0,1fr)_280px]">
          <div className="hidden min-h-0 flex-col border-r border-crm-border p-2.5 md:flex">
            <FieldPalette disabled={disabled} />
          </div>
          <div
            className="flex min-h-0 flex-col gap-2 p-3"
            onClick={(e) => {
              if (e.target === e.currentTarget) select(null);
            }}
          >
            <PageTabs disabled={disabled} />
            <BuilderCanvas disabled={disabled} />
            <div className="md:hidden">
              <FieldPalette disabled={disabled} />
            </div>
          </div>
          <div className="min-h-0 overflow-y-auto border-t border-crm-border p-3 md:border-t-0 md:border-l">
            <SettingsPanel disabled={disabled} asyncValidatorNames={validatorNames} />
          </div>
        </div>
      ) : mode === "preview" ? (
        <PreviewPane
          schema={schema}
          asyncValidators={asyncValidators}
          onPreviewSubmit={onPreviewSubmit}
        />
      ) : (
        <JsonPane schema={schema} disabled={disabled} />
      )}
    </div>
  );
}

function PreviewPane({
  schema,
  asyncValidators,
  onPreviewSubmit,
}: {
  schema: FormSchema;
  asyncValidators?: Record<string, AsyncValidator>;
  onPreviewSubmit?: (values: FormValues) => void;
}) {
  const [payload, setPayload] = React.useState<FormValues | null>(null);
  return (
    <div className="grid min-h-0 flex-1 gap-3 overflow-y-auto bg-crm-sidebar p-4 lg:grid-cols-[minmax(0,1fr)_260px]">
      <div className="mx-auto w-full max-w-xl">
        <ProFormRenderer
          schema={schema}
          asyncValidators={asyncValidators}
          onSubmit={async (values) => {
            await new Promise((r) => setTimeout(r, 400));
            setPayload(values);
            onPreviewSubmit?.(values);
          }}
        />
      </div>
      <div className="rounded-crm bg-crm-card p-3 text-xs shadow-crm-raised">
        <p className="mb-2 font-medium text-crm-soft">Submitted payload</p>
        {payload ? (
          <pre className="overflow-x-auto font-mono text-[11px] whitespace-pre-wrap text-crm-muted-fg">
            {JSON.stringify(
              payload,
              (_k, v) =>
                typeof File !== "undefined" && v instanceof File ? `<File ${v.name}>` : v,
              2,
            )}
          </pre>
        ) : (
          <p className="text-crm-subtle">
            Fill in the preview and submit to inspect the JSON your backend receives.
          </p>
        )}
      </div>
    </div>
  );
}

function JsonPane({ schema, disabled }: { schema: FormSchema; disabled?: boolean }) {
  const replace = useBuilder((s) => s.replace);
  const json = React.useMemo(() => JSON.stringify(schema, null, 2), [schema]);
  const [draft, setDraft] = React.useState<string | null>(null);
  const [errors, setErrors] = React.useState<string[]>([]);
  const [copied, setCopied] = React.useState(false);

  const apply = () => {
    try {
      const parsed = JSON.parse(draft ?? json) as unknown;
      const res = validateFormSchema(parsed);
      if (!res.ok) return setErrors(res.errors);
      replace(res.schema);
      setDraft(null);
      setErrors([]);
    } catch (e) {
      setErrors([e instanceof Error ? e.message : "Invalid JSON"]);
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <p className="flex-1 text-xs text-crm-subtle">
          Store this JSON with the form. Edit and import to round-trip changes (checked with Ajv).
        </p>
        <Button
          size="sm"
          onClick={() => {
            void navigator.clipboard?.writeText(json).then(
              () => {
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              },
              () => undefined,
            );
          }}
        >
          {copied ? <Check aria-hidden /> : <Copy aria-hidden />} {copied ? "Copied" : "Copy"}
        </Button>
        {!disabled ? (
          <Button size="sm" variant="primary" disabled={draft === null} onClick={apply}>
            <Upload aria-hidden /> Import changes
          </Button>
        ) : null}
      </div>
      <textarea
        aria-label="Form schema JSON"
        spellCheck={false}
        readOnly={disabled}
        value={draft ?? json}
        onChange={(e) => setDraft(e.target.value)}
        className="min-h-0 flex-1 resize-none rounded-crm border border-crm-input/60 bg-crm-card p-3 font-mono text-[11px] leading-relaxed text-crm-fg outline-none focus-visible:border-crm-ring focus-visible:ring-2 focus-visible:ring-crm-ring/40"
      />
      {errors.length ? (
        <ul
          role="alert"
          className="max-h-24 list-disc overflow-y-auto pl-5 text-[11px] text-crm-danger"
        >
          {errors.slice(0, 10).map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
