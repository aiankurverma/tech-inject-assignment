/**
 * Durable prompt-to-screen jobs.
 *
 * The HTTP request only creates a Mongo document plus a queue item and returns 202. The worker
 * writes progress, the result and failures back onto that document, so the UI can reload, sign
 * out and come back: the job keeps running and the client polls with the unguessable job token.
 * Pause/cancel flip the document status; the worker checks it at every expensive step.
 */
import { createHash, randomBytes } from "node:crypto";
import mongoose from "mongoose";
import type { Viewer } from "@ti/core";
import type { Queue } from "@ti/queue";
import { ScreenJob } from "../models";
import { HttpError } from "../utils/http";
import { log } from "../utils/logger";
import type { ScreenResult, Screens } from "./screens";

export type ScreenJobStatus = "queued" | "running" | "paused" | "done" | "failed" | "cancelled";

export interface ScreenJobError {
  code: string;
  message: string;
  details: string[];
}

export interface ScreenJobView {
  id: string;
  status: ScreenJobStatus;
  progress: number;
  stage: string;
  prompt: string;
  result?: ScreenResult;
  error?: ScreenJobError;
  createdAt?: string;
  updatedAt?: string;
  finishedAt?: string;
}

export interface ScreenJobRef {
  id: string;
}

const hash = (token: string) => createHash("sha256").update(token).digest("hex");

interface JobLike {
  _id: unknown;
  status: ScreenJobStatus;
  progress: number;
  stage: string;
  prompt: string;
  result?: unknown;
  error?: unknown;
  createdAt?: Date;
  updatedAt?: Date;
  finishedAt?: Date | null;
}

function toView(doc: JobLike): ScreenJobView {
  return {
    id: String(doc._id),
    status: doc.status,
    progress: doc.progress,
    stage: doc.stage,
    prompt: doc.prompt,
    result: (doc.result ?? undefined) as ScreenResult | undefined,
    error: (doc.error ?? undefined) as ScreenJobError | undefined,
    createdAt: doc.createdAt?.toISOString(),
    updatedAt: doc.updatedAt?.toISOString(),
    finishedAt: doc.finishedAt?.toISOString(),
  };
}

/** Creates the job row. The raw token is returned once and only its hash is stored. */
export async function createScreenJob(input: {
  prompt: string;
  viewer: Viewer;
  owner?: string | null;
}): Promise<ScreenJobView & { token: string }> {
  const token = randomBytes(24).toString("base64url");
  const doc = await ScreenJob.create({
    tokenHash: hash(token),
    prompt: input.prompt,
    viewer: input.viewer,
    owner: input.owner ?? undefined,
  });
  return { ...toView(doc), token };
}

/** Loads a job by id + token. A wrong token is indistinguishable from a missing job. */
async function authorised(id: string, token: string) {
  if (!mongoose.isValidObjectId(id) || !token)
    throw new HttpError(404, "not_found", "Screen job not found.");
  const doc = await ScreenJob.findOne({ _id: id, tokenHash: hash(token) }).lean();
  if (!doc) throw new HttpError(404, "not_found", "Screen job not found.");
  return doc;
}

export async function getScreenJob(id: string, token: string): Promise<ScreenJobView> {
  return toView(await authorised(id, token));
}

/** Pause a queued/running job. Done, failed and cancelled jobs are returned unchanged. */
export async function pauseScreenJob(id: string, token: string): Promise<ScreenJobView> {
  await authorised(id, token);
  await ScreenJob.updateOne(
    { _id: id, status: { $in: ["queued", "running"] } },
    { $set: { status: "paused", stage: "Paused" } },
  );
  return getScreenJob(id, token);
}

/** Re-queues a paused job; returns whether it was actually resumed (so a queue item is added once). */
export async function resumeScreenJob(
  id: string,
  token: string,
): Promise<{ job: ScreenJobView; resumed: boolean }> {
  await authorised(id, token);
  const r = await ScreenJob.updateOne(
    { _id: id, status: "paused" },
    { $set: { status: "queued", stage: "Resuming" } },
  );
  return { job: await getScreenJob(id, token), resumed: r.modifiedCount > 0 };
}

/** Cancel whatever is queued, running or paused. A finished job is left alone. */
export async function cancelScreenJob(id: string, token: string): Promise<ScreenJobView> {
  await authorised(id, token);
  await ScreenJob.updateOne(
    { _id: id, status: { $nin: ["done", "failed", "cancelled"] } },
    { $set: { status: "cancelled", stage: "Cancelled", finishedAt: new Date() } },
  );
  return getScreenJob(id, token);
}

class JobHalted extends Error {
  constructor(readonly reason: Exclude<ScreenJobStatus, "running">) {
    super(reason);
  }
}

const failure = (e: unknown): ScreenJobError =>
  e instanceof HttpError
    ? { code: e.code, message: e.message, details: e.details ?? [] }
    : {
        code: "server_error",
        message: e instanceof Error ? e.message : String(e),
        details: [],
      };

/** Queue processor: only a queued job is claimed, so duplicate queue items are harmless. */
export async function processScreenJob({ id }: ScreenJobRef, screens: Screens): Promise<void> {
  const doc = await ScreenJob.findOneAndUpdate(
    { _id: id, status: "queued" },
    { $set: { status: "running", progress: 5, stage: "Starting" } },
    { new: true },
  ).lean();
  if (!doc) return;

  const hooks = {
    async progress(progress: number, stage: string) {
      // Writes stop as soon as the user pauses/cancels: the route already set that status.
      await ScreenJob.updateOne({ _id: id, status: "running" }, { $set: { progress, stage } });
    },
    async checkpoint() {
      const s = await ScreenJob.findById(id, { status: 1 }).lean();
      // Paused, cancelled, or resumed into a fresh queue item: this worker must stop. A resumed
      // job is re-queued, so the new worker owns the remaining steps.
      if (s && s.status !== "running") throw new JobHalted(s.status);
    },
  };

  try {
    const result = await screens.generate(doc.prompt, doc.viewer as Viewer, hooks);
    await ScreenJob.updateOne(
      { _id: id, status: { $ne: "cancelled" } },
      {
        $set: { status: "done", result, progress: 100, stage: "Done", finishedAt: new Date() },
      },
    );
    log.info("screen job done", { id });
  } catch (e) {
    if (e instanceof JobHalted) {
      if (e.reason === "cancelled")
        await ScreenJob.updateOne(
          { _id: id, status: "cancelled" },
          { $set: { finishedAt: new Date() } },
        );
      return;
    }
    const err = failure(e);
    await ScreenJob.updateOne(
      { _id: id, status: "running" },
      { $set: { status: "failed", error: err, stage: "Failed", finishedAt: new Date() } },
    );
    log.warn("screen job failed", { id, error: err.message });
  }
}

/**
 * Server start: jobs still marked running were interrupted by a restart. Put them back in the
 * queue (the document keeps the prompt and progress); queued jobs are re-added too. Bounded so a
 * large backlog cannot delay boot.
 */
export async function recoverScreenJobs(queue: Queue<ScreenJobRef>): Promise<void> {
  const cutoff = new Date(Date.now() - 2 * 60_000);
  await ScreenJob.updateMany(
    { status: "running", updatedAt: { $lt: cutoff } },
    { $set: { status: "queued", stage: "Resuming after a restart" } },
  );
  const pending = await ScreenJob.find({ status: "queued" }, { _id: 1 })
    .sort({ createdAt: 1 })
    .limit(50)
    .lean();
  for (const job of pending) await queue.add({ id: String(job._id) });
  if (pending.length) log.info("recovered screen jobs", { count: pending.length });
}
