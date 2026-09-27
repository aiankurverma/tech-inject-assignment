/** Trims, lowercases, and collapses whitespace runs to a single space. */
export function normalizeTerm(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Returns the real searchCount when >= 5, null otherwise.
 * UI must say "Be one of the first to ask for this" when null.
 * Never fabricate or inflate.
 */
export function publicInterest(count: number): number | null {
  return count >= 5 ? count : null;
}
