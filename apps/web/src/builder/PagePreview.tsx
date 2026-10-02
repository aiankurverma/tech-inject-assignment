import { useEffect, useRef, useState } from "react";
import { MonitorSmartphone, Palette } from "lucide-react";
import { Link } from "react-router-dom";
import { PreviewFrame, type PreviewPayload } from "@ti/client";

/** Fills its panel with the sandboxed preview; the frame height follows the panel size. */
export function PagePreview({
  payload,
  empty,
  pending,
  failed,
  themeCss,
  themeName,
}: {
  payload: PreviewPayload | null;
  empty: boolean;
  pending: string[];
  failed: { slug: string; message: string }[];
  /** Theme Studio `@theme` block and the theme's name shown in the toolbar. */
  themeCss?: string;
  themeName?: string;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(320);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      if (entry) setHeight(Math.max(120, Math.floor(entry.contentRect.height)));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-8 shrink-0 items-center gap-2 border-b border-border px-3 text-xs text-muted-foreground">
        <MonitorSmartphone className="size-3.5" aria-hidden />
        <span className="font-medium text-foreground">Live preview</span>
        {pending.length ? (
          <span>
            Loading {pending.length} component{pending.length === 1 ? "" : "s"}...
          </span>
        ) : null}
        {failed.length ? (
          <span
            className="truncate text-red-700 dark:text-red-300"
            title={failed.map((f) => `${f.slug}: ${f.message}`).join("\n")}
          >
            {failed.length} unavailable: {failed.map((f) => f.slug).join(", ")}
          </span>
        ) : null}
        {themeName ? (
          <Link
            to="/theme"
            className="ml-auto inline-flex items-center gap-1 truncate hover:text-foreground"
          >
            <Palette className="size-3.5" aria-hidden />
            Theme: {themeName}
          </Link>
        ) : null}
      </div>
      <div ref={box} className="min-h-0 flex-1">
        {empty ? (
          <div className="flex h-full items-center justify-center bg-[#161616] p-6 text-center text-xs text-neutral-400">
            Add a component to see the page rendered with the CRM theme.
          </div>
        ) : (
          <PreviewFrame
            payload={payload}
            example={0}
            height={height}
            title="Page preview"
            frameClassName="rounded-none border-0"
            themeCss={themeCss}
          />
        )}
      </div>
    </div>
  );
}
