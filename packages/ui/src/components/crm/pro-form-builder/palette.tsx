import * as React from "react";
import {
  AlignLeft,
  AtSign,
  Calendar,
  CheckSquare,
  ChevronDownSquare,
  CircleDot,
  Globe,
  Hash,
  Heading,
  ListChecks,
  Paperclip,
  Phone,
  ShieldCheck,
  Star,
  Type,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { FieldType } from "@/components/crm/pro-form-renderer/schema";
import { FIELD_TEMPLATES, useBuilder } from "@/components/crm/pro-form-builder/store";

export const DND_NEW = "application/x-kitbase-new-field";
export const DND_MOVE = "application/x-kitbase-move-field";

export const FIELD_ICONS: Record<FieldType, LucideIcon> = {
  text: Type,
  textarea: AlignLeft,
  email: AtSign,
  phone: Phone,
  url: Globe,
  number: Hash,
  select: ChevronDownSquare,
  radio: CircleDot,
  checkbox: CheckSquare,
  multiselect: ListChecks,
  date: Calendar,
  rating: Star,
  file: Paperclip,
  consent: ShieldCheck,
  heading: Heading,
};

/** Field palette: drag onto the canvas, or press Enter / click to insert after the selection. */
export function FieldPalette({ disabled }: { disabled?: boolean }) {
  const addField = useBuilder((s) => s.addField);
  const insertIndex = useBuilder((s) => {
    if (s.selection?.kind !== "field") return undefined;
    const page = s.schema.pages.find((p) => p.id === s.pageId);
    const i = page?.fields.findIndex((f) => f.id === s.selection!.id) ?? -1;
    return i >= 0 ? i + 1 : undefined;
  });
  const [query, setQuery] = React.useState("");
  const items = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return q
      ? FIELD_TEMPLATES.filter(
          (t) => t.label.toLowerCase().includes(q) || t.description.toLowerCase().includes(q),
        )
      : FIELD_TEMPLATES;
  }, [query]);

  return (
    <aside aria-label="Field palette" className="flex min-h-0 flex-col gap-2">
      <p className="px-1 text-[11px] font-medium tracking-wide text-crm-subtle uppercase">Fields</p>
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search fields"
        aria-label="Search field types"
        className="h-8 w-full rounded-crm border border-crm-input/60 bg-crm-raised px-2.5 text-xs text-crm-fg outline-none placeholder:text-crm-subtle focus-visible:border-crm-ring focus-visible:ring-2 focus-visible:ring-crm-ring/40"
      />
      <ul className="-mx-1 flex min-h-0 flex-col gap-0.5 overflow-y-auto px-1 pb-1">
        {items.map((t) => {
          const Icon = FIELD_ICONS[t.type];
          return (
            <li key={t.type}>
              <button
                type="button"
                draggable={!disabled}
                disabled={disabled}
                onDragStart={(e) => {
                  e.dataTransfer.setData(DND_NEW, t.type);
                  e.dataTransfer.effectAllowed = "copy";
                }}
                onClick={() => addField(t.type, insertIndex)}
                title={`${t.description}. Click or drag to add.`}
                className={cn(
                  "group flex w-full cursor-grab items-center gap-2.5 rounded-crm px-2 py-1.5 text-left outline-none active:cursor-grabbing",
                  "hover:bg-crm-muted focus-visible:ring-2 focus-visible:ring-crm-ring/60 disabled:cursor-not-allowed disabled:opacity-50",
                )}
              >
                <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-crm-raised text-crm-muted-fg shadow-crm-raised group-hover:text-crm-fg">
                  <Icon className="size-3.5" aria-hidden />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-xs font-medium text-crm-fg">{t.label}</span>
                  <span className="block truncate text-[11px] text-crm-subtle">
                    {t.description}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
        {!items.length ? (
          <li className="px-2 py-4 text-center text-xs text-crm-subtle">No field types match.</li>
        ) : null}
      </ul>
    </aside>
  );
}
