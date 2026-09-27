import crypto from "node:crypto";
import { RefreshToken } from "../models";
import { log } from "../utils/logger";

export type Audience = "customer" | "admin";

export const REFRESH_TTL_S = 60 * 60 * 24 * 10;
/**
 * Two tabs can refresh with the same token at the same moment. A reuse this soon after the
 * first use is treated as that race (no revocation); anything later is treated as theft.
 */
const REUSE_GRACE_MS = 30_000;

const sha256 = (value: string) => crypto.createHash("sha256").update(value).digest("hex");

/** Creates a refresh token; pass `family` to continue a rotation chain. */
export async function issueRefresh(audience: Audience, subject: string, family?: string) {
  const token = crypto.randomBytes(32).toString("base64url");
  await RefreshToken.create({
    hash: sha256(token),
    audience,
    subject,
    family: family ?? crypto.randomUUID(),
    expiresAt: new Date(Date.now() + REFRESH_TTL_S * 1000),
  });
  return token;
}

/**
 * Marks the token used and returns a new one in the same family, or null when it is
 * unknown, expired, revoked or reused. A reuse outside the grace window revokes the family.
 */
export async function rotateRefresh(
  token: string | undefined,
  audience: Audience,
): Promise<{ subject: string; token: string } | null> {
  if (!token) return null;
  const hash = sha256(token);
  const now = new Date();
  const doc = await RefreshToken.findOneAndUpdate(
    { hash, audience, usedAt: null, revokedAt: null, expiresAt: { $gt: now } },
    { usedAt: now },
  ).lean();
  if (doc) {
    return { subject: doc.subject, token: await issueRefresh(audience, doc.subject, doc.family) };
  }
  const old = await RefreshToken.findOne({ hash, audience }).lean();
  if (old?.usedAt && !old.revokedAt && now.getTime() - old.usedAt.getTime() > REUSE_GRACE_MS) {
    await revokeFamily(old.family);
    log.warn("refresh token reuse, family revoked", { audience });
  }
  return null;
}

/** Sign-out: revokes the token's whole family so no rotated copy stays valid. */
export async function revokeRefresh(token: string | undefined) {
  if (!token) return;
  const doc = await RefreshToken.findOne({ hash: sha256(token) }).lean();
  if (doc) await revokeFamily(doc.family);
}

/** Ends every session of one customer (used when the admin blocks the account). */
export async function revokeSubjectRefresh(audience: Audience, subject: string) {
  await RefreshToken.updateMany({ audience, subject, revokedAt: null }, { revokedAt: new Date() });
}

async function revokeFamily(family: string) {
  await RefreshToken.updateMany({ family, revokedAt: null }, { revokedAt: new Date() });
}
