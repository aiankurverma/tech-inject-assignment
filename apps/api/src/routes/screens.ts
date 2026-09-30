import { Router, type Request, type RequestHandler } from "express";
import { z } from "zod";
import type { Viewer } from "@ti/core";
import type { Auth } from "../middleware/auth";
import { HttpError } from "../utils/http";
import type { Screens } from "../services/screens";

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

export interface ScreenRouteDeps {
  generateLimit: RequestHandler;
  renderLimit: RequestHandler;
}

/**
 * Prompt to screen. Mounted twice: publicly (components the viewer may use) and under
 * /admin behind requireAdmin (every published component). AI calls are rate-limited per IP.
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
  const viewerOf = (req: Request): Promise<Viewer> =>
    mode === "admin" ? Promise.resolve({ kind: "customer", plan: "premium" }) : auth.viewer(req);

  r.post("/generate", deps.generateLimit, async (req, res) => {
    const { prompt } = parseBody(generateBody, req.body);
    res.json(await screens.generate(prompt, await viewerOf(req)));
  });
  r.post("/render", deps.renderLimit, async (req, res) => {
    const { tree } = parseBody(renderBody, req.body);
    res.json(await screens.render(tree, await viewerOf(req)));
  });
  return r;
}
