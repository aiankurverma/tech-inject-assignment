import { z } from "zod";
import {
  ALLOWED_DEPENDENCIES,
  ALLOWED_IMPORTS,
  dependencyOf,
  LIMITS,
  THEME_FILE_PATH,
  UTILS_FILE_PATH,
  type AllowedDependency,
} from "./constants";
import { aliasToPath, isSafeRelativePath } from "./paths";

export const slugSchema = z
  .string()
  .min(2)
  .max(48)
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "lowercase letters, numbers and dashes only");

const semver = z.string().regex(/^\d+\.\d+\.\d+$/, "use MAJOR.MINOR.PATCH, e.g. 1.0.0");

export const bundleFileSchema = z.object({
  path: z.string().refine(isSafeRelativePath, {
    message:
      "path must look like components/crm/name.tsx (folders: components, lib, hooks, styles)",
  }),
  content: z
    .string()
    .min(1)
    .max(LIMITS.maxFileBytes, `file larger than ${LIMITS.maxFileBytes} bytes`),
});

export const propDocSchema = z.object({
  name: z.string().min(1).max(64),
  type: z.string().min(1).max(200),
  default: z.string().max(100).optional(),
  required: z.boolean().default(false),
  description: z.string().max(400).default(""),
});

export const exampleSchema = z.object({
  title: z.string().min(1).max(80),
  /** A TSX module whose default export renders the example. */
  code: z.string().min(1).max(LIMITS.maxFileBytes),
});

export const bundleSchema = z
  .object({
    name: z.string().min(2).max(60),
    slug: slugSchema,
    description: z.string().min(10).max(400),
    category: z.string().min(2).max(40),
    version: semver,
    access: z.enum(["free", "premium"]),
    dependencies: z.array(z.enum(ALLOWED_DEPENDENCIES)).max(20).default([]),
    files: z.array(bundleFileSchema).min(1).max(LIMITS.maxFiles),
    examples: z.array(exampleSchema).min(1).max(LIMITS.maxExamples),
    props: z.array(propDocSchema).max(60).default([]),
    usage: z.string().max(4000).default(""),
    thumbnail: z
      .string()
      .max(LIMITS.maxThumbnailBytes, "thumbnail too large")
      .regex(
        /^data:image\/(png|svg\+xml|webp);base64,[A-Za-z0-9+/=]+$/,
        "thumbnail must be a base64 PNG, SVG or WebP data URL",
      )
      .optional(),
  })
  .strict();

export type Bundle = z.infer<typeof bundleSchema>;
export type BundleInput = z.input<typeof bundleSchema>;

export type ValidationResult = { ok: true; bundle: Bundle } | { ok: false; errors: string[] };

const IMPORT_RE =
  /(?:import|export)\s[^'"]*?from\s*["']([^"']+)["']|import\s*\(\s*["']([^"']+)["']\s*\)|import\s+["']([^"']+)["']|require\s*\(\s*["']([^"']+)["']\s*\)/g;

export function findImports(source: string): string[] {
  const found: string[] = [];
  for (const m of source.matchAll(IMPORT_RE)) {
    const spec = m[1] ?? m[2] ?? m[3] ?? m[4];
    if (spec) found.push(spec);
  }
  return found;
}

const RESERVED = [THEME_FILE_PATH, UTILS_FILE_PATH];
const stripExt = (p: string) => p.replace(/\.(tsx|ts|css)$/, "");

/** Schema check plus import, dependency and size rules that zod cannot express. */
export function validateBundle(input: unknown): ValidationResult {
  const parsed = bundleSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      errors: parsed.error.issues.map((i) => `${i.path.join(".") || "bundle"}: ${i.message}`),
    };
  }
  const bundle = parsed.data;
  const errors: string[] = [];

  const paths = new Set<string>();
  let total = 0;
  for (const f of bundle.files) {
    if (paths.has(f.path)) errors.push(`files: duplicate path ${f.path}`);
    if (RESERVED.includes(f.path))
      errors.push(`files: ${f.path} is provided by the theme, remove it`);
    paths.add(f.path);
    total += f.content.length;
  }
  for (const e of bundle.examples) total += e.code.length;
  if (total > LIMITS.maxTotalBytes) errors.push(`bundle larger than ${LIMITS.maxTotalBytes} bytes`);

  const known = new Set([...[...paths].map(stripExt), ...RESERVED.map(stripExt)]);
  const usedDeps = new Set<string>();
  const sources = [
    ...bundle.files.map((f) => ({ where: f.path, content: f.content })),
    ...bundle.examples.map((e) => ({ where: `example "${e.title}"`, content: e.code })),
  ];
  for (const { where, content } of sources) {
    // `React.useState` etc. without importing React compiles nowhere outside our preview.
    if (/\bReact\./.test(content) && !/import\s+(\*\s+as\s+)?React\b/.test(content)) {
      errors.push(
        `${where}: uses React.* but does not import React (add: import * as React from "react")`,
      );
    }
    for (const spec of findImports(content)) {
      const local = aliasToPath(spec);
      if (local !== null) {
        if (!known.has(stripExt(local)))
          errors.push(`${where}: imports ${spec}, which is not in the bundle`);
      } else if (spec.startsWith(".")) {
        errors.push(`${where}: use "@/..." imports instead of relative "${spec}"`);
      } else if (!ALLOWED_IMPORTS.includes(spec)) {
        errors.push(`${where}: import "${spec}" is not allowed`);
      } else if (dependencyOf(spec) !== "react") {
        usedDeps.add(dependencyOf(spec) ?? spec);
      }
    }
  }
  for (const dep of usedDeps) {
    if (!bundle.dependencies.includes(dep as AllowedDependency)) {
      errors.push(`dependencies: "${dep}" is imported but not listed`);
    }
  }

  return errors.length ? { ok: false, errors } : { ok: true, bundle };
}
