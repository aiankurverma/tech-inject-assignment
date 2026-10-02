import { describe, expect, it } from "vitest";
import { contrast, parseColor } from "./color";
import { contrastOf, toOklch } from "./oklch";
import {
  contrastChecks,
  contrastMatrix,
  DEFAULT_THEME,
  DEFAULT_THEME_DOC,
  deriveMode,
  fixThemeContrast,
  generateThemeBlock,
  modeSpec,
  normalizeTheme,
  normalizeThemeDoc,
  randomizeTheme,
  readableOn,
  resolveTheme,
  THEME_PRESETS,
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

  it("builds a full foreground x surface matrix", () => {
    const cells = contrastMatrix(DEFAULT_THEME);
    expect(cells).toHaveLength(7 * 3);
    const textOnBg = cells.find((x) => x.fg === "text" && x.bg === "bg")!;
    expect(textOnBg.level).toBe("AAA");
    expect(cells.every((x) => x.ratio >= 1 && x.ratio <= 21)).toBe(true);
  });
});

describe("fixThemeContrast", () => {
  it("returns the same object when everything already passes", () => {
    // The stock primary sits at 2.47:1 on the background, so fixing it once is expected...
    const once = fixThemeContrast(DEFAULT_THEME);
    expect(once.text).toBe(DEFAULT_THEME.text);
    expect(once.primary).not.toBe(DEFAULT_THEME.primary);
    // ...and a second pass changes nothing.
    expect(fixThemeContrast(once)).toEqual(once);
  });

  it("nudges every failing role until each check passes", () => {
    const broken = {
      ...DEFAULT_THEME,
      text: "#555555",
      muted: "#2f2f2f",
      primary: "#1c0f6e",
      accent: "#222222",
      success: "#0b3d1e",
    };
    expect(contrastChecks(broken).some((x) => !x.pass)).toBe(true);
    const fixed = fixThemeContrast(broken);
    expect(contrastChecks(fixed).every((x) => x.pass)).toBe(true);
    // Hue is preserved: still a blue-violet primary.
    expect(Math.abs(toOklch(fixed.primary)!.h - toOklch(broken.primary)!.h)).toBeLessThan(3);
    // Untouched roles stay verbatim.
    expect(fixed.bg).toBe(broken.bg);
    expect(fixed.warning).toBe(broken.warning);
  });

  it("fixes text against both background and surface", () => {
    const fixed = fixThemeContrast({ ...DEFAULT_THEME, surface: "#3a3a3a", text: "#6a6a6a" });
    expect(contrastOf(fixed.text, fixed.bg)).toBeGreaterThanOrEqual(4.5);
    expect(contrastOf(fixed.text, fixed.surface)).toBeGreaterThanOrEqual(4.5);
  });
});

describe("theme generation", () => {
  it("normalises bad input back to defaults and clamps radius", () => {
    const t = normalizeTheme({
      primary: "not-a-colour",
      bg: "rgb(255 0 0)",
      radius: 99,
      font: "",
      shadow: "huge" as never,
      overrides: {
        "--color-crm-raised": "#222; } body { x: y",
        "bad key": "#fff",
        "--x": 3 as never,
      },
    });
    expect(t.primary).toBe(DEFAULT_THEME.primary);
    expect(t.bg).toBe("#ff0000");
    expect(t.radius).toBe(32);
    expect(t.font).toBe(DEFAULT_THEME.font);
    expect(t.shadow).toBe("crm");
    expect(t.overrides).toEqual({ "--color-crm-raised": "#222 body x: y" });
  });

  it("emits every crm-theme.css variable", () => {
    const vars = Object.fromEntries(
      themeVariables({ ...DEFAULT_THEME, radius: 4, density: "compact" }),
    );
    expect(vars["--color-crm-primary"]).toBe("#4124fb");
    expect(vars["--color-crm-primary-fg"]).toBe("#ffffff");
    expect(vars["--radius-crm"]).toBe("4px");
    expect(vars["--spacing"]).toBe("0.2rem");
    for (const k of [
      "--font-crm",
      "--color-crm-raised",
      "--color-crm-muted",
      "--color-crm-muted-fg",
      "--color-crm-input",
      "--color-crm-sidebar",
      "--color-crm-subtle",
      "--color-crm-faint",
      "--color-crm-soft",
      "--color-crm-chip",
      "--color-crm-icon",
      "--color-crm-success",
      "--color-crm-warning",
      "--color-crm-danger",
      "--color-crm-trend",
      "--color-crm-trend-muted",
      "--color-crm-track",
      "--color-crm-status",
      "--color-tag-blue-bg",
      "--color-tag-neutral-text",
      "--color-primary-500",
      "--color-neutral-950",
      "--shadow-crm-raised",
      "--shadow-crm-primary",
      "--shadow-crm-overlay",
    ])
      expect(vars[k], k).toBeTruthy();
    expect(Object.keys(vars).filter((k) => k.startsWith("--color-tag-"))).toHaveLength(30);
    expect(vars["--color-primary-500"]).toMatch(/^#[0-9a-f]{6}$/);
  });

  it("derives tag colours per mode and applies overrides last", () => {
    const dark = Object.fromEntries(themeVariables(DEFAULT_THEME));
    const light = Object.fromEntries(themeVariables({ ...DEFAULT_THEME, bg: "#ffffff" }));
    expect(toOklch(dark["--color-tag-blue-bg"]!)!.l).toBeLessThan(0.4);
    expect(toOklch(light["--color-tag-blue-bg"]!)!.l).toBeGreaterThan(0.9);
    expect(toOklch(dark["--color-tag-neutral-text"]!)!.c).toBeLessThan(0.01);
    const over = Object.fromEntries(
      themeVariables({
        ...DEFAULT_THEME,
        overrides: { "--color-crm-raised": "#010203", "--nope": "#fff" },
      }),
    );
    expect(over["--color-crm-raised"]).toBe("#010203");
    expect(over["--nope"]).toBeUndefined();
  });

  it("switches shadows by level and mode", () => {
    const none = Object.fromEntries(themeVariables({ ...DEFAULT_THEME, shadow: "none" }));
    expect(none["--shadow-crm-raised"]).toBe("none");
    const crm = Object.fromEntries(themeVariables(DEFAULT_THEME));
    expect(crm["--shadow-crm-overlay"]).toContain("#0e0e0e");
    const lightSoft = Object.fromEntries(
      themeVariables({ ...DEFAULT_THEME, bg: "#ffffff", shadow: "soft" }),
    );
    expect(lightSoft["--shadow-crm-raised"]).toContain("0.06");
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

describe("modes and presets", () => {
  it("derives a light palette from the dark stock theme that passes contrast", () => {
    const light = deriveMode(DEFAULT_THEME_DOC.dark, "light");
    expect(toOklch(light.bg)!.l).toBeGreaterThan(0.95);
    expect(toOklch(light.text)!.l).toBeLessThan(0.3);
    expect(contrastOf(light.text, light.bg)).toBeGreaterThanOrEqual(4.5);
    expect(contrastOf(light.primary, light.bg)).toBeGreaterThanOrEqual(3);
    // Hue survives the flip.
    expect(Math.abs(toOklch(light.primary)!.h - toOklch(DEFAULT_THEME.primary)!.h)).toBeLessThan(3);
  });

  it("autoDark replaces the stored dark palette", () => {
    const theme = {
      ...DEFAULT_THEME_DOC,
      autoDark: true,
      dark: { ...DEFAULT_THEME_DOC.dark, bg: "#ff0000" },
    };
    expect(resolveTheme(theme).dark.bg).not.toBe("#ff0000");
    expect(resolveTheme({ ...theme, autoDark: false }).dark.bg).toBe("#ff0000");
    expect(modeSpec(theme, "light").radius).toBe(DEFAULT_THEME.radius);
  });

  it("the default document renders the stock dark variables", () => {
    expect(modeSpec(DEFAULT_THEME_DOC)).toMatchObject({ bg: "#161616", primary: "#4124fb" });
  });

  it("ships 7 presets whose text stays readable in both modes and that fix cleanly", () => {
    expect(THEME_PRESETS).toHaveLength(7);
    expect(new Set(THEME_PRESETS.map((p) => p.id)).size).toBe(7);
    for (const p of THEME_PRESETS)
      for (const mode of ["light", "dark"] as const) {
        const spec = modeSpec(p.theme, mode);
        const failing = contrastChecks(spec).filter(
          (x) => !x.pass && /^(Text|Button)/.test(x.label),
        );
        expect(failing, `${p.id} ${mode}`).toEqual([]);
        expect(
          contrastChecks(fixThemeContrast(spec)).every((x) => x.pass),
          `${p.id} ${mode} fixed`,
        ).toBe(true);
      }
  });

  it("validates untrusted theme documents", () => {
    expect(normalizeThemeDoc(null)).toEqual(DEFAULT_THEME_DOC);
    const t = normalizeThemeDoc({
      name: "x".repeat(100),
      mode: "sideways",
      autoDark: "yes",
      light: { bg: "#ffffff", overrides: { "--color-crm-bg": "#eee" } },
      shape: { radius: 2 },
    });
    expect(t.name).toHaveLength(60);
    expect(t.mode).toBe("dark");
    expect(t.autoDark).toBe(false);
    expect(t.light.bg).toBe("#ffffff");
    expect(t.light.overrides).toEqual({ "--color-crm-bg": "#eee" });
    expect(t.shape.radius).toBe(2);
  });
});

describe("randomizeTheme", () => {
  const rng = (seed: number) => () => {
    seed = (seed * 1664525 + 1013904223) % 2 ** 32;
    return seed / 2 ** 32;
  };

  it("is deterministic for a given RNG and stays readable", () => {
    const a = randomizeTheme(DEFAULT_THEME_DOC, "analogous", rng(7));
    const b = randomizeTheme(DEFAULT_THEME_DOC, "analogous", rng(7));
    expect(a).toEqual(b);
    expect(a.dark.primary).not.toBe(DEFAULT_THEME.primary);
    const spec = modeSpec(a);
    expect(contrastOf(spec.text, spec.bg)).toBeGreaterThanOrEqual(4.5);
    expect(contrastOf(spec.accent, spec.bg)).toBeGreaterThanOrEqual(3);
    expect(toOklch(spec.bg)!.l).toBeLessThan(0.3);
  });

  it("follows the harmony scheme and refreshes the other mode", () => {
    const t = randomizeTheme({ ...DEFAULT_THEME_DOC, mode: "light" }, "complementary", rng(3));
    const h = toOklch(t.light.primary)!.h;
    const ah = toOklch(t.light.accent)!.h;
    const delta = (((ah - h) % 360) + 360) % 360;
    expect(Math.abs(delta - 180)).toBeLessThan(15);
    expect(toOklch(t.light.bg)!.l).toBeGreaterThan(0.95);
    expect(toOklch(t.dark.bg)!.l).toBeLessThan(0.3);
  });
});
