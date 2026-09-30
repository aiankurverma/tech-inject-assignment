import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import type { NextFunction, Request, Response } from "express";
import type { Types } from "mongoose";
import { decideTeamAccess, type ComponentStatus, type TeamAction, type Viewer } from "@ti/core";
import type { Env } from "../config/env";
import {
  ApiToken,
  Customer,
  Team,
  TeamMember,
  type CustomerDoc,
  type TeamDoc,
  type TeamMemberDoc,
} from "../models";
import { denyError, HttpError, teamErrors } from "../utils/http";
import { issueRefresh, REFRESH_TTL_S, revokeRefresh, rotateRefresh } from "../services/refresh";
import { teamScope, type TeamScope } from "../services/teamRepo";

export interface Principal {
  customer: CustomerDoc;
  /** Set when the caller used a team-scoped API token. */
  tokenTeamId: Types.ObjectId | null;
}

export interface TeamContext {
  customer: CustomerDoc;
  team: TeamDoc;
  member: TeamMemberDoc;
  repo: TeamScope;
}

export const CUSTOMER_COOKIE = "ti_session";
export const ADMIN_COOKIE = "ti_admin";
export const CUSTOMER_REFRESH_COOKIE = "ti_refresh";
export const ADMIN_REFRESH_COOKIE = "ti_admin_refresh";
const CUSTOMER_REFRESH_PATH = "/api/auth";
const ADMIN_PATH = "/api/admin";
/** Short-lived access JWT; the 10-day refresh token (refresh.ts) renews it. */
export const ACCESS_TTL_S = 15 * 60;

/** True when the request authenticates with an API token (same test `principal()` uses). */
export const usesBearer = (req: Request) => !!req.get("authorization")?.startsWith("Bearer ");

export const sha256 = (value: string) => crypto.createHash("sha256").update(value).digest("hex");

export function newApiToken() {
  const token = `ti_${crypto.randomBytes(24).toString("base64url")}`;
  return { token, hash: sha256(token), prefix: token.slice(0, 7) };
}

export function safeEqual(a: string, b: string) {
  const ha = Buffer.from(sha256(a));
  const hb = Buffer.from(sha256(b));
  return crypto.timingSafeEqual(ha, hb);
}

/** Disabled accounts behave as signed out everywhere (cookie and token), on the very next request. */
const findActiveCustomer = (id: unknown) =>
  Customer.findOne({ _id: id, disabled: { $ne: true } }).lean<CustomerDoc>();

export function makeAuth(env: Env) {
  const secure = env.NODE_ENV === "production";
  // Admin and customer tokens use different audiences, so one can never pass as the other.
  const sign = (sub: string, aud: "customer" | "admin", ttl: number) =>
    jwt.sign({ sub }, env.JWT_SECRET, { audience: aud, expiresIn: ttl });
  const verify = (token: string | undefined, aud: "customer" | "admin"): string | null => {
    if (!token) return null;
    try {
      const payload = jwt.verify(token, env.JWT_SECRET, { audience: aud });
      return typeof payload === "object" && typeof payload.sub === "string" ? payload.sub : null;
    } catch {
      return null;
    }
  };

  const cookieOpts = (maxAgeS: number, path = "/") => ({
    httpOnly: true,
    secure,
    sameSite: "strict" as const,
    path,
    maxAge: maxAgeS * 1000,
  });

  return {
    /** Sign-in: 15-minute access cookie plus a new 10-day refresh token family. */
    async startCustomerSession(res: Response, customerId: string) {
      res.cookie(
        CUSTOMER_COOKIE,
        sign(customerId, "customer", ACCESS_TTL_S),
        cookieOpts(ACCESS_TTL_S),
      );
      const refresh = await issueRefresh("customer", customerId);
      res.cookie(
        CUSTOMER_REFRESH_COOKIE,
        refresh,
        cookieOpts(REFRESH_TTL_S, CUSTOMER_REFRESH_PATH),
      );
    },
    /** Rotates the refresh cookie and issues a new access cookie; null if it cannot. */
    async refreshCustomerSession(req: Request, res: Response): Promise<CustomerDoc | null> {
      const rotated = await rotateRefresh(req.cookies?.[CUSTOMER_REFRESH_COOKIE], "customer");
      const customer = rotated ? await findActiveCustomer(rotated.subject) : null;
      if (!rotated || !customer) {
        this.clearCustomerCookies(res);
        return null;
      }
      res.cookie(
        CUSTOMER_COOKIE,
        sign(rotated.subject, "customer", ACCESS_TTL_S),
        cookieOpts(ACCESS_TTL_S),
      );
      res.cookie(
        CUSTOMER_REFRESH_COOKIE,
        rotated.token,
        cookieOpts(REFRESH_TTL_S, CUSTOMER_REFRESH_PATH),
      );
      return customer;
    },
    async endCustomerSession(req: Request, res: Response) {
      await revokeRefresh(req.cookies?.[CUSTOMER_REFRESH_COOKIE]);
      this.clearCustomerCookies(res);
    },
    clearCustomerCookies(res: Response) {
      res.clearCookie(CUSTOMER_COOKIE, { path: "/" });
      res.clearCookie(CUSTOMER_REFRESH_COOKIE, { path: CUSTOMER_REFRESH_PATH });
    },

    async startAdminSession(res: Response) {
      res.cookie(
        ADMIN_COOKIE,
        sign("admin", "admin", ACCESS_TTL_S),
        cookieOpts(ACCESS_TTL_S, ADMIN_PATH),
      );
      const refresh = await issueRefresh("admin", "admin");
      res.cookie(ADMIN_REFRESH_COOKIE, refresh, cookieOpts(REFRESH_TTL_S, ADMIN_PATH));
    },
    async refreshAdminSession(req: Request, res: Response): Promise<boolean> {
      const rotated = await rotateRefresh(req.cookies?.[ADMIN_REFRESH_COOKIE], "admin");
      if (!rotated) {
        this.clearAdminCookies(res);
        return false;
      }
      res.cookie(
        ADMIN_COOKIE,
        sign("admin", "admin", ACCESS_TTL_S),
        cookieOpts(ACCESS_TTL_S, ADMIN_PATH),
      );
      res.cookie(ADMIN_REFRESH_COOKIE, rotated.token, cookieOpts(REFRESH_TTL_S, ADMIN_PATH));
      return true;
    },
    async endAdminSession(req: Request, res: Response) {
      await revokeRefresh(req.cookies?.[ADMIN_REFRESH_COOKIE]);
      this.clearAdminCookies(res);
    },
    clearAdminCookies(res: Response) {
      res.clearCookie(ADMIN_COOKIE, { path: ADMIN_PATH });
      res.clearCookie(ADMIN_REFRESH_COOKIE, { path: ADMIN_PATH });
    },

    /**
     * Who is calling: bearer token (CLI, agents) or session cookie. Loaded fresh from the DB on
     * every request, so plan changes, blocks and revocations apply at once.
     * `tokenTeamId` is set for team-scoped tokens; they may only touch that team's routes.
     */
    async principal(req: Request): Promise<Principal | null> {
      const header = req.get("authorization");
      if (header && usesBearer(req)) {
        const token = await ApiToken.findOne({
          hash: sha256(header.slice(7).trim()),
          revokedAt: null,
        });
        if (!token)
          throw new HttpError(401, "invalid_token", "The access token is invalid or revoked.");
        await ApiToken.updateOne({ _id: token._id }, { lastUsedAt: new Date() });
        const customer = await findActiveCustomer(token.customerId);
        return customer ? { customer, tokenTeamId: token.teamId ?? null } : null;
      }
      const id = verify(req.cookies?.[CUSTOMER_COOKIE], "customer");
      if (!id) return null;
      const customer = await findActiveCustomer(id);
      return customer ? { customer, tokenTeamId: null } : null;
    },

    /** Public catalogue identity. A team token never counts here, so it can never use its owner's plan. */
    async currentCustomer(req: Request): Promise<CustomerDoc | null> {
      const p = await this.principal(req);
      if (p?.tokenTeamId) throw teamErrors.tokenScope();
      return p?.customer ?? null;
    },

    async viewer(req: Request): Promise<Viewer> {
      const c = await this.currentCustomer(req);
      return c ? { kind: "customer", plan: c.plan } : { kind: "anonymous" };
    },

    /**
     * Resolves a team request: who is calling, which team, what role, and whether `action` is
     * allowed. Order is fixed so anonymous callers learn nothing (401 before any DB lookup),
     * non-members and unknown/disabled teams look identical (404), and only members with too
     * low a role see 403. Membership is read from Mongo on every call - nothing is cached.
     */
    async teamContext(
      req: Request,
      teamSlug: string,
      action: TeamAction,
      component?: { status: ComponentStatus } | null,
    ): Promise<TeamContext> {
      return this.teamContextFor(await this.principal(req), teamSlug, action, component);
    },

    /** Same as `teamContext` for an already resolved principal (cookie routes after `requireCustomer`). */
    async teamContextFor(
      p: Principal | null,
      teamSlug: string,
      action: TeamAction,
      component?: { status: ComponentStatus } | null,
    ): Promise<TeamContext> {
      if (!p) throw teamErrors.signIn();
      const team = await Team.findOne({ slug: teamSlug, disabled: false }).lean<TeamDoc>();
      if (!team) throw teamErrors.notFound();
      if (p.tokenTeamId && !p.tokenTeamId.equals(team._id)) throw teamErrors.notFound();
      const member = await TeamMember.findOne({
        teamId: team._id,
        customerId: p.customer._id,
      }).lean<TeamMemberDoc>();
      const decision = decideTeamAccess(
        component === undefined ? { status: "published" } : component,
        { kind: "customer", role: member?.role ?? null },
        action,
      );
      if (!decision.allowed) {
        if (decision.reason === "not_found") throw teamErrors.notFound();
        if (decision.reason === "sign_in_required") throw teamErrors.signIn();
        throw denyError(decision.reason);
      }
      return {
        customer: p.customer,
        team,
        member: member!,
        repo: teamScope(team._id, team.slug, p.customer._id),
      };
    },

    requireCustomer: async (req: Request, res: Response, next: NextFunction) => {
      const id = verify(req.cookies?.[CUSTOMER_COOKIE], "customer");
      const customer = id ? await findActiveCustomer(id) : null;
      if (!customer) throw new HttpError(401, "unauthorized", "Sign in first.");
      res.locals.customer = customer;
      next();
    },

    requireAdmin: (req: Request, _res: Response, next: NextFunction) => {
      if (verify(req.cookies?.[ADMIN_COOKIE], "admin") !== "admin") {
        throw new HttpError(401, "unauthorized", "Admin sign-in required.");
      }
      next();
    },
  };
}

export type Auth = ReturnType<typeof makeAuth>;

/**
 * Cookie-authenticated writes must come from our own pages (CSRF defence on top of SameSite=strict).
 * Requests without cookies (CLI with bearer token, tests) are not affected.
 */
export function sameOriginWrites(env: Env) {
  const trusted = new Set([
    new URL(env.PUBLIC_ORIGIN).origin,
    ...env.TRUSTED_ORIGINS.split(",")
      .map((o) => o.trim())
      .filter(Boolean),
  ]);
  return (req: Request, _res: Response, next: NextFunction) => {
    if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();
    const origin = req.get("origin");
    if (origin && !trusted.has(origin)) {
      throw new HttpError(403, "bad_origin", "Request origin is not allowed.");
    }
    next();
  };
}
