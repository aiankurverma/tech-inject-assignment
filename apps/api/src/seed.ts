/**
 * Seeds the two test customers and the demo components from packages/ui.
 * A few are marked premium as public demo fixtures (the brief allows this); protection is
 * proven separately with a premium component uploaded at runtime that is not in the repo.
 * Safe to run many times (upserts).
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { z } from "zod";
import { validateBundle } from "@ti/core";
import { Customer, ComponentModel } from "./models";

const ui = (p: string) => fileURLToPath(new URL(`../../../packages/ui/${p}`, import.meta.url));

const seedEnv = z
  .object({
    MONGODB_URI: z.string().default("mongodb://127.0.0.1:27017/techinject"),
    SEED_FREE_EMAIL: z.string().email(),
    SEED_FREE_PASSWORD: z.string().min(10),
    SEED_PREMIUM_EMAIL: z.string().email(),
    SEED_PREMIUM_PASSWORD: z.string().min(10),
  })
  .parse(process.env);

const entrySchema = z.object({
  name: z.string(),
  slug: z.string(),
  description: z.string(),
  category: z.string(),
  version: z.string(),
  access: z.enum(["free", "premium"]).default("free"),
  dependencies: z.array(z.string()).default([]),
  files: z.array(z.string()),
  examples: z.array(z.object({ title: z.string(), file: z.string() })),
  props: z.array(z.unknown()).default([]),
  usage: z.string().default(""),
});

export function loadRepoBundles() {
  const dir = ui("registry");
  return readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => {
      const e = entrySchema.parse(JSON.parse(readFileSync(`${dir}/${f}`, "utf8")));
      // Static thumbnail (captured from the live preview) shown when the component is locked.
      const thumb = ui(`thumbnails/${e.slug}.png`);
      const bundle = {
        ...e,
        ...(existsSync(thumb)
          ? { thumbnail: `data:image/png;base64,${readFileSync(thumb).toString("base64")}` }
          : {}),
        files: e.files.map((path) => ({ path, content: readFileSync(ui(`src/${path}`), "utf8") })),
        examples: e.examples.map((x) => ({
          title: x.title,
          code: readFileSync(ui(`examples/${x.file}`), "utf8"),
        })),
      };
      const result = validateBundle(bundle);
      if (!result.ok) throw new Error(`${f} is invalid:\n  ${result.errors.join("\n  ")}`);
      return result.bundle;
    });
}

async function main() {
  await mongoose.connect(seedEnv.MONGODB_URI);
  const customers = [
    {
      email: seedEnv.SEED_FREE_EMAIL,
      name: "Free Tester",
      password: seedEnv.SEED_FREE_PASSWORD,
      plan: "free",
    },
    {
      email: seedEnv.SEED_PREMIUM_EMAIL,
      name: "Premium Tester",
      password: seedEnv.SEED_PREMIUM_PASSWORD,
      plan: "premium",
    },
  ];
  for (const c of customers) {
    await Customer.updateOne(
      { email: c.email.toLowerCase() },
      {
        email: c.email.toLowerCase(),
        name: c.name,
        plan: c.plan,
        passwordHash: await bcrypt.hash(c.password, 12),
      },
      { upsert: true },
    );
  }
  const bundles = loadRepoBundles();
  for (const b of bundles) {
    await ComponentModel.updateOne(
      { slug: b.slug },
      { slug: b.slug, status: "published", draft: b, published: b, publishedAt: new Date() },
      { upsert: true },
    );
  }
  console.log(
    `Seeded ${customers.length} customers and ${bundles.length} components (${bundles.filter((b) => b.access === "premium").length} premium demo fixtures).`,
  );
  await mongoose.disconnect();
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  await main();
}
