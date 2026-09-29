/** A running shell connection (WebSocket PTY, WebContainer, SSH bridge, or the built-in demo). */
export interface ShellSession {
  /** Send user keystrokes / pasted text to the shell. */
  write(data: string): void;
  /** Subscribe to shell output. Returns an unsubscribe function. */
  onOutput(listener: (data: string) => void): () => void;
  /** Called after fit-on-resize so a PTY backend can SIGWINCH. */
  resize?(cols: number, rows: number): void;
  dispose(): void;
}

export type ShellFactory = (ctx: { id: string; cols: number; rows: number }) => ShellSession;

/** One output chunk or resize, timestamped relative to the session start (ms). */
export type RecordedEvent =
  { t: number; kind: "o"; data: string } | { t: number; kind: "r"; cols: number; rows: number };

export interface CommandEntry {
  command: string;
  sessionId: string;
  /** Epoch ms. */
  at: number;
  /** Offset into the recording (ms). */
  t: number;
}

export interface Recording {
  startedAt: number;
  cols: number;
  rows: number;
  events: RecordedEvent[];
}
