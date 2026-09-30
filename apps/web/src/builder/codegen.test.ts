import { describe, expect, it } from "vitest";
import {
  formatProp,
  generatePage,
  installScript,
  layoutClass,
  resolveComponentMeta,
} from "./codegen";
import { createComponentNode, createLayoutNode, createPage, insertNode } from "./tree";
import type { ComponentDetail, ComponentMeta } from "./types";

const detail = (over: Partial<ComponentDetail>): ComponentDetail => ({
  slug: "button",
  name: "Button",
  category: "Primitives",
  access: "free",
  locked: null,
  ...over,
});

describe("generatePage guard", () => {
  it("wraps each component in the preview guard only for the live preview", () => {
    const meta: ComponentMeta = {
      slug: "stat-card",
      name: "Stat card",
      exportName: "StatCard",
      importPath: "@/components/crm/stat-card",
      installCommand: "npx kitbase add stat-card",
      dependencies: [],
    };
    const tree = insertNode(
      createPage(),
      "page",
      createComponentNode("stat-card", { label: "Deals" }),
    );
    const plain = generatePage(tree, { "stat-card": meta }).code;
    expect(plain).not.toContain("KitbasePreviewGuard");
    const guarded = generatePage(tree, { "stat-card": meta }, "Page", { guard: true }).code;
    expect(guarded).toContain('<KitbasePreviewGuard label="stat-card">');
    expect(guarded).toContain('<StatCard label="Deals" />');
    expect(guarded).toContain("</KitbasePreviewGuard>");
    expect(guarded).toContain("globalThis as any).KitbasePreviewGuard");
  });
});

describe("resolveComponentMeta", () => {
  it("reads the export name and path from the first example", () => {
    const m = resolveComponentMeta(
      detail({
        examples: [
          {
            title: "Variants",
            code: `import { Plus } from "lucide-react";\nimport { Button, type ButtonProps } from "@/components/crm/button";\nexport default function E() { return <Button />; }`,
          },
        ],
        files: [{ path: "components/crm/button.tsx", content: "" }],
        dependencies: ["@radix-ui/react-slot", "lucide-react"],
        installCommand: "npx --yes http://api/cli/kitbase.tgz add button",
      }),
    );
    expect(m).toMatchObject({
      exportName: "Button",
      importPath: "@/components/crm/button",
      installCommand: "npx --yes http://api/cli/kitbase.tgz add button",
      dependencies: ["@radix-ui/react-slot", "lucide-react"],
    });
  });

  it("prefers the import matching the slug over helpers imported first", () => {
    const m = resolveComponentMeta(
      detail({
        slug: "kpi-tile",
        examples: [
          {
            title: "x",
            code: `import { Sparkline } from "@/components/crm/sparkline";\nimport { KpiTile } from "@/components/crm/kpi-tile";`,
          },
        ],
      }),
    );
    expect(m.exportName).toBe("KpiTile");
    expect(m.importPath).toBe("@/components/crm/kpi-tile");
  });

  it("falls back to PascalCase(slug) and the first component file", () => {
    const m = resolveComponentMeta(
      detail({
        slug: "data-table",
        files: [{ path: "components/crm/data-table.tsx", content: "" }],
      }),
      "http://localhost:4000",
    );
    expect(m.exportName).toBe("DataTable");
    expect(m.importPath).toBe("@/components/crm/data-table");
    expect(m.installCommand).toBe("npx --yes http://localhost:4000/cli/kitbase.tgz add data-table");
  });
});

describe("formatProp", () => {
  it("formats each value type as JSX", () => {
    expect(formatProp("variant", "primary")).toBe('variant="primary"');
    expect(formatProp("label", 'say "hi"')).toBe('label={"say \\"hi\\""}');
    expect(formatProp("loading", true)).toBe("loading");
    expect(formatProp("loading", false)).toBe("loading={false}");
    expect(formatProp("count", 3)).toBe("count={3}");
    expect(formatProp("items", ["a", "b"])).toBe('items={["a","b"]}');
    expect(formatProp("x", undefined)).toBeNull();
    expect(formatProp("x", null)).toBeNull();
  });
});

const metas: Record<string, ComponentMeta> = {
  button: {
    slug: "button",
    name: "Button",
    exportName: "Button",
    importPath: "@/components/crm/button",
    installCommand: "npx kitbase add button",
    dependencies: ["@radix-ui/react-slot", "lucide-react"],
  },
  badge: {
    slug: "badge",
    name: "Badge",
    exportName: "Badge",
    importPath: "@/components/crm/badge",
    installCommand: "npx kitbase add badge",
    dependencies: ["react"],
  },
};

describe("generatePage", () => {
  it("renders an empty page", () => {
    const page = generatePage(createPage(), {});
    expect(page.code).toContain("export default function Page()");
    expect(page.code).toContain("{/* Drop components here */}");
    expect(page.code).not.toContain("import {");
    expect(page.slugs).toEqual([]);
    expect(page.install).toEqual([]);
  });

  it("emits imports, layout wrappers and props", () => {
    const section = createLayoutNode("section", { title: "Pipeline", gap: "6" });
    const row = createLayoutNode("row", { align: "center" });
    const col = createLayoutNode("column", { basis: "1/2" });
    let tree = createPage();
    tree = insertNode(tree, "page", section);
    tree = insertNode(tree, section.id, row);
    tree = insertNode(tree, row.id, col);
    tree = insertNode(
      tree,
      col.id,
      createComponentNode("button", { variant: "primary", loading: true, children: "New <deal>" }),
    );
    tree = insertNode(tree, row.id, createComponentNode("badge", { count: 2 }));
    tree = insertNode(tree, row.id, createComponentNode("button"));

    const page = generatePage(tree, metas, "Dashboard");
    expect(page.code).toBe(
      [
        "// Generated by the Kitbase page builder. Components are installed with the kitbase CLI.",
        'import { Badge } from "@/components/crm/badge";',
        'import { Button } from "@/components/crm/button";',
        "",
        "export default function Dashboard() {",
        "  return (",
        '    <main className="flex min-h-screen w-full flex-col gap-6 bg-crm-bg p-6 font-crm text-crm-fg">',
        '      <section className="flex flex-col gap-6">',
        '        <h2 className="text-sm font-medium text-crm-muted-fg">Pipeline</h2>',
        '        <div className="flex flex-wrap items-center gap-4">',
        '          <div className="flex min-w-0 flex-col gap-4 basis-1/2">',
        '            <Button variant="primary" loading>New {"<"}deal{">"}</Button>',
        "          </div>",
        "          <Badge count={2} />",
        "          <Button />",
        "        </div>",
        "      </section>",
        "    </main>",
        "  );",
        "}",
        "",
      ].join("\n"),
    );
    expect(page.slugs).toEqual(["button", "badge"]);
    expect(page.install).toEqual(["npx kitbase add button", "npx kitbase add badge"]);
    expect(page.dependencies).toEqual(["@radix-ui/react-slot", "lucide-react"]);
    expect(page.missing).toEqual([]);
    expect(installScript(page)).toBe(
      [
        "# Run from your project root (React + TypeScript + Tailwind v4)",
        "npx kitbase add button",
        "npx kitbase add badge",
        "npm install @radix-ui/react-slot lucide-react",
      ].join("\n"),
    );
  });

  it("turns components without metadata into placeholder comments", () => {
    let tree = createPage();
    tree = insertNode(tree, "page", createComponentNode("pro-thing"));
    const page = generatePage(tree, metas);
    expect(page.code).toContain("{/* pro-thing: not available */}");
    expect(page.missing).toEqual(["pro-thing"]);
    expect(page.install).toEqual([]);
  });

  it("maps layout props to classes with defaults", () => {
    expect(layoutClass(createLayoutNode("row"))).toBe("flex flex-wrap items-start gap-4");
    expect(layoutClass(createLayoutNode("column"))).toBe("flex min-w-0 flex-col gap-4 flex-1");
    expect(layoutClass(createLayoutNode("section", { gap: "8" }))).toBe("flex flex-col gap-8");
  });
});
