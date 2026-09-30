import { useEffect, useMemo, useState } from "react";
import { Check, Download, TriangleAlert } from "lucide-react";
import {
  contrastChecks,
  DEFAULT_THEME,
  generateThemeBlock,
  parseColor,
  toHex,
  normalizeTheme,
  themeFromCapture,
  type Density,
  type ThemeSpec,
} from "@ti/core";
import { api, CodeBlock, CopyButton, PreviewFrame, type PreviewPayload } from "@ti/client";
import { Layout } from "../components/Layout";
import { alertClass, btn, inputClass, PageHeader } from "../components/ui";

/** Free, small components that together show every token the studio edits. */
const PREVIEW_SLUGS = ["button", "badge", "input", "card", "switch", "tabs"] as const;

const COLOR_FIELDS: { key: keyof ThemeSpec; label: string; group: "Brand" | "Surfaces" }[] = [
  { key: "primary", label: "Primary", group: "Brand" },
  { key: "accent", label: "Accent / focus ring", group: "Brand" },
  { key: "bg", label: "Background", group: "Surfaces" },
  { key: "surface", label: "Surface (cards)", group: "Surfaces" },
  { key: "text", label: "Text", group: "Surfaces" },
  { key: "muted", label: "Muted text", group: "Surfaces" },
  { key: "border", label: "Border", group: "Surfaces" },
];

const FONTS = ["Geist", "Inter", "system-ui", "Roboto", "IBM Plex Sans", "Georgia"];

function ColorInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  return (
    <label className="flex items-center gap-3 text-sm">
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="size-8 shrink-0 cursor-pointer rounded border border-border bg-background p-0.5"
        aria-label={`${label} colour picker`}
      />
      <span className="min-w-0 flex-1 text-foreground">{label}</span>
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          const rgb = parseColor(draft);
          if (rgb) onChange(toHex(rgb));
          else setDraft(value);
        }}
        className={`${inputClass} w-24 font-mono text-xs`}
        aria-label={`${label} hex value`}
      />
    </label>
  );
}

export function ThemeStudio() {
  const [spec, setSpec] = useState<ThemeSpec>(DEFAULT_THEME);
  const [payloads, setPayloads] = useState<Record<string, PreviewPayload>>({});
  const [loadError, setLoadError] = useState<string | null>(null);
  const [importText, setImportText] = useState("");
  const [importMsg, setImportMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    let alive = true;
    Promise.allSettled(
      PREVIEW_SLUGS.map((s) => api<PreviewPayload>(`/api/components/${s}/preview`)),
    ).then((results) => {
      if (!alive) return;
      const next: Record<string, PreviewPayload> = {};
      results.forEach((r, i) => {
        if (r.status === "fulfilled") next[PREVIEW_SLUGS[i]!] = r.value;
      });
      setPayloads(next);
      if (!Object.keys(next).length) setLoadError("Could not load component previews.");
    });
    return () => {
      alive = false;
    };
  }, []);

  const css = useMemo(() => generateThemeBlock(spec), [spec]);
  const checks = useMemo(() => contrastChecks(spec), [spec]);
  const failing = checks.filter((c) => !c.pass).length;

  // Debounce the preview so dragging a colour picker doesn't recompile six iframes per frame.
  const [previewCss, setPreviewCss] = useState(css);
  useEffect(() => {
    const t = window.setTimeout(() => setPreviewCss(css), 250);
    return () => window.clearTimeout(t);
  }, [css]);

  const themed = useMemo(() => {
    const out: Record<string, PreviewPayload> = {};
    for (const [slug, p] of Object.entries(payloads))
      out[slug] = { ...p, themeCss: `${p.themeCss}\n${previewCss}` };
    return out;
  }, [payloads, previewCss]);

  const set = <K extends keyof ThemeSpec>(key: K, value: ThemeSpec[K]) =>
    setSpec((s) => normalizeTheme({ ...s, [key]: value }));

  const download = () => {
    const url = URL.createObjectURL(new Blob([css], { type: "text/css" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "kitbase-theme.css";
    a.click();
    URL.revokeObjectURL(url);
  };

  const runImport = () => {
    try {
      const partial = themeFromCapture(JSON.parse(importText));
      setSpec((s) => normalizeTheme({ ...s, ...partial }));
      setImportMsg({ ok: true, text: `Imported ${Object.keys(partial).length} values.` });
    } catch (e) {
      setImportMsg({ ok: false, text: e instanceof Error ? e.message : "Invalid JSON" });
    }
  };

  const groups = ["Brand", "Surfaces"] as const;

  return (
    <Layout wide>
      <PageHeader eyebrow="Tools" title="Theme studio">
        Tune the CRM tokens, check contrast, and export an <code>@theme</code> block that drops in
        after <code>crm-theme.css</code>.
      </PageHeader>

      <div className="grid gap-8 lg:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="flex flex-col gap-6" aria-label="Theme controls">
          {groups.map((g) => (
            <section key={g} className="flex flex-col gap-3">
              <h2 className="text-sm font-semibold text-foreground">{g}</h2>
              {COLOR_FIELDS.filter((f) => f.group === g).map((f) => (
                <ColorInput
                  key={f.key}
                  label={f.label}
                  value={spec[f.key] as string}
                  onChange={(v) => set(f.key, v)}
                />
              ))}
            </section>
          ))}

          <section className="flex flex-col gap-3 text-sm">
            <h2 className="font-semibold text-foreground">Shape &amp; type</h2>
            <label className="flex flex-col gap-1.5">
              <span className="flex justify-between">
                Radius <span className="text-muted-foreground tabular-nums">{spec.radius}px</span>
              </span>
              <input
                type="range"
                min={0}
                max={24}
                value={spec.radius}
                onChange={(e) => set("radius", Number(e.target.value))}
              />
            </label>
            <label className="flex flex-col gap-1.5">
              Font family
              <input
                list="theme-fonts"
                value={spec.font}
                onChange={(e) => set("font", e.target.value)}
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
              <div className="flex gap-1">
                {(["compact", "comfortable", "spacious"] as Density[]).map((d) => (
                  <button
                    key={d}
                    type="button"
                    aria-pressed={spec.density === d}
                    onClick={() => set("density", d)}
                    className={spec.density === d ? btn.primary : btn.secondary}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </fieldset>
            <button type="button" className={btn.ghost} onClick={() => setSpec(DEFAULT_THEME)}>
              Reset to CRM default
            </button>
          </section>

          <section className="flex flex-col gap-2 text-sm">
            <h2 className="font-semibold text-foreground">Import from Capture</h2>
            <textarea
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              placeholder='Paste a Capture result JSON ({ "capture": { "tokens": ... } })'
              rows={4}
              className={`${inputClass} h-auto py-2 font-mono text-xs`}
            />
            <button
              type="button"
              className={btn.secondary}
              disabled={!importText.trim()}
              onClick={runImport}
            >
              Import
            </button>
            {importMsg ? (
              <p role="status" className={importMsg.ok ? "text-muted-foreground" : alertClass}>
                {importMsg.text}
              </p>
            ) : null}
          </section>
        </aside>

        <div className="flex min-w-0 flex-col gap-8">
          <section aria-label="Live preview">
            {loadError ? <p className={alertClass}>{loadError}</p> : null}
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {PREVIEW_SLUGS.filter((s) => themed[s] || !loadError).map((s) => (
                <PreviewFrame
                  key={s}
                  payload={themed[s] ?? null}
                  example={0}
                  height={200}
                  title={`${s} preview`}
                />
              ))}
            </div>
          </section>

          <section aria-labelledby="contrast-h" className="flex flex-col gap-3">
            <h2 id="contrast-h" className="text-lg font-semibold text-foreground">
              Contrast{" "}
              <span className="text-sm font-normal text-muted-foreground">
                {failing ? `${failing} pair${failing > 1 ? "s" : ""} below WCAG AA` : "all pairs pass"}
              </span>
            </h2>
            <ul className="divide-y divide-border rounded-lg border border-border text-sm">
              {checks.map((c) => (
                <li key={c.label} className="flex items-center gap-3 px-3 py-2">
                  <span
                    aria-hidden
                    className="flex size-7 items-center justify-center rounded text-xs font-semibold"
                    style={{ background: c.bg, color: c.fg }}
                  >
                    Aa
                  </span>
                  <span className="flex-1">{c.label}</span>
                  <span className="tabular-nums text-muted-foreground">{c.ratio.toFixed(2)}:1</span>
                  <span
                    className={`inline-flex w-24 items-center justify-end gap-1 ${c.pass ? "text-foreground" : "text-red-600 dark:text-red-400"}`}
                  >
                    {c.pass ? (
                      <Check className="size-4" aria-hidden />
                    ) : (
                      <TriangleAlert className="size-4" aria-hidden />
                    )}
                    {c.level === "fail" ? "Fail" : c.level}
                  </span>
                </li>
              ))}
            </ul>
            <p className="text-xs text-muted-foreground">
              Text pairs need 4.5:1; primary and focus ring against the background need 3:1.
            </p>
          </section>

          <section aria-labelledby="export-h" className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <h2 id="export-h" className="mr-auto text-lg font-semibold text-foreground">
                Export
              </h2>
              <CopyButton getText={() => css} label="Copy CSS" />
              <button type="button" className={btn.secondary} onClick={download}>
                <Download className="size-4" aria-hidden />
                Download .css
              </button>
            </div>
            <CodeBlock code={css} label="Theme CSS" maxHeight={420} />
          </section>
        </div>
      </div>
    </Layout>
  );
}
