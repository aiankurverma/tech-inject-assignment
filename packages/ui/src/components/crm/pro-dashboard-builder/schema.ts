import { z } from "zod";
import type { RuleGroupType } from "react-querybuilder";

/** Kinds of widget in the library. */
export const WIDGET_TYPES = ["kpi", "line", "bar", "table"] as const;
export type WidgetType = (typeof WIDGET_TYPES)[number];

export const AGGREGATES = ["sum", "avg", "count", "min", "max"] as const;
export type Aggregate = (typeof AGGREGATES)[number];

export const FORMATS = ["number", "currency", "percent"] as const;
export type ValueFormat = (typeof FORMATS)[number];

/** Describes one column of the dataset the dashboard queries. */
export interface DashboardField {
  name: string;
  label: string;
  type: "number" | "string" | "date";
  /** Known values for string fields; renders a select in the query builder. */
  options?: string[];
}

const ruleSchema = z.object({
  id: z.string().optional(),
  field: z.string(),
  operator: z.string(),
  value: z.unknown(),
  valueSource: z.enum(["value", "field"]).optional(),
});

type RuleGroupInput = {
  id?: string;
  combinator: string;
  not?: boolean;
  rules: (z.infer<typeof ruleSchema> | RuleGroupInput)[];
};

const ruleGroupSchema: z.ZodType<RuleGroupInput> = z.lazy(() =>
  z.object({
    id: z.string().optional(),
    combinator: z.string(),
    not: z.boolean().optional(),
    rules: z.array(z.union([ruleSchema, ruleGroupSchema])),
  }),
);

export const widgetSchema = z.object({
  id: z.string().min(1),
  type: z.enum(WIDGET_TYPES),
  title: z.string().max(80),
  /** Numeric field aggregated by KPI/line/bar widgets. Ignored when agg is "count". */
  metric: z.string().optional(),
  agg: z.enum(AGGREGATES).default("sum"),
  /** Dimension for line (date, bucketed by month) and bar (string) widgets. */
  groupBy: z.string().optional(),
  /** Columns shown by the table widget. */
  columns: z.array(z.string()).optional(),
  format: z.enum(FORMATS).default("number"),
  query: ruleGroupSchema,
});

export const rowSchema = z.object({
  id: z.string().min(1),
  size: z.number().min(5).max(100),
  widgets: z.array(z.object({ id: z.string().min(1), size: z.number().min(5).max(100) })).max(6),
});

export const dashboardSchema = z
  .object({
    version: z.literal(1),
    name: z.string().min(1).max(80),
    rows: z.array(rowSchema).max(12),
    widgets: z.record(z.string(), widgetSchema),
  })
  .superRefine((d, ctx) => {
    for (const row of d.rows)
      for (const cell of row.widgets)
        if (!d.widgets[cell.id])
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Row "${row.id}" references unknown widget "${cell.id}"`,
            path: ["rows"],
          });
  });

export type WidgetConfig = Omit<z.infer<typeof widgetSchema>, "query"> & { query: RuleGroupType };
export type DashboardRow = z.infer<typeof rowSchema>;
export interface DashboardConfig {
  version: 1;
  name: string;
  rows: DashboardRow[];
  widgets: Record<string, WidgetConfig>;
}

export type ParseResult = { ok: true; value: DashboardConfig } | { ok: false; errors: string[] };

/** Validate unknown JSON (e.g. an imported layout) against the dashboard schema. */
export function parseDashboard(input: unknown): ParseResult {
  const res = dashboardSchema.safeParse(input);
  if (res.success) return { ok: true, value: res.data as unknown as DashboardConfig };
  return {
    ok: false,
    errors: res.error.issues.slice(0, 8).map((i) => `${i.path.join(".") || "root"}: ${i.message}`),
  };
}

export const emptyQuery = (): RuleGroupType => ({ combinator: "and", rules: [] });

let seq = 0;
export const uid = (p: string) => `${p}_${Date.now().toString(36)}${(seq++).toString(36)}`;
