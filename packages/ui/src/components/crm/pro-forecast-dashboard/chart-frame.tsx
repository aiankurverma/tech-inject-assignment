import * as React from "react";
import * as ToggleGroup from "@radix-ui/react-toggle-group";
import { BarChart3, Table2 } from "lucide-react";
import { cn } from "@/lib/utils";

export type FrameView = "chart" | "table";

export const segmentItem =
  "inline-flex h-7 items-center gap-1.5 rounded-[5px] px-2 text-xs text-crm-muted-fg hover:text-crm-fg focus-visible:ring-2 focus-visible:ring-crm-ring focus-visible:outline-none data-[state=on]:bg-crm-muted data-[state=on]:text-crm-fg";

export interface ChartFrameProps {
  title: string;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  /** Visual chart. */
  chart: React.ReactNode;
  /** Equivalent data table (screen readers, copy/paste, print). */
  table: React.ReactNode;
  className?: string;
}

/** Card with a Chart / Table switch so every chart has an accessible tabular equivalent. */
export function ChartFrame({ title, subtitle, actions, chart, table, className }: ChartFrameProps) {
  const [view, setView] = React.useState<FrameView>("chart");
  const id = React.useId();
  return (
    <section
      aria-labelledby={id}
      className={cn(
        "flex min-w-0 flex-col rounded-crm border border-crm-border bg-crm-card shadow-crm-raised",
        className,
      )}
    >
      <header className="flex flex-wrap items-start gap-2 px-4 pt-3 pb-2">
        <div className="min-w-0 flex-1">
          <h3 id={id} className="text-sm font-medium text-crm-fg">
            {title}
          </h3>
          {subtitle && <p className="text-xs text-crm-muted-fg">{subtitle}</p>}
        </div>
        {actions}
        <ToggleGroup.Root
          type="single"
          value={view}
          onValueChange={(v) => v && setView(v as FrameView)}
          aria-label={`${title} view`}
          className="flex rounded-[6px] border border-crm-border p-0.5"
        >
          <ToggleGroup.Item value="chart" aria-label="Show chart" className={segmentItem}>
            <BarChart3 className="size-3.5" aria-hidden />
          </ToggleGroup.Item>
          <ToggleGroup.Item value="table" aria-label="Show data table" className={segmentItem}>
            <Table2 className="size-3.5" aria-hidden />
          </ToggleGroup.Item>
        </ToggleGroup.Root>
      </header>
      <div className="min-h-0 flex-1 px-2 pb-3">
        {view === "chart" ? chart : <div className="overflow-x-auto px-2">{table}</div>}
      </div>
    </section>
  );
}

export const th = "px-2 py-1.5 text-left text-xs font-medium text-crm-muted-fg";
export const td = "border-t border-crm-border px-2 py-1.5 text-sm tabular-nums text-crm-fg";
