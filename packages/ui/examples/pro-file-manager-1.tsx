import { useMemo, useState } from "react";
import { ProFileManager, type FileNode } from "@/components/crm/pro-file-manager";

const owners = ["Priya Sharma", "Marcus Chen", "Elena Rossi", "Tom Becker", "Aisha Khan"];
const accounts = [
  "Acme Corp",
  "Globex",
  "Initech",
  "Umbrella",
  "Stark Industries",
  "Hooli",
  "Northwind",
  "Wayne Enterprises",
];
const subfolders = ["Contracts", "Proposals", "Invoices", "Meeting notes", "Screenshots"];
const templates: [string, string, number][] = [
  ["Order_Form_v{n}.pdf", "application/pdf", 480_000],
  [
    "MSA_redline_{n}.docx",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    120_000,
  ],
  [
    "Pricing_model_{n}.xlsx",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    64_000,
  ],
  ["Usage_export_{n}.csv", "text/csv", 2_400_000],
  ["Invoice_INV-{n}.pdf", "application/pdf", 90_000],
  ["QBR_notes_{n}.md", "text/markdown", 8_000],
  ["Screenshot_{n}.png", "image/png", 1_300_000],
  ["Architecture_{n}.png", "image/png", 820_000],
  ["Call_recording_{n}.mp4", "video/mp4", 88_000_000],
  [
    "Security_questionnaire_{n}.docx",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    210_000,
  ],
];

function rng(seed: number) {
  return () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
}

function generate(total: number): FileNode[] {
  const rand = rng(7);
  const now = Date.now();
  const nodes: FileNode[] = [];
  const leafFolders: { id: string; account: string }[] = [];
  nodes.push({
    id: "accounts",
    name: "Accounts",
    parentId: null,
    kind: "folder",
    modifiedAt: now - 86_400_000,
  });
  nodes.push({
    id: "archive",
    name: "Archive 2025",
    parentId: null,
    kind: "folder",
    modifiedAt: now - 200 * 86_400_000,
  });
  nodes.push({
    id: "templates",
    name: "Templates",
    parentId: null,
    kind: "folder",
    modifiedAt: now - 30 * 86_400_000,
  });
  for (const a of accounts) {
    const aid = `acc-${a}`;
    nodes.push({
      id: aid,
      name: a,
      parentId: "accounts",
      kind: "folder",
      modifiedAt: now - rand() * 9e9,
    });
    for (const s of subfolders) {
      const id = `${aid}-${s}`;
      nodes.push({ id, name: s, parentId: aid, kind: "folder", modifiedAt: now - rand() * 9e9 });
      leafFolders.push({ id, account: a });
    }
  }
  for (let i = 0; i < total; i++) {
    const [tpl, mimeType, base] = templates[Math.floor(rand() * templates.length)]!;
    // Most files live in one big folder so the virtualised views get exercised at 10k+ items.
    const bulk = i < total * 0.7;
    const target = bulk
      ? { id: "acc-Acme Corp-Invoices", account: "Acme Corp" }
      : leafFolders[Math.floor(rand() * leafFolders.length)]!;
    const isImage = mimeType.startsWith("image/");
    nodes.push({
      id: `f-${i}`,
      name: tpl.replace("{n}", String(1000 + i)),
      parentId: rand() < 0.03 ? "archive" : target.id,
      kind: "file",
      mimeType,
      size: Math.round(base * (0.4 + rand() * 1.6)),
      modifiedAt: Math.round(now - rand() * 400 * 86_400_000),
      owner: owners[Math.floor(rand() * owners.length)],
      linkedRecord: rand() < 0.5 ? `Deal: ${target.account} renewal` : undefined,
      thumbnailUrl: isImage
        ? `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 110"><rect width="160" height="110" fill="hsl(${(i * 37) % 360} 45% 32%)"/><rect x="14" y="16" width="90" height="10" rx="3" fill="#fff" opacity=".5"/><rect x="14" y="36" width="132" height="58" rx="6" fill="#fff" opacity=".18"/></svg>`)}`
        : undefined,
    });
  }
  return nodes;
}

export default function Example() {
  const initial = useMemo(() => generate(12000), []);
  const [opened, setOpened] = useState<string | null>(null);
  return (
    <div className="w-full space-y-2 p-4">
      <ProFileManager
        defaultNodes={initial}
        defaultFolderId="acc-Acme Corp-Invoices"
        rootLabel="Drive"
        onOpenFile={(n) => setOpened(n.name)}
      />
      <p className="text-xs text-crm-muted-fg" aria-live="polite">
        {opened
          ? `Opened ${opened}`
          : "Tip: Shift/Ctrl-click to multi-select, drag onto a folder to move, F2 to rename."}
      </p>
    </div>
  );
}
