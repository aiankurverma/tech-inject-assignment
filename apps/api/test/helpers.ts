/**
 * API test harness: in-memory MongoDB, the real Express app with an in-process cache and
 * no Redis, plus small seed helpers. Every test file starts its own database.
 */
import bcrypt from "bcryptjs";
import mongoose, { Types } from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import request from "supertest";
import { createCache } from "@ti/cache";
import type { ThemeFiles } from "@ti/core";
import { createApp } from "../src/app";
import { loadEnv } from "../src/config/env";
import { newApiToken } from "../src/middleware/auth";
import {
  ApiToken,
  ComponentModel,
  Customer,
  Team,
  TeamMember,
  type CustomerDoc,
  type TeamDoc,
} from "../src/models";

export const PASSWORD = "correct horse battery staple";
export const ORIGIN = "http://localhost:4000";

export const theme: ThemeFiles = {
  themeCss: ":root { --crm-bg: #161616; }",
  utilsTs: 'export const cn = (...a: string[]) => a.join(" ");',
};

export type App = ReturnType<typeof createApp>;

let mongo: MongoMemoryServer | undefined;

/** Starts MongoDB + the app. Call from `beforeAll`; pair with `teardown` in `afterAll`. */
export async function setup() {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  const env = loadEnv({
    NODE_ENV: "test",
    JWT_SECRET: "test-secret-test-secret-test-secret-test",
    ADMIN_USERNAME: "admin",
    ADMIN_PASSWORD: "admin-password-123",
    PUBLIC_ORIGIN: ORIGIN,
    TRUSTED_ORIGINS: "",
    QUEUE_THRESHOLD_BYTES: "200000",
  });
  const cache = createCache({ redis: null, prefix: "test:", defaultTtlSeconds: 60 });
  const app = createApp(env, theme, { cache, builder: { apiKey: undefined } });
  return { app, cache, env };
}

export async function teardown(app?: App) {
  await app?.shutdown();
  await mongoose.disconnect();
  await mongo?.stop();
}

/** Drops every collection (fixtures are re-seeded per describe/test as needed). */
export async function reset() {
  const collections = await mongoose.connection.db!.collections();
  await Promise.all(collections.map((c) => c.deleteMany({})));
}

let seq = 0;
export async function customer(
  over: Partial<{ email: string; name: string; plan: "free" | "premium"; disabled: boolean }> = {},
): Promise<CustomerDoc> {
  seq += 1;
  const doc = await Customer.create({
    email: over.email ?? `user${seq}@example.com`,
    name: over.name ?? `User ${seq}`,
    passwordHash: await bcrypt.hash(PASSWORD, 4),
    plan: over.plan ?? "free",
    disabled: over.disabled ?? false,
  });
  return doc.toObject() as CustomerDoc;
}

/** A cookie-holding agent signed in as `c`. */
export async function login(app: App, c: CustomerDoc) {
  const agent = request.agent(app);
  const res = await agent.post("/api/auth/login").send({ email: c.email, password: PASSWORD });
  if (res.status !== 200) throw new Error(`login failed: ${res.status} ${res.text}`);
  return agent;
}

/** Creates an API token directly in the DB; returns the plain token for `Authorization: Bearer`. */
export async function token(c: CustomerDoc, teamId?: Types.ObjectId) {
  const t = newApiToken();
  await ApiToken.create({
    customerId: c._id,
    name: "test",
    hash: t.hash,
    prefix: t.prefix,
    teamId,
  });
  return t.token;
}

export async function createTeam(slug: string, owner: CustomerDoc, name = slug): Promise<TeamDoc> {
  const team = await Team.create({ slug, name, createdBy: owner._id });
  await TeamMember.create({ teamId: team._id, customerId: owner._id, role: "owner" });
  return team.toObject() as TeamDoc;
}

export async function addMember(team: TeamDoc, c: CustomerDoc, role: "admin" | "member") {
  await TeamMember.create({ teamId: team._id, customerId: c._id, role });
}

const PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

/** A valid bundle. With `team`, files live under `components/<team>/` as the team rules require. */
export function bundle(slug: string, team?: string, over: Record<string, unknown> = {}) {
  const dir = team ?? "crm";
  return {
    name: `Component ${slug}`,
    slug,
    description: `The ${slug} component for ${team ?? "everyone"}, with enough words.`,
    category: "Cards",
    version: "1.0.0",
    access: "free",
    dependencies: [],
    files: [
      {
        path: `components/${dir}/${slug}.tsx`,
        content: `export function X() { return <div>${team ?? "public"} ${slug}</div>; }`,
      },
    ],
    examples: [
      {
        title: "Basic",
        code: `import { X } from "@/components/${dir}/${slug}";\nexport default function E() { return <X />; }`,
      },
    ],
    thumbnail: PNG,
    ...over,
  };
}

/** A published public component (optionally premium). */
export async function publishPublic(slug: string, access: "free" | "premium" = "free") {
  const b = bundle(slug, undefined, { access });
  await ComponentModel.create({
    slug,
    status: "published",
    draft: b,
    published: b,
    publishedAt: new Date(),
  });
  return b;
}

export const bearer = (t: string) => ({ authorization: `Bearer ${t}` });

/** A valid bundle above the queue threshold (200 KB): three 80 KB files. */
export function bigBundle(slug: string, team?: string) {
  const dir = team ?? "crm";
  const pad = `\n// ${"y".repeat(80_000)}`;
  return bundle(slug, team, {
    files: [0, 1, 2].map((i) => ({
      path: `components/${dir}/${slug}${i ? `-${i}` : ""}.tsx`,
      content: `export function X${i}() { return <div>${slug}</div>; }${pad}`,
    })),
  });
}
