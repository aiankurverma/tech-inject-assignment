import { describe, expect, it } from "vitest";
import {
  contrastOf,
  fixContrast,
  fromOklch,
  generateNeutralScale,
  generateScale,
  harmonize,
  harmonyHues,
  isLightColor,
  mixOklch,
  SCALE_STEPS,
  toOklch,
  withOklch,
} from "./oklch";

const HEX = /^#[0-9a-f]{6}$/;

describe("OKLCH conversion", () => {
  it("round-trips hex through OKLCH", () => {
    for (const c of ["#4124fb", "#161616", "#f9fbff", "#22c55e", "#ffffff", "#000000"]) {
      const ok = toOklch(c)!;
      expect(ok.l).toBeGreaterThanOrEqual(0);
      expect(ok.l).toBeLessThanOrEqual(1);
      expect(fromOklch(ok)).toBe(c);
    }
  });

  it("parses the syntaxes browsers compute to", () => {
    expect(toOklch("rgb(255 0 0)")!.h).toBeCloseTo(29, 0);
    expect(toOklch("oklch(0.6 0.2 260)")!.l).toBeCloseTo(0.6, 2);
    expect(toOklch("nope")).toBeNull();
  });

  it("keeps out-of-gamut colours in sRGB by reducing chroma", () => {
    const hex = fromOklch({ l: 0.5, c: 0.4, h: 150 });
    expect(hex).toMatch(HEX);
    expect(toOklch(hex)!.c).toBeLessThan(0.4);
    expect(toOklch(hex)!.l).toBeCloseTo(0.5, 1);
  });

  it("patches channels and mixes perceptually", () => {
    expect(toOklch(withOklch("#4124fb", { l: 0.9 }))!.l).toBeCloseTo(0.9, 1);
    expect(withOklch("garbage", { l: 0.5 })).toBe("garbage");
    const mid = mixOklch("#000000", "#ffffff", 0.5);
    expect(toOklch(mid)!.l).toBeCloseTo(0.5, 1);
    expect(mixOklch("#123456", "#654321", 0)).toBe("#123456");
    expect(isLightColor("#ffffff")).toBe(true);
    expect(isLightColor("#161616")).toBe(false);
  });
});

describe("scales", () => {
  it("emits 11 steps from light to dark, keeping the base verbatim", () => {
    const scale = generateScale("#4124fb");
    expect(Object.keys(scale)).toHaveLength(SCALE_STEPS.length);
    const ls = SCALE_STEPS.map((s) => toOklch(scale[s])!.l);
    for (let i = 1; i < ls.length; i++) expect(ls[i]!).toBeLessThan(ls[i - 1]!);
    expect(Object.values(scale)).toContain("#4124fb");
    expect(toOklch(scale[50])!.l).toBeGreaterThan(0.95);
    expect(toOklch(scale[950])!.l).toBeLessThan(0.3);
  });

  it("keeps the hue across the ramp", () => {
    const scale = generateScale("#22c55e");
    const h0 = toOklch("#22c55e")!.h;
    for (const s of [200, 500, 800] as const)
      expect(Math.abs(toOklch(scale[s])!.h - h0)).toBeLessThan(6);
  });

  it("builds a low-chroma neutral ramp tinted by the base", () => {
    const scale = generateNeutralScale("#4124fb");
    for (const s of SCALE_STEPS) expect(toOklch(scale[s])!.c).toBeLessThan(0.03);
    expect(scale[50]).not.toBe(scale[950]);
  });
});

describe("harmony", () => {
  it("offsets hues per scheme", () => {
    const h = toOklch("#4124fb")!.h;
    const wrap = (x: number) => ((x % 360) + 360) % 360;
    expect(harmonyHues("#4124fb", "complementary")[1]).toBeCloseTo(wrap(h + 180), 5);
    expect(harmonyHues("#4124fb", "analogous")).toHaveLength(3);
    expect(harmonyHues("#4124fb", "triadic")[2]).toBeCloseTo(wrap(h + 240), 5);
    expect(harmonyHues("#4124fb", "mono")).toEqual([h, h]);
  });

  it("returns a valid accent that follows the scheme hue", () => {
    const { accent, tintHue } = harmonize("#4124fb", "complementary");
    expect(accent).toMatch(HEX);
    expect(tintHue).toBeCloseTo(toOklch("#4124fb")!.h, 5);
    const diff = Math.abs(toOklch(accent)!.h - harmonyHues("#4124fb", "complementary")[1]!);
    expect(Math.min(diff, 360 - diff)).toBeLessThan(12);
  });
});

describe("fixContrast", () => {
  it("leaves passing pairs alone", () => {
    expect(fixContrast("#ffffff", "#161616", 4.5)).toBe("#ffffff");
  });

  it("lightens text on dark backgrounds until it passes, keeping the hue", () => {
    const fixed = fixContrast("#333333", "#161616", 4.5);
    expect(contrastOf(fixed, "#161616")).toBeGreaterThanOrEqual(4.5);
    expect(toOklch(fixed)!.l).toBeGreaterThan(toOklch("#333333")!.l);
    const brand = fixContrast("#2a1a9a", "#161616", 3);
    expect(contrastOf(brand, "#161616")).toBeGreaterThanOrEqual(3);
    expect(Math.abs(toOklch(brand)!.h - toOklch("#2a1a9a")!.h)).toBeLessThan(3);
  });

  it("darkens on light backgrounds and does not overshoot", () => {
    const fixed = fixContrast("#bbbbbb", "#ffffff", 4.5);
    const ratio = contrastOf(fixed, "#ffffff");
    expect(ratio).toBeGreaterThanOrEqual(4.5);
    expect(ratio).toBeLessThan(5.2);
  });

  it("falls back to black or white when the hue cannot reach the ratio", () => {
    const fixed = fixContrast("#808080", "#808080", 7);
    expect(["#000000", "#ffffff"]).toContain(fixed);
  });
});
