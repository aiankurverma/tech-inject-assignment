import { useEffect, useMemo, useState } from "react";
import { Moon, Redo2, Shuffle, Sun, Undo2 } from "lucide-react";
import {
  decodeShareHash,
  deriveMode,
  fixThemeContrast,
  generateNeutralScale,
  generateScale,
  generateThemeBlock,
  HARMONY_SCHEMES,
  modeSpec,
  paletteOf,
  randomizeTheme,
  SCALE_STEPS,
  THEME_PRESETS,
  type Density,
  type HarmonyScheme,
  type PaletteKey,
  type ShadowLevel,
  type Theme,
  type ThemeMode,
  type ThemeSpec,
} from "@ti/core";
import { Layout } from "../components/Layout";
import { btn, inputClass, PageHeader } from "../components/ui";
import { ColorField } from "../theme/ColorField";
import { ContrastPanel } from "../theme/ContrastPanel";
import { ExportPanel } from "../theme/ExportPanel";
import { applyPartial, ImportPanel } from "../theme/ImportPanel";
import { PreviewGallery } from "../theme/PreviewGallery";
import { useThemeStore } from "../theme/store";
import { TokenList } from "../theme/TokenList";

const COLOR_FIELDS: {
  key: PaletteKey;
  label: string;
  group: "Brand" | "Surfaces" | "Status";
  hint?: string;
}[] = [
  { key: "primary", label: "Primary", group: "Brand", hint: "buttons, links" },
  { key: "accent", label: "Accent", group: "Brand", hint: "focus ring, status" },
  { key: "bg", label: "Background", group: "Surfaces" },
  { key: "surface", label: "Surface", group: "Surfaces", hint: "cards, panels" },
  { key: "text", label: "Text", group: "Surfaces" },
  { key: "muted", label: "Muted text", group: "Surfaces" },
  { key: "border", label: "Border", group: "Surfaces" },
  { key: "success", label: "Success", group: "Status" },
  { key: "warning", label: "Warning", group: "Status" },
  { key: "danger", label: "Danger", group: "Status" },
];
const GROUPS = ["Brand", "Surfaces", "Status"] as const;
const FONTS = ["Geist", "Inter", "system-ui", "Roboto", "IBM Plex Sans", "Georgia"];
const SHADOWS: ShadowLevel[] = ["none", "soft", "crm"];

function ScaleRow({ label, scale }: { label: string; scale: Record<number, string> }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <ul className="grid grid-cols-11 overflow-hidden rounded-md border border-border">
        {SCALE_STEPS.map((s) => (
          <li
            key={s}
            className="aspect-square"
            style={{ background: scale[s] }}
            title={`${s}: ${scale[s]}`}
          >
            <span className="sr-only">
              {s} {scale[s]}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ThemeStudio() {
  const theme = useThemeStore((s) => s.theme);
  const update = useThemeStore((s) => s.update);
  const replace = useThemeStore((s) => s.replace);
  const undo = useThemeStore((s) => s.undo);
  const redo = useThemeStore((s) => s.redo);
  const canUndo = useThemeStore((s) => s.past.length > 0);
  const canRedo = useThemeStore((s) => s.future.length > 0);
  const [scheme, setScheme] = useState<HarmonyScheme>("analogous");
  const [linkMsg, setLinkMsg] = useState<string | null>(null);

  // A share link (#t=...) replaces the stored theme once, then the hash is cleared.
  useEffect(() => {
    if (!window.location.hash) return;
    try {
      const shared = decodeShareHash(window.location.hash);
      if (shared) {
        replace(shared);
        setLinkMsg(`Loaded shared theme "${shared.name}".`);
      }
    } catch (e) {
      setLinkMsg(e instanceof Error ? e.message : "Could not read the share link.");
    }
    window.history.replaceState(null, "", window.location.pathname + window.location.search);
  }, [replace]);

  // Ctrl/Cmd+Z and Shift+Z outside inputs.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== "z") return;
      const el = e.target;
      if (el instanceof HTMLElement && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) return;
      e.preventDefault();
      if (e.shiftKey) redo();
      else undo();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo]);

  const spec = useMemo(() => modeSpec(theme), [theme]);
  const css = useMemo(() => generateThemeBlock(spec), [spec]);
  // Debounce the preview so dragging a colour picker doesn't recompile a dozen iframes per frame.
  const [previewCss, setPreviewCss] = useState(css);
  useEffect(() => {
    const t = window.setTimeout(() => setPreviewCss(css), 250);
    return () => window.clearTimeout(t);
  }, [css]);

  const editingDerived = theme.mode === "dark" && theme.autoDark;
  const mode = theme.mode;

  const setColour = (key: PaletteKey, value: string) =>
    update(
      (t) => ({
        ...t,
        // Editing the derived dark palette turns it into an explicit one.
        autoDark: mode === "dark" ? false : t.autoDark,
        [mode]: { ...modeSpecPalette(t), [key]: value },
      }),
      `colour:${mode}:${key}`,
    );
  const modeSpecPalette = (t: Theme) => paletteOf(modeSpec(t));
  const setShape = <K extends keyof Theme["shape"]>(key: K, value: Theme["shape"][K]) =>
    update((t) => ({ ...t, shape: { ...t.shape, [key]: value } }), `shape:${key}`);
  const setMode = (m: ThemeMode) => update((t) => (t.mode === m ? t : { ...t, mode: m }));
  const setOverride = (name: string, value: string | null) =>
    update((t) => {
      const palette = modeSpecPalette(t);
      const overrides = { ...palette.overrides };
      if (value === null) delete overrides[name];
      else overrides[name] = value;
      return {
        ...t,
        autoDark: mode === "dark" ? false : t.autoDark,
        [mode]: { ...palette, overrides },
      };
    }, `override:${mode}:${name}`);

  const fix = () =>
    update((t) => {
      const palette = paletteOf(fixThemeContrast(modeSpec(t)));
      return { ...t, autoDark: mode === "dark" ? false : t.autoDark, [mode]: palette };
    });
  const deriveOther = () =>
    update((t) => {
      const other: ThemeMode = mode === "light" ? "dark" : "light";
      return {
        ...t,
        autoDark: other === "dark" ? false : t.autoDark,
        [other]: deriveMode(modeSpecPalette(t), other),
      };
    });

  const scales = useMemo(
    () => ({ primary: generateScale(spec.primary), neutral: generateNeutralScale(spec.bg) }),
    [spec.primary, spec.bg],
  );

  const activePreset = THEME_PRESETS.find((p) => p.theme.name === theme.name)?.id;

  return (
    <Layout wide>
      <PageHeader eyebrow="Tools" title="Theme studio">
        Pick a preset or your own colours, edit light and dark, check contrast, and export the
        tokens as CSS, Tailwind config, design tokens or a share link. The Page Builder and
        Prompt-to-screen previews use this theme too.
      </PageHeader>

      <div
        className="mb-6 flex flex-wrap items-center gap-2 rounded-lg border border-border bg-background p-2"
        role="toolbar"
        aria-label="Theme"
      >
        <label className="flex min-w-0 basis-full items-center gap-2 text-sm sm:flex-1 sm:basis-auto">
          <span className="sr-only">Theme name</span>
          <input
            value={theme.name}
            onChange={(e) => update((t) => ({ ...t, name: e.target.value.slice(0, 60) }), "name")}
            className={`${inputClass} max-w-xs`}
            aria-label="Theme name"
          />
        </label>
        <div
          role="radiogroup"
          aria-label="Mode"
          className="inline-flex h-9 items-center rounded-lg bg-muted p-1"
        >
          {(["light", "dark"] as ThemeMode[]).map((m) => (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={mode === m}
              onClick={() => setMode(m)}
              className={`inline-flex h-7 items-center gap-1.5 rounded-md px-3 text-sm font-medium capitalize transition-all ${
                mode === m
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {m === "light" ? (
                <Sun className="size-3.5" aria-hidden />
              ) : (
                <Moon className="size-3.5" aria-hidden />
              )}
              {m}
            </button>
          ))}
        </div>
        <button
          type="button"
          className={btn.ghost}
          onClick={undo}
          disabled={!canUndo}
          aria-label="Undo"
          title="Undo (Ctrl+Z)"
        >
          <Undo2 className="size-4" aria-hidden />
        </button>
        <button
          type="button"
          className={btn.ghost}
          onClick={redo}
          disabled={!canRedo}
          aria-label="Redo"
          title="Redo (Ctrl+Shift+Z)"
        >
          <Redo2 className="size-4" aria-hidden />
        </button>
      </div>
      {linkMsg ? (
        <p role="status" className="mb-4 text-sm text-muted-foreground">
          {linkMsg}
        </p>
      ) : null}

      <div className="grid gap-8 lg:grid-cols-[340px_minmax(0,1fr)]">
        <aside className="flex min-w-0 flex-col gap-7" aria-label="Theme controls">
          <section className="flex flex-col gap-3">
            <h2 className="text-sm font-semibold text-foreground">Presets</h2>
            <ul className="grid grid-cols-2 gap-2">
              {THEME_PRESETS.map((p) => {
                const s = modeSpec(p.theme, p.theme.mode);
                return (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => replace({ ...p.theme, mode })}
                      aria-pressed={activePreset === p.id}
                      className={`flex w-full items-center gap-2 rounded-md border px-2 py-1.5 text-left text-sm transition-colors hover:bg-muted/50 ${
                        activePreset === p.id ? "border-foreground" : "border-border"
                      }`}
                    >
                      <span
                        aria-hidden
                        className="flex size-6 shrink-0 overflow-hidden rounded border border-border"
                        style={{ background: s.bg }}
                      >
                        <span
                          className="m-auto size-3 rounded-full"
                          style={{ background: s.primary }}
                        />
                      </span>
                      <span className="truncate">{p.name}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
            <div className="flex gap-2">
              <label className="sr-only" htmlFor="harmony">
                Harmony scheme
              </label>
              <select
                id="harmony"
                value={scheme}
                onChange={(e) => setScheme(e.target.value as HarmonyScheme)}
                className={`${inputClass} flex-1 capitalize`}
              >
                {HARMONY_SCHEMES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className={btn.secondary}
                onClick={() => replace(randomizeTheme(theme, scheme))}
              >
                <Shuffle className="size-4" aria-hidden />
                Randomize
              </button>
            </div>
          </section>

          <section className="flex flex-col gap-2 text-sm">
            <h2 className="font-semibold text-foreground">Modes</h2>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={theme.autoDark}
                onChange={(e) => update((t) => ({ ...t, autoDark: e.target.checked }))}
              />
              Derive dark from light automatically
            </label>
            <p className="text-xs text-muted-foreground">
              {editingDerived
                ? "You are viewing the derived dark palette; editing a colour turns it into an override."
                : `Editing the ${mode} palette.`}
            </p>
            <button type="button" className={btn.ghost} onClick={deriveOther}>
              Derive {mode === "light" ? "dark" : "light"} from {mode} now
            </button>
          </section>

          {GROUPS.map((g) => (
            <section key={g} className="flex flex-col gap-3">
              <h2 className="text-sm font-semibold text-foreground">{g}</h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                {COLOR_FIELDS.filter((f) => f.group === g).map((f) => (
                  <ColorField
                    key={f.key}
                    label={f.label}
                    hint={f.hint}
                    value={spec[f.key]}
                    onChange={(v) => setColour(f.key, v)}
                  />
                ))}
              </div>
            </section>
          ))}

          <section className="flex flex-col gap-3">
            <h2 className="text-sm font-semibold text-foreground">Scales</h2>
            <ScaleRow label="Primary 50-950" scale={scales.primary} />
            <ScaleRow label="Neutral 50-950" scale={scales.neutral} />
            <p className="text-xs text-muted-foreground">
              Generated in OKLCH from the primary and background; exported as{" "}
              <code>--color-primary-*</code> and <code>--color-neutral-*</code>.
            </p>
          </section>

          <section className="flex flex-col gap-3 text-sm">
            <h2 className="font-semibold text-foreground">Shape &amp; type</h2>
            <label className="flex flex-col gap-1.5">
              <span className="flex justify-between">
                Radius{" "}
                <span className="text-muted-foreground tabular-nums">{theme.shape.radius}px</span>
              </span>
              <input
                type="range"
                min={0}
                max={24}
                value={theme.shape.radius}
                onChange={(e) => setShape("radius", Number(e.target.value))}
              />
            </label>
            <label className="flex flex-col gap-1.5">
              Font family
              <input
                list="theme-fonts"
                value={theme.shape.font}
                onChange={(e) => setShape("font", e.target.value)}
                className={inputClass}
              />
              <datalist id="theme-fonts">
                {FONTS.map((f) => (
                  <option key={f} value={f} />
                ))}
              </datalist>
            </label>
            <fieldset className="flex flex-col gap-1.5">
              <legend className="mb-1.5">Density</legend>
              <div className="flex flex-wrap gap-1">
                {(["compact", "comfortable", "spacious"] as Density[]).map((d) => (
                  <button
                    key={d}
                    type="button"
                    aria-pressed={theme.shape.density === d}
                    onClick={() => setShape("density", d)}
                    className={theme.shape.density === d ? btn.primary : btn.secondary}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </fieldset>
            <fieldset className="flex flex-col gap-1.5">
              <legend className="mb-1.5">Shadows</legend>
              <div className="flex flex-wrap gap-1">
                {SHADOWS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    aria-pressed={theme.shape.shadow === s}
                    onClick={() => setShape("shadow", s)}
                    className={theme.shape.shadow === s ? btn.primary : btn.secondary}
                  >
                    {s === "crm" ? "CRM" : s}
                  </button>
                ))}
              </div>
            </fieldset>
            <button
              type="button"
              className={btn.ghost}
              onClick={() => replace({ ...THEME_PRESETS[0]!.theme, mode })}
            >
              Reset to CRM default
            </button>
          </section>

          <ImportPanel
            theme={theme}
            onPartial={(partial: Partial<ThemeSpec>) => replace(applyPartial(theme, partial))}
            onTheme={replace}
          />

          <section className="flex flex-col gap-2">
            <h2 className="text-sm font-semibold text-foreground">All tokens</h2>
            <p className="text-xs text-muted-foreground">
              Every variable crm-theme.css defines, derived from the colours above. Edit any to
              override it for the {mode} palette.
            </p>
            <TokenList spec={spec} onOverride={setOverride} />
          </section>
        </aside>

        <div className="flex min-w-0 flex-col gap-10">
          <PreviewGallery themeCss={previewCss} />
          <ContrastPanel spec={spec} onFix={fix} />
          <ExportPanel theme={theme} />
        </div>
      </div>
    </Layout>
  );
}
