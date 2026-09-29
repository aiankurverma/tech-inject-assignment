import * as React from "react";
import { CheckCircle2, GitMerge, PencilLine, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  display,
  isEmpty,
  type MergeAudit,
  type MergeRecord,
} from "@/components/crm/pro-record-merge/model";

/** Human-readable summary of a merge: survivor, removed records and per-field decisions. */
export function MergeAuditView({
  audit,
  recordLabel,
  status,
  className,
}: {
  audit: MergeAudit;
  recordLabel: (id: string) => string;
  /** "preview" before confirming, "done" afterwards. */
  status: "preview" | "done";
  className?: string;
}) {
  const changed = audit.fields.filter((f) => f.conflict || f.pickedFrom === "custom");
  return (
    <section
      aria-label="Merge summary"
      className={cn(
        "flex flex-col gap-3 rounded-crm border border-crm-border bg-crm-card p-3 font-crm text-crm-fg",
        className,
      )}
    >
      <header className="flex items-start gap-2">
        {status === "done" ? (
          <CheckCircle2 className="mt-0.5 size-4 text-crm-success" aria-hidden />
        ) : (
          <GitMerge className="mt-0.5 size-4 text-crm-primary" aria-hidden />
        )}
        <div className="flex flex-col gap-0.5">
          <h3 className="text-sm font-semibold">
            {status === "done" ? "Merge complete" : "Review merge"}
          </h3>
          <p className="text-xs text-crm-muted-fg">
            {status === "done" ? "Kept" : "Will keep"}{" "}
            <span className="text-crm-fg">{recordLabel(audit.survivorId)}</span> and{" "}
            {status === "done" ? "removed" : "remove"} {audit.mergedIds.length} duplicate
            {audit.mergedIds.length === 1 ? "" : "s"}. {audit.conflictsResolved} conflict
            {audit.conflictsResolved === 1 ? "" : "s"} resolved, {audit.customEdits} custom edit
            {audit.customEdits === 1 ? "" : "s"}.
          </p>
        </div>
      </header>
      <ul className="flex flex-wrap gap-1.5" aria-label="Records removed">
        {audit.mergedIds.map((id) => (
          <li
            key={id}
            className="inline-flex items-center gap-1 rounded-full border border-crm-border bg-crm-raised px-2 py-0.5 text-[11px] text-crm-soft"
          >
            <Trash2 className="size-3 text-crm-danger" aria-hidden />
            {recordLabel(id)}
          </li>
        ))}
      </ul>
      {changed.length > 0 ? (
        <table className="w-full text-left text-xs">
          <caption className="sr-only">Field decisions</caption>
          <thead className="text-crm-muted-fg">
            <tr>
              <th scope="col" className="py-1 pr-2 font-medium">
                Field
              </th>
              <th scope="col" className="py-1 pr-2 font-medium">
                Final value
              </th>
              <th scope="col" className="py-1 font-medium">
                Source
              </th>
            </tr>
          </thead>
          <tbody>
            {changed.map((f) => (
              <tr key={f.key} className="border-t border-crm-border align-top">
                <th scope="row" className="py-1.5 pr-2 font-normal text-crm-soft">
                  {f.label}
                </th>
                <td className="max-w-[320px] py-1.5 pr-2 break-words">
                  {isEmpty(f.value) ? (
                    <span className="text-crm-muted-fg">Empty</span>
                  ) : (
                    display(f.value)
                  )}
                </td>
                <td className="py-1.5 whitespace-nowrap text-crm-soft">
                  {f.pickedFrom === "custom" ? (
                    <span className="inline-flex items-center gap-1 text-crm-warning">
                      <PencilLine className="size-3" aria-hidden /> Edited
                    </span>
                  ) : (
                    recordLabel(f.pickedFrom)
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="text-xs text-crm-muted-fg">No conflicting fields; values were combined.</p>
      )}
    </section>
  );
}

export function recordTitle(r: MergeRecord | undefined, titleKey: string) {
  if (!r) return "Unknown record";
  const t = display(r.values[titleKey]);
  return t ? `${t} (${r.id})` : r.id;
}
