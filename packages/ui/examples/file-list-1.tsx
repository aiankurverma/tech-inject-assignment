import * as React from "react";
import { FileList, type FileItem } from "@/components/crm/file-list";

const initial: FileItem[] = [
  {
    id: "f1",
    name: "Acme_MSA_v4_redlined.pdf",
    size: 1_842_331,
    uploadedAt: "2026-09-01T10:12",
    uploadedBy: "Priya S.",
  },
  {
    id: "f2",
    name: "Q3 pricing model.xlsx",
    size: 284_120,
    uploadedAt: "2026-08-29T16:40",
    uploadedBy: "Marcus W.",
  },
  {
    id: "f3",
    name: "Security questionnaire (SIG Lite).docx",
    size: 96_400,
    uploadedAt: "2026-08-22T09:05",
    uploadedBy: "Aisha K.",
  },
  {
    id: "f4",
    name: "Kickoff deck.pptx",
    size: 12_902_553,
    uploadedAt: "2026-08-18T13:30",
    uploadedBy: "Priya S.",
  },
  {
    id: "f5",
    name: "whiteboard-architecture.png",
    size: 2_310_442,
    mimeType: "image/png",
    uploadedAt: "2026-08-15T11:00",
  },
  {
    id: "f6",
    name: "call-recording-2026-09-02.mp4",
    size: 184_220_000,
    status: "uploading",
    progress: 42,
  },
  {
    id: "f7",
    name: "legacy-export.zip",
    size: 58_000_000,
    status: "error",
    error: "Exceeds the 50 MB workspace limit",
  },
];

export default function Example() {
  const [files, setFiles] = React.useState(initial);
  const [log, setLog] = React.useState("");
  const remove = (ids: string[]) => setFiles((fs) => fs.filter((f) => !ids.includes(f.id)));
  return (
    <div className="flex max-w-xl flex-col gap-2">
      <FileList
        files={files}
        selectable
        onOpen={(f) => setLog(`Previewing ${f.name}`)}
        onDownload={(f) => setLog(`Downloading ${f.name}`)}
        onRemove={(f) => remove([f.id])}
        onRetry={(f) =>
          setFiles((fs) =>
            fs.map((x) => (x.id === f.id ? { ...x, status: "uploading", progress: 5 } : x)),
          )
        }
        onBulkDownload={(fs) => setLog(`Zipping ${fs.length} files`)}
        onBulkRemove={(fs) => remove(fs.map((f) => f.id))}
      />
      <p className="text-xs text-crm-muted-fg" aria-live="polite">
        {log}
      </p>
    </div>
  );
}
