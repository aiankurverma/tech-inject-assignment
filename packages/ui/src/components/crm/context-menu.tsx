import * as React from "react";
import * as Menu from "@radix-ui/react-dropdown-menu";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/crm/dropdown-menu";

export type ContextMenuEntry =
  | {
      type?: "item";
      id: string;
      label: string;
      icon?: React.ReactNode;
      shortcut?: string;
      destructive?: boolean;
      disabled?: boolean;
      onSelect?: () => void;
    }
  | {
      type: "checkbox";
      id: string;
      label: string;
      checked: boolean;
      disabled?: boolean;
      onCheckedChange: (v: boolean) => void;
    }
  | {
      type: "submenu";
      id: string;
      label: string;
      icon?: React.ReactNode;
      items: ContextMenuEntry[];
      disabled?: boolean;
    }
  | { type: "label"; id: string; label: string }
  | { type: "separator"; id: string };

export interface ContextMenuProps {
  /** Entries, or a function of the event target so one menu can serve many rows. */
  items: ContextMenuEntry[] | ((target: HTMLElement) => ContextMenuEntry[]);
  /** The region that responds to right-click, long-press and the Menu / Shift+F10 keys. */
  children: React.ReactNode;
  disabled?: boolean;
  /** Touch long-press delay in ms. */
  longPressMs?: number;
  onOpenChange?: (open: boolean) => void;
  className?: string;
}

const subItemCls =
  "relative flex h-8 cursor-pointer items-center gap-2 rounded-lg px-2 text-sm text-crm-fg outline-none select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-40 data-[highlighted]:bg-crm-muted data-[state=open]:bg-crm-muted [&_svg]:size-3.5";

function renderEntries(entries: ContextMenuEntry[]): React.ReactNode {
  return entries.map((e) => {
    switch (e.type) {
      case "separator":
        return <DropdownMenuSeparator key={e.id} />;
      case "label":
        return <DropdownMenuLabel key={e.id}>{e.label}</DropdownMenuLabel>;
      case "checkbox":
        return (
          <DropdownMenuCheckboxItem
            key={e.id}
            checked={e.checked}
            disabled={e.disabled}
            onCheckedChange={(v) => e.onCheckedChange(v === true)}
          >
            {e.label}
          </DropdownMenuCheckboxItem>
        );
      case "submenu":
        return (
          <Menu.Sub key={e.id}>
            <Menu.SubTrigger disabled={e.disabled} className={subItemCls}>
              {e.icon ? <span className="text-crm-soft">{e.icon}</span> : null}
              <span className="flex-1">{e.label}</span>
              <ChevronRight className="text-crm-subtle" />
            </Menu.SubTrigger>
            <Menu.Portal>
              <Menu.SubContent
                sideOffset={4}
                className="z-50 min-w-[180px] rounded-xl border border-crm-border bg-crm-popover p-1 font-crm text-crm-fg shadow-crm-overlay outline-none data-[state=open]:animate-crm-in"
              >
                {renderEntries(e.items)}
              </Menu.SubContent>
            </Menu.Portal>
          </Menu.Sub>
        );
      default:
        return (
          <DropdownMenuItem
            key={e.id}
            icon={e.icon}
            shortcut={e.shortcut}
            destructive={e.destructive}
            disabled={e.disabled}
            onSelect={e.onSelect}
          >
            {e.label}
          </DropdownMenuItem>
        );
    }
  });
}

/**
 * Right-click menu for any region (table rows, cards, canvas). Opens at the pointer, on a
 * touch long-press, or from the keyboard (ContextMenu key / Shift+F10) at the focused
 * element. Built on the CRM DropdownMenu so it gets Radix focus, typeahead and collision
 * handling; supports submenus, checkbox items, labels and per-target item lists.
 */
export function ContextMenu({
  items,
  children,
  disabled,
  longPressMs = 500,
  onOpenChange,
  className,
}: ContextMenuProps) {
  const [open, setOpen] = React.useState(false);
  const [point, setPoint] = React.useState({ x: 0, y: 0 });
  const [entries, setEntries] = React.useState<ContextMenuEntry[]>([]);
  const pressTimer = React.useRef<number | null>(null);
  const pressStart = React.useRef<{ x: number; y: number } | null>(null);

  const openAt = (x: number, y: number, target: HTMLElement) => {
    const list = typeof items === "function" ? items(target) : items;
    if (!list.length) return;
    setEntries(list);
    setPoint({ x, y });
    setOpen(true);
    onOpenChange?.(true);
  };

  const cancelPress = () => {
    if (pressTimer.current !== null) window.clearTimeout(pressTimer.current);
    pressTimer.current = null;
  };
  React.useEffect(() => cancelPress, []);

  return (
    <DropdownMenu
      open={open}
      modal
      onOpenChange={(o) => {
        setOpen(o);
        onOpenChange?.(o);
      }}
    >
      <div
        className={cn("contents", className)}
        onContextMenu={(e) => {
          if (disabled) return;
          e.preventDefault();
          openAt(e.clientX, e.clientY, e.target as HTMLElement);
        }}
        onKeyDown={(e) => {
          if (disabled) return;
          if (e.key === "ContextMenu" || (e.shiftKey && e.key === "F10")) {
            e.preventDefault();
            const t = e.target as HTMLElement;
            const r = t.getBoundingClientRect();
            openAt(r.left + Math.min(24, r.width / 2), r.top + r.height / 2, t);
          }
        }}
        onPointerDown={(e) => {
          if (disabled || e.pointerType !== "touch") return;
          const target = e.target as HTMLElement;
          const { clientX: x, clientY: y } = e;
          pressStart.current = { x, y };
          cancelPress();
          pressTimer.current = window.setTimeout(() => openAt(x, y, target), longPressMs);
        }}
        onPointerMove={(e) => {
          const s = pressStart.current;
          if (s && Math.hypot(e.clientX - s.x, e.clientY - s.y) > 10) cancelPress();
        }}
        onPointerUp={cancelPress}
        onPointerCancel={cancelPress}
      >
        {children}
      </div>
      <Menu.Trigger asChild>
        <span
          aria-hidden
          tabIndex={-1}
          style={{
            position: "fixed",
            left: point.x,
            top: point.y,
            width: 0,
            height: 0,
            pointerEvents: "none",
          }}
        />
      </Menu.Trigger>
      <DropdownMenuContent
        sideOffset={2}
        collisionPadding={8}
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        {renderEntries(entries)}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
