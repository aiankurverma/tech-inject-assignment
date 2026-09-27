import { useState } from "react";
import { cn } from "./ui";

const initials = (name: string) =>
  name
    .split(/[\s-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

/**
 * Small lazy thumbnail. Initials always sit underneath, so a slow, missing or
 * broken image never leaves an empty box; the image fades in once it loads.
 */
export function Thumb({
  slug,
  name,
  className,
}: {
  slug: string;
  name: string;
  className?: string;
}) {
  const [state, setState] = useState<"loading" | "loaded" | "failed">("loading");
  return (
    <span
      className={cn(
        "relative flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-muted",
        className,
      )}
    >
      <span aria-hidden className="text-[11px] font-semibold tracking-tight text-muted-foreground">
        {initials(name)}
      </span>
      {state === "failed" ? null : (
        <img
          src={`/api/admin/components/${encodeURIComponent(slug)}/thumbnail`}
          alt=""
          loading="lazy"
          decoding="async"
          onLoad={() => setState("loaded")}
          onError={() => setState("failed")}
          className={cn(
            "absolute inset-0 size-full bg-neutral-950 object-contain p-0.5 transition-opacity duration-300",
            state === "loaded" ? "opacity-100" : "opacity-0",
          )}
        />
      )}
    </span>
  );
}
