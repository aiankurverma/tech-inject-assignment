import * as React from "react";
import { Crown, GitMerge } from "lucide-react";
import { Button } from "@/components/crm/button";
import { ConfirmDialog } from "@/components/crm/confirm-dialog";
import { cn } from "@/lib/utils";

export interface MergeField {
  key: string;
  label: string;
  /** How to render the value (e.g. currency). Defaults to String(). */
  format?: (value: unknown) => string;
}

export interface MergeRecord {
  id: string;
  /** ISO timestamp; newest non-empty value wins by default. */
  updatedAt: string;
  createdAt: string;
  values: Record<string, unknown>;
  /** Related object counts that get re-parented, e.g. { Deals: 2, Notes: 14 }. */
  related?: Record<string, number>;
}

export interface MergeResult {
  masterId: string;
  mergedIds: string[];
  values: Record<string, unknown>;
  /** field key -> source record id */
  sources: Record<string, string>;
}

export interface MergeDuplicatesProps {
  records: MergeRecord[];
  fields: MergeField[];
  /** Human label per record column header, e.g. owner or source system. */
  recordLabel?: (r: MergeRecord) => string;
  onMerge: (result: MergeResult) => void | Promise<void>;
  onCancel?: () => void;
  className?: string;
}

const empty = (v: unknown) => v === undefined || v === null || (typeof v === "string" && !v.trim());
const same = (a: unknown, b: unknown) =>
  typeof a === "string" && typeof b === "string"
    ? a.trim().toLowerCase() === b.trim().toLowerCase()
    : a === b;

/** Default picks: newest non-empty value per field. */
export function defaultMergePicks(records: MergeRecord[], fields: MergeField[]) {
  const byNewest = [...records].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const picks: Record<string, string> = {};
  for (const f of fields) {
    const hit = byNewest.find((r) => !empty(r.values[f.key]));
    picks[f.key] = (hit ?? byNewest[0])!.id;
  }
  return picks;
}

const dateFmt = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

/** Side-by-side duplicate resolver: choose the surviving record and the winning value per field. */
export function MergeDuplicates({
  records,
  fields,
  recordLabel,
  onMerge,
  onCancel,
  className,
}: MergeDuplicatesProps) {
  const oldest = React.useMemo(
    () => [...records].sort((a, b) => a.createdAt.localeCompare(b.createdAt))[0]?.id ?? "",
    [records],
  );
  const [masterPick, setMasterId] = React.useState(oldest);
  // Fall back to the oldest record if the chosen master is no longer in the set.
  const masterId = records.some((r) => r.id === masterPick) ? masterPick : oldest;
  const [picks, setPicks] = React.useState(() => defaultMergePicks(records, fields));
  const [onlyConflicts, setOnlyConflicts] = React.useState(false);

  if (records.length < 2) {
    return (
      <div
        className={cn(
          "rounded-crm border border-crm-border bg-crm-card p-6 text-center font-crm text-xs text-crm-subtle",
          className,
        )}
      >
        Select at least two records to merge.
      </div>
    );
  }

  const conflict = (f: MergeField) => {
    const vals = records.map((r) => r.values[f.key]).filter((v) => !empty(v));
    return vals.some((v) => !same(v, vals[0]));
  };
  const conflicts = fields.filter(conflict);
  const shown = onlyConflicts ? conflicts : fields;
  const fmt = (f: MergeField, v: unknown) => (empty(v) ? "—" : f.format ? f.format(v) : String(v));
  const relatedTotals: Record<string, number> = {};
  for (const r of records)
    for (const [k, n] of Object.entries(r.related ?? {}))
      relatedTotals[k] = (relatedTotals[k] ?? 0) + n;

  const result = (): MergeResult => {
    const values: Record<string, unknown> = {};
    for (const f of fields)
      values[f.key] = records.find((r) => r.id === picks[f.key])?.values[f.key];
    return {
      masterId,
      mergedIds: records.filter((r) => r.id !== masterId).map((r) => r.id),
      values,
      sources: picks,
    };
  };
  const cols = `minmax(120px,160px) repeat(${records.length}, minmax(160px,1fr))`;

  return (
    <div
      className={cn(
        "flex flex-col gap-4 rounded-crm border border-crm-border bg-crm-card p-4 font-crm",
        className,
      )}
    >
      <div className="flex flex-wrap items-center gap-3">
        <GitMerge className="size-4 text-crm-icon" aria-hidden />
        <span className="text-sm font-medium text-crm-fg">Merge {records.length} records</span>
        <span className="text-xs text-crm-soft">
          {conflicts.length} conflicting field{conflicts.length === 1 ? "" : "s"}
        </span>
        <label className="ml-auto flex cursor-pointer items-center gap-2 text-xs text-crm-soft">
          <input
            type="checkbox"
            className="accent-crm-primary"
            checked={onlyConflicts}
            onChange={(e) => setOnlyConflicts(e.target.checked)}
          />
          Conflicts only
        </label>
      </div>

      <div className="overflow-x-auto">
        <div
          role="table"
          aria-label="Field values by record"
          className="grid min-w-fit gap-px text-sm"
          style={{ gridTemplateColumns: cols }}
        >
          <div role="row" className="contents">
            <span role="columnheader" className="px-2 py-2 text-xs text-crm-subtle">
              Field
            </span>
            {records.map((r) => {
              const master = r.id === masterId;
              return (
                <div role="columnheader" key={r.id} className="flex flex-col gap-1.5 px-2 py-2">
                  <span className="truncate text-xs text-crm-soft">{recordLabel?.(r) ?? r.id}</span>
                  <span className="text-[11px] text-crm-subtle">
                    Created {dateFmt.format(new Date(r.createdAt))}
                  </span>
                  <button
                    type="button"
                    aria-pressed={master}
                    onClick={() => setMasterId(r.id)}
                    className={cn(
                      "inline-flex w-fit cursor-pointer items-center gap-1 rounded-full border px-2 py-0.5 text-xs outline-none focus-visible:ring-2 focus-visible:ring-crm-ring/60",
                      master
                        ? "border-tag-amber-border bg-tag-amber-bg text-tag-amber-text"
                        : "border-crm-border text-crm-subtle hover:text-crm-fg",
                    )}
                  >
                    <Crown className="size-3" aria-hidden />
                    {master ? "Master" : "Make master"}
                  </button>
                </div>
              );
            })}
          </div>
          {shown.map((f) => {
            const isConflict = conflict(f);
            return (
              <div role="radiogroup" aria-label={f.label} key={f.key} className="contents">
                <span
                  className={cn(
                    "flex items-center border-t border-crm-border px-2 py-2 text-xs",
                    isConflict ? "text-crm-warning" : "text-crm-soft",
                  )}
                >
                  {f.label}
                </span>
                {records.map((r) => {
                  const v = r.values[f.key];
                  const on = picks[f.key] === r.id;
                  return (
                    <button
                      type="button"
                      role="radio"
                      aria-checked={on}
                      key={r.id}
                      disabled={empty(v) && !on}
                      onClick={() => setPicks((p) => ({ ...p, [f.key]: r.id }))}
                      className={cn(
                        "flex cursor-pointer items-center gap-2 border-t border-crm-border px-2 py-2 text-left outline-none focus-visible:ring-2 focus-visible:ring-crm-ring/60 disabled:cursor-not-allowed",
                        on ? "bg-crm-primary/10 text-crm-fg" : "text-crm-soft hover:bg-crm-raised",
                      )}
                    >
                      <span
                        aria-hidden
                        className={cn(
                          "size-3 shrink-0 rounded-full border",
                          on ? "border-crm-primary bg-crm-primary" : "border-crm-input",
                        )}
                      />
                      <span className="truncate">{fmt(f, v)}</span>
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      {Object.keys(relatedTotals).length ? (
        <p className="text-xs text-crm-soft">
          Moves to master:{" "}
          {Object.entries(relatedTotals)
            .map(([k, n]) => `${n} ${k}`)
            .join(" · ")}
        </p>
      ) : null}

      <div className="flex flex-wrap justify-end gap-2 border-t border-crm-border pt-3">
        <Button variant="ghost" onClick={() => setPicks(defaultMergePicks(records, fields))}>
          Reset to newest
        </Button>
        {onCancel ? (
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        ) : null}
        <ConfirmDialog
          trigger={<Button variant="primary">Merge records</Button>}
          title={`Merge into ${recordLabel?.(records.find((r) => r.id === masterId)!) ?? masterId}?`}
          description={`${records.length - 1} record${records.length > 2 ? "s" : ""} will be archived and their activity moved to the master. This can't be undone.`}
          confirmLabel="Merge"
          onConfirm={() => onMerge(result())}
        />
      </div>
    </div>
  );
}
