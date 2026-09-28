import * as React from "react";
import { ImageOff } from "lucide-react";
import { cn } from "@/lib/utils";

/** Parses 16/9, "16:9", "16/9" or "4x3" into a number. Falls back to 1 on bad input. */
export function parseRatio(ratio: number | string): number {
  if (typeof ratio === "number") return ratio > 0 && Number.isFinite(ratio) ? ratio : 1;
  const [w = NaN, h = NaN] = ratio.split(/[:/x]/).map((n) => parseFloat(n));
  return w > 0 && h > 0 ? w / h : 1;
}

export interface AspectRatioProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "children"> {
  /** Width / height, e.g. 16/9, "4:3", "1:1". */
  ratio?: number | string;
  /** Arbitrary content (video, map, chart). Ignored when `src` is set. */
  children?: React.ReactNode;
  /** Image mode: shows a skeleton while loading and a fallback on error. */
  src?: string;
  alt?: string;
  fit?: "cover" | "contain";
  /** Rendered instead of the default broken-image state. */
  fallback?: React.ReactNode;
  /** Small overlay in the corner, e.g. duration "3:24" or "PDF". */
  badge?: React.ReactNode;
}

/** Fixed-ratio media box that reserves space before content loads (no layout shift). */
export function AspectRatio({
  ratio = 16 / 9,
  children,
  src,
  alt = "",
  fit = "cover",
  fallback,
  badge,
  className,
  style,
  ...props
}: AspectRatioProps) {
  const [state, setState] = React.useState<"loading" | "loaded" | "error">("loading");
  const imgRef = React.useRef<HTMLImageElement>(null);

  React.useEffect(() => {
    setState("loading");
    // Cached images may already be complete before React attaches onLoad.
    const img = imgRef.current;
    if (img?.complete) setState(img.naturalWidth > 0 ? "loaded" : "error");
  }, [src]);

  return (
    <div
      style={{ aspectRatio: String(parseRatio(ratio)), ...style }}
      className={cn(
        "relative w-full overflow-hidden rounded-crm border border-crm-border bg-crm-muted",
        className,
      )}
      {...props}
    >
      {src ? (
        <>
          {state !== "error" && (
            <img
              ref={imgRef}
              src={src}
              alt={alt}
              loading="lazy"
              decoding="async"
              onLoad={() => setState("loaded")}
              onError={() => setState("error")}
              className={cn(
                "absolute inset-0 size-full transition-opacity duration-300",
                fit === "cover" ? "object-cover" : "object-contain",
                state === "loaded" ? "opacity-100" : "opacity-0",
              )}
            />
          )}
          {state === "loading" && (
            <div
              aria-hidden
              className="absolute inset-0 animate-pulse bg-crm-raised motion-reduce:animate-none"
            />
          )}
          {state === "error" &&
            (fallback ?? (
              <div
                role="img"
                aria-label={alt ? `${alt} (unavailable)` : "Image unavailable"}
                className="absolute inset-0 grid place-items-center text-crm-subtle"
              >
                <div className="flex flex-col items-center gap-1 text-xs">
                  <ImageOff className="size-5" aria-hidden />
                  <span>Image unavailable</span>
                </div>
              </div>
            ))}
        </>
      ) : (
        <div className="absolute inset-0 [&>*]:size-full">{children}</div>
      )}
      {badge != null && (
        <span className="absolute right-2 bottom-2 rounded-md bg-black/70 px-1.5 py-0.5 font-crm text-[11px] font-medium text-white tabular-nums">
          {badge}
        </span>
      )}
    </div>
  );
}
