import * as React from "react";
import {
  autoUpdate,
  flip,
  offset,
  shift,
  size,
  useFloating,
  FloatingPortal,
} from "@floating-ui/react";
import { cn } from "@/lib/utils";

/** One row in a suggestion popup (slash command, person, record). */
export interface SuggestionItem {
  id: string;
  label: string;
  description?: string;
  group?: string;
  icon?: React.ReactNode;
  /** Two-letter avatar or badge text. */
  badge?: string;
  keywords?: string[];
}

export interface SuggestionState {
  open: boolean;
  kind: string;
  query: string;
  items: SuggestionItem[];
  loading: boolean;
  selected: number;
  rect: (() => DOMRect | null) | null;
  select: ((item: SuggestionItem) => void) | null;
}

const closed: SuggestionState = {
  open: false,
  kind: "",
  query: "",
  items: [],
  loading: false,
  selected: 0,
  rect: null,
  select: null,
};

/**
 * Tiny external store bridging Tiptap's imperative `suggestion.render()` lifecycle into React.
 * One store per editor instance, shared by the slash menu and every mention trigger.
 */
export function createSuggestionStore() {
  let state = closed;
  const listeners = new Set<() => void>();
  const emit = () => listeners.forEach((l) => l());
  return {
    get: () => state,
    subscribe(l: () => void) {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    set(patch: Partial<SuggestionState>) {
      state = { ...state, ...patch };
      if (state.selected >= state.items.length) state = { ...state, selected: 0 };
      emit();
    },
    close() {
      if (!state.open) return;
      state = closed;
      emit();
    },
    /** Returns true when the key was handled. */
    keyDown(event: KeyboardEvent): boolean {
      if (!state.open) return false;
      const n = state.items.length;
      if (event.key === "ArrowDown" || (event.key === "n" && event.ctrlKey)) {
        if (n) this.set({ selected: (state.selected + 1) % n });
        return true;
      }
      if (event.key === "ArrowUp" || (event.key === "p" && event.ctrlKey)) {
        if (n) this.set({ selected: (state.selected - 1 + n) % n });
        return true;
      }
      if (event.key === "Enter" || event.key === "Tab") {
        const item = state.items[state.selected];
        if (item && state.select) {
          state.select(item);
          return true;
        }
        return event.key === "Enter" && n === 0 ? false : n > 0;
      }
      if (event.key === "Escape") {
        this.close();
        return true;
      }
      return false;
    },
  };
}

export type SuggestionStore = ReturnType<typeof createSuggestionStore>;

/** Positioned listbox for the active suggestion. Rendered once per editor. */
export function SuggestionMenu({ store, id }: { store: SuggestionStore; id: string }) {
  const state = React.useSyncExternalStore(store.subscribe, store.get, store.get);
  const { refs, floatingStyles } = useFloating({
    open: state.open,
    placement: "bottom-start",
    strategy: "fixed",
    middleware: [
      offset(6),
      flip({ padding: 8 }),
      shift({ padding: 8 }),
      size({
        padding: 8,
        apply({ availableHeight, elements }) {
          elements.floating.style.maxHeight = `${Math.min(320, Math.max(120, availableHeight))}px`;
        },
      }),
    ],
    whileElementsMounted: autoUpdate,
  });

  React.useLayoutEffect(() => {
    const rect = state.rect;
    refs.setPositionReference(
      rect ? { getBoundingClientRect: () => rect() ?? new DOMRect(0, 0, 0, 0) } : null,
    );
  }, [state.rect, refs]);

  const listRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    listRef.current
      ?.querySelector<HTMLElement>(`[data-index="${state.selected}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [state.selected]);

  if (!state.open) return null;
  let lastGroup: string | undefined;
  return (
    <FloatingPortal>
      <div
        ref={(el) => {
          refs.setFloating(el);
          listRef.current = el;
        }}
        style={floatingStyles}
        id={id}
        role="listbox"
        aria-label={state.kind === "/" ? "Insert block" : "Suggestions"}
        className="z-50 w-72 overflow-y-auto rounded-crm border border-crm-border bg-crm-popover p-1 font-crm text-crm-fg shadow-crm-overlay animate-crm-in"
        onMouseDown={(e) => e.preventDefault()}
      >
        {state.loading && state.items.length === 0 ? (
          <p className="px-2 py-3 text-xs text-crm-muted-fg">Searching…</p>
        ) : state.items.length === 0 ? (
          <p className="px-2 py-3 text-xs text-crm-muted-fg">No matches for "{state.query}"</p>
        ) : (
          state.items.map((item, i) => {
            const header = item.group && item.group !== lastGroup ? item.group : null;
            lastGroup = item.group;
            return (
              <React.Fragment key={`${item.group ?? ""}:${item.id}`}>
                {header ? (
                  <div
                    role="presentation"
                    className="px-2 pb-1 pt-2 text-[10px] font-medium uppercase tracking-wide text-crm-faint"
                  >
                    {header}
                  </div>
                ) : null}
                <div
                  role="option"
                  id={`${id}-opt-${i}`}
                  data-index={i}
                  aria-selected={i === state.selected}
                  onMouseEnter={() => store.set({ selected: i })}
                  onClick={() => state.select?.(item)}
                  className={cn(
                    "flex cursor-pointer items-center gap-2 rounded-[6px] px-2 py-1.5 text-sm",
                    i === state.selected ? "bg-crm-muted text-crm-fg" : "text-crm-soft",
                  )}
                >
                  {item.icon ? (
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-[6px] border border-crm-border bg-crm-raised text-crm-icon [&_svg]:size-3.5">
                      {item.icon}
                    </span>
                  ) : item.badge ? (
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-crm-primary/25 text-[10px] font-semibold text-crm-fg">
                      {item.badge}
                    </span>
                  ) : null}
                  <span className="min-w-0">
                    <span className="block truncate">{item.label}</span>
                    {item.description ? (
                      <span className="block truncate text-xs text-crm-muted-fg">
                        {item.description}
                      </span>
                    ) : null}
                  </span>
                </div>
              </React.Fragment>
            );
          })
        )}
      </div>
    </FloatingPortal>
  );
}
