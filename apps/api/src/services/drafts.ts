import type { Model } from "mongoose";
import { validateBundle, type Bundle } from "@ti/core";
import type { Cache } from "@ti/cache";
import { forgetPublished } from "./catalog";
import { HttpError } from "../utils/http";
import { log } from "../utils/logger";
import { ComponentModel, type ComponentRecord } from "../models";

export const validOrThrow = (input: unknown, opts?: { team?: string }) => {
  const result = validateBundle(input, opts);
  if (!result.ok)
    throw new HttpError(422, "invalid_bundle", "The bundle has problems.", result.errors);
  return result.bundle;
};

/**
 * Where drafts are stored and how they are scoped. The public catalogue uses `ComponentModel`
 * with an empty filter; a team uses `TeamComponent` with `{ teamId }` on every query, so the
 * same code can never read or write across teams.
 */
export interface DraftScope {
  model: Model<Record<string, unknown>>;
  /** Added to every filter (`{}` for the public catalogue, `{ teamId }` for a team). */
  filter: Record<string, unknown>;
  /** Extra fields stored on create (e.g. `teamId`, `createdBy`). */
  onCreate?: Record<string, unknown>;
  /** Extra fields stored on update (e.g. `updatedBy`). */
  onUpdate?: Record<string, unknown>;
  validate: (input: unknown) => Bundle;
  /** Called after a change so cached copies are dropped. */
  forget: (slug: string) => Promise<void>;
  /** Upper bound on documents in this scope (teams); `null` = unlimited. */
  maxDocuments: number | null;
}

const publicScope = (cache: Cache | null): DraftScope => ({
  model: ComponentModel as unknown as Model<Record<string, unknown>>,
  filter: {},
  validate: (input) => validOrThrow(input),
  forget: (slug) => (cache ? forgetPublished(cache, slug) : Promise.resolve()),
  maxDocuments: null,
});

/** Validate a bundle and store it as a new DRAFT (never published) inside `scope`. */
export async function createDraftIn<R extends ComponentRecord = ComponentRecord>(
  scope: DraftScope,
  input: unknown,
): Promise<{ slug: string; record: R }> {
  const bundle = scope.validate(input);
  if (await scope.model.exists({ ...scope.filter, slug: bundle.slug })) {
    throw new HttpError(409, "slug_taken", `Slug "${bundle.slug}" is already used.`);
  }
  if (scope.maxDocuments !== null) {
    const count = await scope.model.countDocuments(scope.filter);
    if (count >= scope.maxDocuments)
      throw new HttpError(409, "limit_reached", `Limit reached: ${scope.maxDocuments} components.`);
  }
  let doc;
  try {
    doc = await scope.model.create({
      ...scope.filter,
      ...scope.onCreate,
      slug: bundle.slug,
      status: "draft",
      draft: bundle,
    });
  } catch (e) {
    // Two concurrent creates of one slug both pass `exists()`; the unique index decides.
    if ((e as { code?: number }).code === 11000)
      throw new HttpError(409, "slug_taken", `Slug "${bundle.slug}" is already used.`);
    throw e;
  }
  // Concurrent creates can pass the count together: re-check after the insert and undo ours.
  if (
    scope.maxDocuments !== null &&
    (await scope.model.countDocuments(scope.filter)) > scope.maxDocuments
  ) {
    await scope.model.deleteOne({ ...scope.filter, _id: doc._id });
    throw new HttpError(409, "limit_reached", `Limit reached: ${scope.maxDocuments} components.`);
  }
  log.info("component created", { slug: bundle.slug });
  return { slug: bundle.slug, record: doc.toObject() as R };
}

/** Validate a bundle and save it as the draft of an existing component inside `scope`. */
export async function updateDraftIn<R extends ComponentRecord = ComponentRecord>(
  scope: DraftScope,
  slug: string,
  input: unknown,
): Promise<R> {
  const bundle = scope.validate(input);
  if (bundle.slug !== slug)
    throw new HttpError(400, "slug_mismatch", "The slug cannot be changed.");
  const doc = await scope.model
    .findOneAndUpdate(
      { ...scope.filter, slug },
      { draft: bundle, ...scope.onUpdate },
      { new: true },
    )
    .lean<R>();
  if (!doc) throw new HttpError(404, "not_found", "Component not found.");
  await scope.forget(slug);
  log.info("draft saved", { slug });
  return doc;
}

/**
 * Public catalogue: validate a bundle and store it as a new DRAFT component.
 * Shared by the admin upload route and the feature-radar AI draft builder.
 */
export function createDraft(input: unknown) {
  return createDraftIn(publicScope(null), input);
}

/** Public catalogue: validate a bundle and save it as the draft of an existing component. */
export function updateDraft(slug: string, input: unknown, cache: Cache) {
  return updateDraftIn(publicScope(cache), slug, input);
}

/**
 * A big bundle upload handled in the background: create (no slug) or update (slug).
 * `teamId` is set by the team routes from the server-resolved team, never from the client.
 */
export interface BundleJob {
  slug?: string;
  bundle: unknown;
  teamId?: string;
  customerId?: string;
}

/** Runs a job against a scope, folding validation details into the job's error message. */
export async function runBundleJob({ slug, bundle }: BundleJob, scope: DraftScope) {
  try {
    if (slug) await updateDraftIn(scope, slug, bundle);
    else await createDraftIn(scope, bundle);
  } catch (e) {
    // Jobs only keep a message, so fold validation details into it (one per line).
    if (e instanceof HttpError) throw new Error([e.message, ...(e.details ?? [])].join("\n"));
    throw e;
  }
}

/** Queue processor for big public uploads. Same checks as the synchronous routes. */
export function processBundleJob(job: BundleJob, cache: Cache) {
  return runBundleJob(job, publicScope(cache));
}
