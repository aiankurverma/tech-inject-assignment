/**
 * Smoke check: real registry components render with the props the builder seeds on add.
 * Bundle files are compiled with sucrase (as the preview sandbox does) and rendered on the
 * server; components whose npm modules cannot load in Node are skipped, not failed.
 */
import { createRequire } from "node:module";
import { createElement, type ComponentType } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { transform } from "sucrase";
import { describe, expect, it } from "vitest";
import { resolveComponentMeta } from "./codegen";
import { defaultProps } from "./defaults";
import { registryDetail, registrySlugs } from "./registry-fixture";
import type { ComponentDetail } from "./types";

const nodeRequire = createRequire(import.meta.url);
const SAMPLE = 32;
/**
 * Examples whose required data is built entirely by helper functions (`period(...)`, a
 * `const invoice = makeInvoice()`), so no literal can be read. These still render an inline
 * error box through the per-node preview guard instead of blanking the page.
 */
const COMPUTED_EXAMPLE_DATA = new Set(["analytics-overview-template", "invoice-detail"]);

class ModuleLoadError extends Error {}

function load(detail: ComponentDetail, exportName: string): ComponentType<Record<string, unknown>> {
  const strip = (p: string) => p.replace(/\.(tsx|ts|css)$/, "");
  const sources = new Map((detail.files ?? []).map((f) => [strip(f.path), f.content]));
  const cache = new Map<string, Record<string, unknown>>();
  const run = (id: string, code: string): Record<string, unknown> => {
    const hit = cache.get(id);
    if (hit) return hit;
    const compiled = transform(code, {
      transforms: ["typescript", "jsx", "imports"],
      jsxRuntime: "automatic",
      production: true,
      filePath: `${id}.tsx`,
    }).code;
    const module = { exports: {} as Record<string, unknown> };
    cache.set(id, module.exports);
    const req = (spec: string): unknown => {
      if (spec.startsWith("@/")) {
        const target = strip(spec.slice(2));
        if (target.startsWith("styles/")) return {};
        const src = sources.get(target);
        if (src === undefined) throw new ModuleLoadError(`missing ${spec}`);
        return run(target, src);
      }
      try {
        return nodeRequire(spec);
      } catch (e) {
        throw new ModuleLoadError(`${spec}: ${(e as Error).message}`);
      }
    };
    try {
      new Function("require", "module", "exports", "React", compiled)(
        req,
        module,
        module.exports,
        nodeRequire("react"),
      );
    } catch (e) {
      throw e instanceof ModuleLoadError ? e : new ModuleLoadError((e as Error).message);
    }
    cache.set(id, module.exports);
    return module.exports;
  };
  const meta = resolveComponentMeta(detail);
  const src = sources.get(meta.importPath.slice(2));
  if (src === undefined) throw new ModuleLoadError(`no source for ${meta.importPath}`);
  const C = run(meta.importPath.slice(2), src)[exportName];
  if (!C) throw new ModuleLoadError(`no export ${exportName}`);
  return C as ComponentType<Record<string, unknown>>;
}

describe("builder preview smoke", () => {
  it(`renders a sample of ${SAMPLE} registry components with seeded props`, () => {
    const slugs = registrySlugs();
    // Spread the sample across the alphabet instead of taking the first N.
    const step = Math.max(1, Math.floor(slugs.length / SAMPLE));
    const sample = slugs.filter((_, i) => i % step === 0).slice(0, SAMPLE);
    for (const s of ["shell-onboarding", "np-donors", "status-page"])
      if (!sample.includes(s)) sample.push(s);

    const rendered: string[] = [];
    const skipped: string[] = [];
    const failed: string[] = [];
    let brokenWithEmptyProps = 0;
    for (const slug of sample) {
      const detail = registryDetail(slug);
      // Browser-only libraries touch `window` at import time; the sandbox covers those.
      if ((detail.dependencies ?? []).some((d) => /pdf|map|leaflet|maplibre/.test(d))) {
        skipped.push(`${slug} (browser-only dependency)`);
        continue;
      }
      const { exportName } = resolveComponentMeta(detail);
      let C: ComponentType<Record<string, unknown>>;
      try {
        C = load(detail, exportName);
      } catch (e) {
        if (e instanceof ModuleLoadError) {
          skipped.push(`${slug} (${e.message.slice(0, 80)})`);
          continue;
        }
        throw e;
      }
      try {
        renderToStaticMarkup(createElement(C, {}));
      } catch {
        brokenWithEmptyProps++;
      }
      try {
        renderToStaticMarkup(createElement(C, defaultProps(detail, exportName)));
        rendered.push(slug);
      } catch (e) {
        if (!COMPUTED_EXAMPLE_DATA.has(slug)) failed.push(`${slug}: ${(e as Error).message}`);
      }
    }
    console.info(
      `builder smoke: ${rendered.length} rendered, ${skipped.length} skipped, ` +
        `${brokenWithEmptyProps} would throw with empty props`,
    );
    expect(failed).toEqual([]);
    expect(rendered).toContain("shell-onboarding");
    expect(rendered.length).toBeGreaterThanOrEqual(30);
  });
});
