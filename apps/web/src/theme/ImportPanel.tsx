import { useState } from "react";
import {
  decodeShareHash,
  normalizePalette,
  normalizeShape,
  themeFromCapture,
  themeFromCssVariables,
  type Theme,
  type ThemeSpec,
} from "@ti/core";
import { alertClass, btn, inputClass, Tabs } from "../components/ui";

type Source = "capture" | "css" | "link";
const SOURCES: { value: Source; label: string }[] = [
  { value: "capture", label: "Capture JSON" },
  { value: "css", label: "CSS variables" },
  { value: "link", label: "Share link" },
];

const PLACEHOLDER: Record<Source, string> = {
  capture: 'Paste a Capture result JSON ({ "capture": { "tokens": ... } })',
  css: ":root {\n  --color-crm-bg: #101010;\n  --color-crm-primary: #4124fb;\n}",
  link: "https://.../theme#t=...",
};

/** Applies a partial spec to the mode being edited (colours + shape). */
export function applyPartial(theme: Theme, partial: Partial<ThemeSpec>): Theme {
  const palette = theme[theme.mode];
  const merged = normalizePalette(
    { ...palette, ...partial, overrides: { ...palette.overrides, ...partial.overrides } },
    { ...palette, ...theme.shape },
  );
  return {
    ...theme,
    [theme.mode]: merged,
    shape: normalizeShape({ ...theme.shape, ...partial }, { ...palette, ...theme.shape }),
  };
}

/** Import from Capture JSON, pasted CSS variables or a share link. */
export function ImportPanel({
  theme,
  onPartial,
  onTheme,
}: {
  theme: Theme;
  onPartial: (partial: Partial<ThemeSpec>) => void;
  onTheme: (theme: Theme) => void;
}) {
  const [source, setSource] = useState<Source>("capture");
  const [text, setText] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const run = () => {
    try {
      if (source === "link") {
        const t = decodeShareHash(text.trim());
        if (!t) throw new Error("No theme found in that link (expected #t=...).");
        onTheme(t);
        setMsg({ ok: true, text: `Loaded "${t.name}".` });
        return;
      }
      const partial =
        source === "capture" ? themeFromCapture(JSON.parse(text)) : themeFromCssVariables(text);
      onPartial(partial);
      const n = Object.keys(partial).length;
      setMsg({
        ok: true,
        text: `Imported ${n} value${n === 1 ? "" : "s"} into the ${theme.mode} palette.`,
      });
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : "Invalid input" });
    }
  };

  return (
    <section className="flex flex-col gap-2 text-sm" aria-labelledby="import-h">
      <h2 id="import-h" className="font-semibold text-foreground">
        Import
      </h2>
      <Tabs
        value={source}
        onChange={(s) => {
          setSource(s);
          setMsg(null);
        }}
        items={SOURCES}
        label="Import source"
        idPrefix="import"
      />
      <textarea
        id={`import-panel-${source}`}
        role="tabpanel"
        aria-labelledby={`import-tab-${source}`}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={PLACEHOLDER[source]}
        rows={4}
        spellCheck={false}
        className={`${inputClass} h-auto py-2 font-mono text-xs`}
      />
      <button type="button" className={btn.secondary} disabled={!text.trim()} onClick={run}>
        Import
      </button>
      {msg ? (
        <p role="status" className={msg.ok ? "text-muted-foreground" : alertClass}>
          {msg.text}
        </p>
      ) : null}
    </section>
  );
}
