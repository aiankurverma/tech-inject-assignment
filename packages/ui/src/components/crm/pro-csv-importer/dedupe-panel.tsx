import * as React from "react";
import { Copy, DatabaseZap } from "lucide-react";
import type { CsvImportController } from "@/hooks/use-csv-import";
import { btn } from "@/components/crm/pro-csv-importer/upload-step";

export interface DedupePanelProps {
  ctl: CsvImportController;
  dedupeKeys: readonly string[];
  labels: Map<string, string>;
  skipDuplicates: boolean;
  onSkipDuplicatesChange: (skip: boolean) => void;
}

/** Preview of duplicate groups (first 6) plus the skip / remove controls. */
export function DedupePanel({
  ctl,
  dedupeKeys,
  labels,
  skipDuplicates,
  onSkipDuplicatesChange,
}: DedupePanelProps) {
  const { state, rows, duplicates, bodyStart } = ctl;
  const groups = React.useMemo(() => {
    const cols = dedupeKeys.map((k) => state.mapping.indexOf(k));
    const out: { key: string; rows: number[]; existing: boolean }[] = [];
    const byKey = new Map<string, number>();
    const all = rows.current;
    const keyOf = (i: number) =>
      cols.map((c) => (c < 0 ? "" : (all[i]?.[c] ?? "").trim().toLowerCase())).join(" · ");
    const flagged = [...duplicates.current.inFile, ...duplicates.current.existing].sort(
      (a, b) => a - b,
    );
    for (const i of flagged) {
      if (out.length >= 6 && !byKey.has(keyOf(i))) continue;
      const k = keyOf(i);
      let g = byKey.get(k);
      if (g === undefined) {
        g = out.length;
        byKey.set(k, g);
        out.push({ key: k, rows: [], existing: duplicates.current.existing.has(i) });
      }
      if (!out[g]!.rows.includes(i)) out[g]!.rows.push(i);
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.version, state.mapping, dedupeKeys]);

  const total = state.inFileDupes + state.existingDupes;
  if (!dedupeKeys.length || total === 0) return null;

  return (
    <section
      aria-label="Duplicates"
      className="grid gap-2 border-b border-crm-border bg-crm-warning/[0.06] px-4 py-3"
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
        <span className="flex items-center gap-1.5 font-medium text-crm-fg">
          <Copy className="size-4 text-crm-warning" aria-hidden />
          {state.inFileDupes.toLocaleString()} repeated in file
        </span>
        <span className="flex items-center gap-1.5 font-medium text-crm-fg">
          <DatabaseZap className="size-4 text-crm-warning" aria-hidden />
          {state.existingDupes.toLocaleString()} already in CRM
        </span>
        <span className="text-xs text-crm-muted-fg">
          matched on {dedupeKeys.map((k) => labels.get(k) ?? k).join(" + ")}
        </span>
        <label className="ml-auto flex cursor-pointer items-center gap-2 text-sm text-crm-fg">
          <input
            type="checkbox"
            className="size-3.5 accent-crm-primary"
            checked={skipDuplicates}
            onChange={(e) => onSkipDuplicatesChange(e.target.checked)}
          />
          Skip duplicates on import
        </label>
        <button
          type="button"
          className={btn}
          onClick={() =>
            ctl.setExcluded([...duplicates.current.inFile, ...duplicates.current.existing], true)
          }
        >
          Remove all duplicates
        </button>
      </div>
      <ul className="flex flex-wrap gap-1.5" aria-label="Duplicate preview">
        {groups.map((g) => (
          <li
            key={g.key}
            className="max-w-full truncate rounded-full border border-tag-amber-border bg-tag-amber-bg px-2 py-0.5 text-xs text-tag-amber-text"
          >
            {g.key || "(blank)"} · rows{" "}
            {g.rows
              .slice(0, 4)
              .map((i) => i - bodyStart + 1)
              .join(", ")}
            {g.rows.length > 4 ? "…" : ""}
            {g.existing ? " · in CRM" : ""}
          </li>
        ))}
      </ul>
    </section>
  );
}
