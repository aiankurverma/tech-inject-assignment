import * as React from "react";
import { produce, type Draft } from "immer";
import { createStore, useStore, type StoreApi } from "zustand";
import {
  hasOptions,
  uid,
  type FieldType,
  type FormField,
  type FormPage,
  type FormSchema,
} from "@/components/crm/pro-form-renderer/schema";

/* ------------------------------------------------------------------------------------------------
 * Builder state: one zustand store per builder instance, every mutation is an immer recipe so the
 * schema keeps structural sharing (cheap memo checks) and undo/redo is just a stack of snapshots.
 * ---------------------------------------------------------------------------------------------- */

export interface FieldTemplate {
  type: FieldType;
  label: string;
  description: string;
}

export const FIELD_TEMPLATES: FieldTemplate[] = [
  { type: "text", label: "Short text", description: "Single line answer" },
  { type: "textarea", label: "Long text", description: "Paragraph answer" },
  { type: "email", label: "Email", description: "Validated email address" },
  { type: "phone", label: "Phone", description: "Phone number" },
  { type: "url", label: "Website", description: "Validated URL" },
  { type: "number", label: "Number", description: "Numeric with min / max" },
  { type: "select", label: "Dropdown", description: "Pick one from a list" },
  { type: "radio", label: "Single choice", description: "Radio buttons" },
  { type: "checkbox", label: "Checkboxes", description: "Pick many" },
  { type: "multiselect", label: "Multi-select", description: "Pick many (compact)" },
  { type: "date", label: "Date", description: "Calendar date" },
  { type: "rating", label: "Rating", description: "1 to 5 stars" },
  { type: "file", label: "File upload", description: "Drag and drop files" },
  { type: "consent", label: "Consent", description: "Required checkbox" },
  { type: "heading", label: "Section heading", description: "Title between fields" },
];

const LABELS: Record<FieldType, string> = Object.fromEntries(
  FIELD_TEMPLATES.map((t) => [t.type, t.label]),
) as Record<FieldType, string>;

export const labelForType = (t: FieldType) => LABELS[t] ?? t;

export function createField(type: FieldType, taken: Set<string>): FormField {
  const base = type === "heading" ? "section" : type;
  let name = base;
  for (let i = 2; taken.has(name); i++) name = `${base}_${i}`;
  const field: FormField = {
    id: uid("fld"),
    type,
    name,
    label: type === "consent" ? "I agree to be contacted about my request" : LABELS[type],
    width: "full",
  };
  if (hasOptions(type))
    field.options = [
      { label: "Option A", value: "option_a" },
      { label: "Option B", value: "option_b" },
      { label: "Option C", value: "option_c" },
    ];
  if (type === "rating") field.validation = { max: 5 };
  if (type === "file")
    field.file = { accept: ["application/pdf", "image/*"], maxSizeMb: 10, maxFiles: 3 };
  if (type === "consent") field.required = true;
  return field;
}

export function emptySchema(title = "Untitled form"): FormSchema {
  return {
    id: uid("form"),
    version: 1,
    title,
    pages: [{ id: uid("pg"), title: "Page 1", fields: [] }],
    settings: { submitLabel: "Submit", showProgress: true },
  };
}

export type Selection = { kind: "field"; id: string } | { kind: "page"; id: string } | null;

export interface BuilderState {
  schema: FormSchema;
  pageId: string;
  selection: Selection;
  past: FormSchema[];
  future: FormSchema[];
  /** Apply an immer recipe to the schema and push the previous version on the undo stack. */
  edit: (recipe: (draft: Draft<FormSchema>) => void, opts?: { coalesce?: string }) => void;
  replace: (schema: FormSchema) => void;
  undo: () => void;
  redo: () => void;
  setPage: (id: string) => void;
  select: (s: Selection) => void;
  addField: (type: FieldType, index?: number) => void;
  duplicateField: (id: string) => void;
  removeField: (id: string) => void;
  moveField: (id: string, toIndex: number, toPageId?: string) => void;
  updateField: (id: string, patch: Partial<FormField>) => void;
  addPage: () => void;
  removePage: (id: string) => void;
  movePage: (id: string, toIndex: number) => void;
  updatePage: (id: string, patch: Partial<FormPage>) => void;
}

const HISTORY_LIMIT = 100;

export function findField(schema: FormSchema, id: string) {
  for (const page of schema.pages) {
    const index = page.fields.findIndex((f) => f.id === id);
    if (index >= 0) return { page, index, field: page.fields[index]! };
  }
  return null;
}

const takenNames = (s: FormSchema) => new Set(s.pages.flatMap((p) => p.fields.map((f) => f.name)));

export function createBuilderStore(initial: FormSchema): StoreApi<BuilderState> {
  let lastCoalesce: string | undefined;
  let lastCoalesceAt = 0;

  return createStore<BuilderState>()((set, get) => {
    const edit: BuilderState["edit"] = (recipe, opts) => {
      const prev = get().schema;
      const next = produce(prev, recipe);
      if (next === prev) return;
      const now = Date.now();
      // Typing into one input produces one undo step, not one per keystroke.
      const merge = opts?.coalesce && opts.coalesce === lastCoalesce && now - lastCoalesceAt < 800;
      lastCoalesce = opts?.coalesce;
      lastCoalesceAt = now;
      set((s) => ({
        schema: next,
        past: merge ? s.past : [...s.past, prev].slice(-HISTORY_LIMIT),
        future: [],
      }));
    };

    return {
      schema: initial,
      pageId: initial.pages[0]?.id ?? "",
      selection: null,
      past: [],
      future: [],
      edit,
      replace: (schema) =>
        set((s) => ({
          schema,
          past: [...s.past, s.schema].slice(-HISTORY_LIMIT),
          future: [],
          pageId: schema.pages[0]?.id ?? "",
          selection: null,
        })),
      undo: () =>
        set((s) => {
          const prev = s.past[s.past.length - 1];
          if (!prev) return s;
          lastCoalesce = undefined;
          return {
            schema: prev,
            past: s.past.slice(0, -1),
            future: [s.schema, ...s.future],
            pageId: prev.pages.some((p) => p.id === s.pageId)
              ? s.pageId
              : (prev.pages[0]?.id ?? ""),
          };
        }),
      redo: () =>
        set((s) => {
          const next = s.future[0];
          if (!next) return s;
          lastCoalesce = undefined;
          return {
            schema: next,
            past: [...s.past, s.schema],
            future: s.future.slice(1),
            pageId: next.pages.some((p) => p.id === s.pageId)
              ? s.pageId
              : (next.pages[0]?.id ?? ""),
          };
        }),
      setPage: (id) => set({ pageId: id }),
      select: (selection) => set({ selection }),
      addField: (type, index) => {
        const field = createField(type, takenNames(get().schema));
        const pageId = get().pageId;
        edit((d) => {
          const page = d.pages.find((p) => p.id === pageId) ?? d.pages[0];
          if (!page) return;
          const at =
            index === undefined
              ? page.fields.length
              : Math.max(0, Math.min(index, page.fields.length));
          page.fields.splice(at, 0, field);
        });
        set({ selection: { kind: "field", id: field.id } });
      },
      duplicateField: (id) => {
        const hit = findField(get().schema, id);
        if (!hit) return;
        const copy = createField(hit.field.type, takenNames(get().schema));
        edit((d) => {
          const page = d.pages.find((p) => p.id === hit.page.id)!;
          page.fields.splice(hit.index + 1, 0, {
            ...structuredClone(hit.field),
            id: copy.id,
            name: copy.name,
            label: `${hit.field.label} (copy)`,
          });
        });
        set({ selection: { kind: "field", id: copy.id } });
      },
      removeField: (id) => {
        const hit = findField(get().schema, id);
        if (!hit) return;
        edit((d) => {
          const page = d.pages.find((p) => p.id === hit.page.id)!;
          page.fields.splice(hit.index, 1);
        });
        const sel = get().selection;
        if (sel?.kind === "field" && sel.id === id) {
          const neighbour = hit.page.fields[hit.index + 1] ?? hit.page.fields[hit.index - 1];
          set({ selection: neighbour ? { kind: "field", id: neighbour.id } : null });
        }
      },
      moveField: (id, toIndex, toPageId) =>
        edit((d) => {
          const fromPage = d.pages.find((p) => p.fields.some((f) => f.id === id));
          if (!fromPage) return;
          const from = fromPage.fields.findIndex((f) => f.id === id);
          const target = toPageId ? d.pages.find((p) => p.id === toPageId) : fromPage;
          if (!target) return;
          const [field] = fromPage.fields.splice(from, 1);
          let at = Math.max(0, Math.min(toIndex, target.fields.length));
          if (target === fromPage && from < toIndex) at = Math.max(0, at - 1);
          target.fields.splice(at, 0, field!);
        }),
      updateField: (id, patch) =>
        edit(
          (d) => {
            for (const p of d.pages) {
              const f = p.fields.find((x) => x.id === id);
              if (f) Object.assign(f, patch);
            }
          },
          { coalesce: `field:${id}:${Object.keys(patch).join(",")}` },
        ),
      addPage: () => {
        const page: FormPage = {
          id: uid("pg"),
          title: `Page ${get().schema.pages.length + 1}`,
          fields: [],
        };
        edit((d) => {
          d.pages.push(page);
        });
        set({ pageId: page.id, selection: { kind: "page", id: page.id } });
      },
      removePage: (id) => {
        const { schema } = get();
        if (schema.pages.length <= 1) return;
        const index = schema.pages.findIndex((p) => p.id === id);
        edit((d) => {
          d.pages.splice(index, 1);
        });
        const next = get().schema.pages[Math.max(0, index - 1)];
        set({ pageId: next?.id ?? "", selection: null });
      },
      movePage: (id, toIndex) =>
        edit((d) => {
          const from = d.pages.findIndex((p) => p.id === id);
          if (from < 0) return;
          const [page] = d.pages.splice(from, 1);
          d.pages.splice(Math.max(0, Math.min(toIndex, d.pages.length)), 0, page!);
        }),
      updatePage: (id, patch) =>
        edit(
          (d) => {
            const p = d.pages.find((x) => x.id === id);
            if (p) Object.assign(p, patch);
          },
          { coalesce: `page:${id}:${Object.keys(patch).join(",")}` },
        ),
    };
  });
}

export const BuilderStoreContext = React.createContext<StoreApi<BuilderState> | null>(null);

/** Subscribe to a slice of the nearest builder store (re-renders only when the slice changes). */
export function useBuilder<T>(selector: (s: BuilderState) => T): T {
  const store = React.useContext(BuilderStoreContext);
  if (!store) throw new Error("useBuilder must be used inside <ProFormBuilder>");
  return useStore(store, selector);
}
