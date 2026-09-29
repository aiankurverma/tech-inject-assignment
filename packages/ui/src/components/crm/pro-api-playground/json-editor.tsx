import * as React from "react";
import * as CodeMirrorNs from "@uiw/react-codemirror";
import { EditorView } from "@uiw/react-codemirror";
import { json, jsonParseLinter } from "@codemirror/lang-json";
import { linter, lintGutter } from "@codemirror/lint";
import * as AjvNs from "ajv";
import type { ErrorObject, ValidateFunction } from "ajv";
import { AlertTriangle, CheckCircle2, Wand2 } from "lucide-react";
import { toAjvSchema, type JsonSchema } from "@/components/crm/pro-api-playground/openapi";
import { cn } from "@/lib/utils";

/** Unwraps a default export across ESM, CJS and namespace-wrapping interop layers. */
function interopDefault<T>(m: unknown): T {
  let x = m as { default?: unknown } | null;
  for (let i = 0; i < 3 && x && typeof x === "object" && !("$$typeof" in x) && "default" in x; i++)
    x = x.default as { default?: unknown } | null;
  return x as T;
}
const CodeMirror = interopDefault<typeof CodeMirrorNs.default>(CodeMirrorNs);

/** CodeMirror theme wired to the CRM tokens so the editor follows light/dark themes. */
export const crmEditorTheme = EditorView.theme({
  "&": {
    backgroundColor: "transparent",
    color: "var(--color-crm-fg)",
    fontSize: "12px",
    height: "100%",
  },
  ".cm-content": {
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
    caretColor: "var(--color-crm-fg)",
  },
  ".cm-gutters": {
    backgroundColor: "transparent",
    color: "var(--color-crm-muted-fg)",
    border: "none",
  },
  ".cm-activeLine, .cm-activeLineGutter": {
    backgroundColor: "color-mix(in oklab, var(--color-crm-muted) 50%, transparent)",
  },
  "&.cm-focused": { outline: "none" },
  ".cm-selectionBackground, &.cm-focused .cm-selectionBackground": {
    backgroundColor: "color-mix(in oklab, var(--color-crm-primary) 30%, transparent) !important",
  },
  ".cm-tooltip": {
    backgroundColor: "var(--color-crm-popover)",
    border: "1px solid var(--color-crm-border)",
  },
});

// One Ajv instance per module; compiled validators are cached per schema object.
const AjvCtor = interopDefault<typeof AjvNs.default>(AjvNs);
const ajv = new AjvCtor({ allErrors: true, strict: false, validateFormats: false });
const cache = new WeakMap<JsonSchema, ValidateFunction | null>();
function compile(schema: JsonSchema): ValidateFunction | null {
  if (cache.has(schema)) return cache.get(schema)!;
  let fn: ValidateFunction | null = null;
  try {
    fn = ajv.compile(toAjvSchema(schema));
  } catch {
    fn = null;
  }
  cache.set(schema, fn);
  return fn;
}

export type BodyValidation =
  | { state: "empty" }
  | { state: "syntax"; message: string }
  | { state: "schema"; errors: ErrorObject[] }
  | { state: "valid" }
  | { state: "unchecked" };

export function validateBody(text: string, schema: JsonSchema | undefined): BodyValidation {
  if (!text.trim()) return { state: "empty" };
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch (e) {
    return { state: "syntax", message: (e as Error).message };
  }
  const fn = schema ? compile(schema) : null;
  if (!fn) return { state: "unchecked" };
  return fn(value) ? { state: "valid" } : { state: "schema", errors: fn.errors ?? [] };
}

export interface JsonBodyEditorProps {
  value: string;
  onChange: (v: string) => void;
  schema?: JsonSchema;
  readOnly?: boolean;
  ariaLabel?: string;
  className?: string;
}

/** JSON editor (CodeMirror) with syntax linting and Ajv schema validation against the request schema. */
export function JsonBodyEditor({
  value,
  onChange,
  schema,
  readOnly,
  ariaLabel = "Request body",
  className,
}: JsonBodyEditorProps) {
  const deferred = React.useDeferredValue(value);
  const result = React.useMemo(() => validateBody(deferred, schema), [deferred, schema]);
  const extensions = React.useMemo(
    () => [
      json(),
      linter(jsonParseLinter()),
      lintGutter(),
      crmEditorTheme,
      EditorView.contentAttributes.of({ "aria-label": ariaLabel }),
    ],
    [ariaLabel],
  );
  const format = () => {
    try {
      onChange(JSON.stringify(JSON.parse(value), null, 2));
    } catch {
      // Leave invalid JSON untouched; the linter already points at the problem.
    }
  };

  return (
    <div className={cn("flex min-h-0 flex-col", className)}>
      <div className="min-h-0 flex-1 overflow-auto rounded-crm border border-crm-border bg-crm-bg">
        <CodeMirror
          value={value}
          onChange={onChange}
          extensions={extensions}
          readOnly={readOnly}
          theme="none"
          basicSetup={{ foldGutter: true, highlightActiveLine: !readOnly, autocompletion: false }}
          height="100%"
          minHeight="160px"
        />
      </div>
      <div className="mt-2 flex items-start gap-2 text-xs" aria-live="polite">
        {result.state === "valid" && (
          <span className="flex items-center gap-1 text-crm-success">
            <CheckCircle2 className="size-3.5" aria-hidden /> Body matches the schema
          </span>
        )}
        {result.state === "unchecked" && (
          <span className="text-crm-muted-fg">Valid JSON (no schema to validate against)</span>
        )}
        {result.state === "empty" && <span className="text-crm-muted-fg">Empty body</span>}
        {result.state === "syntax" && (
          <span className="flex items-center gap-1 text-crm-danger">
            <AlertTriangle className="size-3.5" aria-hidden /> {result.message}
          </span>
        )}
        {result.state === "schema" && (
          <ul className="space-y-0.5 text-crm-warning">
            {result.errors.slice(0, 5).map((e, i) => (
              <li key={i} className="flex items-center gap-1">
                <AlertTriangle className="size-3.5 shrink-0" aria-hidden />
                <code className="font-mono">{e.instancePath || "/"}</code> {e.message}
                {e.keyword === "enum" && Array.isArray(e.params.allowedValues)
                  ? `: ${e.params.allowedValues.join(", ")}`
                  : ""}
              </li>
            ))}
            {result.errors.length > 5 && <li>+{result.errors.length - 5} more</li>}
          </ul>
        )}
        {!readOnly && (
          <button
            type="button"
            onClick={format}
            className="ml-auto flex shrink-0 items-center gap-1 rounded-crm px-2 py-1 text-crm-muted-fg hover:bg-crm-muted hover:text-crm-fg focus-visible:outline focus-visible:outline-crm-ring"
          >
            <Wand2 className="size-3.5" aria-hidden /> Format
          </button>
        )}
      </div>
    </div>
  );
}
