import * as React from "react";
import { ArrowRight, CheckCircle2, CircleAlert, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ColumnMapping, ImporterField } from "@/components/crm/pro-csv-importer/types";

export interface MappingStepProps {
  headers: string[];
  samples: string[][];
  fields: readonly ImporterField[];
  mapping: ColumnMapping;
  confidence: (number | null)[];
  hasHeader: boolean;
  delimiter: string;
  rowCount: number;
  truncated: boolean;
  onMap: (col: number, key: string | null) => void;
  onHasHeaderChange: (hasHeader: boolean) => void;
}

const delimiterName: Record<string, string> = {
  ",": "comma",
  ";": "semicolon",
  "\t": "tab",
  "|": "pipe",
};

export function MappingStep({
  headers,
  samples,
  fields,
  mapping,
  confidence,
  hasHeader,
  delimiter,
  rowCount,
  truncated,
  onMap,
  onHasHeaderChange,
}: MappingStepProps) {
  const mapped = new Set(mapping.filter(Boolean));
  const missing = fields.filter((f) => f.required && !mapped.has(f.key));
  const headerId = React.useId();

  return (
    <div className="grid gap-4 p-4 lg:grid-cols-[1fr_240px]">
      <div className="min-w-0">
        <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-crm-muted-fg">
          <span className="tabular-nums">
            {rowCount.toLocaleString()} rows · {headers.length} columns ·{" "}
            {delimiterName[delimiter] ?? delimiter}-separated
          </span>
          {truncated && <span className="text-crm-warning">Row limit reached; file truncated</span>}
          <label className="ml-auto flex cursor-pointer items-center gap-2 text-sm text-crm-fg">
            <input
              type="checkbox"
              className="size-3.5 accent-crm-primary"
              checked={hasHeader}
              onChange={(e) => onHasHeaderChange(e.target.checked)}
            />
            First row is a header
          </label>
        </div>
        <div className="overflow-x-auto rounded-crm border border-crm-border">
          <table className="w-full min-w-[560px] text-sm" aria-describedby={headerId}>
            <caption id={headerId} className="sr-only">
              Map each column in your file to a CRM field
            </caption>
            <thead className="bg-crm-muted/50 text-left text-xs text-crm-muted-fg">
              <tr>
                <th scope="col" className="px-3 py-2 font-medium">
                  Column in file
                </th>
                <th scope="col" className="px-3 py-2 font-medium">
                  Sample values
                </th>
                <th scope="col" className="w-8" aria-hidden />
                <th scope="col" className="px-3 py-2 font-medium">
                  Import as
                </th>
              </tr>
            </thead>
            <tbody>
              {headers.map((h, col) => {
                const key = mapping[col] ?? null;
                const conf = confidence[col];
                const auto = key !== null && conf !== null && conf !== undefined && conf > 0;
                return (
                  <tr key={col} className="border-t border-crm-border">
                    <th scope="row" className="px-3 py-2 text-left font-medium text-crm-fg">
                      <span className="block max-w-48 truncate">{h}</span>
                    </th>
                    <td className="px-3 py-2 text-crm-muted-fg">
                      <span className="block max-w-64 truncate">
                        {samples
                          .map((r) => r[col] ?? "")
                          .filter(Boolean)
                          .slice(0, 3)
                          .join(" · ") || "—"}
                      </span>
                    </td>
                    <td aria-hidden>
                      <ArrowRight className="size-4 text-crm-faint" />
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <select
                          value={key ?? ""}
                          onChange={(e) => onMap(col, e.target.value || null)}
                          aria-label={`Field for column ${h}`}
                          className={cn(
                            "h-8 min-w-40 flex-1 rounded-[6px] border bg-crm-bg px-2 text-sm text-crm-fg outline-none focus-visible:border-crm-ring",
                            key
                              ? "border-crm-input"
                              : "border-dashed border-crm-border text-crm-muted-fg",
                          )}
                        >
                          <option value="">Don’t import</option>
                          {fields.map((f) => (
                            <option key={f.key} value={f.key}>
                              {f.label}
                              {f.required ? " *" : ""}
                              {mapped.has(f.key) && f.key !== key ? " (in use)" : ""}
                            </option>
                          ))}
                        </select>
                        {auto && (
                          <span
                            title={`Auto-matched (${Math.round((1 - conf) * 100)}% confidence)`}
                            className="inline-flex items-center gap-1 rounded-full bg-tag-purple-bg px-1.5 py-0.5 text-[11px] text-tag-purple-text"
                          >
                            <Sparkles className="size-3" aria-hidden />
                            {Math.round((1 - conf) * 100)}%
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      <aside className="h-fit rounded-crm border border-crm-border bg-crm-bg p-3">
        <p className="text-xs font-medium tracking-wide text-crm-muted-fg uppercase">Fields</p>
        <ul className="mt-2 grid gap-1.5">
          {fields.map((f) => {
            const ok = mapped.has(f.key);
            return (
              <li key={f.key} className="flex items-center gap-2 text-sm">
                {ok ? (
                  <CheckCircle2 className="size-4 text-crm-success" aria-label="mapped" />
                ) : f.required ? (
                  <CircleAlert
                    className="size-4 text-crm-danger"
                    aria-label="required, not mapped"
                  />
                ) : (
                  <span
                    className="size-4 rounded-full border border-crm-border"
                    aria-label="not mapped"
                  />
                )}
                <span className={cn("truncate", ok ? "text-crm-fg" : "text-crm-muted-fg")}>
                  {f.label}
                </span>
              </li>
            );
          })}
        </ul>
        {missing.length > 0 && (
          <p role="alert" className="mt-3 text-xs text-crm-danger">
            Map {missing.map((f) => f.label).join(", ")} to continue.
          </p>
        )}
      </aside>
    </div>
  );
}
