import { describe, expect, it } from "vitest";
import { DEFAULT_THEME, DEFAULT_THEME_DOC, modeSpec, THEME_PRESETS, type Theme } from "./theme";
import {
  decodeShareHash,
  encodeShareHash,
  generateCssVariables,
  generateDesignTokens,
  generateTailwindConfig,
  generateThemeCss,
  shareUrl,
  themeFromCssVariables,
} from "./theme-io";

const ocean = THEME_PRESETS.find((p) => p.id === "ocean")!.theme;

describe("CSS exports", () => {
  it("emits light values in @theme and only the differing dark ones in .dark", () => {
    const css = generateThemeCss(ocean);
    expect(css.startsWith("/* Ocean")).toBe(true);
    expect(css).toContain("@theme {");
    expect(css).toContain(`--color-crm-bg: ${ocean.light.bg};`);
    const darkBlock = css.slice(css.indexOf('.dark, [data-theme="dark"] {'));
    expect(darkBlock).toContain(`--color-crm-bg: ${ocean.dark.bg};`);
    expect(darkBlock).toContain("@media (prefers-color-scheme: dark)");
    // Radius and font are the same in both modes, so they are not repeated.
    expect(darkBlock).not.toContain("--radius-crm");
    expect(darkBlock).not.toContain("--font-crm");
  });

  it("emits plain custom properties for both modes", () => {
    const css = generateCssVariables(DEFAULT_THEME_DOC);
    expect(css).toContain(":root {");
    expect(css).toContain('.dark, [data-theme="dark"] {');
    expect(css).not.toContain("@theme");
    expect(css.match(/--color-crm-primary:/g)).toHaveLength(2);
    expect(css).toContain(`--color-crm-primary: ${DEFAULT_THEME.primary};`);
  });

  it("keeps comment injection out of the header", () => {
    const css = generateThemeCss({ ...DEFAULT_THEME_DOC, name: "x */ body{}" });
    expect(css.split("\n")[0]).toBe("/* x  body{} - Kitbase Theme Studio */");
  });
});

describe("Tailwind config export", () => {
  it("references the CSS variables and shape values", () => {
    const ts = generateTailwindConfig({
      ...DEFAULT_THEME_DOC,
      shape: { ...DEFAULT_THEME_DOC.shape, radius: 12, font: "Inter" },
    });
    expect(ts).toContain('import type { Config } from "tailwindcss";');
    expect(ts).toContain('"primary": "var(--color-crm-primary)"');
    expect(ts).toContain('"blue-bg": "var(--color-tag-blue-bg)"');
    expect(ts).toContain('"500": "var(--color-primary-500)"');
    expect(ts).toContain('borderRadius: { crm: "12px" }');
    expect(ts).toContain('fontFamily: { crm: ["Inter"');
    expect(ts).toContain("} satisfies Config;");
  });
});

describe("DTCG export", () => {
  it("types every token and carries both modes in extensions", () => {
    const tokens = generateDesignTokens(ocean);
    expect(tokens.$schema).toBe("https://tr.designtokens.org/format/");
    const kb = tokens.kitbase as Record<
      string,
      Record<string, Record<string, Record<string, unknown>>>
    >;
    const primary = kb.color!.crm!.primary!;
    expect(primary.$type).toBe("color");
    expect(primary.$value).toBe(ocean.dark.primary);
    expect(primary.$extensions).toEqual({
      "com.kitbase.modes": { light: ocean.light.primary, dark: ocean.dark.primary },
    });
    expect(kb.color!.tag!["blue-bg"]!.$type).toBe("color");
    expect(kb.color!.primary!["500"]!.$type).toBe("color");
    expect(kb.radius!.crm).toEqual({ $type: "dimension", $value: "8px" });
    expect(kb.font!.crm!.$type).toBe("fontFamily");
    expect((kb.font!.crm!.$value as unknown as string[])[0]).toBe("Geist");
    expect(JSON.stringify(tokens)).not.toContain("shadow");
  });

  it("uses the light values when light is the active mode", () => {
    const tokens = generateDesignTokens({ ...ocean, mode: "light" }) as unknown as {
      kitbase: { color: { crm: { bg: { $value: string } } } };
    };
    expect(tokens.kitbase.color.crm.bg.$value).toBe(ocean.light.bg);
  });
});

describe("share links", () => {
  it("round-trips a theme through the URL hash", () => {
    const theme: Theme = { ...ocean, name: "Océan ✨", mode: "light" };
    const hash = encodeShareHash(theme);
    expect(hash.startsWith("t=")).toBe(true);
    expect(hash).toMatch(/^t=[A-Za-z0-9_-]+$/);
    expect(decodeShareHash(hash)).toEqual(theme);
    expect(decodeShareHash(`#${hash}`)).toEqual(theme);
    expect(decodeShareHash(shareUrl(theme, "https://kitbase.dev/theme#old"))).toEqual(theme);
    expect(
      shareUrl(theme, "https://kitbase.dev/theme").startsWith("https://kitbase.dev/theme#t="),
    ).toBe(true);
  });

  it("drops the stored dark palette when it is derived anyway", () => {
    const auto = { ...ocean, autoDark: true };
    expect(encodeShareHash(auto).length).toBeLessThan(encodeShareHash(ocean).length);
    expect(decodeShareHash(encodeShareHash(auto))!.autoDark).toBe(true);
  });

  it("returns null without a theme and throws on corrupt data", () => {
    expect(decodeShareHash("")).toBeNull();
    expect(decodeShareHash("#foo=bar")).toBeNull();
    expect(() => decodeShareHash("t=!!!not-base64")).toThrow(/valid/);
    expect(() => decodeShareHash("t=bnVsbA")).toThrow(/no theme/);
    // Unknown fields and bad values fall back instead of failing.
    const loose = decodeShareHash(
      `t=${btoa(JSON.stringify({ mode: "light", light: { bg: "junk" }, evil: 1 }))}`,
    )!;
    expect(loose.mode).toBe("light");
    expect(loose.light.bg).toBe(DEFAULT_THEME_DOC.light.bg);
    expect("evil" in loose).toBe(false);
  });
});

describe("CSS variables import", () => {
  it("reads crm-theme.css declarations, including a @theme block", () => {
    const spec = themeFromCssVariables(`
      /* comment --color-crm-bg: #000; */
      @theme {
        --color-crm-bg: #101010;
        --color-crm-fg: rgb(250 250 250);
        --color-crm-primary: oklch(0.7 0.15 200);
        --color-crm-raised: #222222;
        --radius-crm: 0.75rem;
        --font-crm: "Inter", ui-sans-serif;
      }`);
    expect(spec.bg).toBe("#101010");
    expect(spec.text).toBe("#fafafa");
    expect(spec.primary).toMatch(/^#[0-9a-f]{6}$/);
    expect(spec.radius).toBe(12);
    expect(spec.font).toBe("Inter");
    expect(spec.overrides).toEqual({ "--color-crm-raised": "#222222" });
  });

  it("understands shadcn-style aliases and skips unparseable colours", () => {
    const spec = themeFromCssVariables(
      `:root { --background: #fff; --foreground: #111; --primary: #4124fb; --destructive: hsl(0 80% 60%); --radius: 6px; --border: notacolour }`,
    );
    expect(spec).toMatchObject({ bg: "#ffffff", text: "#111111", primary: "#4124fb", radius: 6 });
    expect(spec.danger).toMatch(/^#[0-9a-f]{6}$/);
    expect(spec.border).toBeUndefined();
  });

  it("throws when there is nothing to import", () => {
    expect(() => themeFromCssVariables("body { color: red }")).toThrow(/No theme variables/);
  });

  it("round-trips through the studio's own export", () => {
    const spec = themeFromCssVariables(generateCssVariables(ocean));
    // :root (light) comes first, .dark later; the last declaration wins, so this is the dark palette.
    expect(spec.bg).toBe(modeSpec(ocean, "dark").bg);
    expect(spec.primary).toBe(modeSpec(ocean, "dark").primary);
  });
});
