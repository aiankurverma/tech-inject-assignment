import * as React from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { cn } from "@/lib/utils";
import type { FeatureFlag, FlagEnvironment } from "@/components/crm/pro-feature-flag-console/types";

export function EnvSwitch({
  checked,
  onChange,
  label,
  disabled,
  pending,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  disabled?: boolean;
  pending?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      aria-busy={pending || undefined}
      disabled={disabled || pending}
      onClick={(e) => {
        e.stopPropagation();
        onChange(!checked);
      }}
      onKeyDown={(e) => e.stopPropagation()}
      className={cn(
        "relative inline-flex h-[18px] w-8 shrink-0 items-center rounded-full transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-crm-ring disabled:cursor-not-allowed disabled:opacity-50",
        checked ? "bg-crm-success" : "bg-crm-track",
        pending && "animate-pulse",
      )}
    >
      <span
        className={cn(
          "inline-block size-3.5 rounded-full bg-white shadow transition-transform",
          checked ? "translate-x-[16px]" : "translate-x-[2px]",
        )}
      />
    </button>
  );
}

export interface FlagListProps {
  flags: FeatureFlag[];
  environments: FlagEnvironment[];
  selectedKey: string | null;
  onSelect: (key: string) => void;
  onToggle: (flag: FeatureFlag, env: FlagEnvironment, enabled: boolean) => void;
  pending: Set<string>;
  readOnly?: boolean;
  rowHeight?: number;
}

/**
 * Virtualised listbox of flags. Arrow keys / Home / End move selection (roving focus via
 * aria-activedescendant); each row carries one switch per environment.
 */
export function FlagList({
  flags,
  environments,
  selectedKey,
  onSelect,
  onToggle,
  pending,
  readOnly,
  rowHeight = 60,
}: FlagListProps) {
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: flags.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => rowHeight,
    getItemKey: (i) => flags[i]?.key ?? i,
    overscan: 8,
  });
  const index = React.useMemo(
    () => flags.findIndex((f) => f.key === selectedKey),
    [flags, selectedKey],
  );
  const listId = React.useId();

  const onKeyDown = (e: React.KeyboardEvent) => {
    let next = index;
    if (e.key === "ArrowDown") next = Math.min(flags.length - 1, index + 1);
    else if (e.key === "ArrowUp") next = Math.max(0, index - 1);
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = flags.length - 1;
    else if (e.key === "PageDown") next = Math.min(flags.length - 1, index + 10);
    else if (e.key === "PageUp") next = Math.max(0, index - 10);
    else return;
    e.preventDefault();
    const f = flags[next];
    if (f) {
      onSelect(f.key);
      virtualizer.scrollToIndex(next, { align: "auto" });
    }
  };

  return (
    <div
      ref={scrollRef}
      role="listbox"
      tabIndex={0}
      aria-label="Feature flags"
      aria-activedescendant={index >= 0 ? `${listId}-${index}` : undefined}
      onKeyDown={onKeyDown}
      className="h-full overflow-y-auto focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-crm-ring"
    >
      <div style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
        {virtualizer.getVirtualItems().map((vi) => {
          const f = flags[vi.index]!;
          const selected = f.key === selectedKey;
          return (
            <div
              key={f.key}
              id={`${listId}-${vi.index}`}
              role="option"
              aria-selected={selected}
              onClick={() => onSelect(f.key)}
              className={cn(
                "absolute inset-x-0 flex cursor-pointer items-center gap-3 border-b border-crm-border px-3",
                selected
                  ? "bg-crm-primary/10 shadow-[inset_2px_0_0_var(--color-crm-primary)]"
                  : "hover:bg-crm-raised",
                f.archived && "opacity-60",
              )}
              style={{ height: vi.size, transform: `translateY(${vi.start}px)` }}
            >
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] font-medium">{f.name}</div>
                <div className="flex items-center gap-1.5">
                  <span className="truncate font-mono text-[11px] text-crm-muted-fg">{f.key}</span>
                  {f.tags?.slice(0, 1).map((t) => (
                    <span key={t} className="rounded bg-crm-muted px-1 text-[10px] text-crm-soft">
                      {t}
                    </span>
                  ))}
                </div>
              </div>
              <div className="flex shrink-0 gap-2.5">
                {environments.map((env) => {
                  const cfg = f.environments[env.key];
                  return (
                    <div key={env.key} className="flex w-9 justify-center">
                      {cfg ? (
                        <EnvSwitch
                          checked={cfg.enabled}
                          label={`${f.name} in ${env.name}`}
                          disabled={readOnly || f.archived}
                          pending={pending.has(`${f.key}:${env.key}`)}
                          onChange={(v) => onToggle(f, env, v)}
                        />
                      ) : (
                        <span
                          className="text-crm-faint"
                          aria-label={`Not configured in ${env.name}`}
                        >
                          –
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
