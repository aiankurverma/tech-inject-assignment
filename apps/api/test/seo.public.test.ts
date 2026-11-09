/**
 * Public HTML, crawler files, caching and scanner hardening. These assertions run against the
 * real Express app with the built web shell, so they catch soft-404 regressions and cache drift.
 */
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import type { Cache } from "@ti/cache";
import { ORIGIN, publishPublic, reset, setup, teardown, theme, type App } from "./helpers";
import { createApp } from "../src/app";
import type { Env } from "../src/config/env";

const hasWebBuild = existsSync(
  fileURLToPath(new URL("../../web/dist/index.html", import.meta.url)),
);
let app: App;
let cache: Cache;
let env: Env;

beforeAll(async () => {
  ({ app, cache, env } = await setup());
});
afterAll(async () => {
  await teardown(app);
});

/** Drop the database and the catalogue cache together; the test helper publishes behind it. */
async function fresh() {
  await reset();
  await cache.del("list");
  await cache.del("list:full");
}

describe.skipIf(!hasWebBuild)("public SEO and security", () => {
  it("server-renders the homepage with the exact title and description", async () => {
    await fresh();
    await publishPublic("activity-feed");
    const res = await request(app).get("/");
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("text/html");
    expect(res.headers["cache-control"]).toBe("no-cache");
    expect(res.text).toContain(
      "<title>Kitbase \u2013 CRM React Components You Can Copy, Install or Give to AI Agents</title>",
    );
    expect(res.text).toContain(
      "Open-source CRM-themed React components: pipelines, contact tables, activity feeds and more.",
    );
    expect(res.text).toContain('<link rel="canonical" href="' + ORIGIN + '/"');
    expect(res.text).toContain('<div id="root">');
    expect(res.text).toContain("activity-feed");
    expect(res.text).toContain("application/ld+json");
  });

  it("gives every public page its own metadata and a real 404", async () => {
    await fresh();
    await publishPublic("contact-table");
    const components = await request(app).get("/components");
    expect(components.status).toBe(200);
    expect(components.text).toContain("CRM React Components \u2013 Pipelines, Tables &amp; Feeds");

    const detail = await request(app).get("/components/contact-table");
    expect(detail.status).toBe(200);
    expect(detail.text).toContain("SoftwareSourceCode");
    expect(detail.text).toContain(`/components/contact-table"`);

    const missing = await request(app).get("/components/not-a-real-component");
    expect(missing.status).toBe(404);
    expect(missing.text).toContain("Page not found");

    const unknown = await request(app).get("/definitely-not-a-page");
    expect(unknown.status).toBe(404);
    expect(unknown.headers["cache-control"]).toBe("no-store");
  });

  it("serves crawler files with the right cache policy", async () => {
    await fresh();
    await publishPublic("pipeline-board");
    const robots = await request(app).get("/robots.txt");
    expect(robots.status).toBe(200);
    expect(robots.text).toContain(`Sitemap: ${ORIGIN}/sitemap.xml`);
    expect(robots.headers["cache-control"]).toBe("public, max-age=3600");

    const sitemap = await request(app).get("/sitemap.xml");
    expect(sitemap.status).toBe(200);
    expect(sitemap.text).toContain("<urlset");
    expect(sitemap.text).toContain(`/components/pipeline-board`);
    expect(sitemap.headers["cache-control"]).toBe("public, max-age=3600");

    const llms = await request(app).get("/llms.txt");
    expect(llms.status).toBe(200);
    expect(llms.text).toContain("pipeline-board");

    const registry = await request(app).get("/registry.json");
    expect(registry.status).toBe(200);
    expect(registry.body.items.length).toBeGreaterThan(0);

    const item = await request(app).get("/r/pipeline-board.json");
    expect(item.status).toBe(200);
    expect(item.body.name).toBeTruthy();
  });

  it("blocks scanner paths before routing and never returns the SPA shell", async () => {
    await fresh();
    for (const path of [
      "/.env",
      "/gcp-key.json",
      "/wp-json/batch/v1",
      "/wp-admin/setup.php",
      "/xmlrpc.php",
      "/.git/config",
      "/vendor/phpunit/phpunit",
    ]) {
      const res = await request(app).get(path);
      expect(res.status).toBe(404);
      expect(res.text).toBe("Not found");
      expect(res.headers["cache-control"]).toBe("no-store");
      expect(res.text).not.toContain('<div id="root">');
    }
  });

  it("keeps health checks cheap and API misses JSON", async () => {
    const health = await request(app).get("/api/health");
    expect(health.status).toBe(200);
    expect(health.body).toEqual({ ok: true });
    expect(health.headers["cache-control"]).toBe("no-store");

    const miss = await request(app).get("/api/not-a-real-route");
    expect(miss.status).toBe(404);
    expect(miss.headers["content-type"]).toContain("application/json");
    expect(miss.body.error).toBe("not_found");
  });

  it("marks hashed assets immutable and keeps HTML revalidating", async () => {
    const html = await request(app).get("/");
    expect(html.headers["cache-control"]).toBe("no-cache");
    const asset = /src="(\/assets\/[^"]+\.js)"/.exec(html.text)?.[1];
    expect(asset).toBeTruthy();
    const res = await request(app).get(asset!);
    expect(res.status).toBe(200);
    expect(res.headers["cache-control"]).toContain("immutable");
    expect(res.headers["cache-control"]).toContain("max-age=31536000");
  });

  it("sends the security headers", async () => {
    const res = await request(app).get("/");
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["permissions-policy"]).toContain("camera=()");
    expect(res.headers["content-security-policy"]).toContain("frame-ancestors 'none'");
    expect(res.headers["x-powered-by"]).toBeUndefined();
  });

  it("redirects www and HTTP to the canonical origin in production", async () => {
    const prodEnv: Env = {
      ...env,
      NODE_ENV: "production",
      PUBLIC_ORIGIN: "https://kitbaseapp.site",
      CANONICAL_ORIGIN: "https://kitbaseapp.site",
    };
    const prodApp = createApp(prodEnv, theme, { cache });
    try {
      const www = await request(prodApp)
        .get("/components")
        .set("Host", "www.kitbaseapp.site")
        .set("X-Forwarded-Proto", "https");
      expect(www.status).toBe(301);
      expect(www.headers.location).toBe("https://kitbaseapp.site/components");

      const http = await request(prodApp)
        .get("/")
        .set("Host", "kitbaseapp.site")
        .set("X-Forwarded-Proto", "http");
      expect(http.status).toBe(301);
      expect(http.headers.location).toBe("https://kitbaseapp.site/");

      // API traffic is never redirected; health checks must answer on any host.
      const health = await request(prodApp)
        .get("/api/health")
        .set("Host", "www.kitbaseapp.site")
        .set("X-Forwarded-Proto", "https");
      expect(health.status).toBe(200);
    } finally {
      await prodApp.shutdown();
    }
  });
});
