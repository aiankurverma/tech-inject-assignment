// Admin-only Capture Engine routes: /api/admin/captures
import { Router, type RequestHandler } from "express";
import mongoose from "mongoose";
import { z } from "zod";
import type { Queue } from "@ti/queue";
import type { Auth } from "../middleware/auth";
import { CaptureModel } from "../models";
import {
  assertPublicUrl,
  generateThemeCss,
  type CaptureJob,
  type CaptureTokens,
} from "../services/capture";
import { HttpError } from "../utils/http";
import { log } from "../utils/logger";

export interface CaptureDeps {
  captureJobs: Queue<CaptureJob>;
  captureLimit: RequestHandler;
}

const createBody = z.object({
  url: z.string().trim().min(1).max(2048),
  // The admin must confirm they own the site or have permission to analyse it.
  permission: z.literal(true, {
    errorMap: () => ({ message: "Confirm you own or may analyse this site." }),
  }),
});

const idParam = z.string().refine((v) => mongoose.isValidObjectId(v), "Invalid capture id.");

function parse<T extends z.ZodTypeAny>(schema: T, value: unknown): z.infer<T> {
  const r = schema.safeParse(value);
  if (!r.success)
    throw new HttpError(
      400,
      "invalid_input",
      r.error.issues[0]?.message ?? "Invalid input.",
      r.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`),
    );
  return r.data;
}

/** At most this many captures may be queued or running at once (Chrome is heavy). */
const MAX_IN_FLIGHT = 3;

export function captureRoutes(auth: Auth, deps: CaptureDeps) {
  const r = Router();
  r.use(auth.requireAdmin);

  r.post("/", deps.captureLimit, async (req, res) => {
    const { url } = parse(createBody, req.body);
    const guard = await assertPublicUrl(url);
    if (!guard.ok) throw new HttpError(400, "url_blocked", guard.reason);
    const inFlight = await CaptureModel.countDocuments({ status: { $in: ["queued", "running"] } });
    if (inFlight >= MAX_IN_FLIGHT)
      throw new HttpError(429, "busy", "Too many captures running. Try again in a minute.");
    const doc = await CaptureModel.create({ url: guard.url.href });
    await deps.captureJobs.add({ id: String(doc._id) });
    log.info("capture queued", { id: String(doc._id), host: guard.url.host });
    res.status(202).json({ id: String(doc._id), status: doc.status });
  });

  // List without the heavy fields.
  r.get("/", async (_req, res) => {
    const rows = await CaptureModel.find(
      {},
      { url: 1, title: 1, status: 1, error: 1, createdAt: 1 },
    )
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();
    res.json(rows.map(({ _id, ...rest }) => ({ id: String(_id), ...rest })));
  });

  r.get("/:id", async (req, res) => {
    const id = parse(idParam, req.params.id);
    const doc = await CaptureModel.findById(id, { __v: 0 }).lean();
    if (!doc) throw new HttpError(404, "not_found", "Capture not found.");
    const { _id, ...rest } = doc;
    res.json({ id: String(_id), ...rest });
  });

  // Generates the crm-theme-style CSS from the tokens and saves it as this capture's Theme draft.
  r.post("/:id/theme", async (req, res) => {
    const id = parse(idParam, req.params.id);
    const doc = await CaptureModel.findById(id).lean();
    if (!doc) throw new HttpError(404, "not_found", "Capture not found.");
    if (doc.status !== "done" || !doc.tokens)
      throw new HttpError(409, "not_ready", "The capture has not finished yet.");
    const css = generateThemeCss(doc.tokens as CaptureTokens, doc.finalUrl ?? doc.url);
    await CaptureModel.updateOne({ _id: id }, { themeCss: css });
    res.json({ css });
  });

  return r;
}
