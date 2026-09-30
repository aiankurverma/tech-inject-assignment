import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { createApi, type FetchLike } from "../src/api.js";
import {
  getComponent,
  installComponent,
  listCategories,
  searchComponents,
  type FsLike,
} from "../src/tools.js";

const root = path.resolve("/tmp/app");

const list = [
  { slug: "button", name: "Button", description: "Action trigger", category: "Inputs", access: "free", locked: null },
  { slug: "deal-card", name: "Deal Card", description: "Pipeline deal summary", category: "Data", access: "free", locked: null },
  { slug: "pro-pipeline-board", name: "Pipeline Board", description: "Kanban of deals", category: "Data", access: "premium", locked: "premium_required" },
];

function mockFetch(routes: Record<string, { status?: number; body: unknown }>) {
  return vi.fn<FetchLike>(async (url) => {
    const key = url.replace("https://kitbase.test/api", "");
    const r = routes[key] ?? { status: 404, body: { message: "Not found" } };
    const status = r.status ?? 200;
    return { ok: status < 400, status, json: async () => r.body };
  });
}

function memFs(files: Record<string, string> = {}): FsLike & { files: Record<string, string> } {
  return {
    files,
    exists: (abs) => abs in files,
    read: (abs) => files[abs]!,
    write: (abs, content) => {
      files[abs] = content;
    },
  };
}

function deps(routes: Parameters<typeof mockFetch>[0], opts: { token?: string; fs?: FsLike } = {}) {
  const fetch = mockFetch(routes);
  const api = createApi({ api: "https://kitbase.test/", token: opts.token, fetch });
  return { fetch, deps: { api, fs: opts.fs ?? memFs(), cwd: root } };
}

describe("search_components", () => {
  it("ranks name matches and filters by category", async () => {
    const { deps: d } = deps({ "/components": { body: list } });
    const all = await searchComponents(d, { query: "pipeline" });
    expect(all.results.map((r) => r.slug)).toEqual(["pro-pipeline-board", "deal-card"]);
    const inputs = await searchComponents(d, { query: "", category: "inputs" });
    expect(inputs.results).toEqual([expect.objectContaining({ slug: "button", access: "free" })]);
  });

  it("sends the bearer token when configured", async () => {
    const { deps: d, fetch } = deps({ "/components": { body: list } }, { token: "kb_test" });
    await searchComponents(d, { query: "card" });
    expect(fetch).toHaveBeenCalledWith("https://kitbase.test/api/components", {
      headers: { authorization: "Bearer kb_test" },
    });
  });
});

describe("list_categories", () => {
  it("counts components per category", async () => {
    const { deps: d } = deps({ "/components": { body: list } });
    expect(await listCategories(d)).toEqual([
      { category: "Data", count: 2 },
      { category: "Inputs", count: 1 },
    ]);
  });
});

describe("get_component", () => {
  it("returns props, usage, examples and dependencies", async () => {
    const { deps: d } = deps({
      "/components/button": {
        body: { ...list[0], version: "1.0.0", props: [{ name: "variant" }], usage: "<Button />", examples: [], dependencies: ["clsx"], files: [] },
      },
    });
    const c = await getComponent(d, { slug: "button" });
    expect(c).toMatchObject({ slug: "button", locked: null, dependencies: ["clsx"], usage: "<Button />" });
    expect(c).not.toHaveProperty("files");
  });

  it("explains locked premium components", async () => {
    const { deps: d } = deps({ "/components/pro-pipeline-board": { body: { ...list[2], version: "1.0.0" } } });
    const c = await getComponent(d, { slug: "pro-pipeline-board" });
    expect(c).toMatchObject({ locked: "premium_required" });
    expect(c).toHaveProperty("hint", expect.stringContaining("KITBASE_TOKEN"));
  });

  it("rejects invalid slugs without calling the API", async () => {
    const { deps: d, fetch } = deps({});
    await expect(getComponent(d, { slug: "../admin" })).rejects.toThrow(/Invalid/);
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe("install_component", () => {
  const item = {
    slug: "button",
    name: "Button",
    version: "1.0.0",
    dependencies: ["clsx"],
    files: [{ path: "components/crm/button.tsx", content: "export const Button = 1;\n" }],
  };
  const target = path.join(root, "src", "components", "crm", "button.tsx");

  it("writes files inside <dir>/src", async () => {
    const fs = memFs({ [path.join(root, "package.json")]: "{}" });
    const { deps: d } = deps({ "/registry/button": { body: item } }, { fs });
    const out = await installComponent(d, { slug: "button" });
    expect(out).toMatchObject({ installed: true, dependencies: ["clsx"] });
    expect(fs.files[target]).toBe(item.files[0]!.content);
  });

  it("does not overwrite changed files without the flag", async () => {
    const fs = memFs({ [path.join(root, "package.json")]: "{}", [target]: "mine" });
    const { deps: d } = deps({ "/registry/button": { body: item } }, { fs });
    const out = await installComponent(d, { slug: "button" });
    expect(out).toMatchObject({ installed: false, conflicts: ["src/components/crm/button.tsx"] });
    expect(fs.files[target]).toBe("mine");
    await installComponent(d, { slug: "button", overwrite: true });
    expect(fs.files[target]).toBe(item.files[0]!.content);
  });

  it("refuses unsafe registry paths", async () => {
    const fs = memFs({ [path.join(root, "package.json")]: "{}" });
    const bad = { ...item, files: [{ path: "../evil.ts", content: "x" }] };
    const { deps: d } = deps({ "/registry/button": { body: bad } }, { fs });
    await expect(installComponent(d, { slug: "button" })).rejects.toThrow(/unsafe/);
    expect(Object.keys(fs.files)).toHaveLength(1);
  });

  it("requires a project root and surfaces premium errors", async () => {
    const { deps: noPkg } = deps({ "/registry/button": { body: item } });
    await expect(installComponent(noPkg, { slug: "button" })).rejects.toThrow(/package.json/);

    const fs = memFs({ [path.join(root, "package.json")]: "{}" });
    const { deps: d } = deps(
      { "/registry/pro-pipeline-board": { status: 401, body: { message: "Premium component." } } },
      { fs },
    );
    await expect(installComponent(d, { slug: "pro-pipeline-board" })).rejects.toThrow(/KITBASE_TOKEN/);
  });

  it("dry run writes nothing", async () => {
    const fs = memFs({ [path.join(root, "package.json")]: "{}" });
    const { deps: d } = deps({ "/registry/button": { body: item } }, { fs });
    const out = await installComponent(d, { slug: "button", dryRun: true });
    expect(out).toMatchObject({ installed: false, dryRun: true });
    expect(fs.files[target]).toBeUndefined();
  });
});
