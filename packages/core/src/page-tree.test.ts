import { describe, expect, it } from "vitest";
import {
  catalogueSummary,
  componentExports,
  exportPage,
  PAGE_TREE_LIMITS,
  pageCode,
  validatePageTree,
  type PageComponent,
  type PageNode,
} from "./page-tree";

const statCard: PageComponent = {
  slug: "stat-card",
  name: "Stat Card",
  description: "KPI tile",
  exports: ["StatCard", "SectionLabel"],
  props: [{ name: "label", type: "string", required: true }],
  dependencies: ["lucide-react"],
  files: [
    { path: "components/crm/stat-card.tsx", content: "export function StatCard() {}" },
    { path: "hooks/shared.ts", content: "export const x = 1;" },
  ],
};
const card: PageComponent = {
  slug: "card",
  name: "Card",
  description: "Surface",
  exports: ["Card", "CardHeader"],
  props: [],
  dependencies: [],
  files: [
    { path: "components/crm/card.tsx", content: "export function Card() {}" },
    { path: "hooks/shared.ts", content: "export const x = 1;" },
  ],
};
const components = [statCard, card];

const tree: PageNode = {
  id: "root",
  type: "card",
  children: [
    { id: "h", type: "card/CardHeader", props: { title: "Pipeline" } },
    { id: "k1", type: "stat-card", props: { label: "Deals", value: 12, wide: true } },
    { id: "t", type: "text", props: { text: "Hello <world> {x}" } },
  ],
};

describe("componentExports", () => {
  it("prefers the PascalCase slug export and reads export lists", () => {
    const exports = componentExports({
      slug: "data-table",
      files: [
        {
          path: "components/crm/data-table.tsx",
          content: [
            "export function Table() {}",
            "export const DataTable = React.forwardRef(() => null);",
            "function Row() {}",
            "export { Row as TableRow, helper };",
          ].join("\n"),
        },
      ],
    });
    expect(exports).toEqual(["DataTable", "Table", "TableRow"]);
  });
});

describe("validatePageTree", () => {
  it("accepts a tree built from known slugs and exports", () => {
    const r = validatePageTree(tree, components);
    expect(r.ok).toBe(true);
  });
  it("rejects unknown slugs and exports", () => {
    const r = validatePageTree(
      {
        id: "a",
        type: "card",
        children: [
          { id: "b", type: "nope" },
          { id: "c", type: "card/Nope" },
        ],
      },
      components,
    );
    expect(r).toEqual({
      ok: false,
      errors: ['b: unknown component "nope"', 'c: "card" has no export "Nope"'],
    });
  });
  it("rejects bad shapes, duplicate ids and non-JSON props", () => {
    expect(validatePageTree({ id: "a", type: "Card" }, components).ok).toBe(false);
    expect(validatePageTree({ id: "a", type: "card", extra: 1 }, components).ok).toBe(false);
    const dup = validatePageTree(
      { id: "a", type: "card", children: [{ id: "a", type: "card" }] },
      components,
    );
    expect(dup).toMatchObject({ ok: false, errors: ["a: duplicate id"] });
  });
  it("enforces depth and node limits", () => {
    let deep: PageNode = { id: "leaf", type: "card" };
    for (let i = 0; i < PAGE_TREE_LIMITS.maxDepth; i++)
      deep = { id: `n${i}`, type: "card", children: [deep] };
    const r = validatePageTree(deep, components);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0]).toMatch(/nested deeper/);

    const wide: PageNode = {
      id: "root",
      type: "card",
      children: Array.from({ length: PAGE_TREE_LIMITS.maxNodes }, (_, i) => ({
        id: `c${i}`,
        type: "card",
      })),
    };
    const w = validatePageTree(wide, components);
    expect(w).toMatchObject({ ok: false });
    if (!w.ok) expect(w.errors.some((e) => /more than/.test(e))).toBe(true);
  });
  it("rejects oversized trees", () => {
    const big = { id: "a", type: "card", props: { text: "x".repeat(PAGE_TREE_LIMITS.maxBytes) } };
    const r = validatePageTree(big, components);
    expect(r).toMatchObject({ ok: false });
    if (!r.ok) expect(r.errors[0]).toMatch(/larger than/);
  });
});

describe("pageCode / exportPage", () => {
  it("writes one import per component and escapes text", () => {
    const code = pageCode(tree, components);
    expect(code).toContain('import { Card, CardHeader } from "@/components/crm/card";');
    expect(code).toContain('import { StatCard } from "@/components/crm/stat-card";');
    expect(code).toContain('<CardHeader title="Pipeline" />');
    expect(code).toContain('<StatCard label="Deals" value={12} wide />');
    expect(code).toContain('Hello {"<"}world{">"} {"{"}x{"}"}');
    expect(code).toContain("export default function Page()");
  });
  it("collects files once, unions dependencies and lists install commands", () => {
    const out = exportPage(tree, components, "https://kit.example");
    expect(out.slugs).toEqual(["card", "stat-card"]);
    expect(out.files.map((f) => f.path)).toEqual([
      "components/crm/card.tsx",
      "hooks/shared.ts",
      "components/crm/stat-card.tsx",
    ]);
    expect(out.dependencies).toEqual(["clsx", "lucide-react", "tailwind-merge"]);
    expect(out.installCommand.split("\n")).toHaveLength(2);
    expect(out.installCommand).toContain("add card");
  });
  it("summarises the catalogue one line per component", () => {
    const summary = catalogueSummary(components);
    expect(summary.split("\n")).toHaveLength(2);
    expect(summary).toContain(
      "stat-card: KPI tile exports: StatCard, SectionLabel. props: label*: string",
    );
  });
});
