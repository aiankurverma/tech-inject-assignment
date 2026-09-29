import { differenceInCalendarDays, parseISO } from "date-fns";

/** A line on the bank statement. Amounts are integer minor units (cents); credits positive. */
export interface BankLine {
  id: string;
  /** ISO date, e.g. "2026-03-14". */
  date: string;
  description: string;
  reference?: string;
  amount: number;
}

/** An entry in the books (ledger). Same sign convention as BankLine. */
export interface BookEntry {
  id: string;
  date: string;
  description: string;
  reference?: string;
  account?: string;
  amount: number;
}

export type MatchKind = "manual" | "auto" | "rule";

export interface ReconMatch {
  id: string;
  bankIds: string[];
  bookIds: string[];
  kind: MatchKind;
  /** Difference booked as an adjustment (bank - book), in minor units. 0 for exact matches. */
  adjustment: number;
  createdAt: string;
}

/** A user-defined rule: bank lines whose description contains `contains` prefer entries on `account`. */
export interface ReconRule {
  id: string;
  name: string;
  contains: string;
  account?: string;
  /** Allowed date drift in days for this rule. */
  maxDays: number;
}

export interface Suggestion {
  bankId: string;
  bookId: string;
  /** 0..1 */
  confidence: number;
  reasons: string[];
  ruleId?: string;
}

export interface ScorerOptions {
  /** Max days between bank and book dates to be considered (default 7). */
  maxDays?: number;
  /** Absolute amount tolerance in minor units (default 0 = exact). */
  amountTolerance?: number;
  /** Max suggestions per bank line (default 3). */
  perLine?: number;
  rules?: ReconRule[];
}

const STOP = new Set([
  "the",
  "and",
  "for",
  "payment",
  "pmt",
  "ref",
  "inv",
  "to",
  "from",
  "ltd",
  "inc",
]);

/** Lowercase alphanumeric tokens (length >= 3), minus noise words. */
export function tokenize(s: string): string[] {
  const out: string[] = [];
  for (const t of s.toLowerCase().split(/[^a-z0-9]+/)) {
    if (t.length >= 3 && !STOP.has(t)) out.push(t);
  }
  return out;
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  return inter / (a.size + b.size - inter);
}

interface PreparedBook {
  entry: BookEntry;
  time: Date;
  tokens: Set<string>;
  ref: string;
}

/**
 * In-house reconciliation scorer.
 *
 * Complexity: book entries are bucketed by amount once (O(m)); each bank line only looks at
 * its amount bucket (plus tolerance neighbours), so a 10k x 10k run is O(n * k) where k is
 * the handful of entries sharing an amount — never O(n * m).
 *
 * Score = amount (0.45) + date proximity (0.25) + text/reference similarity (0.2) + rule (0.1).
 */
export function scoreMatches(
  bank: readonly BankLine[],
  book: readonly BookEntry[],
  opts: ScorerOptions = {},
): Map<string, Suggestion[]> {
  const maxDays = opts.maxDays ?? 7;
  const tol = Math.max(0, Math.round(opts.amountTolerance ?? 0));
  const perLine = opts.perLine ?? 3;
  const rules = (opts.rules ?? []).map((r) => ({ ...r, needle: r.contains.toLowerCase() }));

  const buckets = new Map<number, PreparedBook[]>();
  for (const entry of book) {
    const p: PreparedBook = {
      entry,
      time: parseISO(entry.date),
      tokens: new Set(tokenize(`${entry.description} ${entry.reference ?? ""}`)),
      ref: (entry.reference ?? "").toLowerCase(),
    };
    const list = buckets.get(entry.amount);
    if (list) list.push(p);
    else buckets.set(entry.amount, [p]);
  }
  // With a tolerance we probe neighbouring buckets; cap the probe so a huge tolerance stays cheap.
  const probe: number[] = [0];
  for (let d = 1; d <= Math.min(tol, 500); d++) probe.push(d, -d);

  const result = new Map<string, Suggestion[]>();
  for (const line of bank) {
    const lineTime = parseISO(line.date);
    const lineTokens = new Set(tokenize(`${line.description} ${line.reference ?? ""}`));
    const lower = `${line.description} ${line.reference ?? ""}`.toLowerCase();
    const rule = rules.find((r) => r.needle && lower.includes(r.needle));
    const list: Suggestion[] = [];
    for (const d of probe) {
      const cands = buckets.get(line.amount + d);
      if (!cands) continue;
      for (const c of cands) {
        const days = Math.abs(differenceInCalendarDays(lineTime, c.time));
        const allowed = rule ? rule.maxDays : maxDays;
        if (days > allowed) continue;
        const reasons: string[] = [];
        let score = 0.45 * (d === 0 ? 1 : 1 - Math.abs(d) / (tol + 1));
        reasons.push(d === 0 ? "Exact amount" : "Amount within tolerance");
        score += 0.25 * (1 - days / (allowed + 1));
        if (days === 0) reasons.push("Same day");
        else reasons.push(`${days}d apart`);
        let text = jaccard(lineTokens, c.tokens);
        if (c.ref && lower.includes(c.ref)) {
          text = 1;
          reasons.push("Reference match");
        } else if (text > 0.2) reasons.push("Similar description");
        score += 0.2 * text;
        let ruleId: string | undefined;
        if (rule && (!rule.account || rule.account === c.entry.account)) {
          score += 0.1;
          ruleId = rule.id;
          reasons.push(`Rule: ${rule.name}`);
        }
        list.push({
          bankId: line.id,
          bookId: c.entry.id,
          confidence: Math.min(1, score),
          reasons,
          ruleId,
        });
      }
    }
    if (list.length) {
      list.sort((a, b) => b.confidence - a.confidence);
      result.set(line.id, list.slice(0, perLine));
    }
  }
  return result;
}

/** Suggest a rule from a confirmed match: the most distinctive token of the bank description. */
export function ruleFromMatch(bank: BankLine[], book: BookEntry[], id: string): ReconRule | null {
  const first = bank[0];
  if (!first) return null;
  const tokens = tokenize(first.description).filter((t) => !/^\d+$/.test(t));
  const common = tokens.find((t) => bank.every((b) => b.description.toLowerCase().includes(t)));
  if (!common) return null;
  const accounts = new Set(book.map((b) => b.account).filter(Boolean));
  const account = accounts.size === 1 ? [...accounts][0] : undefined;
  return {
    id,
    name: `"${common}"${account ? ` -> ${account}` : ""}`,
    contains: common,
    account,
    maxDays: 5,
  };
}
