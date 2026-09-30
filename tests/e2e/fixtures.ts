/** Shared by the e2e server and the specs. Test-only values: they never reach a real database. */
export const E2E_PORT = Number(process.env.E2E_PORT ?? 4100);
export const E2E_ORIGIN = `http://localhost:${E2E_PORT}`;
/** Fixed: PreviewFrame bakes http://localhost:5185 into the build when VITE_PREVIEW_ORIGIN is unset. */
export const PREVIEW_ORIGIN = "http://localhost:5185";

export const ADMIN = { username: "e2e-admin", password: "e2e-admin-password-123" };

/** Seeded in memory as published. */
export const FREE_SLUG = "stat-card";
export const FREE_NAME = "Stat Card";
export const PREMIUM_SLUG = "command-palette";
export const PREMIUM_NAME = "Command Palette";
/** Seeded as a draft only; the admin spec publishes it. */
export const DRAFT_SLUG = "avatar";
export const DRAFT_NAME = "Avatar";
