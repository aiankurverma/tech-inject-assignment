import { describe, expect, it } from "vitest";
import { assertPublicUrl, isBlockedIp, parseCaptureUrl } from "./guard";
import {
  buildTokens,
  clusterColors,
  contrast,
  detectScale,
  generateThemeCss,
  guessRoles,
  parseColor,
  primaryFamily,
  scaleRatio,
  toHex,
  spacingBase,
  type ColorSample,
} from "./tokens";

describe("parseColor", () => {
  it("reads computed-style and hex forms", () => {
    expect(parseColor("rgb(22, 22, 22)")).toEqual({ r: 22, g: 22, b: 22, a: 1 });
    expect(parseColor("rgba(65, 36, 251, 0.5)")).toEqual({ r: 65, g: 36, b: 251, a: 0.5 });
    expect(parseColor("rgb(10 20 30 / 40%)")).toEqual({ r: 10, g: 20, b: 30, a: 0.4 });
    expect(parseColor("#fff")).toEqual({ r: 255, g: 255, b: 255, a: 1 });
    expect(parseColor("#4124fb80")?.a).toBeCloseTo(0.5, 1);
    expect(parseColor("hsl(0 0% 0%)")).toBeNull();
  });
  it("converts oklch/oklab/color(srgb) (Tailwind v4 computed values)", () => {
    // Tailwind blue-500: oklch(62.3% 0.214 259.815) = #2b7fff
    const blue = parseColor("oklch(0.623 0.214 259.815)")!;
    expect(toHex(blue)).toBe("#2b7fff");
    expect(toHex(parseColor("oklab(1 0 0)")!)).toBe("#ffffff");
    expect(parseColor("oklab(0 0 0 / 0.5)")?.a).toBe(0.5);
    expect(toHex(parseColor("color(srgb 1 0 0)")!)).toBe("#ff0000");
    expect(toHex(parseColor("lab(100 0 0)")!)).toBe("#ffffff");
    expect(toHex(parseColor("lab(54.29 80.8 69.89)")!)).toBe("#ff0000");
    expect(toHex(parseColor("lch(0 0 0)")!)).toBe("#000000");
  });
  it("computes WCAG contrast", () => {
    expect(contrast(parseColor("#000")!, parseColor("#fff")!)).toBeCloseTo(21, 0);
  });
});

describe("clusterColors", () => {
  it("merges near-identical shades and keeps the heaviest real value", () => {
    const samples: ColorSample[] = [
      { value: "rgb(255, 255, 255)", use: "bg", weight: 900 },
      { value: "rgb(254, 254, 254)", use: "bg", weight: 10 },
      { value: "rgb(17, 17, 17)", use: "text", weight: 50 },
      { value: "rgba(0, 0, 0, 0)", use: "bg", weight: 999 },
    ];
    const c = clusterColors(samples);
    expect(c).toHaveLength(2);
    expect(c[0]).toMatchObject({ hex: "#ffffff", weight: 910, members: 2 });
    expect(c[1]!.uses.text).toBe(50);
  });
});

describe("guessRoles", () => {
  it("assigns bg, surface, text, muted, border and accent", () => {
    const samples: ColorSample[] = [
      { value: "#161616", use: "bg", weight: 800 },
      { value: "#1f1f22", use: "bg", weight: 200 },
      { value: "#4124fb", use: "bg", weight: 20 },
      { value: "#f9fbff", use: "text", weight: 120 },
      { value: "#8a8a8a", use: "text", weight: 60 },
      { value: "#2e2e2e", use: "border", weight: 80 },
    ];
    const roles = guessRoles(clusterColors(samples, 4));
    expect(roles).toEqual({
      bg: "#161616",
      surface: "#1f1f22",
      text: "#f9fbff",
      mutedText: "#8a8a8a",
      border: "#2e2e2e",
      accent: "#4124fb",
    });
  });
  it("skips low-contrast text", () => {
    const roles = guessRoles(
      clusterColors([
        { value: "#ffffff", use: "bg", weight: 10 },
        { value: "#fafafa", use: "text", weight: 99 },
        { value: "#222222", use: "text", weight: 5 },
      ]),
    );
    expect(roles.text).toBe("#222222");
  });
});

describe("scales", () => {
  it("snaps near values, drops noise and sorts ascending", () => {
    const steps = detectScale({ "16px": 40, "15.8px": 3, "12px": 10, "24px": 6, "13.33px": 1 });
    expect(steps).toEqual([
      { value: 12, count: 10 },
      { value: 16, count: 43 },
      { value: 24, count: 6 },
    ]);
  });
  it("finds the type ratio and the spacing grid", () => {
    const type = [12, 15, 18.75].map((value) => ({ value, count: 1 }));
    expect(scaleRatio(type)).toBeCloseTo(1.25, 2);
    expect(scaleRatio(type.slice(0, 2))).toBeNull();
    expect(spacingBase([4, 12, 16, 20, 24].map((value) => ({ value, count: 5 })))).toBe(4);
    expect(spacingBase([8, 16, 24].map((value) => ({ value, count: 5 })))).toBe(8);
    expect(spacingBase([5, 7, 13].map((value) => ({ value, count: 5 })))).toBeNull();
  });
  it("takes the first family of a stack", () => {
    expect(primaryFamily('"Inter var", system-ui, sans-serif')).toBe("Inter var");
  });
});

describe("generateThemeCss", () => {
  it("emits a crm-theme @theme block from tokens", () => {
    const tokens = buildTokens({
      colors: [
        { value: "rgb(255, 255, 255)", use: "bg", weight: 900 },
        { value: "rgb(17, 24, 39)", use: "text", weight: 100 },
        { value: "rgb(229, 231, 235)", use: "border", weight: 40 },
        { value: "rgb(37, 99, 235)", use: "bg", weight: 30 },
      ],
      fonts: { "Inter, sans-serif": 50 },
      fontSizes: { "14px": 30, "16px": 20, "20px": 5 },
      radii: { "8px": 12, "4px": 3 },
      spacing: { "8px": 10, "16px": 10, "24px": 5 },
      shadows: { "rgba(0, 0, 0, 0.1) 0px 1px 3px 0px": 7 },
    });
    const css = generateThemeCss(tokens, "https://example.com/*/x");
    expect(css).toContain("@theme {");
    expect(css).toContain('--font-crm: "Inter"');
    expect(css).toContain("--color-crm-bg: #ffffff;");
    expect(css).toContain("--color-crm-fg: #111827;");
    expect(css).toContain("--color-crm-primary: #2563eb;");
    expect(css).toContain("--color-crm-primary-fg: #ffffff;");
    expect(css).toContain("--radius-crm: 8px;");
    expect(css).toContain("--spacing-cap: 8px;");
    // The source URL cannot close the comment early.
    expect(css.split("*/")).toHaveLength(3);
  });
});

describe("SSRF guard", () => {
  it.each([
    "127.0.0.1",
    "10.1.2.3",
    "172.20.0.1",
    "192.168.1.1",
    "169.254.169.254",
    "100.64.0.1",
    "0.0.0.0",
    "::1",
    "::",
    "fe80::1",
    "fd00::1",
    "::ffff:127.0.0.1",
    "::ffff:a9fe:a9fe",
    "64:ff9b::a00:1",
    "not-an-ip",
  ])("blocks %s", (ip) => expect(isBlockedIp(ip)).toBe(true));

  it.each(["8.8.8.8", "1.1.1.1", "2606:4700:4700::1111", "::ffff:8.8.8.8"])("allows %s", (ip) =>
    expect(isBlockedIp(ip)).toBe(false),
  );

  it.each([
    ["ftp://example.com", "Only http"],
    ["file:///etc/passwd", "Only http"],
    ["http://localhost:3000", "not a public"],
    ["http://intranet", "not a public"],
    ["http://printer.local", "not a public"],
    ["http://169.254.169.254/latest/meta-data", "metadata"],
    ["http://[::1]/", "metadata"],
    ["http://user:pw@example.com", "credentials"],
    ["http://example.com:22", "ports"],
    ["nope", "valid URL"],
  ])("rejects %s", (url, msg) => {
    const r = parseCaptureUrl(url);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain(msg);
  });

  it("accepts public URLs and strips the hash", () => {
    const r = parseCaptureUrl("https://example.com/pricing#top");
    expect(r.ok && r.url.href).toBe("https://example.com/pricing");
  });

  it("rejects hosts whose DNS points inside", async () => {
    const internal = await assertPublicUrl("https://evil.example", async () => ["127.0.0.1"]);
    expect(internal.ok).toBe(false);
    const mixed = await assertPublicUrl("https://x.example", async () => ["8.8.8.8", "10.0.0.1"]);
    expect(mixed.ok).toBe(false);
    const ok = await assertPublicUrl("https://x.example", async () => ["93.184.216.34"]);
    expect(ok.ok).toBe(true);
    const nx = await assertPublicUrl("https://x.example", async () => {
      throw new Error("ENOTFOUND");
    });
    expect(nx.ok).toBe(false);
  });
});
