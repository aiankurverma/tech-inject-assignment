type Level = "info" | "warn" | "error";

/** JSON lines logger. Never pass secrets, tokens, cookies or request bodies here. */
function write(level: Level, msg: string, fields: Record<string, unknown> = {}) {
  if (process.env.NODE_ENV === "test" && level === "info") return;
  const line = JSON.stringify({ t: new Date().toISOString(), level, msg, ...fields });
  (level === "error" ? console.error : console.log)(line);
}

export const log = {
  info: (msg: string, fields?: Record<string, unknown>) => write("info", msg, fields),
  warn: (msg: string, fields?: Record<string, unknown>) => write("warn", msg, fields),
  error: (msg: string, fields?: Record<string, unknown>) => write("error", msg, fields),
};
