import { Router, type Request, type RequestHandler } from "express";
import { z } from "zod";
import type { Viewer } from "@ti/core";
import type { Queue } from "@ti/queue";
import type { Auth } from "../middleware/auth";
import { HttpError } from "../utils/http";
import type { Screens } from "../services/screens";
import {
  cancelScreenJob,
  createScreenJob,
  getScreenJob,
  pauseScreenJob,
  resumeScreenJob,
  type ScreenJobRef,
} from "../services/screenJobs";

const generateBody = z.object({
  prompt: z.string().trim().min(8, "describe the screen in a sentence").max(1000),
});
const renderBody = z.object({ tree: z.unknown() });

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

/** The job token may travel in a header (polling) or a JSON body/query (buttons, links). */
function tokenOf(req: Request): string {
  const header = req.get("x-screen-job-token");
  if (header) return header;
  const body = (req.body as { token?: unknown } | undefined)?.token;
  if (typeof body === "string") return body;
  return typeof req.query.token === "string" ? req.query.token : "";
}

const idOf = (req: Request) => String(req.params.id ?? "");

export interface ScreenRouteDeps {
  generateLimit: RequestHandler;
  renderLimit: RequestHandler;
  screenJobs: Queue<ScreenJobRef>;
}

/**
 * Prompt to screen. Generation is a durable background job: POST /generate creates it and
 * returns 202, the client polls /jobs/:id, and pause/resume/cancel only flip the stored status.
 * Mounted twice: publicly and under /admin behind requireAdmin.
 */
export function screenRoutes(
  auth: Auth,
  screens: Screens,
  deps: ScreenRouteDeps,
  mode: "public" | "admin",
) {
  const r = Router();
  r.use((_req, res, next) => {
    res.set("Cache-Control", "no-store");
    next();
  });
  if (mode === "admin") r.use(auth.requireAdmin);
  const identityOf = async (req: Request): Promise<{ viewer: Viewer; owner: string | null }> => {
    if (mode === "admin") return { viewer: { kind: "customer", plan: "premium" }, owner: null };
    const customer = await auth.currentCustomer(req);
    return {
      viewer: customer ? { kind: "customer", plan: customer.plan } : { kind: "anonymous" },
      owner: customer ? String(customer._id) : null,
    };
  };

  r.post("/generate", deps.generateLimit, async (req, res) => {
    const { prompt } = parseBody(generateBody, req.body);
    const { viewer, owner } = await identityOf(req);
    const job = await createScreenJob({ prompt, viewer, owner });
    await deps.screenJobs.add({ id: job.id });
    res.status(202).json(job);
  });

  r.get("/jobs/:id", deps.renderLimit, async (req, res) => {
    res.json(await getScreenJob(idOf(req), tokenOf(req)));
  });

  r.post("/jobs/:id/pause", deps.renderLimit, async (req, res) => {
    res.json(await pauseScreenJob(idOf(req), tokenOf(req)));
  });

  r.post("/jobs/:id/resume", deps.renderLimit, async (req, res) => {
    const { job, resumed } = await resumeScreenJob(idOf(req), tokenOf(req));
    if (resumed) await deps.screenJobs.add({ id: job.id });
    res.json(job);
  });

  r.post("/jobs/:id/cancel", deps.renderLimit, async (req, res) => {
    res.json(await cancelScreenJob(idOf(req), tokenOf(req)));
  });

  r.post("/render", deps.renderLimit, async (req, res) => {
    const { tree } = parseBody(renderBody, req.body);
    res.json(await screens.render(tree, (await identityOf(req)).viewer));
  });
  return r;
}
