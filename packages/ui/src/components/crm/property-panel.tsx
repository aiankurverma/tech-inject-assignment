import * as React from "react";
import { ChevronRight } from "lucide-react";
import { InlineEdit, type InlineEditOption } from "@/components/crm/inline-edit";
import { cn } from "@/lib/utils";

export interface PropertyField {
  key: string;
  label: string;
  value: string;
  type?: "text" | "number" | "email" | "url" | "textarea" | "select";
  options?: InlineEditOption[];
  icon?: React.ReactNode;
  /** Read-only fields render the value (or `render`) without an editor. */
  readOnly?: boolean;
  placeholder?: string;
  validate?: (value: string) => string | undefined;
  /** Custom rendering of the value (read-only or display mode). */
  render?: (value: string) => React.ReactNode;
}

export interface PropertySection {
  id: string;
  title: string;
  fields: PropertyField[];
  defaultOpen?: boolean;
}

export interface PropertyPanelProps extends Omit<React.HTMLAttributes<HTMLElement>, "title"> {
  sections: PropertySection[];
  /** Save handler for any field. Return a promise to show saving; reject to keep editing. */
  onFieldChange?: (key: string, value: string) => void | Promise<void>;
  /** Header above the sections, e.g. record name + avatar. */
  header?: React.ReactNode;
  /** Accessible name of the panel. */
  label?: string;
}

function Section({
  section,
  onFieldChange,
}: {
  section: PropertySection;
  onFieldChange?: PropertyPanelProps["onFieldChange"];
}) {
  const [open, setOpen] = React.useState(section.defaultOpen ?? true);
  const bodyId = React.useId();
  return (
    <div className="border-b border-crm-border py-2 last:border-b-0">
      <h3>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={bodyId}
          onClick={() => setOpen(!open)}
          className="flex h-8 w-full cursor-pointer items-center gap-1.5 rounded-lg px-1 text-left outline-none hover:text-crm-fg focus-visible:ring-2 focus-visible:ring-crm-ring/60"
        >
          <ChevronRight
            className={cn(
              "size-3.5 text-crm-subtle transition-transform duration-150 ease-crm",
              open && "rotate-90",
            )}
            aria-hidden
          />
          <span className="crm-eyebrow text-crm-soft">{section.title}</span>
          <span className="ml-auto text-xs text-crm-faint tabular-nums">
            {section.fields.length}
          </span>
        </button>
      </h3>
      <dl id={bodyId} hidden={!open} className="flex flex-col gap-0.5 pt-1">
        {section.fields.map((f) => (
          <div key={f.key} className="grid grid-cols-[minmax(88px,38%)_1fr] items-start gap-2 px-1">
            <dt className="flex h-8 items-center gap-1.5 truncate text-xs text-crm-subtle [&_svg]:size-3.5">
              {f.icon ? <span aria-hidden>{f.icon}</span> : null}
              {f.label}
            </dt>
            <dd className="min-w-0 pl-2">
              {f.readOnly || !onFieldChange ? (
                <span
                  className={cn(
                    "flex min-h-8 items-center text-sm text-crm-fg",
                    !f.value && "text-crm-faint",
                  )}
                >
                  {f.value
                    ? f.render
                      ? f.render(f.value)
                      : f.type === "select"
                        ? (f.options?.find((o) => o.value === f.value)?.label ?? f.value)
                        : f.value
                    : "—"}
                </span>
              ) : (
                <InlineEdit
                  label={f.label}
                  value={f.value}
                  type={f.type}
                  options={f.options}
                  placeholder={f.placeholder}
                  validate={f.validate}
                  renderValue={f.render}
                  onSave={(v) => onFieldChange(f.key, v)}
                />
              )}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/** Record sidebar: collapsible sections of label/value fields, each editable in place. */
export function PropertyPanel({
  sections,
  onFieldChange,
  header,
  label = "Record properties",
  className,
  ...props
}: PropertyPanelProps) {
  return (
    <aside
      aria-label={label}
      className={cn(
        "flex w-full flex-col rounded-xl border border-crm-border bg-crm-card font-crm text-crm-fg shadow-crm-raised",
        className,
      )}
      {...props}
    >
      {header ? <div className="border-b border-crm-border p-4">{header}</div> : null}
      <div className="px-3 py-1">
        {sections.map((s) => (
          <Section key={s.id} section={s} onFieldChange={onFieldChange} />
        ))}
      </div>
    </aside>
  );
}
