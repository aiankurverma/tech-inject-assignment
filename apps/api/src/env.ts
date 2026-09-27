import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().default(4000),
  MONGODB_URI: z.string().min(1).default("mongodb://127.0.0.1:27017/techinject"),
  /** Public origin of this server, used in install commands and prompts. */
  PUBLIC_ORIGIN: z.string().url().default("http://localhost:4000"),
  /** Separate origin that renders previews (sandboxed iframe). */
  PREVIEW_ORIGIN: z.string().url().default("http://localhost:5185"),
  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters"),
  ADMIN_USERNAME: z.string().min(3),
  ADMIN_PASSWORD: z.string().min(12, "ADMIN_PASSWORD must be at least 12 characters"),
  /** Extra origins allowed to call write endpoints (dev servers). Comma separated. */
  TRUSTED_ORIGINS: z.string().default("http://localhost:5183,http://localhost:5184"),
  /** Bundle uploads larger than this (bytes) are validated and saved by a background job. */
  QUEUE_THRESHOLD_BYTES: z.coerce.number().int().positive().default(200_000),
  /** Optional: ping PUBLIC_ORIGIN/api/health every N minutes so a free host does not idle-sleep. */
  KEEP_ALIVE_MINUTES: z.preprocess(
    (v) => (v === "" ? undefined : v),
    z.coerce.number().int().min(1).max(14).optional(),
  ),
});

export type Env = z.infer<typeof schema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = schema.safeParse(source);
  if (!parsed.success) {
    const problems = parsed.error.issues
      .map((i) => `  ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid environment variables:\n${problems}`);
  }
  // The localhost default is for development only; in production it would hide a missing setting.
  if (parsed.data.NODE_ENV === "production" && !source.MONGODB_URI) {
    throw new Error("Invalid environment variables:\n  MONGODB_URI: Required in production");
  }
  return parsed.data;
}
