import { memo, useMemo, useState } from "react";
import * as ReactCodeMirrorModule from "@uiw/react-codemirror";
import { EditorView } from "@codemirror/view";

// Some ESM/CJS interop layers (e.g. sandboxed previews) wrap the default export once more.
type CodeMirrorComponent = typeof ReactCodeMirrorModule.default;
const cmDefault = ReactCodeMirrorModule.default as unknown as
  CodeMirrorComponent | { default: CodeMirrorComponent };
const CodeMirror: CodeMirrorComponent =
  "default" in cmDefault && cmDefault.default
    ? cmDefault.default
    : (cmDefault as CodeMirrorComponent);
import { json } from "@codemirror/lang-json";
import { Check, Copy } from "lucide-react";
import { cn } from "@/lib/utils";

/** Pretty-prints JSON bodies; anything else is shown verbatim. */
export function prettyBody(raw: string | undefined): { text: string; isJson: boolean } {
  if (!raw) return { text: "", isJson: false };
  try {
    return { text: JSON.stringify(JSON.parse(raw), null, 2), isJson: true };
  } catch {
    return { text: raw, isJson: false };
  }
}

const baseTheme = EditorView.theme(
  {
    "&": { backgroundColor: "transparent", fontSize: "12px" },
    ".cm-gutters": { backgroundColor: "transparent", border: "none" },
    ".cm-content": { fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" },
  },
  { dark: true },
);

/** Read-only CodeMirror 6 viewer with JSON highlighting, folding, search (Mod-F) and copy. */
export const CodeView = memo(function CodeView({
  value,
  label,
  maxHeight = 280,
  className,
}: {
  value: string | undefined;
  label: string;
  maxHeight?: number;
  className?: string;
}) {
  const { text, isJson } = useMemo(() => prettyBody(value), [value]);
  const extensions = useMemo(
    () => [baseTheme, EditorView.lineWrapping, ...(isJson ? [json()] : [])],
    [isJson],
  );
  const [copied, setCopied] = useState(false);
  const copy = () => {
    void navigator.clipboard?.writeText(value ?? "").then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    });
  };
  if (!text)
    return (
      <p
        className={cn(
          "rounded-crm border border-crm-border p-3 text-xs text-crm-muted-fg",
          className,
        )}
      >
        Empty body
      </p>
    );
  return (
    <div className={cn("relative rounded-crm border border-crm-border bg-crm-bg", className)}>
      <button
        type="button"
        onClick={copy}
        aria-label={`Copy ${label}`}
        className="absolute right-1.5 top-1.5 z-10 rounded-md border border-crm-border bg-crm-card p-1 text-crm-muted-fg hover:text-crm-fg"
      >
        {copied ? <Check className="size-3.5 text-crm-success" /> : <Copy className="size-3.5" />}
      </button>
      <CodeMirror
        value={text}
        readOnly
        editable={false}
        theme="dark"
        aria-label={label}
        maxHeight={`${maxHeight}px`}
        basicSetup={{ lineNumbers: true, foldGutter: true, highlightActiveLine: false }}
        extensions={extensions}
      />
    </div>
  );
});

export function HeaderTable({
  headers,
  label,
}: {
  headers?: Record<string, string>;
  label: string;
}) {
  const entries = headers ? Object.entries(headers) : [];
  if (!entries.length) return <p className="text-xs text-crm-muted-fg">No headers recorded.</p>;
  return (
    <table aria-label={label} className="w-full table-fixed text-left text-[11px]">
      <tbody>
        {entries.map(([k, v]) => (
          <tr key={k} className="border-b border-crm-border last:border-b-0 align-top">
            <th
              scope="row"
              className="w-2/5 truncate py-1 pr-2 font-mono font-normal text-crm-muted-fg"
            >
              {k}
            </th>
            <td className="break-all py-1 font-mono text-crm-soft">{v}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
