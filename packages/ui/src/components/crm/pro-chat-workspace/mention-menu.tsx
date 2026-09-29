import * as React from "react";
import { FloatingPortal, autoUpdate, flip, offset, shift, useFloating } from "@floating-ui/react";
import { cn } from "@/lib/utils";
import { Initials } from "@/components/crm/pro-chat-workspace/message-item";
import type { ChatUser } from "@/components/crm/pro-chat-workspace/types";

const EMPTY: ChatUser[] = [];

export interface MentionState {
  items: ChatUser[];
  rect: (() => DOMRect | null) | null;
  command: (attrs: { id: string; label: string }) => void;
}

export interface MentionMenuHandle {
  onKeyDown: (event: KeyboardEvent) => boolean;
}

/**
 * Listbox for Tiptap's mention suggestion, anchored to the caret with a floating-ui virtual
 * element. Keyboard events are forwarded from the editor (Up/Down/Enter/Tab/Escape) so focus
 * never leaves the composer; aria-activedescendant-style highlighting via aria-selected.
 */
export const MentionMenu = React.forwardRef<MentionMenuHandle, { state: MentionState | null }>(
  function MentionMenu({ state }, ref) {
    const [index, setIndex] = React.useState(0);
    const items = state?.items ?? EMPTY;
    const { refs, floatingStyles } = useFloating({
      open: !!state,
      placement: "top-start",
      middleware: [offset(6), flip(), shift({ padding: 8 })],
      whileElementsMounted: autoUpdate,
    });

    React.useEffect(() => {
      setIndex(0);
    }, [items]);

    React.useLayoutEffect(() => {
      const rect = state?.rect;
      if (!rect) return;
      refs.setPositionReference({
        getBoundingClientRect: () => rect() ?? new DOMRect(),
      });
    }, [state, refs]);

    const pick = React.useCallback(
      (i: number) => {
        const u = items[i];
        if (u && state) state.command({ id: u.id, label: u.name });
      },
      [items, state],
    );

    React.useImperativeHandle(
      ref,
      () => ({
        onKeyDown: (event) => {
          if (!state) return false;
          if (event.key === "Escape") return false;
          if (!items.length) return false;
          if (event.key === "ArrowDown") {
            setIndex((i) => (i + 1) % items.length);
            return true;
          }
          if (event.key === "ArrowUp") {
            setIndex((i) => (i - 1 + items.length) % items.length);
            return true;
          }
          if (event.key === "Enter" || event.key === "Tab") {
            pick(index);
            return true;
          }
          return false;
        },
      }),
      [state, items, index, pick],
    );

    if (!state) return null;
    return (
      <FloatingPortal>
        <div
          ref={refs.setFloating}
          style={floatingStyles}
          role="listbox"
          aria-label="Mention a teammate"
          className="z-50 w-64 overflow-hidden rounded-crm border border-crm-border bg-crm-popover p-1 shadow-crm-overlay"
        >
          {items.length === 0 ? (
            <div className="px-2 py-2 text-xs text-crm-muted-fg">No teammates match.</div>
          ) : (
            items.map((u, i) => (
              <div
                key={u.id}
                role="option"
                aria-selected={i === index}
                onMouseEnter={() => setIndex(i)}
                onMouseDown={(e) => {
                  e.preventDefault();
                  pick(i);
                }}
                className={cn(
                  "flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5",
                  i === index ? "bg-crm-primary/20" : "hover:bg-crm-muted",
                )}
              >
                <Initials user={u} className="size-6 text-[10px]" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm text-crm-fg">{u.name}</div>
                  {u.title ? (
                    <div className="truncate text-[11px] text-crm-muted-fg">{u.title}</div>
                  ) : null}
                </div>
                {u.online ? (
                  <span className="size-2 rounded-full bg-crm-success" aria-label="online" />
                ) : null}
              </div>
            ))
          )}
        </div>
      </FloatingPortal>
    );
  },
);
