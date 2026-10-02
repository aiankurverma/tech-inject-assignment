import { useState, type FormEvent } from "react";
import { Loader2, RefreshCw, Sparkles, TriangleAlert } from "lucide-react";
import { api, ApiError, type PreviewPayload } from "./api";
import { CodeBlock } from "./CodeBlock";
import { CopyButton } from "./CopyButton";
import { PreviewFrame } from "./PreviewFrame";

/** Reply of POST <endpoint>/generate and <endpoint>/render. */
export interface ScreenResult {
  tree: unknown;
  slugs: string[];
  code: string;
  dependencies: string[];
  files: { path: string; content: string }[];
  installCommand: string;
  preview: PreviewPayload;
}

const EXAMPLES = [
  "Sales pipeline overview with KPI cards, a deals table and an activity timeline",
  "Support inbox: ticket list on the left, ticket detail with comments on the right",
  "Settings page for team members with invite form and roles table",
];

type Tab = "preview" | "code" | "tree" | "install";
const TABS: { value: Tab; label: string }[] = [
  { value: "preview", label: "Preview" },
  { value: "code", label: "Page.tsx" },
  { value: "tree", label: "Tree JSON" },
  { value: "install", label: "Install" },
];

const button =
  "inline-flex h-9 items-center justify-center gap-2 rounded-md border px-3 text-sm font-medium whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900 disabled:cursor-not-allowed disabled:opacity-60 [.dark_&]:focus-visible:outline-neutral-100";
const solid = `${button} border-neutral-950 bg-neutral-950 text-white hover:bg-neutral-800 [.dark_&]:border-neutral-50 [.dark_&]:bg-neutral-50 [.dark_&]:text-neutral-950 [.dark_&]:hover:bg-neutral-200`;
const outline = `${button} border-neutral-200 bg-white text-neutral-900 hover:bg-neutral-50 [.dark_&]:border-neutral-800 [.dark_&]:bg-neutral-950 [.dark_&]:text-neutral-100 [.dark_&]:hover:bg-neutral-900`;
const field =
  "w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 shadow-xs placeholder:text-neutral-400 focus:border-neutral-400 focus:outline-none focus:ring-3 focus:ring-neutral-900/10 [.dark_&]:border-neutral-800 [.dark_&]:bg-neutral-950 [.dark_&]:text-neutral-100 [.dark_&]:focus:border-neutral-600 [.dark_&]:focus:ring-neutral-100/10";
const muted = "text-neutral-500 [.dark_&]:text-neutral-400";

/** Everything the consumer pastes: install steps, each file, then the page. */
function copyAllText(r: ScreenResult): string {
  return [
    "// Kitbase page export",
    `// 1) Install dependencies:  npm install ${r.dependencies.join(" ")}`,
    '// 2) Make sure "@/..." resolves to your src folder, and your main CSS imports styles/crm-theme.css.',
    "// 3) Create each file below inside src/.",
    "",
    ...r.files.map((f) => `// ===== src/${f.path} =====\n${f.content.trimEnd()}\n`),
    `// ===== src/pages/Page.tsx =====\n${r.code.trimEnd()}\n`,
  ].join("\n");
}

function describe(e: unknown): { message: string; details: string[] } {
  if (e instanceof ApiError) return { message: e.message, details: e.details };
  return { message: e instanceof Error ? e.message : "Something went wrong.", details: [] };
}

/**
 * Describe a page, get a tree of catalogue components back, preview it in the sandboxed frame,
 * edit the JSON and re-render, then export Page.tsx with its install command.
 * `endpoint` is "/api/screens" (public) or "/api/admin/screens" (admin).
 */
export function PromptToScreen({
  endpoint,
  componentHref,
  themeCss,
}: {
  endpoint: string;
  /** Link for a used component's slug (catalogue or admin editor). Plain text when omitted. */
  componentHref?: (slug: string) => string;
  /** Theme Studio `@theme` block applied to the preview. */
  themeCss?: string;
}) {
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState<"generate" | "render" | null>(null);
  const [error, setError] = useState<{ message: string; details: string[] } | null>(null);
  const [result, setResult] = useState<ScreenResult | null>(null);
  const [tab, setTab] = useState<Tab>("preview");
  const [treeText, setTreeText] = useState("");

  const apply = (r: ScreenResult) => {
    setResult(r);
    setTreeText(JSON.stringify(r.tree, null, 2));
    setError(null);
  };

  const generate = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy("generate");
    setError(null);
    try {
      apply(await api<ScreenResult>(`${endpoint}/generate`, { method: "POST", json: { prompt } }));
      setTab("preview");
    } catch (err) {
      setError(describe(err));
    } finally {
      setBusy(null);
    }
  };

  const rerender = async () => {
    if (busy) return;
    let tree: unknown;
    try {
      tree = JSON.parse(treeText) as unknown;
    } catch {
      setError({ message: "The tree is not valid JSON.", details: [] });
      return;
    }
    setBusy("render");
    setError(null);
    try {
      apply(await api<ScreenResult>(`${endpoint}/render`, { method: "POST", json: { tree } }));
      setTab("preview");
    } catch (err) {
      setError(describe(err));
    } finally {
      setBusy(null);
    }
  };

  const treeDirty = result !== null && treeText !== JSON.stringify(result.tree, null, 2);

  return (
    <div className="space-y-6">
      <form onSubmit={generate} className="space-y-3">
        <label htmlFor="screen-prompt" className="block text-sm font-medium">
          Describe the screen
        </label>
        <textarea
          id="screen-prompt"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={3}
          maxLength={1000}
          required
          minLength={8}
          placeholder="A customer detail page with contact info, open deals and recent activity"
          className={`${field} min-h-24 resize-y`}
        />
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="submit"
            disabled={busy !== null || prompt.trim().length < 8}
            className={solid}
          >
            {busy === "generate" ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <Sparkles className="size-4" aria-hidden />
            )}
            {busy === "generate" ? "Composing..." : "Generate screen"}
          </button>
          <span className={`text-xs ${muted}`}>Try:</span>
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              type="button"
              onClick={() => setPrompt(ex)}
              className={`rounded-full border border-neutral-200 px-2.5 py-1 text-xs transition-colors hover:bg-neutral-100 [.dark_&]:border-neutral-800 [.dark_&]:hover:bg-neutral-800 ${muted}`}
            >
              {ex.split(":")[0]?.split(" with ")[0]}
            </button>
          ))}
        </div>
      </form>

      {error ? (
        <div
          role="alert"
          className="flex gap-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 [.dark_&]:border-red-900 [.dark_&]:bg-red-950/40 [.dark_&]:text-red-300"
        >
          <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          <div className="min-w-0">
            <p>{error.message}</p>
            {error.details.length ? (
              <ul className="mt-1 list-disc pl-5 text-xs">
                {error.details.slice(0, 8).map((d) => (
                  <li key={d}>{d}</li>
                ))}
              </ul>
            ) : null}
          </div>
        </div>
      ) : null}

      {result ? (
        <section aria-label="Generated screen" className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div
              role="tablist"
              aria-label="Result"
              className="inline-flex h-9 items-center gap-0.5 rounded-lg bg-neutral-100 p-1 [.dark_&]:bg-neutral-900"
            >
              {TABS.map((t) => (
                <button
                  key={t.value}
                  id={`screen-tab-${t.value}`}
                  type="button"
                  role="tab"
                  aria-selected={tab === t.value}
                  aria-controls={`screen-panel-${t.value}`}
                  onClick={() => setTab(t.value)}
                  className={`inline-flex h-7 items-center rounded-md px-3 text-sm font-medium transition-all ${
                    tab === t.value
                      ? "bg-white text-neutral-950 shadow-sm [.dark_&]:bg-neutral-950 [.dark_&]:text-neutral-50"
                      : `${muted} hover:text-neutral-950 [.dark_&]:hover:text-neutral-50`
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <CopyButton variant="solid" getText={() => copyAllText(result)}>
                Copy all files
              </CopyButton>
              <CopyButton getText={() => result.code}>Copy Page.tsx</CopyButton>
            </div>
          </div>

          <p className={`flex flex-wrap items-center gap-1.5 text-xs ${muted}`}>
            <span>Uses {result.slugs.length} components:</span>
            {result.slugs.map((s) =>
              componentHref ? (
                <a
                  key={s}
                  href={componentHref(s)}
                  className="rounded border border-neutral-200 px-1.5 py-0.5 font-mono hover:bg-neutral-100 [.dark_&]:border-neutral-800 [.dark_&]:hover:bg-neutral-800"
                >
                  {s}
                </a>
              ) : (
                <span
                  key={s}
                  className="rounded border border-neutral-200 px-1.5 py-0.5 font-mono [.dark_&]:border-neutral-800"
                >
                  {s}
                </span>
              ),
            )}
          </p>

          <div
            id="screen-panel-preview"
            role="tabpanel"
            aria-labelledby="screen-tab-preview"
            hidden={tab !== "preview"}
          >
            <PreviewFrame
              payload={result.preview}
              example={0}
              height={600}
              title="Generated page preview"
              themeCss={themeCss}
            />
          </div>
          <div
            id="screen-panel-code"
            role="tabpanel"
            aria-labelledby="screen-tab-code"
            hidden={tab !== "code"}
          >
            <CodeBlock code={result.code} label="src/pages/Page.tsx" maxHeight={600} />
          </div>
          <div
            id="screen-panel-tree"
            role="tabpanel"
            aria-labelledby="screen-tab-tree"
            hidden={tab !== "tree"}
            className="space-y-3"
          >
            <p className={`text-sm ${muted}`}>
              Nodes are {"{ id, type, props, children }"}; <code>type</code> is a catalogue slug,{" "}
              <code>slug/Export</code>, or <code>text</code>. Edit and re-render.
            </p>
            <textarea
              aria-label="Page tree JSON"
              value={treeText}
              onChange={(e) => setTreeText(e.target.value)}
              spellCheck={false}
              rows={18}
              className={`${field} font-mono text-[13px] leading-6`}
            />
            <button
              type="button"
              onClick={() => void rerender()}
              disabled={busy !== null || !treeDirty}
              className={outline}
            >
              {busy === "render" ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <RefreshCw className="size-4" aria-hidden />
              )}
              Re-render
            </button>
          </div>
          <div
            id="screen-panel-install"
            role="tabpanel"
            aria-labelledby="screen-tab-install"
            hidden={tab !== "install"}
            className="space-y-3"
          >
            <p className={`text-sm ${muted}`}>
              Add each component with the CLI (premium ones need <code>KITBASE_TOKEN</code>),
              install the dependencies, then save Page.tsx.
            </p>
            <CodeBlock code={result.installCommand} label="terminal" />
            <CodeBlock code={`npm install ${result.dependencies.join(" ")}`} label="terminal" />
          </div>
        </section>
      ) : null}
    </div>
  );
}
