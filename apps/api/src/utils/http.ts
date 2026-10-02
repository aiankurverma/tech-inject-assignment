import type { NextFunction, Request, Response } from "express";
import type { z } from "zod";
import type { DenyReason } from "@ti/core";

export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: string[],
  ) {
    super(message);
  }
}

const DENY: Record<DenyReason, HttpError> = {
  not_found: new HttpError(404, "not_found", "Component not found."),
  sign_in_required: new HttpError(
    401,
    "sign_in_required",
    "This is a premium component. Sign in with a premium account (or set KITBASE_TOKEN) to use it.",
  ),
  premium_required: new HttpError(
    403,
    "premium_required",
    "Premium access required. Ask the library admin to upgrade your account.",
  ),
  team_role_required: new HttpError(
    403,
    "team_role_required",
    "Your role in this team does not allow that.",
  ),
};

export const denyError = (reason: DenyReason) => DENY[reason];

/** Parses a request body with a zod schema; 400 `invalid_input` with one line per problem. */
export function parseBody<T extends z.ZodTypeAny>(schema: T, body: unknown): z.infer<T> {
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

/** Team workspace errors. Kept in one place so every route returns the same body. */
export const teamErrors = {
  /** Anonymous callers: same body whether or not the team exists. */
  signIn: () =>
    new HttpError(
      401,
      "sign_in_required",
      "Sign in (or set KITBASE_TOKEN) to use team components.",
    ),
  notFound: () => new HttpError(404, "not_found", "Not found."),
  lastOwner: () => new HttpError(409, "last_owner", "A team needs at least one owner."),
  slugTaken: () => new HttpError(409, "slug_taken", "That slug is already used."),
  inviteInvalid: () => new HttpError(410, "invite_invalid", "This invite is no longer valid."),
  tokenScope: () =>
    new HttpError(401, "token_scope", "This is a team token; it only installs @team components."),
  limit: (what: string) => new HttpError(409, "limit_reached", `Limit reached: ${what}.`),
};

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.code, message: err.message, details: err.details });
    return;
  }
  if (err instanceof SyntaxError && "body" in err) {
    res.status(400).json({ error: "invalid_json", message: "Request body is not valid JSON." });
    return;
  }
  if (typeof err === "object" && err !== null && "type" in err && err.type === "entity.too.large") {
    res.status(413).json({ error: "too_large", message: "Request body is too large." });
    return;
  }
  // Unknown error: log type and message only, never the request.
  console.error(JSON.stringify({ level: "error", msg: "unhandled", error: String(err) }));
  res.status(500).json({ error: "server_error", message: "Something went wrong. Try again." });
}
