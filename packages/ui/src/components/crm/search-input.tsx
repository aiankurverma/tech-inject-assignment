import * as React from "react";
import { Loader2, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Kbd } from "@/components/crm/kbd";

export interface SearchInputProps extends Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "type" | "size" | "value" | "defaultValue"
> {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  /** Called on Enter with the current query. */
  onSearch?: (value: string) => void;
  /** Key that focuses the field from anywhere with Cmd/Ctrl, e.g. "k". Also shown as a hint. */
  shortcut?: string;
  loading?: boolean;
  size?: "sm" | "md";
  /** "subtle" hides the border until hover/focus, for toolbars. */
  variant?: "default" | "subtle";
}

/** Search field with icon, clear button, Esc-to-clear, loading state and an optional global Cmd/Ctrl shortcut. */
export const SearchInput = React.forwardRef<HTMLInputElement, SearchInputProps>(
  function SearchInput(
    {
      value: valueProp,
      defaultValue = "",
      onValueChange,
      onChange,
      onSearch,
      shortcut,
      loading,
      size = "md",
      variant = "default",
      placeholder = "Search",
      disabled,
      className,
      onKeyDown,
      ...props
    },
    ref,
  ) {
    const [inner, setInner] = React.useState(defaultValue);
    const value = valueProp ?? inner;
    const localRef = React.useRef<HTMLInputElement>(null);
    React.useImperativeHandle(ref, () => localRef.current as HTMLInputElement);
    const [isMac, setIsMac] = React.useState(false);

    React.useEffect(() => {
      setIsMac(/Mac|iPhone|iPad/.test(navigator.userAgent));
      if (!shortcut) return;
      const onKey = (e: KeyboardEvent) => {
        if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === shortcut.toLowerCase()) {
          e.preventDefault();
          localRef.current?.focus();
          localRef.current?.select();
        }
      };
      window.addEventListener("keydown", onKey);
      return () => window.removeEventListener("keydown", onKey);
    }, [shortcut]);

    const update = (v: string) => {
      if (valueProp === undefined) setInner(v);
      onValueChange?.(v);
    };

    return (
      <div
        className={cn(
          "flex w-full items-center gap-2 rounded-crm border px-2.5 font-crm",
          "transition-[border-color,box-shadow,background-color] duration-150 ease-crm",
          "focus-within:border-crm-ring focus-within:bg-crm-raised focus-within:ring-2 focus-within:ring-crm-ring/40",
          variant === "default"
            ? "border-crm-input/60 bg-crm-raised hover:border-crm-input"
            : "border-transparent bg-transparent hover:bg-crm-raised",
          size === "sm" ? "h-8" : "h-9",
          disabled && "cursor-not-allowed opacity-50",
          className,
        )}
      >
        {loading ? (
          <Loader2 aria-hidden className="size-3.5 shrink-0 animate-spin text-crm-subtle" />
        ) : (
          <Search aria-hidden className="size-3.5 shrink-0 text-crm-subtle" />
        )}
        <input
          ref={localRef}
          type="search"
          autoComplete="off"
          aria-busy={loading || undefined}
          aria-keyshortcuts={
            shortcut ? `${isMac ? "Meta" : "Control"}+${shortcut.toUpperCase()}` : undefined
          }
          disabled={disabled}
          placeholder={placeholder}
          value={value}
          onChange={(e) => {
            update(e.target.value);
            onChange?.(e);
          }}
          onKeyDown={(e) => {
            onKeyDown?.(e);
            if (e.defaultPrevented) return;
            if (e.key === "Enter") onSearch?.(value);
            if (e.key === "Escape" && value) {
              e.preventDefault();
              update("");
            }
          }}
          className="min-w-0 flex-1 bg-transparent text-sm text-crm-fg outline-none placeholder:text-crm-subtle disabled:cursor-not-allowed [&::-webkit-search-cancel-button]:appearance-none"
          {...props}
        />
        {value ? (
          <button
            type="button"
            aria-label="Clear search"
            disabled={disabled}
            onClick={() => {
              update("");
              localRef.current?.focus();
            }}
            className="grid size-5 shrink-0 cursor-pointer place-items-center rounded-full text-crm-subtle outline-none hover:bg-crm-muted hover:text-crm-fg focus-visible:ring-2 focus-visible:ring-crm-ring/60 [&_svg]:size-3"
          >
            <X />
          </button>
        ) : shortcut ? (
          <span aria-hidden className="flex shrink-0 gap-0.5">
            <Kbd>{isMac ? "⌘" : "Ctrl"}</Kbd>
            <Kbd>{shortcut.toUpperCase()}</Kbd>
          </span>
        ) : null}
      </div>
    );
  },
);
