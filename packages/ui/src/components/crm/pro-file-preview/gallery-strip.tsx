import * as React from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { File, FileCode2, FileText, Film, Image as ImageIcon, Music } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  detectKind,
  extensionOf,
  type PreviewFile,
  type PreviewKind,
} from "@/components/crm/pro-file-preview/types";

const ICONS: Record<PreviewKind, React.ComponentType<{ className?: string }>> = {
  pdf: FileText,
  image: ImageIcon,
  code: FileCode2,
  video: Film,
  audio: Music,
  unknown: File,
};

const ITEM = 72;

/** Horizontally virtualised thumbnail strip: stays smooth with thousands of attachments. */
export function GalleryStrip({
  files,
  index,
  onSelect,
}: {
  files: PreviewFile[];
  index: number;
  onSelect: (i: number) => void;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  const v = useVirtualizer({
    horizontal: true,
    count: files.length,
    getScrollElement: () => ref.current,
    estimateSize: () => ITEM + 8,
    overscan: 6,
    paddingStart: 8,
    paddingEnd: 8,
  });

  React.useEffect(() => {
    v.scrollToIndex(index, { align: "auto" });
  }, [index, v]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    const map: Record<string, number> = {
      ArrowRight: index + 1,
      ArrowLeft: index - 1,
      Home: 0,
      End: files.length - 1,
    };
    if (!(e.key in map)) return;
    e.preventDefault();
    e.stopPropagation();
    const next = Math.max(0, Math.min(files.length - 1, map[e.key]!));
    onSelect(next);
    requestAnimationFrame(() =>
      ref.current?.querySelector<HTMLButtonElement>(`[data-index="${next}"]`)?.focus(),
    );
  };

  return (
    <div
      ref={ref}
      className="h-[92px] shrink-0 overflow-x-auto overflow-y-hidden border-t border-crm-border bg-crm-card"
    >
      <div
        role="tablist"
        aria-label="Files"
        aria-orientation="horizontal"
        onKeyDown={onKeyDown}
        className="relative h-full"
        style={{ width: v.getTotalSize() }}
      >
        {v.getVirtualItems().map((item) => {
          const f = files[item.index]!;
          const kind = detectKind(f);
          const Icon = ICONS[kind];
          const selected = item.index === index;
          const thumb =
            f.thumbnail ?? (kind === "image" && typeof f.src === "string" ? f.src : undefined);
          return (
            <button
              key={item.key}
              type="button"
              role="tab"
              data-index={item.index}
              aria-selected={selected}
              tabIndex={selected ? 0 : -1}
              title={f.name}
              onClick={() => onSelect(item.index)}
              className={cn(
                "absolute top-2 flex flex-col items-center gap-1 rounded-crm p-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-crm-ring",
                selected ? "bg-crm-muted" : "hover:bg-crm-muted",
              )}
              style={{ left: item.start, width: ITEM }}
            >
              <span
                className={cn(
                  "flex h-12 w-16 items-center justify-center overflow-hidden rounded-[4px] border bg-crm-bg",
                  selected ? "border-crm-primary" : "border-crm-border",
                )}
              >
                {thumb ? (
                  <img src={thumb} alt="" loading="lazy" className="h-full w-full object-cover" />
                ) : (
                  <span className="flex flex-col items-center">
                    <Icon className="h-5 w-5 text-crm-icon" />
                    <span className="mt-0.5 font-mono text-[9px] uppercase text-crm-muted-fg">
                      {extensionOf(f.name).slice(0, 4)}
                    </span>
                  </span>
                )}
              </span>
              <span className="w-full truncate text-center text-[10px] text-crm-muted-fg">
                {f.name}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export { ICONS as KIND_ICONS };
