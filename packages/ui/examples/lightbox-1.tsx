import * as React from "react";
import { Expand, ImageOff, Paperclip } from "lucide-react";
import { Lightbox, formatBytes, type LightboxFile } from "@/components/crm/lightbox";

// Inline SVG "photos" so the example works offline.
function svg(title: string, lines: string[], hue: number) {
  const body = lines
    .map(
      (l, i) =>
        `<text x="48" y="${170 + i * 44}" font-size="26" fill="#cfcfcf" font-family="sans-serif">${l}</text>`,
    )
    .join("");
  return `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800"><rect width="1200" height="800" fill="hsl(${hue} 25% 14%)"/><text x="48" y="100" font-size="44" font-weight="700" fill="#f9fbff" font-family="sans-serif">${title}</text>${body}</svg>`,
  )}`;
}

const files: LightboxFile[] = [
  {
    id: "f1",
    name: "site-survey-dock-3.jpg",
    kind: "image",
    url: svg("Site survey — Dock 3", ["Chicago DC · 14 bays", "Photo by Priya Raman"], 220),
    size: 2_480_133,
    uploadedBy: "Priya Raman",
    uploadedAt: "2026-09-18",
  },
  {
    id: "f2",
    name: "signed-order-form.png",
    kind: "image",
    url: svg("Order form #SO-2291", ["Fleet tracking · 120 units", "Total $62,500.00"], 150),
    size: 812_004,
    uploadedBy: "Maya Chen",
    uploadedAt: "2026-09-20",
  },
  {
    id: "f3",
    name: "whiteboard-architecture.jpg",
    kind: "image",
    url: svg(
      "Whiteboard — architecture",
      ["Ingest → Queue → Rules engine", "Webhooks to ERP · 2 regions"],
      280,
    ),
    size: 3_120_550,
    uploadedBy: "Tom Becker",
    uploadedAt: "2026-09-21",
  },
  {
    id: "f4",
    name: "pricing-model-v4.xlsx",
    kind: "other",
    url: "data:text/csv;charset=utf-8,sku,units,price%0AFT-100,120,520.83",
    size: 48_900,
    uploadedBy: "Arjun Patel",
    uploadedAt: "2026-09-22",
  },
];

function Thumb({ file, className }: { file: LightboxFile; className?: string }) {
  const [broken, setBroken] = React.useState(false);
  if (file.kind !== "image") return <Paperclip className="size-6 text-crm-soft" aria-hidden />;
  if (broken) return <ImageOff className="size-6 text-crm-subtle" aria-hidden />;
  return (
    <img
      src={file.thumbUrl ?? file.url}
      alt=""
      onError={() => setBroken(true)}
      className={className ?? "size-full object-cover"}
    />
  );
}

export default function Example() {
  const [open, setOpen] = React.useState(false);
  const [index, setIndex] = React.useState(0);
  const current = files[index] ?? files[0]!;
  return (
    <div className="flex w-full max-w-[640px] flex-col gap-3 font-crm text-crm-fg">
      <div className="flex items-center justify-between">
        <p className="crm-eyebrow text-crm-subtle">Attachments · Acme Logistics</p>
        <span className="text-xs text-crm-subtle">{files.length} files</span>
      </div>
      <div className="overflow-hidden rounded-crm border border-crm-border bg-crm-card shadow-crm-raised">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={`Open ${current.name} in viewer`}
          className="group relative grid aspect-[3/2] w-full cursor-zoom-in place-items-center bg-crm-raised outline-none focus-visible:ring-2 focus-visible:ring-crm-ring/60 focus-visible:ring-inset"
        >
          <Thumb file={current} className="size-full object-contain" />
          <span className="absolute right-3 bottom-3 inline-flex items-center gap-1.5 rounded-full border border-crm-border bg-crm-card/90 px-2.5 py-1 text-xs text-crm-fg">
            <Expand className="size-3.5" aria-hidden /> Open viewer
          </span>
        </button>
        <div className="flex items-center justify-between gap-3 border-t border-crm-border px-3 py-2">
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium">{current.name}</span>
            <span className="text-[11px] text-crm-subtle">
              {formatBytes(current.size)} · {current.uploadedBy}
            </span>
          </span>
          <span className="shrink-0 text-xs text-crm-subtle tabular-nums">
            {index + 1} / {files.length}
          </span>
        </div>
      </div>
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {files.map((f, i) => (
          <li key={f.id} className="min-w-0">
            <button
              type="button"
              aria-pressed={i === index}
              onClick={() => setIndex(i)}
              onDoubleClick={() => {
                setIndex(i);
                setOpen(true);
              }}
              className="flex w-full cursor-pointer flex-col overflow-hidden rounded-crm border border-crm-border bg-crm-card text-left outline-none hover:border-crm-faint focus-visible:ring-2 focus-visible:ring-crm-ring/60 aria-[pressed=true]:border-crm-primary"
            >
              <span className="grid h-24 place-items-center overflow-hidden bg-crm-raised">
                <Thumb file={f} />
              </span>
              <span className="truncate px-2 pt-1.5 text-xs text-crm-fg">{f.name}</span>
              <span className="px-2 pb-1.5 text-[11px] text-crm-subtle">{formatBytes(f.size)}</span>
            </button>
          </li>
        ))}
      </ul>
      <Lightbox
        files={files}
        open={open}
        onOpenChange={setOpen}
        index={index}
        onIndexChange={setIndex}
      />
    </div>
  );
}
