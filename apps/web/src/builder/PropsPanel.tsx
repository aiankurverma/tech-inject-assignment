import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { ExternalLink } from "lucide-react";
import { inputClass, Skeleton } from "../components/ui";
import { useCatalogCache } from "./catalog";
import { coerce, fieldsFromProps, LAYOUT_FIELDS, type Field } from "./propsSchema";
import { useBuilder } from "./store";
import { findNode } from "./tree";
import type { PageNode } from "./types";

const labelClass = "mb-1 block text-xs font-medium text-foreground";
const smallInput = `${inputClass} h-8 text-xs`;

function FieldInput({
  field,
  value,
  onChange,
}: {
  field: Field;
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  const id = `prop-${field.name}`;
  const placeholder = field.default !== undefined ? `Default: ${String(field.default)}` : undefined;
  let control: ReactNode;
  if (field.kind === "boolean" || field.kind === "select") {
    const options = field.kind === "boolean" ? ["true", "false"] : (field.options ?? []);
    control = (
      <select
        id={id}
        value={value === undefined ? "" : String(value)}
        onChange={(e) =>
          onChange(e.target.value === "" ? undefined : coerce(field, e.target.value))
        }
        className={smallInput}
      >
        <option value="">
          {field.default !== undefined ? `Default (${String(field.default)})` : "Not set"}
        </option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    );
  } else if (field.kind === "list") {
    control = (
      <textarea
        id={id}
        rows={3}
        value={Array.isArray(value) ? value.join("\n") : ""}
        onChange={(e) =>
          onChange(e.target.value.trim() === "" ? undefined : coerce(field, e.target.value))
        }
        placeholder="One item per line"
        className={`${inputClass} h-auto py-1.5 text-xs`}
      />
    );
  } else {
    control = (
      <input
        id={id}
        type={field.kind === "number" ? "number" : "text"}
        value={value === undefined ? "" : String(value)}
        onChange={(e) => onChange(coerce(field, e.target.value))}
        placeholder={placeholder}
        className={smallInput}
      />
    );
  }
  return (
    <div>
      <label htmlFor={id} className={labelClass}>
        <span className="font-mono">{field.name}</span>
        {field.required ? <span className="ml-1 text-red-600 dark:text-red-400">*</span> : null}
      </label>
      {control}
      {field.description ? (
        <p className="mt-1 text-[11px] leading-4 text-muted-foreground">{field.description}</p>
      ) : null}
    </div>
  );
}

/** Raw JSON editor for everything the form cannot express (arrays of objects, dates...). */
function JsonEditor({ node }: { node: PageNode }) {
  const replaceProps = useBuilder((s) => s.replaceProps);
  const current = JSON.stringify(node.props, null, 2);
  const [text, setText] = useState(current);
  const [error, setError] = useState<string | null>(null);
  // Follow outside changes (form fields, undo) unless the editor has unapplied edits.
  useEffect(() => {
    setText(current);
    setError(null);
  }, [current]);
  const dirty = text !== current;

  const apply = () => {
    try {
      const parsed: unknown = JSON.parse(text);
      if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed))
        throw new Error("Props must be a JSON object");
      replaceProps(node.id, parsed as Record<string, unknown>);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Invalid JSON");
    }
  };

  return (
    <div>
      <textarea
        aria-label="Props as JSON"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if ((e.ctrlKey || e.metaKey) && e.key === "Enter") apply();
        }}
        rows={Math.min(16, Math.max(4, text.split("\n").length))}
        spellCheck={false}
        className={`${inputClass} h-auto py-1.5 font-mono text-xs`}
      />
      <div className="mt-2 flex items-center gap-2">
        <button
          type="button"
          onClick={apply}
          disabled={!dirty}
          className="inline-flex h-7 items-center rounded-md bg-primary px-2.5 text-xs font-medium text-primary-foreground disabled:opacity-50"
        >
          Apply
        </button>
        {dirty ? (
          <button
            type="button"
            onClick={() => setText(current)}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Discard
          </button>
        ) : (
          <span className="text-[11px] text-muted-foreground">Ctrl+Enter applies</span>
        )}
      </div>
      {error ? <p className="mt-2 text-xs text-red-700 dark:text-red-300">{error}</p> : null}
    </div>
  );
}

function Fields({ node, fields }: { node: PageNode; fields: Field[] }) {
  const setProp = useBuilder((s) => s.setProp);
  if (!fields.length) return null;
  return (
    <div className="space-y-4">
      {fields.map((f) => (
        <FieldInput
          key={f.name}
          field={f}
          value={node.props[f.name]}
          onChange={(v) => setProp(node.id, f.name, v)}
        />
      ))}
    </div>
  );
}

function ComponentProps({ node }: { node: PageNode }) {
  const slug = node.slug ?? "";
  const entry = useCatalogCache((s) => s.details[slug]);
  const ensureDetail = useCatalogCache((s) => s.ensureDetail);
  useEffect(() => ensureDetail(slug), [slug, ensureDetail]);

  if (!entry || entry.status === "loading")
    return (
      <div className="space-y-3" role="status" aria-label="Loading props">
        <Skeleton className="h-8" />
        <Skeleton className="h-8" />
      </div>
    );
  if (entry.status === "error")
    return <p className="text-xs text-red-700 dark:text-red-300">{entry.message}</p>;
  const d = entry.value;
  const fields = fieldsFromProps(d.props);
  const skipped = (d.props?.length ?? 0) - fields.length;
  return (
    <>
      <div className="mb-4 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{d.name}</p>
          <p className="text-xs text-muted-foreground">{d.category}</p>
        </div>
        <Link
          to={`/components/${d.slug}`}
          target="_blank"
          className="inline-flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label="Open docs in a new tab"
          title="Open docs"
        >
          <ExternalLink className="size-3.5" aria-hidden />
        </Link>
      </div>
      {d.locked ? (
        <p className="mb-4 text-xs text-muted-foreground">
          Locked: {d.locked === "premium_required" ? "premium plan required" : "sign in required"}.
        </p>
      ) : null}
      <Fields node={node} fields={fields} />
      <details className="mt-5 group" open={!fields.length}>
        <summary className="cursor-pointer text-xs font-medium text-muted-foreground hover:text-foreground">
          JSON{" "}
          {skipped > 0 ? (
            <span className="font-normal">
              ({skipped} prop{skipped === 1 ? "" : "s"} only editable here)
            </span>
          ) : null}
        </summary>
        <div className="mt-2">
          <JsonEditor node={node} />
        </div>
      </details>
    </>
  );
}

/** Right rail: form for the selected node's props, generated from registry metadata. */
export function PropsPanel() {
  const tree = useBuilder((s) => s.tree);
  const selectedId = useBuilder((s) => s.selectedId);
  const node = findNode(tree, selectedId) ?? tree;

  return (
    <div className="scroll-thin h-full overflow-y-auto p-3">
      {node.type === "page" ? (
        <div className="text-xs leading-5 text-muted-foreground">
          <p className="mb-1 text-sm font-semibold text-foreground">Page</p>
          <p>
            Select a node on the canvas to edit its props. Drag components from the palette or click
            one to add it to the selected container.
          </p>
          <p className="mt-3">
            Shortcuts: <kbd>Del</kbd> delete, <kbd>Ctrl+D</kbd> duplicate, <kbd>Alt+Arrows</kbd>{" "}
            move, <kbd>Ctrl+Z</kbd>/<kbd>Ctrl+Y</kbd> undo/redo. Focus a drag handle and press{" "}
            <kbd>Space</kbd> to sort with the arrow keys.
          </p>
        </div>
      ) : node.type === "component" ? (
        <ComponentProps key={node.id} node={node} />
      ) : (
        <>
          <p className="mb-4 text-sm font-semibold capitalize">{node.type}</p>
          <Fields node={node} fields={LAYOUT_FIELDS[node.type]} />
        </>
      )}
    </div>
  );
}
