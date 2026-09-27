import { validateBundle } from "@ti/core";
import type { Cache } from "@ti/cache";
import { forgetPublished } from "./catalog";
import { HttpError } from "../utils/http";
import { log } from "../utils/logger";
import { ComponentModel, type ComponentRecord } from "../models";

const validOrThrow = (input: unknown) => {
  const result = validateBundle(input);
  if (!result.ok)
    throw new HttpError(422, "invalid_bundle", "The bundle has problems.", result.errors);
  return result.bundle;
};

/**
 * Validate a bundle and store it as a new DRAFT component (never published).
 * Shared by the admin upload route and the feature-radar AI draft builder.
 */
export async function createDraft(
  input: unknown,
): Promise<{ slug: string; record: ComponentRecord }> {
  const bundle = validOrThrow(input);
  if (await ComponentModel.exists({ slug: bundle.slug })) {
    throw new HttpError(409, "slug_taken", `Slug "${bundle.slug}" is already used.`);
  }
  const doc = await ComponentModel.create({ slug: bundle.slug, status: "draft", draft: bundle });
  log.info("component created", { slug: bundle.slug });
  return { slug: bundle.slug, record: doc.toObject() as ComponentRecord };
}

/** Validate a bundle and save it as the draft of an existing component. */
export async function updateDraft(
  slug: string,
  input: unknown,
  cache: Cache,
): Promise<ComponentRecord> {
  const bundle = validOrThrow(input);
  if (bundle.slug !== slug)
    throw new HttpError(400, "slug_mismatch", "The slug cannot be changed.");
  const doc = await ComponentModel.findOneAndUpdate(
    { slug },
    { draft: bundle },
    { new: true },
  ).lean<ComponentRecord>();
  if (!doc) throw new HttpError(404, "not_found", "Component not found.");
  await forgetPublished(cache, slug);
  log.info("draft saved", { slug });
  return doc;
}

/** A big bundle upload handled in the background: create (no slug) or update (slug). */
export interface BundleJob {
  slug?: string;
  bundle: unknown;
}

/** Queue processor for big uploads. Same checks as the synchronous routes. */
export async function processBundleJob({ slug, bundle }: BundleJob, cache: Cache) {
  try {
    if (slug) await updateDraft(slug, bundle, cache);
    else await createDraft(bundle);
  } catch (e) {
    // Jobs only keep a message, so fold validation details into it (one per line).
    if (e instanceof HttpError) throw new Error([e.message, ...(e.details ?? [])].join("\n"));
    throw e;
  }
}
