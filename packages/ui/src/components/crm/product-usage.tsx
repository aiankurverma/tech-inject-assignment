import * as React from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { KpiGrid } from "@/components/crm/kpi-grid";
import { Sparkline } from "@/components/crm/sparkline";
import { SearchInput } from "@/components/crm/search-input";
import { SegmentedControl } from "@/components/crm/segmented-control";

export interface FeatureUsage {
  id: string;
  name: string;
  /** Product area, e.g. "Reporting". */
  area: string;
  /** Weekly active accounts using the feature per plan, oldest week first. */
  weekly: Record<string, number[]>;
  /** ISO date the feature launched (flags "new"). */
  launchedAt?: string;
}

export interface ProductUsageProps {
  features: FeatureUsage[];
  /** Total active accounts per plan (denominator for adoption). */
  accountsByPlan: Record<string, number>;
  /** Daily and monthly active users for stickiness. */
  dau?: number[];
  mau?: number;
  /** Adoption below this % is flagged as at-risk. */
  lowAdoption?: number;
  asOf?: string;
  onFeatureSelect?: (id: string) => void;
  className?: string;
}

type SortKey = "adoption" | "change" | "name";

/**
 * Product adoption report: stickiness (DAU/MAU), per-feature adoption with 12-week trend,
 * week-over-week change, plan filter, search, sort and low-adoption flags.
 */
export function ProductUsage({
  features,
  accountsByPlan,
  dau,
  mau,
  lowAdoption = 15,
  asOf,
  onFeatureSelect,
  className,
}: ProductUsageProps) {
  const plans = Object.keys(accountsByPlan);
  const [plan, setPlan] = React.useState("All");
  const [q, setQ] = React.useState("");
  const [sort, setSort] = React.useState<SortKey>("adoption");
  const [desc, setDesc] = React.useState(true);
  const now = asOf ? Date.parse(asOf) : Date.now();

  const denom =
    plan === "All"
      ? Object.values(accountsByPlan).reduce((a, b) => a + b, 0)
      : (accountsByPlan[plan] ?? 0);

  const rows = React.useMemo(() => {
    const out = features
      .filter((f) => `${f.name} ${f.area}`.toLowerCase().includes(q.trim().toLowerCase()))
      .map((f) => {
        const series = (plan === "All" ? Object.values(f.weekly) : [f.weekly[plan] ?? []]).reduce<
          number[]
        >((acc, s) => s.map((v, i) => v + (acc[i] ?? 0)), []);
        const last = series[series.length - 1] ?? 0;
        const prev = series[series.length - 2] ?? 0;
        return {
          f,
          series,
          last,
          adoption: denom ? (last / denom) * 100 : 0,
          change: prev ? ((last - prev) / prev) * 100 : 0,
          isNew: f.launchedAt ? now - Date.parse(f.launchedAt) < 45 * 86_400_000 : false,
        };
      });
    out.sort((a, b) => {
      const d = sort === "name" ? a.f.name.localeCompare(b.f.name) : a[sort] - b[sort];
      return desc ? -d : d;
    });
    return out;
  }, [features, plan, q, sort, desc, denom, now]);

  const stick =
    dau?.length && mau ? (dau.reduce((a, b) => a + b, 0) / dau.length / mau) * 100 : undefined;
  const breadth = rows.length
    ? rows.filter((r) => r.adoption >= lowAdoption).length / rows.length
    : 0;
  const lagging = rows.filter((r) => r.adoption < lowAdoption && !r.isNew).length;

  const head = (k: SortKey, label: string, align = "text-right") => (
    <th
      scope="col"
      aria-sort={sort === k ? (desc ? "descending" : "ascending") : "none"}
      className={cn("crm-caption h-9 px-3 font-normal text-crm-subtle", align)}
    >
      <button
        type="button"
        onClick={() => (sort === k ? setDesc(!desc) : (setSort(k), setDesc(k !== "name")))}
        className="inline-flex items-center gap-1 rounded-sm hover:text-crm-fg focus-visible:ring-2 focus-visible:ring-crm-ring focus-visible:outline-none"
      >
        {label}
        {sort === k ? (
          desc ? (
            <ArrowDown className="size-3" aria-hidden />
          ) : (
            <ArrowUp className="size-3" aria-hidden />
          )
        ) : null}
      </button>
    </th>
  );

  return (
    <section
      aria-label="Product usage"
      className={cn("flex flex-col gap-3 font-crm text-crm-fg", className)}
    >
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="crm-eyebrow text-crm-subtle">Product usage</p>
          <h2 className="text-lg font-semibold tracking-tight">
            {denom.toLocaleString("en-US")} active accounts{plan !== "All" ? ` on ${plan}` : ""}
          </h2>
        </div>
        <SegmentedControl
          label="Plan"
          size="sm"
          value={plan}
          onValueChange={setPlan}
          options={["All", ...plans].map((p) => ({ value: p, label: p }))}
        />
      </header>

      <KpiGrid
        columns={3}
        items={[
          {
            label: "Stickiness (DAU/MAU)",
            value: stick !== undefined ? `${stick.toFixed(1)}%` : "—",
            caption: stick !== undefined && stick >= 20 ? "Habit-forming" : "Below 20% benchmark",
            trend: dau,
          },
          {
            label: "Feature breadth",
            value: `${Math.round(breadth * 100)}%`,
            caption: `features above ${lowAdoption}% adoption`,
          },
          { label: "Lagging features", value: lagging, caption: "excl. launched < 45 days" },
        ]}
      />

      <div className="rounded-crm border border-crm-border bg-crm-card shadow-crm-raised">
        <div className="border-b border-crm-border p-3">
          <SearchInput
            size="sm"
            placeholder="Search features or areas"
            value={q}
            onValueChange={setQ}
            className="max-w-xs"
          />
        </div>
        {rows.length === 0 ? (
          <p className="p-8 text-center text-sm text-crm-subtle">
            {features.length ? `No features match “${q}”.` : "No usage events received yet."}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[620px] text-sm">
              <thead>
                <tr className="border-b border-crm-border">
                  {head("name", "Feature", "text-left")}
                  <th
                    scope="col"
                    className="crm-caption h-9 px-3 text-left font-normal text-crm-subtle"
                  >
                    12-week trend
                  </th>
                  <th
                    scope="col"
                    className="crm-caption h-9 px-3 text-right font-normal text-crm-subtle"
                  >
                    Accounts
                  </th>
                  {head("adoption", "Adoption")}
                  {head("change", "WoW")}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const low = r.adoption < lowAdoption && !r.isNew;
                  return (
                    <tr
                      key={r.f.id}
                      onClick={() => onFeatureSelect?.(r.f.id)}
                      className={cn(
                        "border-b border-crm-border last:border-0 hover:bg-crm-muted/40",
                        onFeatureSelect && "cursor-pointer",
                      )}
                    >
                      <td className="h-12 px-3">
                        <p className="flex items-center gap-1.5 font-medium">
                          {r.f.name}
                          {r.isNew ? (
                            <span className="rounded-full border border-tag-blue-border bg-tag-blue-bg px-1.5 text-[10px] text-tag-blue-text">
                              New
                            </span>
                          ) : null}
                        </p>
                        <p className="text-xs text-crm-subtle">{r.f.area}</p>
                      </td>
                      <td className="px-3">
                        <Sparkline
                          data={r.series.length ? r.series : [0, 0]}
                          height={24}
                          label={`${r.f.name} weekly trend`}
                        />
                      </td>
                      <td className="px-3 text-right tabular-nums">
                        {r.last.toLocaleString("en-US")}
                      </td>
                      <td className="px-3">
                        <span className="flex items-center justify-end gap-2">
                          <span className="relative h-1.5 w-20 rounded-full bg-crm-muted">
                            <span
                              className={cn(
                                "absolute inset-y-0 left-0 rounded-full",
                                low ? "bg-crm-danger" : "bg-crm-primary",
                              )}
                              style={{ width: `${Math.min(100, r.adoption)}%` }}
                            />
                            <span
                              className="absolute -inset-y-0.5 w-px bg-crm-faint"
                              style={{ left: `${lowAdoption}%` }}
                              aria-hidden
                            />
                          </span>
                          <span
                            className={cn("w-12 text-right tabular-nums", low && "text-crm-danger")}
                          >
                            {r.adoption.toFixed(1)}%
                          </span>
                        </span>
                      </td>
                      <td
                        className={cn(
                          "px-3 text-right tabular-nums",
                          r.change > 0
                            ? "text-crm-success"
                            : r.change < 0
                              ? "text-crm-danger"
                              : "text-crm-subtle",
                        )}
                      >
                        {r.change > 0 ? "+" : ""}
                        {r.change.toFixed(1)}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
