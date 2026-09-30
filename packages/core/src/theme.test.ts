import { describe, expect, it } from "vitest";
import { contrast, parseColor } from "./color";
import {
  contrastChecks,
  DEFAULT_THEME,
  generateThemeBlock,
  normalizeTheme,
  readableOn,
  themeFromCapture,
  themeVariables,
  wcagLevel,
} from "./theme";

const c = (s: string) => parseColor(s)!;

describe("contrast math", () => {
  it("matches the WCAG reference values", () => {
    expect(contrast(c("#000"), c("#fff"))).toBeCloseTo(21, 5);
    expect(contrast(c("#fff"), c("#fff"))).toBeCloseTo(1, 5);
    expect(contrast(c("#777777"), c("#ffffff"))).toBeCloseTo(4.48, 2);
    // Order does not matter.
    expect(contrast(c("#fff"), c("#767676"))).toBeCloseTo(contrast(c("#767676"), c("#fff")), 10);
  });

  it("maps ratios to WCAG levels", () => {
    expect(wcagLevel(7)).toBe("AAA");
    expect(wcagLevel(4.5)).toBe("AA");
    expect(wcagLevel(4.49)).toBe("AA-large");
    expect(wcagLevel(2.9)).toBe("fail");
  });

  it("picks a readable label colour for the primary", () => {
    expect(readableOn("#4124fb")).toBe("#ffffff");
    expect(readableOn("#fde68a")).toBe("#111111");
  });

  it("flags failing text/surface pairs", () => {
    const checks = contrastChecks({ ...DEFAULT_THEME, muted: "#333333" });
    const muted = checks.find((x) => x.label === "Muted text on background")!;
    expect(muted.pass).toBe(false);
    expect(muted.level).toBe("fail");
    expect(checks.find((x) => x.label === "Text on background")!.pass).toBe(true);
  });
});

describe("theme generation", () => {
  it("normalises bad input back to defaults and clamps radius", () => {
    const t = normalizeTheme({ primary: "not-a-colour", bg: "rgb(255 0 0)", radius: 99, font: "" });
    expect(t.primary).toBe(DEFAULT_THEME.primary);
    expect(t.bg).toBe("#ff0000");
    expect(t.radius).toBe(32);
    expect(t.font).toBe(DEFAULT_THEME.font);
  });

  it("emits crm-theme.css variable names", () => {
    const vars = Object.fromEntries(
      themeVariables({ ...DEFAULT_THEME, radius: 4, density: "compact" }),
    );
    expect(vars["--color-crm-primary"]).toBe("#4124fb");
    expect(vars["--color-crm-primary-fg"]).toBe("#ffffff");
    expect(vars["--radius-crm"]).toBe("4px");
    expect(vars["--spacing"]).toBe("0.2rem");
  });

  it("builds a safe @theme block", () => {
    const css = generateThemeBlock({ font: 'Evil"; } body { x: y' }, "note */ injected");
    expect(css).toContain("@theme {");
    expect(css).toContain('--font-crm: "Evil  body  x y"');
    expect(css.match(/\*\//g)).toHaveLength(1);
  });

  it("imports a Capture result", () => {
    const spec = themeFromCapture({
      capture: {
        tokens: {
          roles: { bg: "#ffffff", text: "rgb(17, 17, 17)", accent: "oklch(0.6 0.2 260)" },
          fonts: [{ family: "Inter", count: 10 }],
          radii: [
            { value: 4, count: 2 },
            { value: 12, count: 9 },
          ],
        },
      },
    });
    expect(spec).toMatchObject({
      bg: "#ffffff",
      surface: "#ffffff",
      text: "#111111",
      font: "Inter",
      radius: 12,
    });
    expect(spec.primary).toMatch(/^#[0-9a-f]{6}$/);
    expect(() => themeFromCapture({ foo: 1 })).toThrow(/roles/);
    expect(() => themeFromCapture("x")).toThrow();
  });
});
