import * as React from "react";
import { Paperclip } from "lucide-react";
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
    url: "https://invalid.example/whiteboard.jpg",
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

export default function Example() {
  const [open, setOpen] = React.useState(false);
  const [index, setIndex] = React.useState(0);
  return (
    <div className="w-full max-w-[520px] font-crm">
      <p className="crm-eyebrow mb-2 text-[11px] text-crm-faint">Attachments · Acme Logistics</p>
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {files.map((f, i) => (
          <li key={f.id}>
            <button
              type="button"
              onClick={() => {
                setIndex(i);
                setOpen(true);
              }}
              className="flex w-full cursor-pointer flex-col overflow-hidden rounded-xl border border-crm-border bg-crm-card text-left outline-none hover:border-crm-input focus-visible:ring-2 focus-visible:ring-crm-ring/60"
            >
              <span className="grid h-20 place-items-center bg-crm-raised">
                {f.kind === "image" ? (
                  <img src={f.url} alt="" className="size-full object-cover" />
                ) : (
                  <Paperclip className="size-5 text-crm-soft" />
                )}
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
