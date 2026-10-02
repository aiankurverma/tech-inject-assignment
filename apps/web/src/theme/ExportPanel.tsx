import { useMemo, useState } from "react";
import { Download, Link2 } from "lucide-react";
import {
  generateCssVariables,
  generateDesignTokens,
  generateTailwindConfig,
  generateThemeBlock,
  generateThemeCss,
  modeSpec,
  shareUrl,
  type Theme,
} from "@ti/core";
import { CodeBlock, CopyButton } from "@ti/client";
import { btn, Tabs } from "../components/ui";

type Format = "theme" | "mode" | "vars" | "tailwind" | "tokens" | "share";

const FORMATS: { value: Format; label: string; file: string; language: string }[] = [
  { value: "theme", label: "@theme CSS", file: "kitbase-theme.css", language: "css" },
  { value: "mode", label: "Single mode", file: "kitbase-theme-mode.css", language: "css" },
  { value: "vars", label: "CSS variables", file: "kitbase-variables.css", language: "css" },
  { value: "tailwind", label: "Tailwind config", file: "tailwind.config.ts", language: "ts" },
  { value: "tokens", label: "Design tokens", file: "kitbase-tokens.json", language: "json" },
  { value: "share", label: "Share link", file: "kitbase-theme-link.txt", language: "text" },
];

const slug = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/plain" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

/** Every export format for the theme, with copy and download. */
export function ExportPanel({ theme }: { theme: Theme }) {
  const [format, setFormat] = useState<Format>("theme");
  const outputs = useMemo<Record<Format, string>>(
    () => ({
      theme: generateThemeCss(theme),
      mode: generateThemeBlock(
        modeSpec(theme),
        `Kitbase theme: ${theme.name} (${theme.mode} mode)`,
      ),
      vars: generateCssVariables(theme),
      tailwind: generateTailwindConfig(theme),
      tokens: JSON.stringify(generateDesignTokens(theme), null, 2),
      share: shareUrl(theme, window.location.href),
    }),
    [theme],
  );
  const current = FORMATS.find((f) => f.value === format)!;
  const file = current.file.replace("kitbase", slug(theme.name) || "kitbase");
  const code = outputs[format];

  return (
    <section aria-labelledby="export-h" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <h2 id="export-h" className="mr-auto text-lg font-semibold text-foreground">
          Export
        </h2>
        <CopyButton getText={() => code} label={format === "share" ? "Copy link" : "Copy"} />
        <button type="button" className={btn.secondary} onClick={() => download(file, code)}>
          <Download className="size-4" aria-hidden />
          Download
        </button>
      </div>
      <div className="overflow-x-auto">
        <Tabs
          value={format}
          onChange={setFormat}
          items={FORMATS}
          label="Export format"
          idPrefix="export"
        />
      </div>
      <div id={`export-panel-${format}`} role="tabpanel" aria-labelledby={`export-tab-${format}`}>
        {format === "share" ? (
          <div className="flex flex-col gap-2 rounded-lg border border-border p-4 text-sm">
            <p className="flex items-center gap-2 font-medium text-foreground">
              <Link2 className="size-4" aria-hidden />
              Share this theme
            </p>
            <p className="text-muted-foreground">
              The whole theme is encoded in the URL hash. Nothing is stored on the server; whoever
              opens the link gets an editable copy.
            </p>
            <code className="block max-h-40 overflow-auto rounded-md bg-muted p-3 text-xs break-all">
              {code}
            </code>
          </div>
        ) : (
          <CodeBlock code={code} label={file} language={current.language} maxHeight={420} />
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        {format === "theme"
          ? "Both modes in one file; import it after crm-theme.css. Dark applies with .dark, data-theme or the OS preference."
          : format === "mode"
            ? `Only the ${theme.mode} palette as a plain @theme block (the original Theme Studio format).`
            : format === "vars"
              ? "Plain custom properties without Tailwind: :root for light, .dark for dark."
              : format === "tailwind"
                ? "JS config for @config users; colours reference the CSS variables file so mode switching still works."
                : format === "tokens"
                  ? "W3C Design Tokens (DTCG) JSON. $value is the active mode; both modes sit in $extensions."
                  : ""}
      </p>
    </section>
  );
}
