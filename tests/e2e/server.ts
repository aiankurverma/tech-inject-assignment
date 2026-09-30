/**
 * API for the e2e suite: an in-memory MongoDB (mongodb-memory-server), a tiny seed, and the
 * real Express app serving the built catalogue (/) and admin (/admin). Never touches Atlas.
 * Playwright starts it (see playwright.config.ts); run alone with `npx tsx tests/e2e/server.ts`.
 */
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import {
  ADMIN,
  DRAFT_SLUG,
  E2E_ORIGIN,
  E2E_PORT,
  FREE_SLUG,
  PREMIUM_SLUG,
  PREVIEW_ORIGIN,
} from "./fixtures";

const mongo = await MongoMemoryServer.create();

// Set before the app modules read process.env. No REDIS_URL: cache, queues and limits use memory.
Object.assign(process.env, {
  NODE_ENV: "test",
  PORT: String(E2E_PORT),
  MONGODB_URI: mongo.getUri("kitbase-e2e"),
  PUBLIC_ORIGIN: E2E_ORIGIN,
  PREVIEW_ORIGIN,
  JWT_SECRET: "e2e-only-jwt-secret-not-used-anywhere-else",
  ADMIN_USERNAME: ADMIN.username,
  ADMIN_PASSWORD: ADMIN.password,
  TRUSTED_ORIGINS: E2E_ORIGIN,
});
delete process.env.REDIS_URL;
delete process.env.KEEP_ALIVE_MINUTES;

const { loadEnv } = await import("../../apps/api/src/config/env");
const { createApp } = await import("../../apps/api/src/app");
const { loadTheme } = await import("../../apps/api/src/services/theme");
const { loadRepoBundles } = await import("../../apps/api/src/seed");
const { ComponentModel } = await import("../../apps/api/src/models");

const env = loadEnv();
await mongoose.connect(env.MONGODB_URI);

// Lean seed: three registry components, one left as an unpublished draft.
const wanted = new Set([FREE_SLUG, PREMIUM_SLUG, DRAFT_SLUG]);
const now = new Date();
for (const b of loadRepoBundles().filter((b) => wanted.has(b.slug))) {
  await ComponentModel.create(
    b.slug === DRAFT_SLUG
      ? { slug: b.slug, status: "draft", draft: b }
      : { slug: b.slug, status: "published", draft: b, published: b, publishedAt: now },
  );
}

const app = createApp(env, loadTheme());
const server = app.listen(E2E_PORT, () => console.log(`e2e api ready on ${E2E_ORIGIN}`));

const shutdown = () =>
  server.close(async () => {
    await app.shutdown();
    await mongoose.disconnect();
    await mongo.stop();
    process.exit(0);
  });
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
