import * as React from "react";
import { Terminal, type ITheme } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { ensureXtermStyles } from "@/components/crm/pro-web-terminal/xterm-styles";
import { Download, Pause, Play, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CommandEntry, Recording } from "@/components/crm/pro-web-terminal/types";

export interface SessionReplayProps {
  recording: Recording;
  commands: CommandEntry[];
  theme: ITheme;
  fontSize: number;
  title: string;
  onClose: () => void;
}

const SPEEDS = [0.5, 1, 2, 4, 8];
const fmt = (ms: number) => {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};
const btn =
  "inline-flex h-7 items-center gap-1 rounded-crm border border-crm-border bg-crm-card px-2 text-xs text-crm-fg hover:bg-crm-muted focus-visible:outline-2 focus-visible:outline-crm-ring";

/** Upper bound: index of the first event with t > time (binary search). */
function upper(events: Recording["events"], time: number) {
  let lo = 0;
  let hi = events.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (events[mid]!.t <= time) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/**
 * Replays a recorded session into a read-only xterm. Scrubbing rebuilds the screen from the start
 * (xterm has no snapshots), playback streams incrementally. Exports asciicast v2 for asciinema.
 */
export function SessionReplay({
  recording,
  commands,
  theme,
  fontSize,
  title,
  onClose,
}: SessionReplayProps) {
  const host = React.useRef<HTMLDivElement>(null);
  const term = React.useRef<Terminal | null>(null);
  const cursor = React.useRef(0);
  // Snapshot so the timeline stays stable while the live session keeps producing output.
  const events = React.useMemo(() => recording.events.slice(), [recording]);
  const duration = Math.max(1, events[events.length - 1]?.t ?? 1);
  const [time, setTime] = React.useState(duration);
  const [playing, setPlaying] = React.useState(false);
  const [speed, setSpeed] = React.useState(1);

  const writeTo = React.useCallback(
    (target: number, rebuild: boolean) => {
      const t = term.current;
      if (!t) return;
      if (rebuild) {
        t.reset();
        t.resize(recording.cols, recording.rows);
        cursor.current = 0;
      }
      const end = upper(events, target);
      let chunk = "";
      for (let i = cursor.current; i < end; i++) {
        const e = events[i]!;
        if (e.kind === "o") chunk += e.data;
        else {
          if (chunk) t.write(chunk);
          chunk = "";
          t.resize(e.cols, e.rows);
        }
      }
      if (chunk) t.write(chunk);
      cursor.current = end;
    },
    [events, recording.cols, recording.rows],
  );

  React.useEffect(() => {
    if (!host.current) return;
    ensureXtermStyles(host.current.ownerDocument);
    const t = new Terminal({
      disableStdin: true,
      cursorBlink: false,
      fontSize,
      theme,
      fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
      scrollback: 5000,
    });
    t.loadAddon(new FitAddon());
    t.open(host.current);
    term.current = t;
    writeTo(duration, true);
    return () => {
      t.dispose();
      term.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Playback loop.
  React.useEffect(() => {
    if (!playing) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      setTime((prev) => {
        const next = Math.min(duration, prev + (now - last) * speed);
        writeTo(next, false);
        if (next >= duration) setPlaying(false);
        return next;
      });
      last = now;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, speed, duration, writeTo]);

  const seek = (ms: number) => {
    const target = Math.max(0, Math.min(duration, ms));
    writeTo(target, target < time || cursor.current === 0);
    setTime(target);
  };

  const exportCast = () => {
    const header = {
      version: 2,
      width: recording.cols,
      height: recording.rows,
      timestamp: Math.floor(recording.startedAt / 1000),
      title,
    };
    const lines = events.map((e) =>
      JSON.stringify(
        e.kind === "o" ? [e.t / 1000, "o", e.data] : [e.t / 1000, "r", `${e.cols}x${e.rows}`],
      ),
    );
    const blob = new Blob([[JSON.stringify(header), ...lines].join("\n")], {
      type: "application/x-asciicast",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${title.replace(/\W+/g, "-")}.cast`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  return (
    <div
      role="dialog"
      aria-label={`Replay of ${title}`}
      className="flex h-full flex-col bg-crm-card"
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
        else if (e.key === " " && e.target === e.currentTarget) {
          e.preventDefault();
          if (time >= duration) seek(0);
          setPlaying((p) => !p);
        }
      }}
    >
      <div className="min-h-0 flex-1 bg-crm-bg p-2">
        <div ref={host} className="h-full w-full overflow-hidden" />
      </div>
      <div className="space-y-2 border-t border-crm-border px-3 py-2">
        <div className="relative h-5">
          <input
            type="range"
            min={0}
            max={duration}
            step={10}
            value={time}
            aria-label="Replay position"
            aria-valuetext={`${fmt(time)} of ${fmt(duration)}`}
            onChange={(e) => {
              setPlaying(false);
              seek(Number(e.target.value));
            }}
            className="absolute inset-0 w-full accent-[var(--color-crm-primary)]"
          />
          {commands.map((c, i) => (
            <button
              key={`${c.t}-${i}`}
              type="button"
              title={`${fmt(c.t)} · ${c.command}`}
              aria-label={`Jump to ${c.command} at ${fmt(c.t)}`}
              onClick={() => seek(c.t)}
              className="absolute top-0 h-2 w-1 -translate-x-1/2 rounded-sm bg-crm-warning hover:h-3"
              style={{ left: `${(c.t / duration) * 100}%` }}
            />
          ))}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className={btn}
            aria-label={playing ? "Pause" : "Play"}
            onClick={() => {
              if (!playing && time >= duration) seek(0);
              setPlaying((p) => !p);
            }}
          >
            {playing ? (
              <Pause className="size-3.5" aria-hidden />
            ) : (
              <Play className="size-3.5" aria-hidden />
            )}
          </button>
          <span className="font-mono text-xs tabular-nums text-crm-muted-fg">
            {fmt(time)} / {fmt(duration)}
          </span>
          <div role="radiogroup" aria-label="Playback speed" className="ml-2 flex gap-1">
            {SPEEDS.map((s) => (
              <button
                key={s}
                type="button"
                role="radio"
                aria-checked={speed === s}
                onClick={() => setSpeed(s)}
                className={cn(btn, "px-1.5", speed === s && "border-crm-primary text-crm-primary")}
              >
                {s}×
              </button>
            ))}
          </div>
          <span className="flex-1" />
          <button type="button" className={btn} onClick={exportCast}>
            <Download className="size-3.5" aria-hidden />
            .cast
          </button>
          <button type="button" className={btn} onClick={onClose} aria-label="Close replay">
            <X className="size-3.5" aria-hidden />
          </button>
        </div>
      </div>
    </div>
  );
}
