import * as React from "react";
import { ArrowDown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ScrollAreaHandle {
  scrollToBottom: (behavior?: ScrollBehavior) => void;
  scrollToTop: (behavior?: ScrollBehavior) => void;
  element: HTMLDivElement | null;
}

export interface ScrollAreaProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "onScroll"> {
  /** CSS max-height, e.g. 320 or "60vh". */
  maxHeight?: number | string;
  orientation?: "vertical" | "horizontal" | "both";
  /** Chat/log mode: stay pinned to the bottom as content grows unless the user scrolled up. */
  stickToBottom?: boolean;
  /** Called when the user nears the end — use for infinite loading. */
  onReachEnd?: () => void;
  /** Distance in px from the end that counts as "reached". */
  endThreshold?: number;
  /** Accessible name; the region is keyboard-scrollable. */
  label?: string;
  /** Change this (e.g. message count) to let stickToBottom react to new content. */
  contentKey?: unknown;
}

/**
 * Styled scroll container with thin themed scrollbars, edge fade shadows that only appear when
 * more content exists, stick-to-bottom for feeds and an end-reached callback.
 */
export const ScrollArea = React.forwardRef<ScrollAreaHandle, ScrollAreaProps>(function ScrollArea(
  {
    maxHeight,
    orientation = "vertical",
    stickToBottom,
    onReachEnd,
    endThreshold = 48,
    label = "Scrollable content",
    contentKey,
    className,
    style,
    children,
    ...props
  },
  ref,
) {
  const el = React.useRef<HTMLDivElement>(null);
  const [edges, setEdges] = React.useState({
    top: false,
    bottom: false,
    left: false,
    right: false,
  });
  const pinned = React.useRef(true);
  const reached = React.useRef(false);
  const [newBelow, setNewBelow] = React.useState(false);

  const measure = React.useCallback(() => {
    const n = el.current;
    if (!n) return;
    const bottomGap = n.scrollHeight - n.clientHeight - n.scrollTop;
    const next = {
      top: n.scrollTop > 1,
      bottom: bottomGap > 1,
      left: n.scrollLeft > 1,
      right: n.scrollWidth - n.clientWidth - n.scrollLeft > 1,
    };
    setEdges((p) =>
      p.top === next.top &&
      p.bottom === next.bottom &&
      p.left === next.left &&
      p.right === next.right
        ? p
        : next,
    );
    pinned.current = bottomGap < 8;
    if (pinned.current) setNewBelow(false);
    const endGap =
      orientation === "horizontal"
        ? next.right
          ? n.scrollWidth - n.clientWidth - n.scrollLeft
          : 0
        : bottomGap;
    if (endGap <= endThreshold) {
      if (!reached.current) {
        reached.current = true;
        onReachEnd?.();
      }
    } else reached.current = false;
  }, [endThreshold, onReachEnd, orientation]);

  const scrollToBottom = React.useCallback((behavior: ScrollBehavior = "smooth") => {
    const n = el.current;
    if (n) n.scrollTo({ top: n.scrollHeight, behavior });
  }, []);

  React.useImperativeHandle(
    ref,
    () => ({
      scrollToBottom,
      scrollToTop: (behavior: ScrollBehavior = "smooth") =>
        el.current?.scrollTo({ top: 0, behavior }),
      get element() {
        return el.current;
      },
    }),
    [scrollToBottom],
  );

  React.useEffect(() => {
    const n = el.current;
    if (!n || typeof ResizeObserver === "undefined") {
      measure();
      return;
    }
    const ro = new ResizeObserver(() => measure());
    ro.observe(n);
    if (n.firstElementChild) ro.observe(n.firstElementChild);
    measure();
    return () => ro.disconnect();
  }, [measure]);

  React.useLayoutEffect(() => {
    if (!stickToBottom) return;
    if (pinned.current) scrollToBottom("auto");
    else setNewBelow(true);
    measure();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contentKey, stickToBottom]);

  const overflow =
    orientation === "vertical"
      ? "overflow-y-auto overflow-x-hidden"
      : orientation === "horizontal"
        ? "overflow-x-auto overflow-y-hidden"
        : "overflow-auto";

  return (
    <div className={cn("relative min-h-0", className)}>
      <div
        ref={el}
        role="region"
        aria-label={label}
        tabIndex={0}
        onScroll={measure}
        style={{ maxHeight, ...style }}
        className={cn(
          "h-full overscroll-contain rounded-[inherit] outline-none focus-visible:ring-2 focus-visible:ring-crm-primary focus-visible:ring-inset",
          "[scrollbar-color:var(--color-crm-input,#444)_transparent] [scrollbar-width:thin]",
          "[&::-webkit-scrollbar]:size-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-crm-input/70 [&::-webkit-scrollbar-track]:bg-transparent",
          overflow,
        )}
        {...props}
      >
        <div className={cn(orientation !== "vertical" && "w-max min-w-full")}>{children}</div>
      </div>
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-x-0 top-0 h-5 bg-gradient-to-b from-black/35 to-transparent transition-opacity",
          edges.top ? "opacity-100" : "opacity-0",
        )}
      />
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-x-0 bottom-0 h-5 bg-gradient-to-t from-black/35 to-transparent transition-opacity",
          edges.bottom ? "opacity-100" : "opacity-0",
        )}
      />
      {orientation !== "vertical" && (
        <>
          <span
            aria-hidden
            className={cn(
              "pointer-events-none absolute inset-y-0 left-0 w-5 bg-gradient-to-r from-black/35 to-transparent transition-opacity",
              edges.left ? "opacity-100" : "opacity-0",
            )}
          />
          <span
            aria-hidden
            className={cn(
              "pointer-events-none absolute inset-y-0 right-0 w-5 bg-gradient-to-l from-black/35 to-transparent transition-opacity",
              edges.right ? "opacity-100" : "opacity-0",
            )}
          />
        </>
      )}
      {stickToBottom && newBelow && (
        <button
          type="button"
          onClick={() => scrollToBottom()}
          className="absolute bottom-3 left-1/2 inline-flex -translate-x-1/2 cursor-pointer items-center gap-1 rounded-full bg-crm-primary px-3 py-1 font-crm text-xs font-medium text-crm-primary-fg shadow-crm-primary outline-none focus-visible:ring-2 focus-visible:ring-crm-fg [&_svg]:size-3.5"
        >
          <ArrowDown /> New activity
        </button>
      )}
    </div>
  );
});
