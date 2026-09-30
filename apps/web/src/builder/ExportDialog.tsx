import { useEffect, useRef, useState } from "react";
import { Download, X } from "lucide-react";
import { CodeBlock, CopyButton } from "@ti/client";
import { btn, Tabs } from "../components/ui";
import { installScript, type GeneratedPage } from "./codegen";

/** Triggers a browser download of `text` as `filename`. */
export function downloadText(filename: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Modal with the generated Page.tsx and the CLI commands to install what it uses. */
export function ExportDialog({ page, onClose }: { page: GeneratedPage; onClose: () => void }) {
  const [tab, setTab] = useState<"code" | "install">("code");
  const panel = useRef<HTMLDivElement>(null);
  const script = installScript(page);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    panel.current?.focus();
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="export-title"
    >
      <div className="absolute inset-0 bg-black/40 dark:bg-black/60" onClick={onClose} />
      <div
        ref={panel}
        tabIndex={-1}
        className="relative flex max-h-full w-full max-w-3xl flex-col rounded-xl border border-border bg-background shadow-2xl focus:outline-none"
      >
        <div className="flex items-center gap-3 border-b border-border px-5 py-3">
          <div className="min-w-0 flex-1">
            <h2 id="export-title" className="text-base font-semibold">
              Export page
            </h2>
            <p className="text-xs text-muted-foreground">
              {page.slugs.length} component{page.slugs.length === 1 ? "" : "s"}
              {page.missing.length ? ` (${page.missing.length} unavailable, left as comments)` : ""}
            </p>
          </div>
          <Tabs
            value={tab}
            onChange={setTab}
            label="Export format"
            idPrefix="export"
            items={[
              { value: "code", label: "Page.tsx" },
              { value: "install", label: "Install" },
            ]}
          />
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className={`${btn.ghost} size-9 px-0`}
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>
        <div className="scroll-thin flex-1 overflow-y-auto p-5">
          {tab === "code" ? (
            <div id="export-panel-code" role="tabpanel" aria-labelledby="export-tab-code">
              <CodeBlock code={page.code} label="src/Page.tsx" maxHeight={420} />
            </div>
          ) : (
            <div
              id="export-panel-install"
              role="tabpanel"
              aria-labelledby="export-tab-install"
              className="space-y-3"
            >
              <p className="text-sm text-muted-foreground">
                Run these in your project, then drop{" "}
                <code className="font-mono text-xs">Page.tsx</code> into{" "}
                <code className="font-mono text-xs">src/</code>. Premium components read the token
                from <code className="font-mono text-xs">KITBASE_TOKEN</code>.
              </p>
              <CodeBlock code={script} label="terminal" maxHeight={360} />
            </div>
          )}
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border px-5 py-3">
          <CopyButton getText={() => (tab === "code" ? page.code : script)}>
            {tab === "code" ? "Copy Page.tsx" : "Copy commands"}
          </CopyButton>
          <button
            type="button"
            onClick={() => downloadText("Page.tsx", page.code)}
            className={btn.primary}
          >
            <Download className="size-4" aria-hidden />
            Download .tsx
          </button>
        </div>
      </div>
    </div>
  );
}
