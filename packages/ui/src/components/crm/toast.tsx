import * as React from "react";
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export type ToastTone = "neutral" | "success" | "warning" | "danger";

export interface ToastOptions {
  title: React.ReactNode;
  description?: React.ReactNode;
  tone?: ToastTone;
  /** Auto-dismiss after ms. 0 keeps it until closed. */
  duration?: number;
  action?: { label: string; onClick: () => void };
}

interface ToastItem extends ToastOptions {
  id: number;
}

interface ToastApi {
  toast: (t: ToastOptions) => number;
  dismiss: (id: number) => void;
}

const ToastContext = React.createContext<ToastApi | null>(null);

/** Returns `toast()` and `dismiss()`. Must be used under <ToastProvider>. */
export function useToast(): ToastApi {
  const ctx = React.useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}

const icons = {
  neutral: <Info className="text-crm-soft" />,
  success: <CheckCircle2 className="text-crm-success" />,
  warning: <AlertTriangle className="text-crm-warning" />,
  danger: <XCircle className="text-crm-danger" />,
} as const;

const positions = {
  "bottom-right": "right-4 bottom-4 items-end",
  "top-right": "top-4 right-4 items-end",
  "bottom-center": "bottom-4 left-1/2 -translate-x-1/2 items-center",
} as const;

export interface ToastProviderProps {
  children: React.ReactNode;
  position?: keyof typeof positions;
  /** Maximum toasts visible at once; oldest are dropped. */
  limit?: number;
}

/** Holds the toast queue and renders it in a polite live region. Wrap your app once. */
export function ToastProvider({
  children,
  position = "bottom-right",
  limit = 4,
}: ToastProviderProps) {
  const [items, setItems] = React.useState<ToastItem[]>([]);
  const next = React.useRef(1);
  const dismiss = React.useCallback((id: number) => {
    setItems((all) => all.filter((t) => t.id !== id));
  }, []);
  const toast = React.useCallback(
    (t: ToastOptions) => {
      const id = next.current++;
      setItems((all) => [...all, { ...t, id }].slice(-limit));
      return id;
    },
    [limit],
  );
  const api = React.useMemo(() => ({ toast, dismiss }), [toast, dismiss]);
  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        aria-live="polite"
        aria-label="Notifications"
        className={cn(
          "fixed z-[100] flex w-[min(360px,calc(100vw-2rem))] flex-col gap-2",
          positions[position],
        )}
      >
        {items.map((t) => (
          <Toast key={t.id} item={t} onClose={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function Toast({ item, onClose }: { item: ToastItem; onClose: (id: number) => void }) {
  const { id, title, description, tone = "neutral", duration = 5000, action } = item;
  const [paused, setPaused] = React.useState(false);
  React.useEffect(() => {
    if (!duration || paused) return;
    const t = setTimeout(() => onClose(id), duration);
    return () => clearTimeout(t);
  }, [duration, paused, onClose, id]);
  return (
    <div
      role={tone === "danger" ? "alert" : "status"}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose(id);
      }}
      className="flex w-full animate-crm-in items-start gap-3 rounded-xl border border-crm-border bg-crm-popover p-3 font-crm shadow-crm-overlay"
    >
      <span className="mt-px shrink-0 [&_svg]:size-4">{icons[tone]}</span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-crm-fg">{title}</p>
        {description ? <p className="mt-1 text-xs text-crm-soft">{description}</p> : null}
        {action ? (
          <button
            type="button"
            onClick={() => {
              action.onClick();
              onClose(id);
            }}
            className="mt-2 cursor-pointer rounded text-xs font-medium text-crm-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-crm-ring/60"
          >
            {action.label}
          </button>
        ) : null}
      </div>
      <button
        type="button"
        aria-label="Close notification"
        onClick={() => onClose(id)}
        className="grid size-5 shrink-0 cursor-pointer place-items-center rounded text-crm-subtle outline-none hover:text-crm-fg focus-visible:ring-2 focus-visible:ring-crm-ring/60"
      >
        <X className="size-3.5" />
      </button>
    </div>
  );
}
