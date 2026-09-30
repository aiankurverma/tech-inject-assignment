import { describe, expect, it } from "vitest";
import type { Bundle, Viewer } from "@ti/core";
import { HttpError } from "../utils/http";
import { makeScreens } from "./screens";

const bundle = (slug: string, access: "free" | "premium", content: string): Bundle => ({
  name: slug,
  slug,
  description: `The ${slug} component for CRM pages.`,
  category: "Layout",
  version: "1.0.0",
  access,
  dependencies: slug === "stat-card" ? ["lucide-react"] : [],
  files: [{ path: `components/crm/${slug}.tsx`, content }],
  examples: [{ title: "Default", code: "export default function E() { return null; }" }],
  props: [{ name: "label", type: "string", required: true, description: "" }],
  usage: "",
});

const published = [
  bundle("card", "free", "export function Card() {}\nexport function CardHeader() {}"),
  bundle("stat-card", "free", "export function StatCard() {}"),
  bundle("pro-data-grid", "premium", "export function ProDataGrid() {}"),
];
const theme = { themeCss: ":root{}", utilsTs: "export const cn = () => ''" };
const anonymous: Viewer = { kind: "anonymous" };
const premium: Viewer = { kind: "customer", plan: "premium" };

/** Anthropic-shaped reply for each call, in order; records request bodies. */
function fakeFetch(replies: (unknown | { status: number })[]) {
  const calls: { url: string; body: Record<string, unknown> }[] = [];
  const fetchImpl = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), body: JSON.parse(String(init?.body)) });
    const reply = replies.shift();
    if (reply && typeof reply === "object" && "status" in reply)
      return new Response("{}", { status: (reply as { status: number }).status });
    const body = { content: [{ type: "text", text: JSON.stringify(reply) }] };
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;
  return { fetchImpl, calls };
}

const make = (fetchImpl: typeof fetch, extra: Record<string, unknown> = {}) =>
  makeScreens({
    theme,
    apiOrigin: "https://kit.example",
    chain: { apiKey: "k", model: "m", fetchImpl, ...extra },
    loadPublished: async () => published,
  });

const goodTree = {
  id: "root",
  type: "card",
  children: [
    { id: "h", type: "card/CardHeader", props: { title: "Pipeline" } },
    { id: "k", type: "stat-card", props: { label: "Deals", value: 12 } },
  ],
};

describe("screens.generate", () => {
  it("sends the viewer's catalogue to the AI and returns tree, code and preview", async () => {
    const { fetchImpl, calls } = fakeFetch([goodTree]);
    const r = await make(fetchImpl).generate("A pipeline overview", anonymous);
    expect(r.tree).toEqual(goodTree);
    expect(r.slugs).toEqual(["card", "stat-card"]);
    expect(r.code).toContain('import { Card, CardHeader } from "@/components/crm/card";');
    expect(r.dependencies).toEqual(["clsx", "lucide-react", "tailwind-merge"]);
    expect(r.installCommand).toBe(
      "npx --yes https://kit.example/cli/kitbase.tgz add card\nnpx --yes https://kit.example/cli/kitbase.tgz add stat-card",
    );
    expect(r.preview.files.map((f) => f.path)).toEqual([
      "lib/utils.ts",
      "components/crm/card.tsx",
      "components/crm/stat-card.tsx",
    ]);
    // The preview gets per-component error boundaries; exported code stays clean.
    expect(r.code).not.toContain("KitbasePreviewGuard");
    expect(r.preview.examples[0]?.code).toContain('<KitbasePreviewGuard label="stat-card">');
    expect(r).not.toHaveProperty("previewCode");

    const system = String(calls[0]?.body.system);
    expect(system).toContain("- card:");
    expect(system).toContain("exports: Card, CardHeader");
    // Anonymous viewers never see premium components in the catalogue.
    expect(system).not.toContain("pro-data-grid");
    expect(JSON.stringify(calls[0]?.body.messages)).toContain("A pipeline overview");
  });

  it("lets a premium viewer use premium components", async () => {
    const { fetchImpl, calls } = fakeFetch([{ id: "g", type: "pro-data-grid" }]);
    const r = await make(fetchImpl).generate("A big grid", premium);
    expect(r.slugs).toEqual(["pro-data-grid"]);
    expect(String(calls[0]?.body.system)).toContain("pro-data-grid");
  });

  it("rejects unknown slugs, retries once with the errors, then fails with 422", async () => {
    const { fetchImpl, calls } = fakeFetch([
      { id: "a", type: "made-up" },
      { id: "a", type: "card", children: [{ id: "b", type: "pro-data-grid" }] },
    ]);
    const err = await make(fetchImpl)
      .generate("Something odd", anonymous)
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(HttpError);
    expect(err).toMatchObject({
      status: 422,
      code: "invalid_tree",
      details: ['b: unknown component "pro-data-grid"'],
    });
    expect(calls).toHaveLength(2);
    expect(JSON.stringify(calls[1]?.body.messages)).toContain("unknown component");
  });

  it("falls back to the next provider when the primary fails", async () => {
    const { fetchImpl, calls } = fakeFetch([{ status: 500 }]);
    // Second reply comes from OpenRouter, so it needs that shape.
    const fallback = (async () =>
      new Response(
        JSON.stringify({ choices: [{ message: { content: JSON.stringify(goodTree) } }] }),
        { status: 200, headers: { "content-type": "application/json" } },
      )) as typeof fetch;
    let n = 0;
    const chained = ((url: string | URL | Request, init?: RequestInit) =>
      n++ === 0 ? fetchImpl(url, init) : fallback(url, init)) as typeof fetch;
    const r = await make(chained, {
      fallbacks: [{ provider: "openrouter", apiKey: "or", model: "x" }],
    }).generate("Pipeline", anonymous);
    expect(r.slugs).toEqual(["card", "stat-card"]);
    expect(calls[0]?.url).toContain("anthropic.com");
    expect(n).toBe(2);
  });

  it("answers 503 when no AI is configured", async () => {
    const s = makeScreens({
      theme,
      apiOrigin: "x",
      chain: null,
      loadPublished: async () => published,
    });
    await expect(s.generate("Anything at all", anonymous)).rejects.toMatchObject({ status: 503 });
  });
});

describe("screens.render", () => {
  it("rebuilds a hand-edited tree without calling the AI", async () => {
    const { fetchImpl, calls } = fakeFetch([]);
    const r = await make(fetchImpl).render(goodTree, anonymous);
    expect(r.code).toContain('<StatCard label="Deals" value={12} />');
    expect(calls).toHaveLength(0);
  });
  it("rejects trees the viewer may not build", async () => {
    const { fetchImpl } = fakeFetch([]);
    await expect(
      make(fetchImpl).render({ id: "g", type: "pro-data-grid" }, anonymous),
    ).rejects.toMatchObject({ status: 422, details: ['g: unknown component "pro-data-grid"'] });
  });
});
