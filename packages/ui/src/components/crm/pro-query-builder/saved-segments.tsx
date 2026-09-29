import * as React from "react";
import { Bookmark, Save, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { countRules, segmentNameSchema, type SavedSegment } from "@/lib/pro-query-builder";
import { inputCls } from "@/components/crm/pro-query-builder/value-editor";

export interface SavedSegmentsProps {
  segments: SavedSegment[];
  activeId: string | null;
  canSave: boolean;
  disabled?: boolean;
  onLoad: (segment: SavedSegment) => void;
  onSave: (name: string, overwriteId: string | null) => void;
  onDelete: (id: string) => void;
}

const relTime = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
function ago(isoDate: string) {
  const diff = (new Date(isoDate).getTime() - Date.now()) / 1000;
  const abs = Math.abs(diff);
  if (abs < 3600) return relTime.format(Math.round(diff / 60), "minute");
  if (abs < 86400) return relTime.format(Math.round(diff / 3600), "hour");
  return relTime.format(Math.round(diff / 86400), "day");
}

export function SavedSegments({
  segments,
  activeId,
  canSave,
  disabled,
  onLoad,
  onSave,
  onDelete,
}: SavedSegmentsProps) {
  const active = segments.find((s) => s.id === activeId) ?? null;
  const [name, setName] = React.useState(active?.name ?? "");
  const [error, setError] = React.useState<string | null>(null);
  React.useEffect(() => setName(active?.name ?? ""), [active?.name]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = segmentNameSchema.safeParse(name);
    if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? "Invalid name");
    const dup = segments.find(
      (s) => s.name.toLowerCase() === parsed.data.toLowerCase() && s.id !== activeId,
    );
    if (dup) return setError("A segment with this name already exists");
    setError(null);
    onSave(parsed.data, active && active.name === parsed.data ? active.id : null);
  };

  return (
    <section aria-label="Saved segments" className="flex min-h-0 flex-col gap-2">
      <form onSubmit={submit} className="flex flex-col gap-1" noValidate>
        <label htmlFor="qb-segment-name" className="text-[11px] font-medium text-crm-muted-fg">
          Segment name
        </label>
        <div className="flex gap-1.5">
          <input
            id="qb-segment-name"
            value={name}
            disabled={disabled}
            onChange={(e) => {
              setName(e.target.value);
              if (error) setError(null);
            }}
            aria-invalid={!!error || undefined}
            aria-describedby={error ? "qb-segment-error" : undefined}
            placeholder="e.g. Enterprise, churn risk"
            className={cn(inputCls, "flex-1")}
          />
          <button
            type="submit"
            disabled={disabled || !canSave}
            title={canSave ? undefined : "Fix invalid conditions first"}
            className="inline-flex h-[30px] items-center gap-1 rounded-full bg-crm-primary px-2.5 text-xs text-crm-primary-fg shadow-crm-primary outline-none hover:bg-[#5237ff] focus-visible:ring-2 focus-visible:ring-crm-ring/60 disabled:opacity-40"
          >
            <Save className="size-3.5" />
            {active && active.name === name.trim() ? "Update" : "Save"}
          </button>
        </div>
        {error && (
          <p id="qb-segment-error" role="alert" className="text-[11px] text-crm-danger">
            {error}
          </p>
        )}
      </form>
      <ul className="flex min-h-0 flex-col gap-1 overflow-auto" aria-label="Segments">
        {segments.length === 0 && (
          <li className="rounded-crm border border-dashed border-crm-border px-3 py-4 text-center text-xs text-crm-subtle">
            No saved segments yet
          </li>
        )}
        {segments.map((s) => (
          <li key={s.id} className="group flex items-center gap-1">
            <button
              type="button"
              onClick={() => onLoad(s)}
              aria-current={s.id === activeId || undefined}
              className={cn(
                "flex min-w-0 flex-1 items-center gap-2 rounded-crm px-2 py-1.5 text-left outline-none hover:bg-crm-muted focus-visible:ring-2 focus-visible:ring-crm-ring/60",
                s.id === activeId && "bg-crm-muted",
              )}
            >
              <Bookmark
                className={cn(
                  "size-3.5 shrink-0",
                  s.id === activeId ? "text-crm-primary" : "text-crm-subtle",
                )}
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs text-crm-fg">{s.name}</span>
                <span className="block text-[11px] text-crm-subtle">
                  {countRules(s.query)} conditions · {ago(s.updatedAt)}
                </span>
              </span>
            </button>
            <button
              type="button"
              aria-label={`Delete segment ${s.name}`}
              disabled={disabled}
              onClick={() => onDelete(s.id)}
              className="grid size-7 place-items-center rounded-crm text-crm-subtle opacity-0 outline-none group-hover:opacity-100 hover:bg-crm-danger/15 hover:text-crm-danger focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-crm-ring/60"
            >
              <Trash2 className="size-3.5" />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
