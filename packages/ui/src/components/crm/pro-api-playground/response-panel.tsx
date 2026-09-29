import * as React from "react";
import * as Tabs from "@radix-ui/react-tabs";
import * as CodeMirrorNs from "@uiw/react-codemirror";
import { EditorView } from "@uiw/react-codemirror";
import { json } from "@codemirror/lang-json";
import { javascript } from "@codemirror/lang-javascript";
import { AlertTriangle, Check, Copy, Loader2, Send } from "lucide-react";
import { crmEditorTheme } from "@/components/crm/pro-api-playground/json-editor";
import { formatBytes, type ExecutedResponse } from "@/components/crm/pro-api-playground/request";
import {
  buildSnippet,
  type BuiltRequest,
  type SnippetLanguage,
} from "@/components/crm/pro-api-playground/snippets";
import { cn } from "@/lib/utils";

/** Unwraps a default export across ESM, CJS and namespace-wrapping interop layers. */
function interopDefault<T>(m: unknown): T {
  let x = m as { default?: unknown } | null;
  for (let i = 0; i < 3 && x && typeof x === "object" && !("$$typeof" in x) && "default" in x; i++)
    x = x.default as { default?: unknown } | null;
  return x as T;
}
const CodeMirror = interopDefault<typeof CodeMirrorNs.default>(CodeMirrorNs);

const tabCls =
  "rounded-crm px-2.5 py-1 text-xs text-crm-muted-fg outline-none hover:text-crm-fg focus-visible:ring-1 focus-visible:ring-crm-ring data-[state=active]:bg-crm-muted data-[state=active]:text-crm-fg";

/** Bodies above this size skip pretty-printing/highlighting to keep the UI responsive. */
const PRETTY_LIMIT = 2_000_000;

function CopyButton({ text, label }: { text: string; label: string }) {
  const [done, setDone] = React.useState(false);
  return (
    <button
      type="button"
      aria-label={label}
      onClick={() => {
        void navigator.clipboard?.writeText(text).then(() => {
          setDone(true);
          setTimeout(() => setDone(false), 1200);
        });
      }}
      className="rounded-crm p-1.5 text-crm-muted-fg hover:bg-crm-muted hover:text-crm-fg focus-visible:outline focus-visible:outline-crm-ring"
    >
      {done ? (
        <Check className="size-3.5 text-crm-success" aria-hidden />
      ) : (
        <Copy className="size-3.5" aria-hidden />
      )}
    </button>
  );
}

function ReadOnlyCode({
  value,
  lang,
  label,
}: {
  value: string;
  lang: "json" | "js" | "text";
  label: string;
}) {
  const extensions = React.useMemo(
    () => [
      ...(lang === "json" ? [json()] : lang === "js" ? [javascript()] : []),
      crmEditorTheme,
      EditorView.lineWrapping,
      EditorView.contentAttributes.of({ "aria-label": label }),
    ],
    [lang, label],
  );
  return (
    <CodeMirror
      value={value}
      readOnly
      editable={false}
      extensions={extensions}
      theme="none"
      basicSetup={{ highlightActiveLine: false, foldGutter: lang === "json" }}
      height="100%"
    />
  );
}

const statusTone = (s: number) =>
  s >= 500
    ? "text-crm-danger"
    : s >= 400
      ? "text-crm-warning"
      : s >= 300
        ? "text-sky-400"
        : "text-crm-success";

export interface ResponsePanelProps {
  response: ExecutedResponse | null;
  error: string | null;
  pending: boolean;
  /** Request with secrets redacted, used for snippets. */
  snippetRequest: BuiltRequest;
  snippetLanguage: SnippetLanguage;
  onSnippetLanguageChange: (l: SnippetLanguage) => void;
}

export function ResponsePanel({
  response,
  error,
  pending,
  snippetRequest,
  snippetLanguage,
  onSnippetLanguageChange,
}: ResponsePanelProps) {
  const pretty = React.useMemo(() => {
    if (!response) return "";
    if (response.body.length > PRETTY_LIMIT) return response.body;
    try {
      return JSON.stringify(JSON.parse(response.body), null, 2);
    } catch {
      return response.body;
    }
  }, [response]);
  const isJson =
    !!response && pretty !== response.body ? true : !!response?.contentType.includes("json");
  const snippet = React.useMemo(
    () => buildSnippet(snippetLanguage, snippetRequest),
    [snippetLanguage, snippetRequest],
  );

  return (
    <Tabs.Root defaultValue="pretty" className="flex h-full min-h-0 flex-col">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-crm-border px-3 py-1.5">
        <Tabs.List aria-label="Response views" className="flex gap-1">
          <Tabs.Trigger value="pretty" className={tabCls}>
            Pretty
          </Tabs.Trigger>
          <Tabs.Trigger value="raw" className={tabCls}>
            Raw
          </Tabs.Trigger>
          <Tabs.Trigger value="headers" className={tabCls}>
            Headers{" "}
            {response && <span className="text-crm-muted-fg">({response.headers.length})</span>}
          </Tabs.Trigger>
          <Tabs.Trigger value="code" className={tabCls}>
            Code
          </Tabs.Trigger>
        </Tabs.List>
        <div className="ml-auto flex items-center gap-3 text-xs" aria-live="polite">
          {pending && (
            <span className="flex items-center gap-1 text-crm-muted-fg">
              <Loader2 className="size-3.5 animate-spin" aria-hidden /> Sending…
            </span>
          )}
          {!pending && response && (
            <>
              <span className={cn("font-mono font-semibold", statusTone(response.status))}>
                {response.status} {response.statusText}
              </span>
              <span
                className="text-crm-muted-fg"
                title={`Headers after ${response.headersMs.toFixed(0)} ms`}
              >
                {response.durationMs.toFixed(0)} ms
              </span>
              <span className="text-crm-muted-fg">{formatBytes(response.sizeBytes)}</span>
            </>
          )}
        </div>
      </div>

      <div className="relative min-h-0 flex-1 overflow-auto">
        {(["pretty", "raw", "headers"] as const).map((tab) => (
          <Tabs.Content key={tab} value={tab} className="h-full outline-none">
            {error && !pending ? (
              <div
                role="alert"
                className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center text-sm"
              >
                <AlertTriangle className="size-5 text-crm-danger" aria-hidden />
                <p className="text-crm-fg">Request failed</p>
                <p className="max-w-sm text-xs text-crm-muted-fg">
                  {error}. Check the server URL, CORS policy and network connection.
                </p>
              </div>
            ) : !response ? (
              <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center text-sm text-crm-muted-fg">
                {pending ? (
                  <Loader2 className="size-5 animate-spin" aria-hidden />
                ) : (
                  <Send className="size-5" aria-hidden />
                )}
                {pending
                  ? "Waiting for response…"
                  : "Send the request to see the response (Ctrl/⌘ + Enter)."}
              </div>
            ) : tab === "headers" ? (
              <table className="w-full text-xs">
                <caption className="sr-only">Response headers</caption>
                <tbody>
                  {response.headers.map(([k, v]) => (
                    <tr key={k} className="border-b border-crm-border">
                      <th
                        scope="row"
                        className="w-1/3 px-3 py-1.5 text-left font-mono font-normal text-crm-muted-fg"
                      >
                        {k}
                      </th>
                      <td className="break-all px-3 py-1.5 font-mono text-crm-fg">{v}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : tab === "pretty" ? (
              <ReadOnlyCode value={pretty} lang={isJson ? "json" : "text"} label="Response body" />
            ) : (
              <pre className="whitespace-pre-wrap break-all p-3 font-mono text-xs text-crm-fg">
                {response.body || "(empty body)"}
              </pre>
            )}
            {response && tab !== "headers" && (
              <div className="absolute right-2 top-2">
                <CopyButton
                  text={tab === "pretty" ? pretty : response.body}
                  label="Copy response body"
                />
              </div>
            )}
          </Tabs.Content>
        ))}
        <Tabs.Content value="code" className="flex h-full flex-col outline-none">
          <div className="flex items-center gap-1 border-b border-crm-border px-3 py-1.5">
            {(["curl", "javascript", "python"] as const).map((l) => (
              <button
                key={l}
                type="button"
                aria-pressed={snippetLanguage === l}
                onClick={() => onSnippetLanguageChange(l)}
                className={cn(tabCls, snippetLanguage === l && "bg-crm-muted text-crm-fg")}
              >
                {l === "curl" ? "cURL" : l === "javascript" ? "JavaScript" : "Python"}
              </button>
            ))}
            <div className="ml-auto">
              <CopyButton text={snippet} label="Copy code snippet" />
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-auto">
            <ReadOnlyCode
              value={snippet}
              lang={snippetLanguage === "javascript" ? "js" : "text"}
              label="Code snippet"
            />
          </div>
        </Tabs.Content>
      </div>
    </Tabs.Root>
  );
}
