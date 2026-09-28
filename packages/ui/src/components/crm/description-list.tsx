import * as React from "react";
import { Check, Copy } from "lucide-react";
import { cn } from "@/lib/utils";

export interface DescriptionItem {
  label: string;
  value?: React.ReactNode;
  /** Plain text copied to the clipboard; shows a copy button on hover/focus. */
  copyValue?: string;
  /** Leading icon next to the label. */
  icon?: React.ReactNode;
  /** Span the full row in multi-column grids. */
  fullWidth?: boolean;
}

export interface DescriptionListProps extends React.HTMLAttributes<HTMLDListElement> {
  items: DescriptionItem[];
  /** stacked: label above value. inline: label column + value column. */
  layout?: "stacked" | "inline";
  columns?: 1 | 2 | 3;
  /** Shown when value is empty/null. */
  emptyText?: string;
  /** Hairline dividers between rows (defaults to true for inline layout). */
  divided?: boolean;
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = React.useState(false);
  React.useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(t);
  }, [copied]);
  return (
    <button
      type="button"
      aria-label={copied ? `${label} copied` : `Copy ${label}`}
      onClick={() => {
        navigator.clipboard
          ?.writeText(text)
          .then(() => setCopied(true))
          .catch(() => undefined);
      }}
      className="inline-flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-md text-crm-subtle opacity-0 outline-none transition-opacity group-hover:opacity-100 hover:bg-crm-muted hover:text-crm-fg focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-crm-ring/60 [&_svg]:size-3.5"
    >
      {copied ? <Check className="text-crm-success" /> : <Copy />}
    </button>
  );
}

const cols = { 1: "", 2: "sm:grid-cols-2", 3: "sm:grid-cols-2 lg:grid-cols-3" } as const;

/** Key/value record fields as a semantic <dl>, with empty states and copy-to-clipboard. */
export function DescriptionList({
  items,
  layout = "stacked",
  columns = 1,
  emptyText = "—",
  divided,
  className,
  ...props
}: DescriptionListProps) {
  const lines = divided ?? layout === "inline";
  return (
    <dl
      className={cn(
        "grid font-crm",
        layout === "stacked" ? "gap-x-6 gap-y-4" : "gap-x-6",
        cols[columns],
        className,
      )}
      {...props}
    >
      {items.map((item) => {
        const empty = item.value === undefined || item.value === null || item.value === "";
        return (
          <div
            key={item.label}
            className={cn(
              "group min-w-0",
              layout === "stacked"
                ? "flex flex-col gap-1"
                : "grid grid-cols-[minmax(96px,40%)_1fr] items-center gap-3 py-2",
              lines && "border-b border-crm-border pb-2 last:border-b-0",
              item.fullWidth && "sm:col-span-full",
            )}
          >
            <dt className="flex items-center gap-1.5 text-xs text-crm-subtle [&_svg]:size-3.5">
              {item.icon ? <span aria-hidden>{item.icon}</span> : null}
              {item.label}
            </dt>
            <dd className="flex min-h-6 min-w-0 items-center gap-1 text-sm text-crm-fg">
              <span className={cn("min-w-0 truncate", empty && "text-crm-faint")}>
                {empty ? emptyText : item.value}
              </span>
              {item.copyValue && !empty ? (
                <CopyButton text={item.copyValue} label={item.label} />
              ) : null}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}
