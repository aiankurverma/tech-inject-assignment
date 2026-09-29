import * as React from "react";
import { Check, Copy } from "lucide-react";
import type { RuleGroupType } from "react-querybuilder";
import { cn } from "@/lib/utils";
import { EXPORT_LABELS, exportQuery, type QueryExportFormat } from "@/lib/pro-query-builder";

export interface ExportPanelProps {
  query: RuleGroupType;
  formats: QueryExportFormat[];
  valid: boolean;
}

/** Tabbed read-only export view (WAI-ARIA tabs with arrow-key navigation). */
export function ExportPanel({ query, formats, valid }: ExportPanelProps) {
  const [active, setActive] = React.useState<QueryExportFormat>(formats[0] ?? "sql");
  const [copied, setCopied] = React.useState(false);
  const deferred = React.useDeferredValue(query);
  const output = React.useMemo(() => {
    try {
      return exportQuery(deferred, active);
    } catch (err) {
      return `/* ${(err as Error).message} */`;
    }
  }, [deferred, active]);
  const tabsRef = React.useRef<Array<HTMLButtonElement | null>>([]);
  const baseId = React.useId();

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(output);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked (e.g. insecure context) - nothing to do */
    }
  };

  return (
    <div className="flex min-h-0 flex-col rounded-crm border border-crm-border bg-crm-bg">
      <div className="flex items-center justify-between gap-2 border-b border-crm-border px-2 py-1.5">
        <div role="tablist" aria-label="Export format" className="flex gap-1">
          {formats.map((f, i) => (
            <button
              key={f}
              ref={(el) => {
                tabsRef.current[i] = el;
              }}
              id={`${baseId}-tab-${f}`}
              role="tab"
              type="button"
              aria-selected={active === f}
              aria-controls={`${baseId}-panel`}
              tabIndex={active === f ? 0 : -1}
              onClick={() => setActive(f)}
              onKeyDown={(e) => {
                if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
                e.preventDefault();
                const n = (i + (e.key === "ArrowRight" ? 1 : formats.length - 1)) % formats.length;
                setActive(formats[n]!);
                tabsRef.current[n]?.focus();
              }}
              className={cn(
                "h-6 rounded-full px-2.5 text-[11px] font-medium outline-none focus-visible:ring-2 focus-visible:ring-crm-ring/60",
                active === f ? "bg-crm-muted text-crm-fg" : "text-crm-subtle hover:text-crm-fg",
              )}
            >
              {EXPORT_LABELS[f]}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={copy}
          aria-label={`Copy ${EXPORT_LABELS[active]}`}
          className="inline-flex h-6 items-center gap-1 rounded-full px-2 text-[11px] text-crm-soft outline-none hover:bg-crm-muted hover:text-crm-fg focus-visible:ring-2 focus-visible:ring-crm-ring/60"
        >
          {copied ? <Check className="size-3 text-crm-success" /> : <Copy className="size-3" />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      {!valid && (
        <p className="border-b border-crm-border bg-crm-warning/10 px-3 py-1.5 text-[11px] text-crm-warning">
          The query has incomplete conditions; the export may not run as expected.
        </p>
      )}
      <pre
        id={`${baseId}-panel`}
        role="tabpanel"
        aria-labelledby={`${baseId}-tab-${active}`}
        tabIndex={0}
        className="min-h-24 flex-1 overflow-auto p-3 font-mono text-[11px] leading-relaxed whitespace-pre-wrap break-words text-crm-soft outline-none focus-visible:ring-2 focus-visible:ring-crm-ring/60"
      >
        {output}
      </pre>
    </div>
  );
}
