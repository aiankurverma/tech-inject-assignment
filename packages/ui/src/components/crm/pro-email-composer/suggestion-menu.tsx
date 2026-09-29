import * as React from "react";
import {
  autoUpdate,
  flip,
  FloatingPortal,
  offset,
  shift,
  size,
  useFloating,
} from "@floating-ui/react";
import type { SuggestionKeyDownProps, SuggestionProps } from "@tiptap/suggestion";
import { cn } from "@/lib/utils";
import type { SuggestionItemBase } from "@/components/crm/pro-email-composer/types";

interface BridgeState<I> {
  open: boolean;
  items: I[];
  query: string;
  clientRect: (() => DOMRect | null) | null;
  command: ((item: I) => void) | null;
}

const CLOSED = { open: false, items: [], query: "", clientRect: null, command: null };

/**
 * Connects a Tiptap suggestion plugin (which lives outside React) to a React-rendered menu.
 * `render` is stable, so it can be passed to the extension once at editor creation.
 */
export function useSuggestionBridge<I extends SuggestionItemBase>() {
  const [state, setState] = React.useState<BridgeState<I>>(CLOSED);
  const [active, setActive] = React.useState(0);
  const stateRef = React.useRef(state);
  const activeRef = React.useRef(active);
  stateRef.current = state;
  activeRef.current = active;

  const select = React.useCallback((index: number) => {
    const s = stateRef.current;
    const item = s.items[index];
    if (item && s.command) s.command(item);
  }, []);

  const render = React.useCallback(
    () => ({
      onStart: (p: SuggestionProps<I, I>) => {
        setState({
          open: true,
          items: p.items,
          query: p.query,
          clientRect: p.clientRect ?? null,
          command: p.command,
        });
        setActive(0);
      },
      onUpdate: (p: SuggestionProps<I, I>) => {
        setState({
          open: true,
          items: p.items,
          query: p.query,
          clientRect: p.clientRect ?? null,
          command: p.command,
        });
        setActive((a) => (a < p.items.length ? a : 0));
      },
      onExit: () => setState(CLOSED),
      onKeyDown: ({ event }: SuggestionKeyDownProps) => {
        const s = stateRef.current;
        if (!s.open) return false;
        const n = s.items.length;
        if (event.key === "Escape") {
          setState(CLOSED);
          return true;
        }
        if (!n) return false;
        if (event.key === "ArrowDown") {
          setActive((a) => (a + 1) % n);
          return true;
        }
        if (event.key === "ArrowUp") {
          setActive((a) => (a - 1 + n) % n);
          return true;
        }
        if (event.key === "Enter" || event.key === "Tab") {
          select(activeRef.current);
          return true;
        }
        return false;
      },
    }),
    [select],
  );

  return { state, active, setActive, select, render };
}

export interface SuggestionMenuProps<I extends SuggestionItemBase> {
  bridge: ReturnType<typeof useSuggestionBridge<I>>;
  label: string;
  emptyText: string;
  renderItem?: (item: I, active: boolean) => React.ReactNode;
}

export function SuggestionMenu<I extends SuggestionItemBase>({
  bridge,
  label,
  emptyText,
  renderItem,
}: SuggestionMenuProps<I>) {
  const { state, active, setActive, select } = bridge;
  const id = React.useId();
  const listRef = React.useRef<HTMLDivElement>(null);
  const clientRect = state.clientRect;
  const reference = React.useMemo(
    () => ({
      getBoundingClientRect: () => clientRect?.() ?? new DOMRect(),
    }),
    [clientRect],
  );
  const { refs, floatingStyles } = useFloating({
    open: state.open,
    placement: "bottom-start",
    middleware: [
      offset(6),
      flip({ padding: 8 }),
      shift({ padding: 8 }),
      size({
        padding: 8,
        apply({ availableHeight, elements }) {
          elements.floating.style.maxHeight = `${Math.min(320, availableHeight)}px`;
        },
      }),
    ],
    whileElementsMounted: autoUpdate,
  });
  React.useLayoutEffect(() => {
    refs.setPositionReference(reference);
  }, [refs, reference]);

  React.useEffect(() => {
    listRef.current
      ?.querySelector<HTMLElement>(`[data-index="${active}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [active]);

  if (!state.open) return null;

  let lastGroup: string | undefined;
  return (
    <FloatingPortal>
      <div
        ref={refs.setFloating}
        style={floatingStyles}
        className="z-50 w-72 overflow-hidden rounded-crm border border-crm-border bg-crm-popover font-crm text-crm-fg shadow-crm-overlay"
      >
        <div
          ref={listRef}
          id={id}
          role="listbox"
          aria-label={label}
          className="max-h-[inherit] overflow-y-auto p-1"
        >
          {state.items.length === 0 ? (
            <p className="px-3 py-2 text-sm text-crm-muted-fg">{emptyText}</p>
          ) : (
            state.items.map((item, i) => {
              const heading = item.group !== lastGroup ? item.group : undefined;
              lastGroup = item.group;
              return (
                <React.Fragment key={item.id}>
                  {heading && (
                    <div
                      role="presentation"
                      className="px-2 pt-2 pb-1 text-[11px] font-medium tracking-wide text-crm-subtle uppercase"
                    >
                      {heading}
                    </div>
                  )}
                  <div
                    role="option"
                    data-index={i}
                    aria-selected={i === active}
                    onMouseEnter={() => setActive(i)}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      select(i);
                    }}
                    className={cn(
                      "flex cursor-pointer items-center justify-between gap-3 rounded-[6px] px-2 py-1.5 text-sm",
                      i === active ? "bg-crm-muted text-crm-fg" : "text-crm-soft",
                    )}
                  >
                    {renderItem ? (
                      renderItem(item, i === active)
                    ) : (
                      <>
                        <span className="truncate">{item.label}</span>
                        {item.hint && (
                          <span className="shrink-0 truncate text-xs text-crm-subtle">
                            {item.hint}
                          </span>
                        )}
                      </>
                    )}
                  </div>
                </React.Fragment>
              );
            })
          )}
        </div>
        <div className="flex gap-3 border-t border-crm-border px-3 py-1.5 text-[11px] text-crm-subtle">
          <span>↑↓ navigate</span>
          <span>↵ insert</span>
          <span>esc close</span>
        </div>
        <p className="sr-only" aria-live="polite">
          {state.items.length} {state.items.length === 1 ? "result" : "results"}
        </p>
      </div>
    </FloatingPortal>
  );
}
