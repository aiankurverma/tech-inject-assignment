import { describe, expect, it } from "vitest";
import {
  decideAccess,
  isSafeRelativePath,
  validateBundle,
  buildRegistryItem,
  agentPromptText,
  copyCodeText,
} from "./index";

export const validBundle = () => ({
  name: "Test Button",
  slug: "test-button",
  description: "A button used in tests.",
  category: "Primitives",
  version: "1.0.0",
  access: "free" as const,
  dependencies: ["lucide-react" as const],
  files: [
    {
      path: "components/crm/test-button.tsx",
      content:
        'import { Plus } from "lucide-react";\nimport { cn } from "@/lib/utils";\nexport function TestButton() { return <button className={cn("x")}><Plus /></button>; }\n',
    },
  ],
  examples: [
    {
      title: "Default",
      code: 'import { TestButton } from "@/components/crm/test-button";\nexport default function E() { return <TestButton />; }\n',
    },
  ],
});

describe("validateBundle", () => {
  it("accepts a valid bundle", () => {
    expect(validateBundle(validBundle())).toMatchObject({ ok: true });
  });

  it.each([
    ["missing name", (b: Record<string, unknown>) => delete b.name],
    ["bad slug", (b: Record<string, unknown>) => (b.slug = "Bad Slug")],
    ["bad version", (b: Record<string, unknown>) => (b.version = "v1")],
    ["unknown field", (b: Record<string, unknown>) => (b.evil = true)],
    ["no examples", (b: Record<string, unknown>) => (b.examples = [])],
  ])("rejects %s", (_label, mutate) => {
    const b = validBundle() as Record<string, unknown>;
    mutate(b);
    expect(validateBundle(b).ok).toBe(false);
  });

  it("rejects unsafe file paths", () => {
    for (const path of [
      "../etc/passwd",
      "/abs/x.tsx",
      "components/../../x.tsx",
      "components\\x.tsx",
      "src/x.js",
      "app/x.tsx",
    ]) {
      const b = validBundle();
      b.files[0]!.path = path;
      expect(validateBundle(b).ok, path).toBe(false);
    }
  });

  it("rejects imports that are not allowed or not listed", () => {
    const b = validBundle();
    b.files[0]!.content += 'import fs from "fs";\n';
    const r = validateBundle(b);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join()).toContain('"fs" is not allowed');

    const c = validBundle();
    c.dependencies = [];
    const r2 = validateBundle(c);
    expect(r2.ok).toBe(false);
    if (!r2.ok) expect(r2.errors.join()).toContain("lucide-react");
  });

  it("rejects local imports missing from the bundle and relative imports", () => {
    const b = validBundle();
    b.examples[0]!.code = 'import { X } from "@/components/crm/missing";\nexport default X;';
    expect(validateBundle(b).ok).toBe(false);
    const c = validBundle();
    c.examples[0]!.code = 'import { X } from "./x";\nexport default X;';
    expect(validateBundle(c).ok).toBe(false);
  });

  it("rejects oversized files and theme overrides", () => {
    const b = validBundle();
    b.files[0]!.content = "x".repeat(100_001);
    expect(validateBundle(b).ok).toBe(false);
    const c = validBundle();
    c.files.push({ path: "styles/crm-theme.css", content: "body{}" });
    expect(validateBundle(c).ok).toBe(false);
  });
});

describe("isSafeRelativePath", () => {
  it("allows only known folders", () => {
    expect(isSafeRelativePath("components/crm/a-b.tsx")).toBe(true);
    expect(isSafeRelativePath("lib/utils.ts")).toBe(true);
    expect(isSafeRelativePath("node_modules/x.ts")).toBe(false);
  });
});

describe("decideAccess", () => {
  const anon = { kind: "anonymous" } as const;
  const free = { kind: "customer", plan: "free" } as const;
  const premium = { kind: "customer", plan: "premium" } as const;

  it("follows the access table", () => {
    const f = { status: "published", access: "free" } as const;
    const p = { status: "published", access: "premium" } as const;
    expect(decideAccess(f, anon)).toEqual({ allowed: true });
    expect(decideAccess(f, free)).toEqual({ allowed: true });
    expect(decideAccess(p, anon)).toEqual({ allowed: false, reason: "sign_in_required" });
    expect(decideAccess(p, free)).toEqual({ allowed: false, reason: "premium_required" });
    expect(decideAccess(p, premium)).toEqual({ allowed: true });
  });

  it("hides drafts and unpublished items from everyone, including premium", () => {
    for (const status of ["draft", "unpublished"] as const) {
      expect(decideAccess({ status, access: "free" }, premium)).toEqual({
        allowed: false,
        reason: "not_found",
      });
    }
  });
});

describe("registry outputs", () => {
  const r = validateBundle(validBundle());
  if (!r.ok) throw new Error("fixture invalid");
  const item = buildRegistryItem(r.bundle, { themeCss: "/* theme */", utilsTs: "// utils" });

  it("ships theme, utils and component files with deps", () => {
    expect(item.files.map((f) => f.path)).toEqual([
      "styles/crm-theme.css",
      "lib/utils.ts",
      "components/crm/test-button.tsx",
    ]);
    expect(item.dependencies).toEqual(
      expect.arrayContaining(["clsx", "tailwind-merge", "lucide-react"]),
    );
  });

  it("copy code and prompt contain the same source and never a token", () => {
    const copy = copyCodeText(item);
    const prompt = agentPromptText(item, { apiOrigin: "https://x.test", premium: true });
    expect(copy).toContain(r.bundle.files[0]!.content.trimEnd());
    expect(prompt).toContain("KITBASE_TOKEN");
    expect(prompt).toContain("https://x.test/cli/kitbase.tgz add test-button");
    expect(prompt).not.toMatch(/ti_[A-Za-z0-9_-]{20,}/);
  });
});
