import * as React from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { cn } from "@/lib/utils";

interface HoverCardContextValue {
  open: boolean;
  show: () => void;
  hide: () => void;
}

const HoverCardContext = React.createContext<HoverCardContextValue | null>(null);

function useHoverCard() {
  const ctx = React.useContext(HoverCardContext);
  if (!ctx) throw new Error("HoverCard parts must be used inside HoverCard");
  return ctx;
}

export interface HoverCardProps {
  children: React.ReactNode;
  /** Delay before opening, ms. */
  openDelay?: number;
  /** Delay before closing, ms; lets the pointer travel into the card. */
  closeDelay?: number;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

/** Record preview that opens on hover or keyboard focus of the trigger and stays open
 *  while the pointer is over the card. Esc closes it. For supplementary info only:
 *  anything essential must also be reachable without hovering. */
export function HoverCard({
  children,
  openDelay = 400,
  closeDelay = 200,
  open,
  onOpenChange,
}: HoverCardProps) {
  const [inner, setInner] = React.useState(false);
  const isOpen = open ?? inner;
  const timer = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const set = React.useCallback(
    (next: boolean) => {
      if (open === undefined) setInner(next);
      onOpenChange?.(next);
    },
    [open, onOpenChange],
  );

  const schedule = React.useCallback(
    (next: boolean, delay: number) => {
      clearTimeout(timer.current);
      timer.current = setTimeout(() => set(next), delay);
    },
    [set],
  );

  React.useEffect(() => () => clearTimeout(timer.current), []);

  const value = React.useMemo(
    () => ({
      open: isOpen,
      show: () => schedule(true, openDelay),
      hide: () => schedule(false, closeDelay),
    }),
    [isOpen, schedule, openDelay, closeDelay],
  );

  return (
    <HoverCardContext.Provider value={value}>
      <PopoverPrimitive.Root
        open={isOpen}
        onOpenChange={(o) => {
          clearTimeout(timer.current);
          set(o);
        }}
      >
        {children}
      </PopoverPrimitive.Root>
    </HoverCardContext.Provider>
  );
}

/** Wraps the element that triggers the card (usually a link). Rendered with asChild. */
export function HoverCardTrigger({ children }: { children: React.ReactElement }) {
  const { show, hide } = useHoverCard();
  return (
    <PopoverPrimitive.Anchor asChild>
      <span
        className="inline-flex"
        onPointerEnter={(e) => {
          if (e.pointerType === "mouse") show();
        }}
        onPointerLeave={(e) => {
          if (e.pointerType === "mouse") hide();
        }}
        onFocus={show}
        onBlur={hide}
      >
        {children}
      </span>
    </PopoverPrimitive.Anchor>
  );
}

export interface HoverCardContentProps extends React.ComponentPropsWithoutRef<
  typeof PopoverPrimitive.Content
> {
  arrow?: boolean;
}

export const HoverCardContent = React.forwardRef<
  React.ElementRef<typeof PopoverPrimitive.Content>,
  HoverCardContentProps
>(function HoverCardContent(
  { className, arrow, children, sideOffset = 8, align = "start", ...props },
  ref,
) {
  const { show, hide } = useHoverCard();
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        ref={ref}
        sideOffset={sideOffset}
        align={align}
        // Keep focus on the trigger: a hover card is a preview, not a dialog.
        onOpenAutoFocus={(e) => e.preventDefault()}
        onCloseAutoFocus={(e) => e.preventDefault()}
        onPointerEnter={show}
        onPointerLeave={hide}
        className={cn(
          "z-50 w-[300px] max-w-[calc(100vw-2rem)] rounded-xl border border-crm-border bg-crm-popover p-4 font-crm text-crm-fg shadow-crm-overlay outline-none data-[state=open]:animate-crm-in",
          className,
        )}
        {...props}
      >
        {children}
        {arrow ? (
          <PopoverPrimitive.Arrow width={12} height={6} className="fill-crm-popover" />
        ) : null}
      </PopoverPrimitive.Content>
    </PopoverPrimitive.Portal>
  );
});
