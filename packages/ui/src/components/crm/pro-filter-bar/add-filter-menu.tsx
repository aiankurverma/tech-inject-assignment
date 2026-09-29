import * as React from "react";
import * as Popover from "@radix-ui/react-popover";
import { Command } from "cmdk";
import { CornerDownLeft, ListFilter } from "lucide-react";
import { cn } from "@/lib/utils";
import type { FacetCounts, FilterField, FilterOption } from "@/components/crm/pro-filter-bar/types";

export interface AddFilterMenuProps {
  fields: FilterField<never>[];
  options: Record<string, FilterOption[]>;
  facets?: FacetCounts;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Picked a field: create an empty chip for it. */
  onPickField: (field: FilterField<never>) => void;
  /** Picked a value straight from the typeahead ("Stage: Won"). */
  onPickValue: (field: FilterField<never>, value: string) => void;
  disabled?: boolean;
  compact?: boolean;
  shortcut?: string;
}

const MAX_VALUE_HITS = 40;
const nf = new Intl.NumberFormat();

/**
 * Typeahead entry point. Empty query lists fields; typing also searches every enum value
 * across fields so "won" jumps straight to "Stage is Won".
 */
export function AddFilterMenu({
  fields,
  options,
  facets,
  open,
  onOpenChange,
  onPickField,
  onPickValue,
  disabled,
  compact,
  shortcut,
}: AddFilterMenuProps) {
  const [query, setQuery] = React.useState("");
  const visible = fields.filter((f) => !f.hidden);

  const valueHits = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    const hits: { field: FilterField<never>; option: FilterOption; count: number }[] = [];
    for (const field of visible) {
      if (field.type !== "enum") continue;
      for (const option of options[field.id] ?? []) {
        const hay = `${option.label} ${option.keywords ?? ""}`.toLowerCase();
        if (!hay.includes(q)) continue;
        hits.push({ field, option, count: facets?.[field.id]?.get(option.value) ?? 0 });
      }
    }
    return hits.sort((a, b) => b.count - a.count).slice(0, MAX_VALUE_HITS);
  }, [query, visible, options, facets]);

  return (
    <Popover.Root
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) setQuery("");
      }}
    >
      <Popover.Trigger
        disabled={disabled}
        aria-keyshortcuts={shortcut}
        className={cn(
          "flex h-7 shrink-0 items-center gap-1.5 rounded-crm px-2 text-[13px] text-crm-soft outline-none transition-colors",
          "hover:bg-crm-muted hover:text-crm-fg focus-visible:ring-1 focus-visible:ring-crm-ring disabled:opacity-50",
          "data-[state=open]:bg-crm-muted data-[state=open]:text-crm-fg",
        )}
      >
        <ListFilter className="size-3.5" />
        {!compact && "Filter"}
        {shortcut && !compact && (
          <kbd className="ml-0.5 rounded border border-crm-border px-1 font-sans text-[10px] text-crm-subtle">
            {shortcut.toUpperCase()}
          </kbd>
        )}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={6}
          className="z-50 w-72 overflow-hidden rounded-crm border border-crm-border bg-crm-popover shadow-crm-overlay animate-crm-in"
        >
          <Command loop label="Add filter" shouldFilter>
            <div className="border-b border-crm-border p-1.5">
              <Command.Input
                value={query}
                onValueChange={setQuery}
                placeholder="Filter by… (try a value)"
                className="h-8 w-full bg-transparent px-2 text-[13px] text-crm-fg outline-none placeholder:text-crm-subtle"
              />
            </div>
            <Command.List className="max-h-80 overflow-y-auto p-1">
              <Command.Empty className="px-2 py-4 text-center text-xs text-crm-muted-fg">
                No fields or values match “{query}”
              </Command.Empty>
              <Command.Group
                heading="Fields"
                className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:text-crm-subtle"
              >
                {visible.map((field) => (
                  <Command.Item
                    key={field.id}
                    value={`field:${field.id} ${field.label}`}
                    onSelect={() => onPickField(field)}
                    className={itemCls}
                  >
                    <span className="text-crm-soft [&_svg]:size-3.5">{field.icon}</span>
                    <span className="flex-1">{field.label}</span>
                    <CornerDownLeft className="size-3 text-crm-faint opacity-0 group-data-[selected=true]:opacity-100" />
                  </Command.Item>
                ))}
              </Command.Group>
              {valueHits.length > 0 && (
                <Command.Group
                  heading="Values"
                  className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:text-crm-subtle"
                >
                  {valueHits.map(({ field, option, count }) => (
                    <Command.Item
                      key={`${field.id}:${option.value}`}
                      value={`value:${field.id}:${option.value} ${option.label} ${option.keywords ?? ""}`}
                      onSelect={() => onPickValue(field, option.value)}
                      className={itemCls}
                    >
                      <span className="text-crm-subtle">{field.label}</span>
                      <span className="text-crm-faint">is</span>
                      {option.icon}
                      <span className="min-w-0 flex-1 truncate text-crm-fg">{option.label}</span>
                      {facets && (
                        <span className="text-xs tabular-nums text-crm-muted-fg">
                          {nf.format(count)}
                        </span>
                      )}
                    </Command.Item>
                  ))}
                </Command.Group>
              )}
            </Command.List>
          </Command>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

const itemCls =
  "group flex h-8 cursor-pointer items-center gap-2 rounded-[6px] px-2 text-[13px] text-crm-chip data-[selected=true]:bg-crm-muted data-[selected=true]:text-crm-fg";
