import { format, startOfMonth, startOfQuarter, startOfYear } from "date-fns";

export type AccountType = "asset" | "liability" | "equity" | "revenue" | "expense";

/** Chart-of-accounts node. `parentId` builds the tree; leaf accounts receive postings. */
export interface LedgerAccount {
  id: string;
  code: string;
  name: string;
  type: AccountType;
  parentId?: string | null;
}

/** One side of a journal entry. Amounts are integer minor units (cents) to avoid float drift. */
export interface LedgerPosting {
  accountId: string;
  debit: number;
  credit: number;
  memo?: string;
}

/** A balanced double-entry journal entry (sum of debits === sum of credits). */
export interface JournalEntry {
  id: string;
  date: Date | string;
  reference: string;
  description: string;
  postings: LedgerPosting[];
  source?: string;
}

/** Flattened row: one posting line, enriched with its entry and running balance. */
export interface JournalLine {
  key: string;
  entry: JournalEntry;
  date: Date;
  account: LedgerAccount;
  debit: number;
  credit: number;
  memo?: string;
  balance: number;
}

export type GroupBy = "none" | "account" | "month" | "quarter" | "year";

export interface GroupHeader {
  kind: "group";
  key: string;
  label: string;
  debit: number;
  credit: number;
  count: number;
}
export type DisplayRow = GroupHeader | ({ kind: "line" } & JournalLine);

/** Debit-normal accounts grow with debits; others grow with credits. */
export function isDebitNormal(type: AccountType) {
  return type === "asset" || type === "expense";
}

export function toDate(d: Date | string) {
  return d instanceof Date ? d : new Date(d);
}

/** Every descendant id (inclusive) for a set of selected accounts. O(accounts). */
export function expandSelection(accounts: LedgerAccount[], selected: ReadonlySet<string>) {
  if (selected.size === 0) return null;
  const children = new Map<string, string[]>();
  for (const a of accounts) {
    if (!a.parentId) continue;
    const list = children.get(a.parentId) ?? [];
    list.push(a.id);
    children.set(a.parentId, list);
  }
  const out = new Set<string>();
  const stack = [...selected];
  while (stack.length) {
    const id = stack.pop()!;
    if (out.has(id)) continue;
    out.add(id);
    for (const c of children.get(id) ?? []) stack.push(c);
  }
  return out;
}

/**
 * Flatten entries into posting lines sorted by date, then compute a running balance
 * per account (signed by the account's normal side). Single pass after the sort: O(n log n).
 */
export function buildLines(
  entries: JournalEntry[],
  accountsById: Map<string, LedgerAccount>,
  include: Set<string> | null,
): JournalLine[] {
  const lines: JournalLine[] = [];
  for (const entry of entries) {
    const date = toDate(entry.date);
    entry.postings.forEach((p, i) => {
      if (include && !include.has(p.accountId)) return;
      const account = accountsById.get(p.accountId);
      if (!account) return;
      lines.push({
        key: `${entry.id}:${i}`,
        entry,
        date,
        account,
        debit: p.debit,
        credit: p.credit,
        memo: p.memo,
        balance: 0,
      });
    });
  }
  lines.sort((a, b) => a.date.getTime() - b.date.getTime() || a.key.localeCompare(b.key));
  const running = new Map<string, number>();
  for (const l of lines) {
    const delta = isDebitNormal(l.account.type) ? l.debit - l.credit : l.credit - l.debit;
    const next = (running.get(l.account.id) ?? 0) + delta;
    running.set(l.account.id, next);
    l.balance = next;
  }
  return lines;
}

function periodKey(d: Date, by: GroupBy): [string, string] {
  if (by === "month") return [format(startOfMonth(d), "yyyy-MM"), format(d, "MMMM yyyy")];
  if (by === "quarter") return [format(startOfQuarter(d), "yyyy-QQQ"), format(d, "QQQ yyyy")];
  return [format(startOfYear(d), "yyyy"), format(d, "yyyy")];
}

/** Interleave group header rows (with subtotals) and line rows for the virtual list. O(n). */
export function groupLines(
  lines: JournalLine[],
  by: GroupBy,
  collapsed: ReadonlySet<string>,
): DisplayRow[] {
  if (by === "none") return lines.map((l) => ({ kind: "line", ...l }));
  const groups = new Map<string, { header: GroupHeader; rows: JournalLine[] }>();
  for (const l of lines) {
    const [key, label]: [string, string] =
      by === "account"
        ? [l.account.id, `${l.account.code} · ${l.account.name}`]
        : periodKey(l.date, by);
    let g = groups.get(key);
    if (!g) {
      g = { header: { kind: "group", key, label, debit: 0, credit: 0, count: 0 }, rows: [] };
      groups.set(key, g);
    }
    g.header.debit += l.debit;
    g.header.credit += l.credit;
    g.header.count++;
    g.rows.push(l);
  }
  const keys = [...groups.keys()].sort();
  const out: DisplayRow[] = [];
  for (const k of keys) {
    const g = groups.get(k)!;
    out.push(g.header);
    if (!collapsed.has(k)) for (const r of g.rows) out.push({ kind: "line", ...r });
  }
  return out;
}

const csvCell = (v: string | number) => {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** RFC 4180 CSV of the filtered lines (amounts in major units). */
export function linesToCsv(lines: JournalLine[], minorUnits = 100) {
  const head = [
    "Date",
    "Reference",
    "Account code",
    "Account",
    "Description",
    "Memo",
    "Debit",
    "Credit",
    "Balance",
  ];
  const rows = lines.map((l) =>
    [
      format(l.date, "yyyy-MM-dd"),
      l.entry.reference,
      l.account.code,
      l.account.name,
      l.entry.description,
      l.memo ?? "",
      (l.debit / minorUnits).toFixed(2),
      (l.credit / minorUnits).toFixed(2),
      (l.balance / minorUnits).toFixed(2),
    ]
      .map(csvCell)
      .join(","),
  );
  return [head.join(","), ...rows].join("\n");
}

export function downloadText(filename: string, text: string, mime = "text/csv") {
  const url = URL.createObjectURL(new Blob([text], { type: `${mime};charset=utf-8` }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
