import { Router, type Request, type RequestHandler, type Response } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { slugSchema, validateBundle, type ThemeFiles } from "@ti/core";
import type { Cache } from "@ti/cache";
import type { Queue } from "@ti/queue";
import type { Env } from "../config/env";
import { CUSTOMER_REFRESH_COOKIE, newApiToken, safeEqual, type Auth } from "../middleware/auth";
import { revokeSubjectRefresh } from "../services/refresh";
import {
  forgetPublished,
  makeCatalog,
  placeholderThumbnail,
  previewPayload,
} from "../services/catalog";
import { createDraft, updateDraft, type BundleJob } from "../services/drafts";
import { HttpError } from "../utils/http";
import { log } from "../utils/logger";
import {
  ApiToken,
  ComponentModel,
  Customer,
  type ComponentRecord,
  type CustomerDoc,
} from "../models";

const slugParam = (req: Request) => {
  const parsed = slugSchema.safeParse(req.params.slug);
  if (!parsed.success) throw new HttpError(404, "not_found", "Component not found.");
  return parsed.data;
};

function parseBody<T extends z.ZodTypeAny>(schema: T, body: unknown): z.infer<T> {
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw new HttpError(
      400,
      "invalid_input",
      "Check the highlighted fields.",
      parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`),
    );
  }
  return parsed.data;
}

/** Shared infrastructure built in app.ts (cache, rate limits, queues). */
export interface RouteDeps {
  cache: Cache;
  customerLoginLimit: RequestHandler;
  adminLoginLimit: RequestHandler;
  registryLimit: RequestHandler;
  bundleJobs: Queue<BundleJob>;
}

const sendText = (res: Response, text: string) => res.type("text/plain; charset=utf-8").send(text);

export function publicRoutes(auth: Auth, theme: ThemeFiles, env: Env, deps: RouteDeps) {
  const r = Router();
  const catalog = makeCatalog(theme, env.PUBLIC_ORIGIN, deps.cache);
  // Protected responses must never be cached by browsers or proxies.
  r.use((_req, res, next) => {
    res.set("Cache-Control", "no-store");
    next();
  });

  r.get("/components", async (req, res) => {
    res.json(await catalog.list(await auth.viewer(req)));
  });
  r.get("/components/:slug", async (req, res) => {
    res.json(await catalog.detail(slugParam(req), await auth.viewer(req)));
  });
  r.get("/components/:slug/thumbnail", async (req, res) => {
    const dataUrl = await catalog.thumbnail(slugParam(req));
    const [, mime, b64] = /^data:([^;]+);base64,(.*)$/.exec(dataUrl) ?? [];
    res.type(mime ?? "image/svg+xml").send(Buffer.from(b64 ?? "", "base64"));
  });
  r.get("/components/:slug/preview", async (req, res) => {
    res.json(await catalog.preview(slugParam(req), await auth.viewer(req)));
  });
  r.get("/components/:slug/copy", async (req, res) => {
    sendText(res, await catalog.copyCode(slugParam(req), await auth.viewer(req)));
  });
  r.get("/components/:slug/prompt", async (req, res) => {
    sendText(res, await catalog.prompt(slugParam(req), await auth.viewer(req)));
  });
  /** Used by the CLI installer. Accepts cookie or `Authorization: Bearer <token>`. */
  r.get("/registry/:slug", deps.registryLimit, async (req, res) => {
    const slug = slugParam(req);
    const item = await catalog.registryItem(slug, await auth.viewer(req));
    log.info("registry download", { slug });
    res.json(item);
  });
  return r;
}

export function customerRoutes(auth: Auth, deps: RouteDeps) {
  const r = Router();
  const login = z.object({ email: z.string().email(), password: z.string().min(1).max(200) });

  r.post("/auth/login", deps.customerLoginLimit, async (req, res) => {
    const { email, password } = parseBody(login, req.body);
    const customer = await Customer.findOne({ email: email.toLowerCase() }).lean<CustomerDoc>();
    const ok = customer ? await bcrypt.compare(password, customer.passwordHash) : false;
    if (!customer || !ok)
      throw new HttpError(401, "bad_credentials", "Email or password is wrong.");
    if (customer.disabled)
      throw new HttpError(403, "account_disabled", "This account is disabled. Contact the admin.");
    await auth.startCustomerSession(res, String(customer._id));
    res.json({ email: customer.email, name: customer.name, plan: customer.plan });
  });
  r.post("/auth/logout", async (req, res) => {
    await auth.endCustomerSession(req, res);
    res.json({ ok: true });
  });
  /** Swaps the refresh cookie for a new one plus a fresh 15-minute access cookie. */
  r.post("/auth/refresh", async (req, res) => {
    const c = await auth.refreshCustomerSession(req, res);
    if (!c) throw new HttpError(401, "unauthorized", "Session expired. Sign in again.");
    res.json({ email: c.email, name: c.name, plan: c.plan });
  });
  // Signed-out visitors get `null` (not an error) so pages can render without noise.
  // An expired access cookie is renewed here from the refresh cookie (sent to /api/auth only).
  r.get("/auth/me", async (req, res) => {
    const c =
      (await auth.currentCustomer(req)) ??
      (req.cookies?.[CUSTOMER_REFRESH_COOKIE] ? await auth.refreshCustomerSession(req, res) : null);
    res.json(c ? { email: c.email, name: c.name, plan: c.plan } : null);
  });

  // Personal access tokens for the CLI and AI agents. Any customer may create them;
  // access is still decided per request from the customer's current plan.
  r.get("/tokens", auth.requireCustomer, async (_req, res) => {
    const c = res.locals.customer as CustomerDoc;
    const tokens = await ApiToken.find({ customerId: c._id, revokedAt: null })
      .sort({ createdAt: -1 })
      .lean();
    res.json(
      tokens.map((t) => ({
        id: String(t._id),
        name: t.name,
        prefix: t.prefix,
        createdAt: t.createdAt,
        lastUsedAt: t.lastUsedAt,
      })),
    );
  });
  r.post("/tokens", auth.requireCustomer, async (req, res) => {
    const { name } = parseBody(z.object({ name: z.string().trim().min(1).max(60) }), req.body);
    const c = res.locals.customer as CustomerDoc;
    const count = await ApiToken.countDocuments({ customerId: c._id, revokedAt: null });
    if (count >= 10)
      throw new HttpError(400, "too_many_tokens", "Revoke an old token first (max 10).");
    const { token, hash, prefix } = newApiToken();
    const doc = await ApiToken.create({ customerId: c._id, name, hash, prefix });
    res.status(201).json({ id: String(doc._id), name, prefix, token });
  });
  r.delete("/tokens/:id", auth.requireCustomer, async (req, res) => {
    const c = res.locals.customer as CustomerDoc;
    const id = z
      .string()
      .regex(/^[a-f0-9]{24}$/)
      .safeParse(req.params.id);
    if (!id.success) throw new HttpError(404, "not_found", "Token not found.");
    await ApiToken.updateOne({ _id: id.data, customerId: c._id }, { revokedAt: new Date() });
    res.json({ ok: true });
  });
  return r;
}

export function adminRoutes(auth: Auth, theme: ThemeFiles, env: Env, deps: RouteDeps) {
  const r = Router();
  const login = z.object({
    username: z.string().min(1).max(100),
    password: z.string().min(1).max(200),
  });

  r.post("/login", deps.adminLoginLimit, async (req, res) => {
    const { username, password } = parseBody(login, req.body);
    const ok = safeEqual(username, env.ADMIN_USERNAME) && safeEqual(password, env.ADMIN_PASSWORD);
    if (!ok) {
      log.warn("admin login failed");
      throw new HttpError(401, "bad_credentials", "Username or password is wrong.");
    }
    await auth.startAdminSession(res);
    log.info("admin login");
    res.json({ ok: true });
  });
  r.post("/logout", async (req, res) => {
    await auth.endAdminSession(req, res);
    res.json({ ok: true });
  });
  r.post("/refresh", async (req, res) => {
    if (!(await auth.refreshAdminSession(req, res)))
      throw new HttpError(401, "unauthorized", "Admin session expired. Sign in again.");
    res.json({ ok: true });
  });

  // Everything below requires the admin cookie.
  r.use(auth.requireAdmin);
  r.get("/me", (_req, res) => {
    res.json({ username: env.ADMIN_USERNAME });
  });

  const summary = (d: ComponentRecord) => ({
    slug: d.slug,
    status: d.status,
    name: d.draft.name,
    category: d.draft.category,
    access: d.draft.access,
    draftVersion: d.draft.version,
    publishedVersion: d.published?.version ?? null,
    publishedAt: d.publishedAt ?? null,
    updatedAt: d.updatedAt,
    hasUnpublishedChanges: !!d.published && JSON.stringify(d.published) !== JSON.stringify(d.draft),
  });

  const load = async (slug: string) => {
    const doc = await ComponentModel.findOne({ slug }).lean<ComponentRecord>();
    if (!doc) throw new HttpError(404, "not_found", "Component not found.");
    return doc;
  };
  const validOrThrow = (input: unknown) => {
    const result = validateBundle(input);
    if (!result.ok)
      throw new HttpError(422, "invalid_bundle", "The bundle has problems.", result.errors);
    return result.bundle;
  };

  r.get("/components", async (_req, res) => {
    const docs = await ComponentModel.find().sort({ updatedAt: -1 }).lean<ComponentRecord[]>();
    res.json(docs.map(summary));
  });
  r.post("/validate", (req, res) => {
    const result = validateBundle(req.body);
    res.json(result.ok ? { ok: true, errors: [] } : result);
  });
  // Big uploads are validated and saved by a background job: 202 + job id, poll /jobs/:id.
  const isBig = (body: unknown) =>
    Buffer.byteLength(JSON.stringify(body ?? null)) > env.QUEUE_THRESHOLD_BYTES;
  const enqueue = async (res: Response, job: BundleJob) => {
    const jobId = await deps.bundleJobs.add(job);
    log.info("bundle queued", { slug: job.slug ?? null, jobId });
    res.status(202).json({ status: "queued", jobId });
  };

  r.post("/components", async (req, res) => {
    if (isBig(req.body)) return enqueue(res, { bundle: req.body });
    const { record } = await createDraft(req.body);
    res.status(201).json(summary(record));
  });
  r.get("/jobs/:id", async (req, res) => {
    const id = z
      .string()
      .regex(/^[\w-]{1,64}$/)
      .safeParse(req.params.id);
    const job = id.success ? await deps.bundleJobs.status(id.data) : null;
    if (!job) throw new HttpError(404, "not_found", "Job not found.");
    res.json(job);
  });
  r.get("/components/:slug", async (req, res) => {
    const doc = await load(slugParam(req));
    res.json({ ...summary(doc), draft: doc.draft, published: doc.published ?? null });
  });
  r.put("/components/:slug", async (req, res) => {
    const slug = slugParam(req);
    if (isBig(req.body)) return enqueue(res, { slug, bundle: req.body });
    res.json(summary(await updateDraft(slug, req.body, deps.cache)));
  });
  r.get("/components/:slug/preview", async (req, res) => {
    const doc = await load(slugParam(req));
    res.json(previewPayload(doc.draft, theme));
  });
  r.get("/components/:slug/thumbnail", async (req, res) => {
    const doc = await load(slugParam(req));
    const dataUrl = doc.draft.thumbnail ?? placeholderThumbnail(doc.draft.name);
    const [, mime, b64] = /^data:([^;]+);base64,(.*)$/.exec(dataUrl) ?? [];
    res.type(mime ?? "image/svg+xml").send(Buffer.from(b64 ?? "", "base64"));
  });
  r.post("/components/:slug/publish", async (req, res) => {
    const slug = slugParam(req);
    const doc = await load(slug);
    const bundle = validOrThrow(doc.draft); // re-check rules at publish time
    const updated = await ComponentModel.findOneAndUpdate(
      { slug },
      { status: "published", published: bundle, publishedAt: new Date() },
      { new: true },
    ).lean<ComponentRecord>();
    await forgetPublished(deps.cache, slug);
    log.info("component published", { slug, version: bundle.version });
    res.json(summary(updated!));
  });
  r.post("/components/:slug/unpublish", async (req, res) => {
    const slug = slugParam(req);
    const doc = await load(slug);
    if (doc.status !== "published")
      throw new HttpError(400, "not_published", "Component is not published.");
    const updated = await ComponentModel.findOneAndUpdate(
      { slug },
      { status: "unpublished" },
      { new: true },
    ).lean<ComponentRecord>();
    await forgetPublished(deps.cache, slug);
    log.info("component unpublished", { slug });
    res.json(summary(updated!));
  });
  // Switch free/premium on the draft AND the live snapshot, so the lock applies on the next request.
  // Only the access label changes; the published source stays the same version.
  r.post("/components/:slug/access", async (req, res) => {
    const slug = slugParam(req);
    const { access } = parseBody(z.object({ access: z.enum(["free", "premium"]) }), req.body);
    const doc = await load(slug);
    const update: Record<string, string> = { "draft.access": access };
    if (doc.published) update["published.access"] = access;
    const updated = await ComponentModel.findOneAndUpdate(
      { slug },
      { $set: update },
      { new: true },
    ).lean<ComponentRecord>();
    await forgetPublished(deps.cache, slug);
    log.info("component access changed", { slug, access });
    res.json(summary(updated!));
  });
  // Permanent delete (Privileges page). Already installed copies are unaffected.
  r.delete("/components/:slug", async (req, res) => {
    const slug = slugParam(req);
    const { deletedCount } = await ComponentModel.deleteOne({ slug });
    if (!deletedCount) throw new HttpError(404, "not_found", "Component not found.");
    await forgetPublished(deps.cache, slug);
    log.info("component deleted", { slug });
    res.json({ ok: true });
  });

  const customerView = (c: CustomerDoc) => ({
    id: String(c._id),
    email: c.email,
    name: c.name,
    plan: c.plan,
    disabled: !!c.disabled,
  });
  const updateCustomer = async (
    rawId: unknown,
    update: Partial<Pick<CustomerDoc, "plan" | "disabled">>,
  ) => {
    const id = z
      .string()
      .regex(/^[a-f0-9]{24}$/)
      .safeParse(rawId);
    if (!id.success) throw new HttpError(404, "not_found", "Customer not found.");
    const c = await Customer.findByIdAndUpdate(id.data, update, { new: true }).lean<CustomerDoc>();
    if (!c) throw new HttpError(404, "not_found", "Customer not found.");
    log.info("customer updated", { customer: String(c._id), ...update });
    return customerView(c);
  };

  r.get("/customers", async (_req, res) => {
    const customers = await Customer.find().sort({ email: 1 }).lean<CustomerDoc[]>();
    res.json(customers.map(customerView));
  });
  r.post("/customers/:id/plan", async (req, res) => {
    const { plan } = parseBody(z.object({ plan: z.enum(["free", "premium"]) }), req.body);
    res.json(await updateCustomer(req.params.id, { plan }));
  });
  r.post("/customers/:id/status", async (req, res) => {
    const { disabled } = parseBody(z.object({ disabled: z.boolean() }), req.body);
    const customer = await updateCustomer(req.params.id, { disabled });
    // Block = signed out everywhere: end every browser session (API tokens already stop working).
    if (disabled) await revokeSubjectRefresh("customer", String(req.params.id));
    log.info(disabled ? "customer blocked" : "customer unblocked", { id: req.params.id });
    res.json(customer);
  });
  return r;
}
