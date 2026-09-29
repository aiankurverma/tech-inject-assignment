import * as React from "react";
import { ProSchemaErd, type ErdColumn, type ErdTable } from "@/components/crm/pro-schema-erd";

// A multi-tenant commerce + SaaS warehouse: ~130 tables across 12 schemas.
const core: ErdTable[] = [
  {
    id: "auth.organizations",
    name: "organizations",
    schema: "auth",
    color: "#7c6bff",
    columns: [
      { name: "id", type: "uuid", pk: true },
      { name: "slug", type: "citext", unique: true },
      { name: "name", type: "text" },
      { name: "plan", type: "plan_tier" },
      { name: "created_at", type: "timestamptz" },
    ],
  },
  {
    id: "auth.users",
    name: "users",
    schema: "auth",
    color: "#7c6bff",
    columns: [
      { name: "id", type: "uuid", pk: true },
      { name: "org_id", type: "uuid", fk: { table: "auth.organizations", column: "id" } },
      { name: "email", type: "citext", unique: true },
      {
        name: "manager_id",
        type: "uuid",
        nullable: true,
        fk: { table: "auth.users", column: "id" },
      },
      { name: "role", type: "user_role" },
      { name: "last_seen_at", type: "timestamptz", nullable: true },
    ],
  },
  {
    id: "crm.customers",
    name: "customers",
    schema: "crm",
    color: "#22c55e",
    columns: [
      { name: "id", type: "uuid", pk: true },
      { name: "org_id", type: "uuid", fk: { table: "auth.organizations", column: "id" } },
      { name: "owner_id", type: "uuid", nullable: true, fk: { table: "auth.users", column: "id" } },
      { name: "email", type: "citext" },
      { name: "lifetime_value", type: "numeric(12,2)" },
    ],
  },
  {
    id: "catalog.products",
    name: "products",
    schema: "catalog",
    color: "#f59e0b",
    columns: [
      { name: "id", type: "uuid", pk: true },
      { name: "org_id", type: "uuid", fk: { table: "auth.organizations", column: "id" } },
      { name: "sku", type: "varchar(64)", unique: true },
      { name: "title", type: "text" },
      { name: "price_cents", type: "int4" },
    ],
  },
  {
    id: "orders.orders",
    name: "orders",
    schema: "orders",
    color: "#38bdf8",
    columns: [
      { name: "id", type: "uuid", pk: true },
      { name: "customer_id", type: "uuid", fk: { table: "crm.customers", column: "id" } },
      {
        name: "placed_by",
        type: "uuid",
        nullable: true,
        fk: { table: "auth.users", column: "id" },
      },
      { name: "status", type: "order_status" },
      { name: "total_cents", type: "int8" },
      { name: "placed_at", type: "timestamptz" },
    ],
  },
  {
    id: "orders.order_items",
    name: "order_items",
    schema: "orders",
    color: "#38bdf8",
    columns: [
      { name: "id", type: "uuid", pk: true },
      { name: "order_id", type: "uuid", fk: { table: "orders.orders", column: "id" } },
      { name: "product_id", type: "uuid", fk: { table: "catalog.products", column: "id" } },
      { name: "qty", type: "int4" },
      { name: "unit_cents", type: "int4" },
    ],
  },
  {
    id: "billing.invoices",
    name: "invoices",
    schema: "billing",
    color: "#f97373",
    columns: [
      { name: "id", type: "uuid", pk: true },
      {
        name: "order_id",
        type: "uuid",
        unique: true,
        fk: { table: "orders.orders", column: "id" },
      },
      { name: "number", type: "varchar(32)", unique: true },
      { name: "due_on", type: "date" },
      { name: "paid_at", type: "timestamptz", nullable: true },
    ],
  },
];

const roots: Record<string, string> = {
  billing: "billing.invoices",
  catalog: "catalog.products",
  orders: "orders.orders",
  crm: "crm.customers",
  auth: "auth.users",
};

const domains: [string, string, string, string[]][] = [
  [
    "billing",
    "#f97373",
    "billing.invoices",
    [
      "payments",
      "refunds",
      "credit_notes",
      "tax_lines",
      "payment_methods",
      "dunning_attempts",
      "subscriptions",
      "subscription_items",
      "coupons",
      "usage_records",
    ],
  ],
  [
    "catalog",
    "#f59e0b",
    "catalog.products",
    [
      "variants",
      "categories",
      "product_images",
      "price_lists",
      "price_list_entries",
      "bundles",
      "bundle_items",
      "attributes",
      "attribute_values",
      "reviews",
    ],
  ],
  [
    "orders",
    "#38bdf8",
    "orders.orders",
    [
      "carts",
      "cart_items",
      "order_events",
      "returns",
      "return_items",
      "discounts_applied",
      "gift_cards",
      "order_notes",
    ],
  ],
  [
    "shipping",
    "#2dd4bf",
    "orders.orders",
    [
      "shipments",
      "shipment_items",
      "carriers",
      "rates",
      "tracking_events",
      "labels",
      "pickups",
      "zones",
      "zone_rates",
    ],
  ],
  [
    "inventory",
    "#a3e635",
    "catalog.products",
    [
      "warehouses",
      "stock_levels",
      "stock_movements",
      "purchase_orders",
      "po_lines",
      "suppliers",
      "cycle_counts",
      "reservations",
    ],
  ],
  [
    "crm",
    "#22c55e",
    "crm.customers",
    [
      "contacts",
      "companies",
      "deals",
      "deal_stages",
      "activities",
      "notes",
      "segments",
      "segment_members",
      "addresses",
      "consents",
    ],
  ],
  [
    "support",
    "#e879f9",
    "crm.customers",
    [
      "tickets",
      "ticket_messages",
      "ticket_tags",
      "sla_policies",
      "macros",
      "csat_responses",
      "escalations",
      "knowledge_articles",
    ],
  ],
  [
    "marketing",
    "#fb923c",
    "crm.customers",
    [
      "campaigns",
      "campaign_sends",
      "email_templates",
      "utm_sessions",
      "landing_pages",
      "ab_tests",
      "ab_variants",
      "referrals",
    ],
  ],
  [
    "analytics",
    "#94a3b8",
    "orders.orders",
    [
      "fct_orders",
      "fct_revenue_daily",
      "dim_customer",
      "dim_product",
      "dim_date",
      "cohort_retention",
      "funnel_steps",
      "attribution_touches",
      "ltv_snapshots",
    ],
  ],
  [
    "auth",
    "#7c6bff",
    "auth.users",
    [
      "sessions",
      "api_keys",
      "roles",
      "role_permissions",
      "permissions",
      "invites",
      "audit_log",
      "sso_connections",
      "mfa_factors",
    ],
  ],
  [
    "hr",
    "#facc15",
    "auth.users",
    ["employees", "departments", "time_off", "payroll_runs", "payslips", "reviews_cycles", "goals"],
  ],
  [
    "finance",
    "#60a5fa",
    "billing.invoices",
    [
      "ledger_accounts",
      "journal_entries",
      "journal_lines",
      "bank_accounts",
      "bank_transactions",
      "reconciliations",
      "fx_rates",
      "budgets",
    ],
  ],
];

const TYPES = [
  "text",
  "int4",
  "numeric(12,2)",
  "boolean",
  "jsonb",
  "varchar(120)",
  "timestamptz",
  "date",
];
const FIELDS = [
  "status",
  "amount",
  "currency",
  "external_ref",
  "metadata",
  "label",
  "priority",
  "is_active",
  "notes",
  "score",
  "starts_on",
  "ends_on",
];

function singular(s: string) {
  return s.replace(/ies$/, "y").replace(/s$/, "");
}

function buildSchema(): ErdTable[] {
  const tables = [...core];
  let seed = 7;
  const r = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (const [schema, color, root, names] of domains) {
    const ids: string[] = [];
    names.forEach((n, i) => {
      const id = `${schema}.${n}`;
      const cols: ErdColumn[] = [{ name: "id", type: "uuid", pk: true }];
      // Chain to a sibling (e.g. po_lines -> purchase_orders) or the domain root.
      const parent = i > 0 && r() > 0.45 ? ids[Math.floor(r() * ids.length)]! : root;
      const pname = singular(parent.split(".")[1]!);
      cols.push({ name: `${pname}_id`, type: "uuid", fk: { table: parent, column: "id" } });
      if (r() > 0.55)
        cols.push({
          name: "org_id",
          type: "uuid",
          fk: { table: "auth.organizations", column: "id" },
        });
      if (r() > 0.6 && root !== roots.auth)
        cols.push({
          name: "created_by",
          type: "uuid",
          nullable: true,
          fk: { table: "auth.users", column: "id" },
        });
      const extra = 2 + Math.floor(r() * 5);
      for (let k = 0; k < extra; k++) {
        const f = FIELDS[(i + k * 3) % FIELDS.length]!;
        if (!cols.some((c) => c.name === f))
          cols.push({ name: f, type: TYPES[(i + k) % TYPES.length]!, nullable: r() > 0.6 });
      }
      cols.push(
        { name: "created_at", type: "timestamptz" },
        { name: "updated_at", type: "timestamptz" },
      );
      tables.push({ id, name: n, schema, color, columns: cols });
      ids.push(id);
    });
  }
  return tables;
}

export default function Example() {
  const tables = React.useMemo(buildSchema, []);
  return (
    <div className="w-[1100px] max-w-full">
      <ProSchemaErd
        title="warehouse_prod · public schemas"
        tables={tables}
        defaultFocusedTable="orders.orders"
        defaultLineageDepth={1}
        height={680}
        relations={[
          {
            from: { table: "marketing.campaigns", column: "id" },
            to: { table: "crm.segments", column: "id" },
            cardinality: "many-to-many",
            label: "campaign audiences (via campaign_segments)",
          },
        ]}
      />
    </div>
  );
}
