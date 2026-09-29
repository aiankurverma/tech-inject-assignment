import * as React from "react";
import { Mention } from "@tiptap/extension-mention";
import {
  mergeAttributes,
  nodeInputRule,
  nodePasteRule,
  NodeViewWrapper,
  ReactNodeViewRenderer,
  type NodeViewProps,
} from "@tiptap/react";
import {
  autoUpdate,
  flip,
  FloatingFocusManager,
  FloatingPortal,
  offset,
  shift,
  useDismiss,
  useFloating,
  useInteractions,
} from "@floating-ui/react";
import { AlertTriangle, Braces, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { MERGE_NODE, resolveField, token } from "@/components/crm/pro-email-composer/merge";
import type { MergeFieldDef, MergeRecord } from "@/components/crm/pro-email-composer/types";

/** Live info the chips read: known fields and the record currently being previewed. */
export interface MergeContextValue {
  fields: Map<string, MergeFieldDef>;
  record: MergeRecord | undefined;
  recordLabel: string | undefined;
  disabled: boolean;
}

export const MergeContext = React.createContext<MergeContextValue>({
  fields: new Map(),
  record: undefined,
  recordLabel: undefined,
  disabled: false,
});

const EDIT_META = "mergeFieldEdit";
const TOKEN_FIND = /\{\{\s*([a-zA-Z0-9_.]+)\s*(?:\|\s*([^}]*?)\s*)?\}\}$/;
const TOKEN_PASTE = /\{\{\s*([a-zA-Z0-9_.]+)\s*(?:\|\s*([^}]*?)\s*)?\}\}/g;

function MergeChip({
  node,
  editor,
  getPos,
  selected,
  deleteNode,
  updateAttributes,
}: NodeViewProps) {
  const ctx = React.useContext(MergeContext);
  const key = String(node.attrs.id ?? "");
  const fallback = (node.attrs.fallback as string | null) ?? "";
  const def = ctx.fields.get(key);
  const label = def?.label ?? (node.attrs.label as string) ?? key;
  const resolved = resolveField(ctx.record, key, fallback);
  const unknown = !def;
  const [open, setOpen] = React.useState(false);
  const [draft, setDraft] = React.useState(fallback);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const { refs, floatingStyles, context } = useFloating({
    open,
    onOpenChange: (o) => {
      setOpen(o);
      if (!o) editor.commands.focus();
    },
    placement: "bottom-start",
    middleware: [offset(6), flip({ padding: 8 }), shift({ padding: 8 })],
    whileElementsMounted: autoUpdate,
  });
  const dismiss = useDismiss(context);
  const { getReferenceProps, getFloatingProps } = useInteractions([dismiss]);

  // Enter on a selected chip (keyboard users) opens the fallback editor.
  React.useEffect(() => {
    const onTx = ({ transaction }: { transaction: { getMeta: (k: string) => unknown } }) => {
      const pos = transaction.getMeta(EDIT_META);
      if (typeof pos === "number" && pos === getPos()) setOpen(true);
    };
    editor.on("transaction", onTx);
    return () => {
      editor.off("transaction", onTx);
    };
  }, [editor, getPos]);

  React.useEffect(() => {
    if (open) setDraft(fallback);
  }, [open, fallback]);

  const save = () => {
    updateAttributes({ fallback: draft.trim() || null });
    setOpen(false);
    editor.commands.focus();
  };

  const tone =
    unknown || resolved.source === "missing"
      ? "border-tag-amber-border bg-tag-amber-bg text-tag-amber-text"
      : "border-tag-purple-border bg-tag-purple-bg text-tag-purple-text";

  return (
    <NodeViewWrapper as="span" className="inline">
      <span
        ref={refs.setReference}
        {...getReferenceProps({
          onClick: () => !ctx.disabled && setOpen(true),
        })}
        contentEditable={false}
        role="button"
        aria-haspopup="dialog"
        aria-label={`Merge field ${label}${fallback ? `, fallback ${fallback}` : ", no fallback"}`}
        title={
          unknown
            ? `Unknown field "${key}"`
            : `${token(key, fallback)} → ${resolved.text || "(empty)"}${ctx.recordLabel ? ` for ${ctx.recordLabel}` : ""}`
        }
        className={cn(
          "mx-0.5 inline-flex max-w-[16rem] cursor-pointer items-center gap-1 rounded-[5px] border px-1.5 align-baseline text-[0.85em] leading-5 font-medium select-none",
          tone,
          selected && "ring-2 ring-crm-primary",
        )}
      >
        {unknown || resolved.source === "missing" ? (
          <AlertTriangle className="size-3 shrink-0" aria-hidden />
        ) : (
          <Braces className="size-3 shrink-0" aria-hidden />
        )}
        <span className="truncate">{label}</span>
        {fallback && <span className="truncate opacity-60">| {fallback}</span>}
      </span>
      {open && (
        <FloatingPortal>
          <FloatingFocusManager context={context} initialFocus={inputRef}>
            <div
              ref={refs.setFloating}
              style={floatingStyles}
              {...getFloatingProps()}
              role="dialog"
              aria-label={`Edit merge field ${label}`}
              className="z-50 w-72 rounded-crm border border-crm-border bg-crm-popover p-3 font-crm text-crm-fg shadow-crm-overlay"
            >
              <div className="mb-2 flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{label}</p>
                  <code className="text-xs text-crm-subtle">{key}</code>
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded p-0.5 text-crm-muted-fg hover:text-crm-fg focus-visible:ring-2 focus-visible:ring-crm-ring focus-visible:outline-none"
                  aria-label="Close"
                >
                  <X className="size-4" />
                </button>
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  save();
                }}
              >
                <label className="mb-1 block text-xs text-crm-muted-fg" htmlFor={`fb-${key}`}>
                  Fallback when empty
                </label>
                <input
                  ref={inputRef}
                  id={`fb-${key}`}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder={def?.fallback ?? "e.g. there"}
                  className="h-8 w-full rounded-[6px] border border-crm-input bg-crm-bg px-2 text-sm text-crm-fg outline-none placeholder:text-crm-faint focus:border-crm-ring"
                />
                {ctx.recordLabel && (
                  <p className="mt-2 text-xs text-crm-muted-fg">
                    {ctx.recordLabel}:{" "}
                    <span
                      className={cn(
                        resolved.source === "value" ? "text-crm-fg" : "text-crm-warning",
                      )}
                    >
                      {resolveField(ctx.record, key, draft).text || "empty, no fallback"}
                    </span>
                  </p>
                )}
                <div className="mt-3 flex justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => deleteNode()}
                    className="h-8 rounded-[6px] px-2 text-sm text-crm-danger hover:bg-tag-red-bg focus-visible:ring-2 focus-visible:ring-crm-ring focus-visible:outline-none"
                  >
                    Remove
                  </button>
                  <button
                    type="submit"
                    className="h-8 rounded-[6px] bg-crm-primary px-3 text-sm font-medium text-crm-primary-fg shadow-crm-primary focus-visible:ring-2 focus-visible:ring-crm-ring focus-visible:outline-none"
                  >
                    Save
                  </button>
                </div>
              </form>
            </div>
          </FloatingFocusManager>
        </FloatingPortal>
      )}
    </NodeViewWrapper>
  );
}

export interface MergeFieldOptionsExtra {
  fields: MergeFieldDef[];
}

/**
 * Merge field node built on @tiptap/extension-mention: atom chip with `id` (field key),
 * `label` and `fallback`. Typing or pasting `{{key|fallback}}` converts to a chip.
 */
export const MergeField = Mention.extend<
  ReturnType<NonNullable<typeof Mention.config.addOptions>> & MergeFieldOptionsExtra
>({
  name: MERGE_NODE,

  addOptions() {
    return { ...this.parent!(), fields: [] };
  },

  addAttributes() {
    return {
      ...this.parent?.(),
      fallback: {
        default: null,
        parseHTML: (el: HTMLElement) => el.getAttribute("data-fallback"),
        renderHTML: (attrs: Record<string, unknown>) =>
          attrs.fallback ? { "data-fallback": attrs.fallback } : {},
      },
    };
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      "span",
      mergeAttributes({ "data-type": MERGE_NODE }, HTMLAttributes),
      token(String(node.attrs.id), node.attrs.fallback as string | null),
    ];
  },

  renderText({ node }) {
    return token(String(node.attrs.id), node.attrs.fallback as string | null);
  },

  addNodeView() {
    return ReactNodeViewRenderer(MergeChip, { as: "span" });
  },

  addKeyboardShortcuts() {
    return {
      ...this.parent?.(),
      Enter: ({ editor }) => {
        const sel = editor.state.selection as unknown as {
          node?: { type: { name: string } };
          from: number;
        };
        if (sel.node?.type.name !== MERGE_NODE) return false;
        editor.view.dispatch(editor.state.tr.setMeta(EDIT_META, sel.from));
        return true;
      },
    };
  },

  addInputRules() {
    const labelOf = (k: string) => this.options.fields.find((f) => f.key === k)?.label ?? k;
    return [
      nodeInputRule({
        find: TOKEN_FIND,
        type: this.type,
        getAttributes: (m) => ({ id: m[1], label: labelOf(m[1]!), fallback: m[2] || null }),
      }),
    ];
  },

  addPasteRules() {
    const labelOf = (k: string) => this.options.fields.find((f) => f.key === k)?.label ?? k;
    return [
      nodePasteRule({
        find: TOKEN_PASTE,
        type: this.type,
        getAttributes: (m) => ({ id: m[1], label: labelOf(m[1]!), fallback: m[2] || null }),
      }),
    ];
  },
});
