import { describe, expect, it } from "vitest";
import {
  catalogueSummary,
  componentExports,
  exportPage,
  PAGE_TREE_LIMITS,
  pageCode,
  PREVIEW_GUARD_PRELUDE,
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
  it("wraps primary components in the preview guard only when asked", () => {
    expect(pageCode(tree, components)).not.toContain("KitbasePreviewGuard");
    const guarded = pageCode(tree, components, { guard: true });
    expect(guarded).toContain(PREVIEW_GUARD_PRELUDE);
    expect(guarded).toContain('<KitbasePreviewGuard label="card">');
    expect(guarded).toContain('<KitbasePreviewGuard label="stat-card">');
    // secondary exports stay unwrapped so parents can still inspect them
    expect(guarded).not.toMatch(/label="card\/CardHeader"/);
    const out = exportPage(tree, components, "https://kit.example");
    expect(out.code).not.toContain("KitbasePreviewGuard");
    expect(out.previewCode).toContain("KitbasePreviewGuard");
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

describe("slot props holding nodes", () => {
  const split: PageNode = {
    id: "root",
    type: "card",
    props: {
      title: "Support inbox",
      left: { id: "l", type: "stat-card", props: { label: "Open tickets" } },
      right: [
        { id: "r1", type: "card/CardHeader", props: { title: "Ticket #42" } },
        { id: "r2", type: "stat-card", props: { label: "Comments" } },
      ],
    },
  };

  it("validates slot nodes like children and counts them toward the limits", () => {
    expect(validatePageTree(split, components)).toMatchObject({ ok: true });
    const bad = { ...split, props: { left: { id: "x", type: "nope" } } };
    const r = validatePageTree(bad, components);
    expect(r).toMatchObject({ ok: false });
    if (!r.ok) expect(r.errors.join()).toMatch(/unknown component "nope"/);
    const dup = { ...split, props: { left: { id: "root", type: "stat-card" } } };
    expect(validatePageTree(dup, components)).toMatchObject({ ok: false });
    let deep: PageNode = { id: "d0", type: "stat-card" };
    for (let i = 1; i <= PAGE_TREE_LIMITS.maxDepth + 1; i++)
      deep = { id: `d${i}`, type: "card", props: { left: deep as never } };
    const d = validatePageTree(deep, components);
    expect(d).toMatchObject({ ok: false });
    if (!d.ok) expect(d.errors.join()).toMatch(/nested deeper/);
  });

  it("renders slot nodes as JSX, never as plain objects", () => {
    for (const code of [
      pageCode(split, components),
      pageCode(split, components, { guard: true }),
    ]) {
      expect(code).not.toContain('"type":');
      expect(code).toContain('title="Support inbox"');
      expect(code).toContain('import { StatCard } from "@/components/crm/stat-card";');
      expect(code).toContain('<CardHeader key="r1" title="Ticket #42" />');
      expect(code).toContain('<StatCard key="r2" label="Comments" />');
    }
    expect(pageCode(split, components)).toContain('left={<StatCard label="Open tickets" />}');
    expect(pageCode(split, components, { guard: true })).toContain(
      '<KitbasePreviewGuard label="stat-card">',
    );
    expect(exportPage(split, components, "https://kit.example").slugs).toEqual([
      "card",
      "stat-card",
    ]);
  });
});
