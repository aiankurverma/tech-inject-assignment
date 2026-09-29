import * as React from "react";
import { produce } from "immer";
import type {
  QuoteDraft,
  QuoteHeader,
  QuoteLine,
  QuoteVersion,
} from "@/components/crm/pro-cpq-quote-builder/types";

export type CpqAction =
  | { type: "addLines"; lines: QuoteLine[] }
  | { type: "updateLine"; id: string; patch: Partial<Omit<QuoteLine, "id">> }
  | { type: "updateLines"; ids: readonly string[]; patch: Partial<Omit<QuoteLine, "id">> }
  | { type: "removeLines"; ids: readonly string[] }
  | { type: "setCurrency"; currency: string }
  | { type: "setHeader"; header: QuoteHeader }
  | { type: "setHeaderDiscount"; bp: number }
  | { type: "replace"; quote: QuoteDraft };

const clampInt = (v: number, min: number, max: number) =>
  Math.min(max, Math.max(min, Math.trunc(Number.isFinite(v) ? v : min)));

/** Immer reducer: structural sharing keeps unchanged lines referentially equal for memoised rows. */
export const cpqReducer = produce((draft: QuoteDraft, action: CpqAction) => {
  switch (action.type) {
    case "addLines":
      draft.lines.push(...action.lines);
      return;
    case "updateLine": {
      const line = draft.lines.find((l) => l.id === action.id);
      if (line) applyPatch(line, action.patch);
      return;
    }
    case "updateLines": {
      const ids = new Set(action.ids);
      for (const line of draft.lines) if (ids.has(line.id)) applyPatch(line, action.patch);
      return;
    }
    case "removeLines": {
      const ids = new Set(action.ids);
      draft.lines = draft.lines.filter((l) => !ids.has(l.id));
      return;
    }
    case "setCurrency":
      draft.currency = action.currency;
      return;
    case "setHeader":
      draft.header = action.header;
      return;
    case "setHeaderDiscount":
      draft.headerDiscountBp = clampInt(action.bp, 0, 10_000);
      return;
    case "replace":
      return action.quote;
  }
});

function applyPatch(line: QuoteLine, patch: Partial<Omit<QuoteLine, "id">>) {
  if (patch.quantity !== undefined) line.quantity = clampInt(patch.quantity, 0, 1_000_000);
  if (patch.discountBp !== undefined) line.discountBp = clampInt(patch.discountBp, 0, 10_000);
  if (patch.termMonths !== undefined) line.termMonths = clampInt(patch.termMonths, 1, 120);
  if (patch.productId !== undefined) line.productId = patch.productId;
}

export interface UseCpqQuoteOptions {
  value?: QuoteDraft;
  defaultValue: QuoteDraft;
  onChange?: (quote: QuoteDraft) => void;
  versions?: QuoteVersion[];
  defaultVersions?: QuoteVersion[];
  onVersionsChange?: (versions: QuoteVersion[]) => void;
}

/**
 * Controlled/uncontrolled quote state with undo (bounded history) and version snapshots.
 * In controlled mode every dispatch is computed against `value` and handed to onChange.
 */
export function useCpqQuote(opts: UseCpqQuoteOptions) {
  const controlled = opts.value !== undefined;
  const [inner, setInner] = React.useState(opts.defaultValue);
  const quote = controlled ? opts.value! : inner;
  const quoteRef = React.useRef(quote);
  quoteRef.current = quote;
  const onChangeRef = React.useRef(opts.onChange);
  onChangeRef.current = opts.onChange;
  const history = React.useRef<QuoteDraft[]>([]);
  const [canUndo, setCanUndo] = React.useState(false);

  const commit = React.useCallback(
    (next: QuoteDraft, record = true) => {
      const prev = quoteRef.current;
      if (next === prev) return;
      if (record) {
        history.current.push(prev);
        if (history.current.length > 50) history.current.shift();
        setCanUndo(true);
      }
      quoteRef.current = next;
      if (!controlled) setInner(next);
      onChangeRef.current?.(next);
    },
    [controlled],
  );

  const dispatch = React.useCallback(
    (action: CpqAction) => commit(cpqReducer(quoteRef.current, action)),
    [commit],
  );

  const undo = React.useCallback(() => {
    const prev = history.current.pop();
    setCanUndo(history.current.length > 0);
    if (prev) commit(prev, false);
  }, [commit]);

  const versionsControlled = opts.versions !== undefined;
  const [innerVersions, setInnerVersions] = React.useState(opts.defaultVersions ?? []);
  const versions = versionsControlled ? opts.versions! : innerVersions;

  const saveVersion = React.useCallback(
    (label: string, totalMinor: number) => {
      const snapshot = quoteRef.current;
      const next: QuoteVersion[] = [
        ...versions,
        {
          version: (versions[versions.length - 1]?.version ?? 0) + 1,
          createdAt: new Date().toISOString(),
          label,
          snapshot,
          totalMinor,
          currency: snapshot.currency,
        },
      ];
      if (!versionsControlled) setInnerVersions(next);
      opts.onVersionsChange?.(next);
      return next[next.length - 1]!;
    },
    [versions, versionsControlled, opts],
  );

  const restoreVersion = React.useCallback(
    (v: QuoteVersion) => dispatch({ type: "replace", quote: v.snapshot }),
    [dispatch],
  );

  return { quote, dispatch, undo, canUndo, versions, saveVersion, restoreVersion };
}
