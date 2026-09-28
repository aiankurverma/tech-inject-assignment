import * as React from "react";
import { ArrowRight, CircleAlert, CircleCheck, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/crm/button";
import { Select } from "@/components/crm/select";

export type ImportFieldType = "text" | "email" | "phone" | "number" | "currency" | "date" | "url";

export interface ImportTargetField {
  key: string;
  label: string;
  type?: ImportFieldType;
  required?: boolean;
  /** Extra header names that should auto-map here, e.g. ["e-mail", "work email"]. */
  aliases?: string[];
}

/** Map of CSV column index → target field key, or null to skip the column. */
export type ImportMapping = Record<number, string | null>;

export interface ImportMapperProps {
  /** CSV header row. */
  headers: string[];
  /** A few sample data rows used for previews and type checks. */
  rows: string[][];
  fields: ImportTargetField[];
  /** Controlled mapping. */
  mapping?: ImportMapping;
  onMappingChange?: (m: ImportMapping) => void;
  onConfirm?: (m: ImportMapping) => void;
  onBack?: () => void;
  fileName?: string;
  /** Total rows in the file (rows may be only a sample). */
  totalRows?: number;
  className?: string;
}

const SKIP = "__skip";
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

const checks: Record<ImportFieldType, (v: string) => boolean> = {
  text: () => true,
  email: (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
  phone: (v) => v.replace(/[^\d]/g, "").length >= 7,
  number: (v) => !Number.isNaN(Number(v.replace(/[,\s]/g, ""))),
  currency: (v) => !Number.isNaN(Number(v.replace(/[^\d.-]/g, ""))) && /\d/.test(v),
  date: (v) => !Number.isNaN(Date.parse(v)),
  url: (v) => /^(https?:\/\/)?[\w-]+(\.[\w-]+)+/.test(v),
};

/** Guesses a mapping from headers: exact key/label/alias match first, then containment. Each field maps once. */
export function autoMap(headers: string[], fields: ImportTargetField[]): ImportMapping {
  const used = new Set<string>();
  const out: ImportMapping = {};
  const names = (f: ImportTargetField) => [f.key, f.label, ...(f.aliases ?? [])].map(norm);
  headers.forEach((h, i) => {
    const n = norm(h);
    const exact = fields.find((f) => !used.has(f.key) && names(f).includes(n));
    const loose =
      exact ??
      fields.find(
        (f) =>
          !used.has(f.key) &&
          n.length > 2 &&
          names(f).some((x) => x.length > 2 && (n.includes(x) || x.includes(n))),
      );
    out[i] = loose ? loose.key : null;
    if (loose) used.add(loose.key);
  });
  return out;
}

/**
 * CSV column → CRM field mapping step: auto-matches headers (with aliases), shows sample values,
 * validates sample data against the field type, blocks duplicate targets, and lists unmapped
 * required fields before import can continue.
 */
export function ImportMapper({
  headers,
  rows,
  fields,
  mapping: mappingProp,
  onMappingChange,
  onConfirm,
  onBack,
  fileName,
  totalRows,
  className,
}: ImportMapperProps) {
  const [inner, setInner] = React.useState<ImportMapping>(() => autoMap(headers, fields));
  const mapping = mappingProp ?? inner;
  const set = (m: ImportMapping) => {
    if (mappingProp === undefined) setInner(m);
    onMappingChange?.(m);
  };

  const byKey = new Map(fields.map((f) => [f.key, f]));
  const counts = new Map<string, number>();
  Object.values(mapping).forEach((k) => k && counts.set(k, (counts.get(k) ?? 0) + 1));
  const missing = fields.filter((f) => f.required && !counts.get(f.key));
  const dupes = [...counts.entries()]
    .filter(([, n]) => n > 1)
    .map(([k]) => byKey.get(k)?.label ?? k);
  const mappedCount = Object.values(mapping).filter(Boolean).length;
  const ready = missing.length === 0 && dupes.length === 0 && mappedCount > 0;

  const invalidShare = (col: number, key: string | null) => {
    const type = key ? byKey.get(key)?.type : undefined;
    if (!type) return 0;
    const vals = rows.map((r) => (r[col] ?? "").trim()).filter(Boolean);
    if (!vals.length) return 0;
    return vals.filter((v) => !checks[type](v)).length / vals.length;
  };

  const options = [
    { value: SKIP, label: "Don't import" },
    ...fields.map((f) => ({ value: f.key, label: `${f.label}${f.required ? " *" : ""}` })),
  ];

  return (
    <section
      className={cn("flex flex-col gap-4 font-crm text-crm-fg", className)}
      aria-label="Map columns"
    >
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-medium">Map columns{fileName ? ` from ${fileName}` : ""}</h3>
          <p className="text-xs text-crm-subtle">
            {mappedCount} of {headers.length} columns mapped
            {totalRows != null ? ` · ${totalRows.toLocaleString("en-US")} rows` : ""}
          </p>
        </div>
        <div className="flex gap-1.5">
          <Button size="sm" variant="ghost" onClick={() => set(autoMap(headers, fields))}>
            <Sparkles className="size-3.5" aria-hidden /> Auto-match
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => set(Object.fromEntries(headers.map((_, i) => [i, null])))}
          >
            Skip all
          </Button>
        </div>
      </header>

      <div className="overflow-x-auto rounded-crm border border-crm-border">
        <table className="w-full min-w-[560px] text-left text-xs">
          <thead className="bg-crm-raised text-crm-subtle">
            <tr>
              <th scope="col" className="px-3 py-2 font-medium">
                File column
              </th>
              <th scope="col" className="px-3 py-2 font-medium">
                Sample values
              </th>
              <th scope="col" className="w-8" aria-label="maps to" />
              <th scope="col" className="w-56 px-3 py-2 font-medium">
                CRM field
              </th>
            </tr>
          </thead>
          <tbody>
            {headers.map((h, i) => {
              const key = mapping[i] ?? null;
              const bad = invalidShare(i, key);
              const isDupe = key != null && (counts.get(key) ?? 0) > 1;
              const samples = rows
                .map((r) => r[i])
                .filter(Boolean)
                .slice(0, 3);
              return (
                <tr
                  key={`${h}-${i}`}
                  className={cn("border-t border-crm-border align-top", !key && "opacity-60")}
                >
                  <th scope="row" className="px-3 py-2.5 font-medium">
                    {h || <span className="text-crm-subtle italic">Column {i + 1}</span>}
                  </th>
                  <td className="max-w-56 px-3 py-2.5 text-crm-soft">
                    {samples.length ? (
                      samples.map((s, j) => (
                        <span key={j} className="block truncate" title={s}>
                          {s}
                        </span>
                      ))
                    ) : (
                      <span className="text-crm-subtle">Empty</span>
                    )}
                  </td>
                  <td className="py-3 text-crm-subtle">
                    <ArrowRight className="size-3.5" aria-hidden />
                  </td>
                  <td className="px-3 py-2">
                    <Select
                      aria-label={`Map ${h || `column ${i + 1}`} to`}
                      options={options}
                      value={key ?? SKIP}
                      invalid={isDupe}
                      onValueChange={(v) => set({ ...mapping, [i]: v === SKIP ? null : v })}
                      className="h-8"
                    />
                    {isDupe ? (
                      <p className="mt-1 text-[11px] text-crm-danger">
                        Mapped from more than one column
                      </p>
                    ) : bad > 0 ? (
                      <p className="mt-1 flex items-center gap-1 text-[11px] text-crm-warning">
                        <CircleAlert className="size-3" aria-hidden />
                        {Math.round(bad * 100)}% of samples don't look like {byKey.get(key!)?.type}
                      </p>
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div role="status" aria-live="polite" className="flex flex-col gap-1 text-xs">
        {missing.length ? (
          <p className="flex items-center gap-1.5 text-crm-danger">
            <CircleAlert className="size-3.5" aria-hidden />
            Required field{missing.length > 1 ? "s" : ""} not mapped:{" "}
            {missing.map((f) => f.label).join(", ")}
          </p>
        ) : null}
        {dupes.length ? (
          <p className="flex items-center gap-1.5 text-crm-danger">
            <CircleAlert className="size-3.5" aria-hidden />
            Each field can be mapped once: {dupes.join(", ")}
          </p>
        ) : null}
        {ready ? (
          <p className="flex items-center gap-1.5 text-crm-success">
            <CircleCheck className="size-3.5" aria-hidden />
            Ready to import {mappedCount} column{mappedCount > 1 ? "s" : ""}
            {headers.length - mappedCount ? `, skipping ${headers.length - mappedCount}` : ""}
          </p>
        ) : null}
      </div>

      {onConfirm || onBack ? (
        <footer className="flex justify-end gap-2 border-t border-crm-border pt-4">
          {onBack ? (
            <Button variant="ghost" onClick={onBack}>
              Back
            </Button>
          ) : null}
          {onConfirm ? (
            <Button variant="primary" disabled={!ready} onClick={() => onConfirm(mapping)}>
              Continue
            </Button>
          ) : null}
        </footer>
      ) : null}
    </section>
  );
}
