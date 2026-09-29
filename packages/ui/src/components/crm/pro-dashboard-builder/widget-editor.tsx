import * as React from "react";
import {
  QueryBuilder,
  formatQuery,
  type Classnames,
  type Field,
  type RuleGroupType,
} from "react-querybuilder";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  AGGREGATES,
  FORMATS,
  WIDGET_TYPES,
  type DashboardField,
  type WidgetConfig,
} from "@/components/crm/pro-dashboard-builder/schema";

const control =
  "h-7 rounded-crm border border-crm-border bg-crm-input px-2 text-xs text-crm-fg focus-visible:outline-2 focus-visible:outline-crm-ring";
const btn =
  "h-7 rounded-crm border border-crm-border bg-crm-card px-2 text-xs text-crm-fg hover:bg-crm-muted focus-visible:outline-2 focus-visible:outline-crm-ring";

const qbClasses: Partial<Classnames> = {
  queryBuilder: "text-xs",
  ruleGroup: "flex flex-col gap-2 rounded-crm border border-crm-border bg-crm-muted/40 p-2",
  header: "flex flex-wrap items-center gap-1.5",
  body: "flex flex-col gap-1.5 empty:hidden",
  rule: "flex flex-wrap items-center gap-1.5",
  combinators: control,
  fields: control,
  operators: control,
  value: cn(control, "min-w-20 flex-1"),
  addRule: btn,
  addGroup: btn,
  removeRule: cn(btn, "text-crm-danger"),
  removeGroup: cn(btn, "text-crm-danger"),
  notToggle: "inline-flex items-center gap-1 text-crm-muted-fg",
};

export interface WidgetEditorProps {
  widget: WidgetConfig;
  fields: DashboardField[];
  onChange: (patch: Partial<WidgetConfig>, key: string) => void;
  onClose: () => void;
}

function Label({ children, htmlFor }: { children: React.ReactNode; htmlFor: string }) {
  return (
    <label htmlFor={htmlFor} className="mb-1 block text-[11px] font-medium text-crm-muted-fg">
      {children}
    </label>
  );
}

export function WidgetEditor({ widget, fields, onChange, onClose }: WidgetEditorProps) {
  const id = React.useId();
  const titleRef = React.useRef<HTMLInputElement>(null);
  React.useEffect(() => titleRef.current?.focus(), [widget.id]);
  const qbFields = React.useMemo<Field[]>(
    () =>
      fields.map((f) => ({
        name: f.name,
        label: f.label,
        inputType: f.type === "number" ? "number" : f.type === "date" ? "date" : "text",
        ...(f.options
          ? { valueEditorType: "select", values: f.options.map((o) => ({ name: o, label: o })) }
          : {}),
      })),
    [fields],
  );
  const numeric = fields.filter((f) => f.type === "number");
  const dims = fields.filter((f) =>
    widget.type === "line" ? f.type === "date" : f.type !== "number",
  );
  const sql = React.useMemo(() => formatQuery(widget.query, "sql"), [widget.query]);
  const set = (patch: Partial<WidgetConfig>, key = Object.keys(patch)[0]) =>
    onChange(patch, `${widget.id}:${key}`);

  return (
    <aside
      role="dialog"
      aria-labelledby={`${id}-h`}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.stopPropagation();
          onClose();
        }
      }}
      className="flex w-full flex-col border-l border-crm-border bg-crm-card md:w-[360px]"
    >
      <div className="flex items-center justify-between border-b border-crm-border px-4 py-3">
        <h3 id={`${id}-h`} className="text-sm font-semibold text-crm-fg">
          Widget settings
        </h3>
        <button type="button" onClick={onClose} aria-label="Close settings" className={btn}>
          <X className="size-3.5" aria-hidden />
        </button>
      </div>
      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        <div>
          <Label htmlFor={`${id}-t`}>Title</Label>
          <input
            ref={titleRef}
            id={`${id}-t`}
            value={widget.title}
            maxLength={80}
            onChange={(e) => set({ title: e.target.value })}
            className={cn(control, "w-full")}
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label htmlFor={`${id}-ty`}>Type</Label>
            <select
              id={`${id}-ty`}
              value={widget.type}
              onChange={(e) => set({ type: e.target.value as WidgetConfig["type"] })}
              className={cn(control, "w-full")}
            >
              {WIDGET_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t.toUpperCase()}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor={`${id}-f`}>Format</Label>
            <select
              id={`${id}-f`}
              value={widget.format}
              onChange={(e) => set({ format: e.target.value as WidgetConfig["format"] })}
              className={cn(control, "w-full")}
            >
              {FORMATS.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </div>
          {widget.type !== "table" && (
            <>
              <div>
                <Label htmlFor={`${id}-a`}>Aggregate</Label>
                <select
                  id={`${id}-a`}
                  value={widget.agg}
                  onChange={(e) => set({ agg: e.target.value as WidgetConfig["agg"] })}
                  className={cn(control, "w-full")}
                >
                  {AGGREGATES.map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor={`${id}-m`}>Metric</Label>
                <select
                  id={`${id}-m`}
                  value={widget.metric ?? ""}
                  disabled={widget.agg === "count"}
                  onChange={(e) => set({ metric: e.target.value || undefined })}
                  className={cn(control, "w-full disabled:opacity-50")}
                >
                  <option value="">—</option>
                  {numeric.map((f) => (
                    <option key={f.name} value={f.name}>
                      {f.label}
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}
          {(widget.type === "line" || widget.type === "bar") && (
            <div className="col-span-2">
              <Label htmlFor={`${id}-g`}>
                Group by {widget.type === "line" ? "(month)" : "(top 12)"}
              </Label>
              <select
                id={`${id}-g`}
                value={widget.groupBy ?? ""}
                onChange={(e) => set({ groupBy: e.target.value || undefined })}
                className={cn(control, "w-full")}
              >
                <option value="">—</option>
                {dims.map((f) => (
                  <option key={f.name} value={f.name}>
                    {f.label}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
        {widget.type === "table" && (
          <fieldset>
            <legend className="mb-1 text-[11px] font-medium text-crm-muted-fg">Columns</legend>
            <div className="flex flex-wrap gap-1.5">
              {fields.map((f) => {
                const cols = widget.columns ?? fields.slice(0, 5).map((x) => x.name);
                const on = cols.includes(f.name);
                return (
                  <button
                    key={f.name}
                    type="button"
                    aria-pressed={on}
                    onClick={() =>
                      set({ columns: on ? cols.filter((c) => c !== f.name) : [...cols, f.name] })
                    }
                    className={cn(
                      btn,
                      on && "border-crm-primary bg-crm-primary/10 text-crm-primary",
                    )}
                  >
                    {f.label}
                  </button>
                );
              })}
            </div>
          </fieldset>
        )}
        <div>
          <div className="mb-1 text-[11px] font-medium text-crm-muted-fg">Query</div>
          <QueryBuilder
            fields={qbFields}
            query={widget.query}
            onQueryChange={(q: RuleGroupType) => set({ query: q }, "query")}
            controlClassnames={qbClasses}
            showNotToggle
          />
          <pre className="mt-2 overflow-x-auto whitespace-pre-wrap rounded-crm bg-crm-muted p-2 font-mono text-[11px] text-crm-muted-fg">
            WHERE {sql}
          </pre>
        </div>
      </div>
    </aside>
  );
}
