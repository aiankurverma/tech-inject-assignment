import * as React from "react";
import { AudioLines, FileWarning, Gauge } from "lucide-react";
import { useObjectUrl } from "@/hooks/use-object-url";
import type { PreviewFile } from "@/components/crm/pro-file-preview/types";
import { Toolbar, ViewerMessage } from "@/components/crm/pro-file-preview/toolbar";

const RATES = [0.5, 0.75, 1, 1.25, 1.5, 2];

/** Native <video>/<audio> with playback-rate control; the browser supplies accessible controls. */
export function MediaViewer({ file, kind }: { file: PreviewFile; kind: "video" | "audio" }) {
  const url = useObjectUrl(file.src, file.mimeType);
  const ref = React.useRef<HTMLVideoElement & HTMLAudioElement>(null);
  const [rate, setRate] = React.useState(1);
  const [error, setError] = React.useState(false);

  React.useEffect(() => setError(false), [url]);
  React.useEffect(() => {
    if (ref.current) ref.current.playbackRate = rate;
  }, [rate, url]);

  if (!url || error)
    return (
      <ViewerMessage
        icon={<FileWarning className="h-8 w-8" />}
        title={url ? "This media could not be played" : "No media source"}
        detail="The codec may not be supported by this browser. Download the file to play it locally."
      />
    );

  return (
    <div className="flex h-full min-h-0 flex-col">
      <Toolbar label="Playback controls">
        <Gauge className="ml-1 h-4 w-4 text-crm-muted-fg" aria-hidden />
        <label className="flex items-center gap-2 text-xs text-crm-muted-fg">
          Speed
          <select
            value={rate}
            onChange={(e) => setRate(Number(e.target.value))}
            className="h-7 rounded-crm border border-crm-input bg-crm-bg px-1.5 text-xs text-crm-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-crm-ring"
          >
            {RATES.map((r) => (
              <option key={r} value={r}>
                {r}x
              </option>
            ))}
          </select>
        </label>
      </Toolbar>
      <div className="flex min-h-0 flex-1 items-center justify-center bg-crm-bg p-4">
        {kind === "video" ? (
          <video
            ref={ref}
            key={url}
            src={url}
            controls
            playsInline
            preload="metadata"
            poster={file.thumbnail}
            onError={() => setError(true)}
            className="max-h-full max-w-full rounded-crm shadow-crm-raised"
          >
            <track kind="captions" />
          </video>
        ) : (
          <div className="flex w-full max-w-lg flex-col items-center gap-5 rounded-crm border border-crm-border bg-crm-card p-8 shadow-crm-raised">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-crm-muted">
              <AudioLines className="h-9 w-9 text-crm-icon" aria-hidden />
            </div>
            <p className="max-w-full truncate text-sm font-medium text-crm-fg">{file.name}</p>
            <audio
              ref={ref}
              key={url}
              src={url}
              controls
              preload="metadata"
              onError={() => setError(true)}
              className="w-full"
            />
          </div>
        )}
      </div>
    </div>
  );
}
