import * as React from "react";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/crm/dropdown-menu";

export interface Workspace {
  id: string;
  name: string;
  /** Image URL or node for the logo; falls back to the first letter. */
  logo?: React.ReactNode;
  /** Secondary line, e.g. plan or member count. */
  meta?: string;
}

export interface WorkspaceSwitcherProps {
  workspaces: Workspace[];
  value?: string;
  defaultValue?: string;
  onValueChange?: (id: string) => void;
  /** Shows a "Create workspace" item when set. */
  onCreate?: () => void;
  /** Extra items (e.g. settings) shown under the list. */
  children?: React.ReactNode;
  /** Hide the name and chevron, showing only the logo (collapsed sidebar). */
  compact?: boolean;
  className?: string;
  /** Open the menu on mount (uncontrolled). */
  defaultOpen?: boolean;
  /** Controlled open state. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Radix modal behaviour; set false to keep the page interactive while open. */
  modal?: boolean;
}

const palette = [
  "bg-tag-purple-bg text-tag-purple-text",
  "bg-tag-blue-bg text-tag-blue-text",
  "bg-tag-green-bg text-tag-green-text",
  "bg-tag-orange-bg text-tag-orange-text",
  "bg-tag-red-bg text-tag-red-text",
];

function WorkspaceLogo({ ws, size = "md" }: { ws: Workspace; size?: "sm" | "md" }) {
  const hue = palette[[...ws.id].reduce((a, c) => a + c.charCodeAt(0), 0) % palette.length];
  return (
    <span
      aria-hidden
      className={cn(
        "grid shrink-0 place-items-center overflow-hidden rounded-md font-semibold [&>img]:size-full [&>img]:object-cover",
        size === "sm" ? "size-5 text-[10px]" : "size-6 text-xs",
        typeof ws.logo === "string" ? "bg-crm-muted" : hue,
      )}
    >
      {typeof ws.logo === "string" ? (
        <img src={ws.logo} alt="" />
      ) : (
        (ws.logo ?? ws.name.charAt(0).toUpperCase())
      )}
    </span>
  );
}

/** Org/team dropdown for sidebars and top bars. */
export function WorkspaceSwitcher({
  workspaces,
  value,
  defaultValue,
  onValueChange,
  onCreate,
  children,
  compact,
  className,
  defaultOpen,
  open,
  onOpenChange,
  modal,
}: WorkspaceSwitcherProps) {
  const [inner, setInner] = React.useState(defaultValue ?? workspaces[0]?.id);
  const currentId = value ?? inner;
  const current = workspaces.find((w) => w.id === currentId) ?? workspaces[0];

  const select = (id: string) => {
    if (value === undefined) setInner(id);
    onValueChange?.(id);
  };

  return (
    <DropdownMenu defaultOpen={defaultOpen} open={open} onOpenChange={onOpenChange} modal={modal}>
      <DropdownMenuTrigger
        aria-label={`Switch workspace, current: ${current?.name ?? "none"}`}
        className={cn(
          "flex cursor-pointer items-center gap-2 rounded-lg p-1.5 text-left font-crm text-crm-fg outline-none",
          "transition-colors duration-150 ease-crm hover:bg-crm-raised focus-visible:ring-2 focus-visible:ring-crm-ring/60 data-[state=open]:bg-crm-raised",
          compact ? "w-auto" : "w-full",
          className,
        )}
      >
        {current ? <WorkspaceLogo ws={current} /> : null}
        {compact ? null : (
          <>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">{current?.name}</span>
              {current?.meta ? (
                <span className="block truncate text-xs text-crm-subtle">{current.meta}</span>
              ) : null}
            </span>
            <ChevronsUpDown className="size-3.5 shrink-0 text-crm-subtle" />
          </>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-[260px]">
        <DropdownMenuLabel>Workspaces</DropdownMenuLabel>
        {workspaces.map((ws) => (
          <DropdownMenuItem
            key={ws.id}
            onSelect={() => select(ws.id)}
            aria-current={ws.id === current?.id ? "true" : undefined}
            icon={<WorkspaceLogo ws={ws} size="sm" />}
            className="h-auto min-h-8 py-1"
          >
            <span className="flex items-center gap-2">
              <span className="min-w-0 flex-1">
                <span className="block truncate">{ws.name}</span>
                {ws.meta ? (
                  <span className="block truncate text-xs text-crm-subtle">{ws.meta}</span>
                ) : null}
              </span>
              {ws.id === current?.id ? <Check className="text-crm-primary" /> : null}
            </span>
          </DropdownMenuItem>
        ))}
        {children || onCreate ? <DropdownMenuSeparator /> : null}
        {children}
        {onCreate ? (
          <DropdownMenuItem icon={<Plus />} onSelect={onCreate}>
            Create workspace
          </DropdownMenuItem>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
