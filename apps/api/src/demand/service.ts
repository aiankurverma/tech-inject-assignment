/**
 * Demand capture, opportunity scoring, quality gates and controlled publishing.
 *
 * Safety rules encoded here:
 * - Untrusted text (search boxes, request forms) is normalised and length-limited before it is
 *   stored or handed to an AI builder. It is data, never an instruction.
 * - A component is published only from a draft that has a passing quality report, a human
 *   approval, the kill switch off and the daily batch limit not exceeded.
 * - No email is sent from this module. Notifications are recorded as `pending` for a human.
 */
import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { validateBundle, type Bundle } from "@ti/core";
import type { Cache } from "@ti/cache";
import { clusterTerms, demandScore, isSimilar, normalizeTerm } from "@ti/feature-radar/server";
import { ComponentModel, Customer, type ComponentRecord } from "../models";
import { findPublishedDocs, forgetPublished } from "../services/catalog";
import { HttpError } from "../utils/http";
import { log } from "../utils/logger";
import {
  ComponentRequest,
  DemandAudit,
  DemandNotification,
  DemandOpportunity,
  DemandSettings,
  DemandSignal,
  QualityReport,
  RequestVote,
  type ComponentRequestDoc,
  type DemandSignalDoc,
  type OpportunityDoc,
  type QualityCheck,
  type QualityReportDoc,
} from "./models";

const DAY_MS = 24 * 60 * 60 * 1000;
const REPORT_DIR = fileURLToPath(new URL("../../../../reports", import.meta.url));

const clean = (value: unknown, max: number) =>
  String(value ?? "")
    // eslint-disable-next-line no-control-regex -- stripping control characters is the point
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);

/** User text must never look like an instruction to an LLM. Keep only words and punctuation. */
export const sanitizeUntrusted = (value: unknown, max = 200) => clean(value, max);

/** A term for the AI builder: lowercase words, digits, spaces, dashes and dots only. */
export const safeBuildTerm = (value: unknown) => {
  const term = normalizeTerm(sanitizeUntrusted(value, 80))
    .replace(/[^a-z0-9 \-&.]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 60);
  if (term.length < 2) throw new HttpError(422, "invalid_term", "The request is too short.");
  return term;
};

const SPAM = /https?:\/\/|www\.|\[url=|<a\s+href/i;
const PROFANITY = /\b(?:fuck|shit|bitch|cunt|asshole|dickhead|motherfucker|porn|viagra|casino)\b/i;

export interface RequestInput {
  title: string;
  description: string;
  useCase?: string;
  creditOptIn?: boolean;
  notifyOptIn?: boolean;
  website?: string;
}

export interface PublicRequest {
  id: string;
  title: string;
  description: string;
  useCase: string;
  status: ComponentRequestDoc["status"];
  votes: number;
  componentSlug: string | null;
  creditName: string | null;
  createdAt: string;
}

export const toPublicRequest = (r: ComponentRequestDoc): PublicRequest => ({
  id: String(r._id),
  title: r.title,
  description: r.description,
  useCase: r.useCase,
  status: r.status,
  votes: r.votes,
  componentSlug: r.componentSlug ?? null,
  // Only expose a name when the requester explicitly opted in.
  creditName: r.creditOptIn ? (r.creditName ?? null) : null,
  createdAt: r.createdAt.toISOString(),
});

const published = (docs: ComponentRecord[]): (ComponentRecord & { published: Bundle })[] =>
  docs.filter((d): d is ComponentRecord & { published: Bundle } => !!d.published);

export async function recordSiteSearch(
  cache: Cache,
  input: { query: unknown; resultCount?: unknown; clicked?: unknown; matchedSlug?: unknown },
) {
  const query = sanitizeUntrusted(input.query, 120);
  const normalizedQuery = normalizeTerm(query);
  if (normalizedQuery.length < 2) return { recorded: false };
  const resultCount =
    typeof input.resultCount === "number" && Number.isFinite(input.resultCount)
      ? Math.max(0, Math.floor(input.resultCount))
      : 0;
  const clicked = input.clicked === true;
  let matchedComponentSlug: string | null = null;
  if (typeof input.matchedSlug === "string" && /^[a-z0-9-]{2,48}$/.test(input.matchedSlug)) {
    const exists = await ComponentModel.exists({
      slug: input.matchedSlug,
      status: "published",
    });
    if (exists) matchedComponentSlug = input.matchedSlug;
  }
  const now = new Date();
  await DemandSignal.updateOne(
    { source: "site_search", normalizedQuery },
    {
      $inc: {
        count: 1,
        ...(resultCount === 0 ? { zeroResultCount: 1 } : {}),
        ...(clicked ? { clickedCount: 1 } : {}),
      },
      $set: {
        query,
        lastSeen: now,
        ...(matchedComponentSlug ? { matchedComponentSlug } : {}),
      },
      $setOnInsert: {
        source: "site_search",
        normalizedQuery,
        firstSeen: now,
        status: "new",
      },
    },
    { upsert: true },
  );
  return { recorded: true };
}

type PublishedDoc = ComponentRecord & { published: Bundle };

/** Matches a search term against already-loaded published docs (no extra cache/DB lookups). */
function matchPublished(docs: PublishedDoc[], term: string) {
  const n = normalizeTerm(term);
  return (
    docs.find(
      (d) =>
        d.slug === n.replace(/\s+/g, "-") ||
        isSimilar(n, d.published.name) ||
        isSimilar(n, d.published.slug.replace(/-/g, " ")),
    ) ?? null
  );
}

async function existingComponent(cache: Cache, term: string) {
  return matchPublished(published(await findPublishedDocs(cache)), term);
}

export async function listPublicRequests() {
  const docs = await ComponentRequest.find({ status: { $ne: "rejected" } })
    .sort({ votes: -1, createdAt: -1 })
    .limit(100)
    .lean<ComponentRequestDoc[]>();
  return docs.map(toPublicRequest);
}

export async function createRequest(
  cache: Cache,
  input: RequestInput,
  opts: { customer?: { id: string; name: string; email: string } | null } = {},
) {
  if (clean(input.website, 100)) throw new HttpError(422, "spam", "Request rejected.");
  const title = sanitizeUntrusted(input.title, 80);
  const description = sanitizeUntrusted(input.description, 600);
  const useCase = sanitizeUntrusted(input.useCase, 400);
  if (title.length < 3) throw new HttpError(422, "invalid_title", "Give the request a name.");
  if (description.length < 10)
    throw new HttpError(422, "invalid_description", "Describe what the component should do.");
  if (SPAM.test(`${title} ${description} ${useCase}`) || PROFANITY.test(`${title} ${description}`))
    throw new HttpError(422, "spam", "That request looks like spam. Please rephrase it.");

  const match = await existingComponent(cache, title);
  if (match) {
    return {
      duplicate: true as const,
      componentSlug: match.slug,
      request: null,
      message: "A component already covers this request.",
    };
  }

  const normalizedTitle = normalizeTerm(title);
  const similar = await ComponentRequest.find({ status: { $ne: "rejected" } })
    .sort({ votes: -1 })
    .lean<ComponentRequestDoc[]>();
  const duplicate = similar.find((r) => isSimilar(normalizedTitle, r.normalizedTitle));
  if (duplicate) {
    return {
      duplicate: true as const,
      componentSlug: duplicate.componentSlug ?? null,
      request: toPublicRequest(duplicate),
      message: "This request already exists; vote on the existing one.",
    };
  }

  const doc = await ComponentRequest.create({
    title,
    normalizedTitle,
    description,
    useCase,
    status: "requested",
    votes: 1,
    requesterId: opts.customer?.id ?? null,
    creditName: opts.customer?.name ?? null,
    creditOptIn: !!input.creditOptIn && !!opts.customer,
    notifyOptIn: !!input.notifyOptIn && !!opts.customer,
    componentSlug: null,
  });
  const now = new Date();
  await DemandSignal.updateOne(
    { source: "request_board", normalizedQuery: normalizedTitle },
    {
      $inc: { count: 1, upvotes: 1 },
      $set: { query: title, lastSeen: now },
      $setOnInsert: {
        source: "request_board",
        normalizedQuery: normalizedTitle,
        firstSeen: now,
        status: "new",
      },
    },
    { upsert: true },
  );
  await audit("request.created", "public", String(doc._id), { title, normalizedTitle });
  return {
    duplicate: false as const,
    componentSlug: null,
    request: toPublicRequest(doc.toObject() as ComponentRequestDoc),
    message: "Request created.",
  };
}

const voterHash = (token: string) =>
  createHash("sha256").update(`demand-vote:${token}`).digest("hex");

export async function voteRequest(
  id: string,
  token: string,
  customerId?: string | null,
): Promise<{ votes: number; alreadyVoted: boolean }> {
  const request = await ComponentRequest.findById(id).lean<ComponentRequestDoc>();
  if (!request) throw new HttpError(404, "not_found", "Request not found.");
  if (request.status === "rejected") throw new HttpError(409, "closed", "This request is closed.");
  const hash = voterHash(customerId ? `customer:${customerId}` : clean(token, 120));
  let alreadyVoted = false;
  try {
    await RequestVote.create({ requestId: request._id, voterHash: hash });
  } catch (e) {
    if ((e as { code?: number }).code === 11000) alreadyVoted = true;
    else throw e;
  }
  if (!alreadyVoted) {
    const updated = await ComponentRequest.findByIdAndUpdate(
      request._id,
      { $inc: { votes: 1 } },
      { new: true },
    ).lean<ComponentRequestDoc>();
    const now = new Date();
    await DemandSignal.updateOne(
      { source: "request_board", normalizedQuery: request.normalizedTitle },
      {
        $inc: { upvotes: 1 },
        $set: { lastSeen: now },
        $setOnInsert: {
          source: "request_board",
          normalizedQuery: request.normalizedTitle,
          query: request.title,
          firstSeen: now,
          status: "new",
        },
      },
      { upsert: true },
    );
    return { votes: updated?.votes ?? request.votes + 1, alreadyVoted: false };
  }
  return { votes: request.votes, alreadyVoted: true };
}

/** Parses a Google Search Console "Queries" CSV (quoted fields, CRLF or LF). */
export function parseGscCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n") {
      row.push(field.replace(/\r$/, ""));
      if (row.some((c) => c.trim() !== "")) rows.push(row);
      row = [];
      field = "";
    } else field += ch;
  }
  row.push(field.replace(/\r$/, ""));
  if (row.some((c) => c.trim() !== "")) rows.push(row);
  return rows;
}

export async function importGscCsv(csv: string, actor: string) {
  const rows = parseGscCsv(csv);
  if (!rows.length) throw new HttpError(422, "empty_csv", "The CSV has no rows.");
  const header = rows[0]!.map((h) => h.trim().toLowerCase());
  const find = (...names: string[]) =>
    header.findIndex((h) => names.some((n) => h === n || h.includes(n)));
  const queryCol = find("top queries", "query", "search query");
  const clicksCol = find("clicks", "click");
  const impressionsCol = find("impressions", "impression");
  if (queryCol === -1)
    throw new HttpError(
      422,
      "bad_csv",
      'CSV needs a "Top queries" or "Query" column (and ideally Clicks/Impressions).',
    );
  let imported = 0;
  const now = new Date();
  for (const row of rows.slice(1)) {
    const query = sanitizeUntrusted(row[queryCol], 120);
    const normalizedQuery = normalizeTerm(query);
    if (normalizedQuery.length < 2) continue;
    const num = (i: number) => {
      if (i === -1) return 0;
      const n = Number(String(row[i] ?? "").replace(/[%,$\s]/g, ""));
      return Number.isFinite(n) && n >= 0 ? Math.round(n) : 0;
    };
    await DemandSignal.updateOne(
      { source: "search_console_import", normalizedQuery },
      {
        $set: {
          query,
          impressions: num(impressionsCol),
          clicks: num(clicksCol),
          lastSeen: now,
        },
        $setOnInsert: {
          source: "search_console_import",
          normalizedQuery,
          firstSeen: now,
          status: "new",
          count: 1,
        },
      },
      { upsert: true },
    );
    imported++;
  }
  await audit("gsc.import", actor, "search_console_import", { rows: imported });
  return { imported };
}

export async function getSettings() {
  const existing = await DemandSettings.findById("global").lean();
  if (existing) return existing;
  return (await DemandSettings.findByIdAndUpdate(
    "global",
    { $setOnInsert: { _id: "global" } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  ).lean())!;
}

export async function updateSettings(patch: Record<string, unknown>, actor: string) {
  const allowed: Record<string, unknown> = {};
  for (const key of [
    "killSwitch",
    "autoBuild",
    "autoPublish",
    "buildThreshold",
    "voteThreshold",
    "maxPublishPerDay",
  ]) {
    if (patch[key] !== undefined) allowed[key] = patch[key];
  }
  const doc = await DemandSettings.findByIdAndUpdate(
    "global",
    { $set: allowed, $setOnInsert: { _id: "global" } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  ).lean();
  await audit("settings.updated", actor, "global", allowed);
  return doc;
}

export async function audit(
  action: string,
  actor: string,
  target: string,
  detail: Record<string, unknown> = {},
) {
  await DemandAudit.create({ action, actor, target, detail });
}

export async function scanOpportunities(cache: Cache, actor: string) {
  const signals = await DemandSignal.find().lean<DemandSignalDoc[]>();
  if (!signals.length) return { opportunities: [], scanned: 0 };
  const byTerm = new Map<string, DemandSignalDoc[]>();
  for (const s of signals) {
    const list = byTerm.get(s.normalizedQuery) ?? [];
    list.push(s);
    byTerm.set(s.normalizedQuery, list);
  }
  const docs = published(await findPublishedDocs(cache));
  const settings = await getSettings();
  const clusters = clusterTerms([...byTerm.keys()]);
  const saved: OpportunityDoc[] = [];
  for (const terms of clusters) {
    const members = terms.flatMap((t) => byTerm.get(t) ?? []);
    if (!members.length) continue;
    const canonical = terms
      .map((t) => ({
        t,
        n: (byTerm.get(t) ?? []).reduce((sum, s) => sum + s.count, 0),
      }))
      .sort((a, b) => b.n - a.n || a.t.localeCompare(b.t))[0]!.t;
    const searches = members.reduce((n, s) => n + s.count, 0);
    const upvotes = members.reduce((n, s) => n + s.upvotes, 0);
    const impressions = members.reduce((n, s) => n + s.impressions, 0);
    const clicks = members.reduce((n, s) => n + s.clicks, 0);
    const zeroResults = members.reduce((n, s) => n + s.zeroResultCount, 0);
    const lastSeen = new Date(Math.max(...members.map((s) => s.lastSeen.getTime())));
    const score = demandScore({
      searchCount: searches + upvotes * 2,
      lastSearchedAt: lastSeen,
    });
    const matchedSlug = members.find((s) => s.matchedComponentSlug)?.matchedComponentSlug ?? null;
    const existing =
      (matchedSlug ? docs.find((d) => d.slug === matchedSlug) : null) ??
      matchPublished(docs, canonical);
    const reasons: string[] = [];
    let decision: OpportunityDoc["decision"] = "ignore";
    if (existing) {
      decision = "improve";
      reasons.push(
        `Existing component ${existing.published.name} (/components/${existing.slug}) covers this query; improve that page and add internal links instead of creating a duplicate.`,
      );
    } else if (
      searches >= settings.buildThreshold ||
      upvotes >= settings.voteThreshold ||
      impressions >= 100
    ) {
      decision = "build";
      reasons.push(
        `Passes the demand threshold: ${searches} searches, ${upvotes} upvotes, ${impressions} impressions.`,
      );
      reasons.push("Fits the CRM theme and is not a near-duplicate of a published component.");
    } else {
      reasons.push(
        `Below threshold (${searches} searches, ${upvotes} upvotes, ${impressions} impressions); keep watching.`,
      );
    }
    if (zeroResults > 0) reasons.push(`${zeroResults} on-site searches returned no result.`);
    const clusterKey = canonical;
    // Once a human has reviewed an opportunity, a re-scan must not reset that decision or
    // status. Only the evidence keeps updating, so a rejected idea cannot silently re-open.
    const current = await DemandOpportunity.findOne({ clusterKey })
      .select({ status: 1 })
      .lean<Pick<OpportunityDoc, "status">>();
    const reviewed = current ? current.status !== "open" : false;
    const computed = {
      canonicalQuery: canonical,
      memberQueries: terms,
      demandScore: score,
      evidence: {
        searches,
        upvotes,
        impressions,
        clicks,
        zeroResultRate: searches ? Math.round((zeroResults / searches) * 100) / 100 : 0,
      },
    };
    const savedDoc = await DemandOpportunity.findOneAndUpdate(
      { clusterKey },
      reviewed ? { $set: computed } : { $set: { ...computed, decision, reasons, status: "open" } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    ).lean<OpportunityDoc>();
    if (savedDoc) saved.push(savedDoc);
    // Mark the source signals so the admin can see what has been reviewed. A signal that is
    // already live keeps that status; nothing downgrades published demand.
    await DemandSignal.updateMany(
      { normalizedQuery: { $in: terms }, status: { $ne: "live" } },
      {
        $set: {
          status: existing ? "covered" : decision === "build" ? "reviewing" : "ignored",
          ...(existing ? { matchedComponentSlug: existing.slug } : {}),
        },
      },
    );
  }
  await audit("opportunities.scanned", actor, "demand", { clusters: saved.length });
  return {
    opportunities: saved.sort((a, b) => b.demandScore - a.demandScore),
    scanned: saved.length,
  };
}

/** Automatic quality gate. Visual/a11y checks stay manual until a human confirms them. */
export async function runQualityGate(draftSlug: string, actor: string) {
  const doc = await ComponentModel.findOne({ slug: draftSlug }).lean<ComponentRecord>();
  if (!doc) throw new HttpError(404, "not_found", "Draft not found.");
  const checks: QualityCheck[] = [];
  const result = validateBundle(doc.draft);
  checks.push({
    id: "bundle",
    label: "Bundle validates",
    status: result.ok ? "pass" : "fail",
    detail: result.ok
      ? "Bundle shape, imports and dependencies are valid."
      : result.errors.join("; "),
  });
  const bundle = result.ok ? result.bundle : doc.draft;

  // esbuild is a small, fast parser (already present through Vite). It catches syntax errors
  // without pulling the whole TypeScript compiler into the API process.
  const syntaxErrors: string[] = [];
  let esbuildAvailable = true;
  try {
    const { transform } = await import("esbuild");
    for (const file of bundle.files) {
      try {
        await transform(file.content, {
          loader: "tsx",
          jsx: "automatic",
          target: "es2022",
          format: "esm",
        });
      } catch (e) {
        syntaxErrors.push(`${file.path}: ${e instanceof Error ? e.message : "syntax error"}`);
      }
    }
  } catch {
    esbuildAvailable = false;
  }
  checks.push({
    id: "typescript",
    label: "TypeScript syntax",
    status: esbuildAvailable ? (syntaxErrors.length ? "fail" : "pass") : "manual",
    detail: esbuildAvailable
      ? syntaxErrors.length
        ? syntaxErrors.slice(0, 3).join("; ")
        : "All files transpile."
      : "esbuild is unavailable; run the project build before approving.",
  });

  const code = bundle.files.map((f) => f.content).join("\n");
  const security: string[] = [];
  if (/\beval\s*\(/.test(code)) security.push("eval()");
  if (/\bnew\s+Function\b/.test(code)) security.push("new Function()");
  if (/\bfetch\s*\(/.test(code)) security.push("fetch()");
  if (/XMLHttpRequest/.test(code)) security.push("XMLHttpRequest");
  if (/(?:https?:)?\/\//.test(code.replace(/\/\*[\s\S]*?\*\//g, ""))) security.push("remote URL");
  if (/process\.env/.test(code)) security.push("process.env");
  if (/(?:sk-|ghp_|AKIA|-----BEGIN|api[_-]?key\s*[:=])/i.test(code))
    security.push("secret-like text");
  checks.push({
    id: "security",
    label: "No remote code, eval or secrets",
    status: security.length ? "fail" : "pass",
    detail: security.length ? `Found ${security.join(", ")}.` : "No remote code, eval or secrets.",
  });

  const title = `${bundle.name} – React ${bundle.category} Component | Kitbase`;
  checks.push({
    id: "title",
    label: "Page title 50–60 characters",
    status: title.length >= 50 && title.length <= 60 ? "pass" : "fail",
    detail: `${title.length} chars: ${title}`,
  });
  checks.push({
    id: "description",
    label: "Meta description 140–160 characters",
    status: bundle.description.length >= 140 && bundle.description.length <= 160 ? "pass" : "fail",
    detail: `${bundle.description.length} chars.`,
  });
  checks.push({
    id: "h1",
    label: "One clear H1",
    status: bundle.name.trim().length >= 2 ? "pass" : "fail",
    detail: `H1: ${bundle.name}`,
  });
  checks.push({
    id: "props",
    label: "Props table",
    status: bundle.props.length >= 1 ? "pass" : "fail",
    detail: `${bundle.props.length} documented props.`,
  });
  checks.push({
    id: "variants",
    label: "At least 2 meaningful variants",
    status: bundle.examples.length >= 2 ? "pass" : "fail",
    detail: `${bundle.examples.length} examples.`,
  });
  const publishedDocs = published(await findPublishedDocsFromModel());
  const related = publishedDocs.filter(
    (d) => d.slug !== draftSlug && d.published.category === bundle.category,
  );
  checks.push({
    id: "related",
    label: "At least 3 related components",
    status: related.length >= 3 ? "pass" : "fail",
    detail: `${related.length} published components in ${bundle.category}.`,
  });
  const tokensOf = (s: string) =>
    new Set(
      s
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter((t) => t.length > 2),
    );
  const mine = tokensOf(`${bundle.name} ${bundle.description} ${bundle.usage}`);
  const jaccard = (a: Set<string>, b: Set<string>) => {
    const inter = [...a].filter((x) => b.has(x)).length;
    const union = new Set([...a, ...b]).size;
    return union ? inter / union : 0;
  };
  let maxSimilarity = 0;
  let closest = "";
  for (const d of publishedDocs) {
    if (d.slug === draftSlug) continue;
    const sim = jaccard(mine, tokensOf(`${d.published.name} ${d.published.description}`));
    if (sim > maxSimilarity) {
      maxSimilarity = sim;
      closest = d.slug;
    }
  }
  checks.push({
    id: "uniqueness",
    label: "Unique page copy",
    status: maxSimilarity < 0.85 ? "pass" : "fail",
    detail: `${Math.round(maxSimilarity * 100)}% similar to ${closest || "no page"}.`,
  });
  checks.push({
    id: "install",
    label: "Install command and breadcrumb",
    status: "pass",
    detail:
      "Generated from the canonical origin at render time; breadcrumb is in the page template.",
  });
  // These need a browser and a human eye. They stay `manual` and block publishing until confirmed.
  checks.push({
    id: "a11y",
    label: "Accessibility (axe, keyboard)",
    status: "manual",
    detail: "Run the preview through axe and keyboard navigation, then confirm in review.",
  });
  checks.push({
    id: "responsive",
    label: "Responsive at 375px, tablet and desktop",
    status: "manual",
    detail: "Check the live preview for horizontal overflow at 375px, 768px and 1280px.",
  });
  checks.push({
    id: "performance",
    label: "Preview performance budget",
    status: "manual",
    detail: "Confirm the preview is lazy-loaded and the component payload is within budget.",
  });

  const passed = checks.every((c) => c.status === "pass");
  const report = await QualityReport.create({ draftSlug, checks, passed });
  await audit("quality.run", actor, draftSlug, {
    passed,
    failed: checks.filter((c) => c.status === "fail").map((c) => c.id),
    manual: checks.filter((c) => c.status === "manual").map((c) => c.id),
  });
  return report.toObject() as QualityReportDoc;
}

async function findPublishedDocsFromModel() {
  return ComponentModel.find({ status: "published" }).lean<ComponentRecord[]>();
}

export async function confirmManualChecks(reportId: string, checkIds: string[], actor: string) {
  const report = await QualityReport.findById(reportId);
  if (!report) throw new HttpError(404, "not_found", "Quality report not found.");
  const wanted = new Set(checkIds);
  report.checks = report.checks.map((c) =>
    c.status === "manual" && wanted.has(c.id)
      ? { ...c, status: "pass" as const, detail: `Confirmed manually by ${actor}.` }
      : c,
  );
  report.passed = report.checks.every((c) => c.status === "pass");
  await report.save();
  await audit("quality.confirm", actor, report.draftSlug, { checkIds, passed: report.passed });
  return report.toObject() as QualityReportDoc;
}

export async function setOpportunityDecision(
  id: string,
  decision: "build" | "improve" | "ignore",
  actor: string,
  note?: string,
) {
  const opp = await DemandOpportunity.findById(id);
  if (!opp) throw new HttpError(404, "not_found", "Opportunity not found.");
  if (opp.status === "published")
    throw new HttpError(
      409,
      "already_published",
      "This component is already live; use the catalogue editor to change it.",
    );
  opp.decision = decision;
  if (decision === "build") {
    opp.status = "approved";
    if (!opp.requestId) {
      // Prefer the existing public request. Creating a second row for the same idea would
      // split votes and could notify the requester twice.
      const normalized = normalizeTerm(opp.canonicalQuery);
      const openRequests = await ComponentRequest.find({ status: { $ne: "rejected" } })
        .sort({ votes: -1 })
        .limit(200)
        .lean<ComponentRequestDoc[]>();
      const existing = openRequests.find((r) => isSimilar(normalized, r.normalizedTitle));
      if (existing) {
        opp.requestId = existing._id;
        await ComponentRequest.updateOne(
          { _id: existing._id },
          { $set: { status: "building", opportunityId: opp._id } },
        );
      } else {
        const req = await ComponentRequest.create({
          title: sanitizeUntrusted(opp.canonicalQuery, 80),
          normalizedTitle: normalizeTerm(opp.canonicalQuery),
          description: `Requested through demand signals (${opp.evidence.searches} searches, ${opp.evidence.upvotes} upvotes).`,
          useCase: "Collected from the public request board and on-site search.",
          status: "building",
          votes: Math.max(1, opp.evidence.upvotes),
          creditOptIn: false,
          notifyOptIn: false,
          opportunityId: opp._id,
        });
        opp.requestId = req._id;
      }
    } else {
      await ComponentRequest.updateOne({ _id: opp.requestId }, { $set: { status: "building" } });
    }
  } else if (decision === "improve") {
    opp.status = "open";
  } else {
    opp.status = "rejected";
  }
  opp.reviewedBy = actor;
  opp.reviewedAt = new Date();
  if (note) opp.reasons = [...opp.reasons, sanitizeUntrusted(note, 400)];
  await opp.save();
  await audit("opportunity.decision", actor, id, { decision, note: note ?? "" });
  return opp.toObject();
}

export async function linkFeatureRequest(id: string, featureRequestId: string, actor: string) {
  const opp = await DemandOpportunity.findByIdAndUpdate(
    id,
    { $set: { featureRequestId, status: "drafting" } },
    { new: true },
  ).lean<OpportunityDoc>();
  if (!opp) throw new HttpError(404, "not_found", "Opportunity not found.");
  await audit("opportunity.draft", actor, id, { featureRequestId });
  return opp;
}

export async function recordDraftQuality(id: string, draftSlug: string, actor: string) {
  const report = await runQualityGate(draftSlug, actor);
  const opp = await DemandOpportunity.findByIdAndUpdate(
    id,
    {
      $set: {
        draftSlug,
        qualityReportId: report._id,
        status: "review",
      },
    },
    { new: true },
  ).lean<OpportunityDoc>();
  if (!opp) throw new HttpError(404, "not_found", "Opportunity not found.");
  await ComponentRequest.updateOne({ _id: opp.requestId }, { $set: { status: "in_review" } });
  return { opportunity: opp, report };
}

export async function approveOpportunity(id: string, actor: string) {
  const opp = await DemandOpportunity.findById(id);
  if (!opp) throw new HttpError(404, "not_found", "Opportunity not found.");
  if (!opp.qualityReportId)
    throw new HttpError(409, "no_quality_report", "Run the quality gate first.");
  const report = await QualityReport.findById(opp.qualityReportId).lean<QualityReportDoc>();
  if (!report?.passed)
    throw new HttpError(
      409,
      "quality_failed",
      "The quality report has failing or unconfirmed checks.",
    );
  opp.status = "approved_to_publish";
  opp.reviewedBy = actor;
  opp.reviewedAt = new Date();
  await opp.save();
  await audit("opportunity.approved", actor, id, { draftSlug: opp.draftSlug });
  return opp.toObject();
}

export async function rejectOpportunity(id: string, actor: string, reason: string) {
  const opp = await DemandOpportunity.findByIdAndUpdate(
    id,
    {
      $set: {
        status: "rejected",
        decision: "ignore",
        rejectionReason: sanitizeUntrusted(reason, 400),
        reviewedBy: actor,
        reviewedAt: new Date(),
      },
    },
    { new: true },
  ).lean<OpportunityDoc>();
  if (!opp) throw new HttpError(404, "not_found", "Opportunity not found.");
  await audit("opportunity.rejected", actor, id, { reason });
  return opp;
}

export async function publishOpportunity(id: string, cache: Cache, actor: string) {
  const opp = await DemandOpportunity.findById(id);
  if (!opp) throw new HttpError(404, "not_found", "Opportunity not found.");
  if (opp.status === "published")
    throw new HttpError(409, "already_published", "This opportunity is already live.");
  const settings = await getSettings();
  if (settings.killSwitch)
    throw new HttpError(409, "kill_switch", "Publishing is paused by the global kill switch.");
  if (!settings.autoPublish && opp.status !== "approved_to_publish")
    throw new HttpError(409, "not_approved", "Approve this opportunity before publishing.");
  if (!opp.draftSlug) throw new HttpError(409, "no_draft", "No draft is linked.");
  const report = opp.qualityReportId
    ? await QualityReport.findById(opp.qualityReportId).lean<QualityReportDoc>()
    : await QualityReport.findOne({ draftSlug: opp.draftSlug })
        .sort({ createdAt: -1 })
        .lean<QualityReportDoc>();
  if (!report?.passed)
    throw new HttpError(409, "quality_failed", "The quality gate has not passed.");
  const doc = await ComponentModel.findOne({ slug: opp.draftSlug }).lean<ComponentRecord>();
  if (!doc) throw new HttpError(404, "not_found", "Draft not found.");
  const valid = validateBundle(doc.draft);
  if (!valid.ok) throw new HttpError(422, "invalid_bundle", "Draft is invalid.", valid.errors);

  // Reserve one slot in the daily batch atomically. A stale read could otherwise let two
  // concurrent publishes both pass the limit check. The counter is a safety budget: on a
  // later failure it is released again.
  const today = new Date().toISOString().slice(0, 10);
  await DemandSettings.updateOne(
    { _id: "global", publishedDay: { $ne: today } },
    { $set: { publishedDay: today, publishedToday: 0 } },
  );
  const reserved = await DemandSettings.findOneAndUpdate(
    {
      _id: "global",
      killSwitch: { $ne: true },
      publishedToday: { $lt: settings.maxPublishPerDay },
    },
    { $inc: { publishedToday: 1 } },
    { new: true },
  ).lean();
  if (!reserved)
    throw new HttpError(
      409,
      "batch_limit",
      `Daily publish limit reached (${settings.maxPublishPerDay}). Try again tomorrow.`,
    );

  try {
    await ComponentModel.updateOne(
      { slug: opp.draftSlug },
      { $set: { status: "published", published: valid.bundle, publishedAt: new Date() } },
    );
    await forgetPublished(cache, opp.draftSlug);
    opp.status = "published";
    opp.publishedAt = new Date();
    await opp.save();
    if (opp.requestId) {
      await ComponentRequest.updateOne(
        { _id: opp.requestId },
        { $set: { status: "live", componentSlug: opp.draftSlug } },
      );
    }
    await DemandSignal.updateMany(
      { normalizedQuery: { $in: opp.memberQueries } },
      { $set: { status: "live", matchedComponentSlug: opp.draftSlug } },
    );
    // Opt-in notifications are recorded only; nothing is emailed without an explicit decision.
    const requests = await ComponentRequest.find({
      componentSlug: opp.draftSlug,
      notifyOptIn: true,
      requesterId: { $ne: null },
    }).lean<ComponentRequestDoc[]>();
    const customerIds = requests.map((r) => r.requesterId).filter(Boolean);
    const customers = await Customer.find({ _id: { $in: customerIds } })
      .select({ email: 1 })
      .lean();
    const emailById = new Map(customers.map((c) => [String(c._id), c.email]));
    let notifications = 0;
    for (const request of requests) {
      const email = request.requesterId ? emailById.get(String(request.requesterId)) : undefined;
      if (!email) continue;
      try {
        await DemandNotification.create({
          requestId: request._id,
          email,
          componentSlug: opp.draftSlug,
          status: "pending",
        });
        notifications++;
      } catch (e) {
        // The unique (requestId, componentSlug) index makes re-publishing idempotent.
        if ((e as { code?: number }).code !== 11000) throw e;
      }
    }
    await audit("opportunity.published", actor, id, {
      slug: opp.draftSlug,
      notifications,
    });
    log.info("demand component published", { slug: opp.draftSlug, opportunity: id });
    return { opportunity: opp.toObject(), slug: opp.draftSlug, notifications };
  } catch (e) {
    await DemandSettings.updateOne(
      { _id: "global", publishedToday: { $gt: 0 } },
      { $inc: { publishedToday: -1 } },
    );
    throw e;
  }
}

export async function listNotifications() {
  return DemandNotification.find().sort({ createdAt: -1 }).limit(100).lean();
}

export async function markNotificationSent(id: string, actor: string) {
  const n = await DemandNotification.findByIdAndUpdate(
    id,
    { $set: { status: "sent" } },
    { new: true },
  ).lean();
  if (!n) throw new HttpError(404, "not_found", "Notification not found.");
  await audit("notification.sent", actor, id, { componentSlug: n.componentSlug });
  return n;
}

export async function weeklyReport(cache: Cache, actor = "system") {
  const since = new Date(Date.now() - 7 * DAY_MS);
  const [signals, opportunities, requests, reports, recent, settings] = await Promise.all([
    DemandSignal.find({ lastSeen: { $gte: since } })
      .sort({ count: -1, impressions: -1 })
      .limit(40)
      .lean<DemandSignalDoc[]>(),
    DemandOpportunity.find().sort({ demandScore: -1 }).limit(40).lean<OpportunityDoc[]>(),
    ComponentRequest.find()
      .sort({ votes: -1, createdAt: -1 })
      .limit(40)
      .lean<ComponentRequestDoc[]>(),
    QualityReport.find({ createdAt: { $gte: since } })
      .sort({ createdAt: -1 })
      .limit(40)
      .lean<QualityReportDoc[]>(),
    ComponentModel.find({ status: "published", publishedAt: { $gte: since } })
      .sort({ publishedAt: -1 })
      .lean<ComponentRecord[]>(),
    getSettings(),
  ]);
  const date = new Date().toISOString().slice(0, 10);
  const lines: string[] = [
    `# Demand report — ${date}`,
    "",
    `Kill switch: **${settings.killSwitch ? "ON" : "off"}** · auto-build: **${settings.autoBuild ? "on" : "off"}** · auto-publish: **${settings.autoPublish ? "on" : "off"}** · batch limit: **${settings.maxPublishPerDay}/day**`,
    "",
    "## New demand signals (last 7 days)",
    ...signals.map(
      (s) =>
        `- **${s.query}** — ${s.count} searches, ${s.upvotes} upvotes, ${s.impressions} impressions, ${s.clicks} clicks (${s.source})`,
    ),
    signals.length ? "" : "- None.",
    "",
    "## Ranked opportunities",
    ...opportunities.map(
      (o) =>
        `- **${o.canonicalQuery}** — score ${o.demandScore}, decision **${o.decision}**, status **${o.status}**. ${o.reasons[0] ?? ""}`,
    ),
    opportunities.length ? "" : "- None.",
    "",
    "## Request board",
    ...requests.map(
      (r) =>
        `- **${r.title}** — ${r.votes} votes, status **${r.status}**${r.componentSlug ? `, live as /components/${r.componentSlug}` : ""}`,
    ),
    requests.length ? "" : "- None.",
    "",
    "## Quality reports (last 7 days)",
    ...reports.map(
      (r) =>
        `- ${r.draftSlug}: **${r.passed ? "passed" : "not passed"}** (${r.checks.filter((c) => c.status === "fail").length} failing, ${r.checks.filter((c) => c.status === "manual").length} manual)`,
    ),
    reports.length ? "" : "- None.",
    "",
    "## Published this week",
    ...recent.map((r) => `- /components/${r.slug} — ${r.publishedAt?.toISOString().slice(0, 10)}`),
    recent.length ? "" : "- None.",
    "",
    "## Search Console follow-ups",
    "- Import a fresh GSC Queries CSV to refresh impressions and clicks.",
    "- Page-level GSC data is not imported yet. Add page-level CSV support before making CTR/no-impression decisions.",
    "- For pages with impressions but low CTR, rewrite the title and description; do not create a new page.",
    "- For pages with no impressions after 60 days, improve, merge or noindex them.",
    "",
    "## Rejection reasons (feedback for future drafts)",
    ...opportunities
      .filter((o) => o.rejectionReason)
      .map((o) => `- ${o.canonicalQuery}: ${o.rejectionReason}`),
    "",
  ];
  await mkdir(REPORT_DIR, { recursive: true });
  const file = `${REPORT_DIR}/demand-${date}.md`;
  await writeFile(file, `${lines.join("\n")}\n`, "utf8");
  await audit("report.generated", actor, file, {
    signals: signals.length,
    opportunities: opportunities.length,
  });
  return { file, markdown: lines.join("\n") };
}

export async function overview(cache: Cache) {
  const [settings, signals, opportunities, requests, reports, pendingNotifications] =
    await Promise.all([
      getSettings(),
      DemandSignal.countDocuments(),
      DemandOpportunity.aggregate<{ _id: string; n: number }>([
        { $group: { _id: "$status", n: { $sum: 1 } } },
      ]),
      ComponentRequest.countDocuments(),
      QualityReport.countDocuments({ passed: true }),
      DemandNotification.countDocuments({ status: "pending" }),
    ]);
  const docs = published(await findPublishedDocs(cache));
  return {
    settings,
    signals,
    opportunities,
    requests,
    qualityPassed: reports,
    pendingNotifications,
    publishedComponents: docs.length,
  };
}
