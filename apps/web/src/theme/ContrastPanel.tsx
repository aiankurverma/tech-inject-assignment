import { Check, TriangleAlert, Wand2 } from "lucide-react";
import { contrastChecks, contrastMatrix, type ThemeSpec, type WcagLevel } from "@ti/core";
import { btn } from "../components/ui";

const LEVEL_CLASS: Record<WcagLevel, string> = {
  AAA: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  AA: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  "AA-large": "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  fail: "bg-red-500/15 text-red-700 dark:text-red-300",
};

const ROLE_LABEL: Record<string, string> = {
  text: "Text",
  muted: "Muted",
  primary: "Primary",
  accent: "Accent",
  success: "Success",
  warning: "Warning",
  danger: "Danger",
  bg: "Background",
  surface: "Surface",
};

/** Component pair checks plus the full AA/AAA matrix, with one-click fixing. */
export function ContrastPanel({ spec, onFix }: { spec: ThemeSpec; onFix: () => void }) {
  const checks = contrastChecks(spec);
  const cells = contrastMatrix(spec);
  const failing = checks.filter((c) => !c.pass).length;
  const bgs = ["bg", "surface", "primary"] as const;
  const fgs = [...new Set(cells.map((c) => c.fg))];

  return (
    <section aria-labelledby="contrast-h" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <h2 id="contrast-h" className="mr-auto text-lg font-semibold text-foreground">
          Contrast{" "}
          <span className="text-sm font-normal text-muted-foreground">
            {failing ? `${failing} pair${failing > 1 ? "s" : ""} below WCAG` : "all pairs pass"}
          </span>
        </h2>
        <button type="button" className={btn.secondary} onClick={onFix} disabled={!failing}>
          <Wand2 className="size-4" aria-hidden />
          Fix contrast
        </button>
      </div>

      <ul className="grid gap-px overflow-hidden rounded-lg border border-border bg-border text-sm sm:grid-cols-2">
        {checks.map((c) => (
          <li key={c.label} className="flex items-center gap-3 bg-background px-3 py-2">
            <span
              aria-hidden
              className="flex size-7 shrink-0 items-center justify-center rounded text-xs font-semibold"
              style={{ background: c.bg, color: c.fg }}
            >
              Aa
            </span>
            <span className="min-w-0 flex-1 truncate">{c.label}</span>
            <span className="tabular-nums text-muted-foreground">{c.ratio.toFixed(2)}:1</span>
            <span
              className={`inline-flex w-20 items-center justify-end gap-1 ${c.pass ? "text-foreground" : "text-red-600 dark:text-red-400"}`}
            >
              {c.pass ? (
                <Check className="size-4" aria-hidden />
              ) : (
                <TriangleAlert className="size-4" aria-hidden />
              )}
              {c.level === "fail" ? "Fail" : c.level}
            </span>
          </li>
        ))}
      </ul>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[420px] border-separate border-spacing-1 text-xs">
          <caption className="mb-1 text-left text-xs text-muted-foreground">
            WCAG matrix: every foreground role on every surface. AAA 7:1, AA 4.5:1, AA-large 3:1.
          </caption>
          <thead>
            <tr>
              <th scope="col" className="text-left font-medium text-muted-foreground">
                Foreground
              </th>
              {bgs.map((b) => (
                <th key={b} scope="col" className="font-medium text-muted-foreground">
                  on {ROLE_LABEL[b]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {fgs.map((fg) => (
              <tr key={fg}>
                <th scope="row" className="text-left font-medium text-foreground">
                  {ROLE_LABEL[fg]}
                </th>
                {bgs.map((bg) => {
                  const cell = cells.find((c) => c.fg === fg && c.bg === bg)!;
                  return (
                    <td
                      key={bg}
                      className={`rounded-md px-2 py-1.5 text-center ${LEVEL_CLASS[cell.level]}`}
                    >
                      <span
                        aria-hidden
                        className="mr-1.5 inline-block size-3 rounded-sm align-middle"
                        style={{ background: spec[bg], boxShadow: `inset 0 0 0 1.5px ${spec[fg]}` }}
                      />
                      <span className="tabular-nums">{cell.ratio.toFixed(1)}</span>{" "}
                      <span className="font-medium">
                        {cell.level === "fail" ? "Fail" : cell.level}
                      </span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">
        "Fix contrast" nudges each failing foreground's lightness (hue and saturation stay) until
        text reaches 4.5:1 and brand, focus and status colours reach 3:1.
      </p>
    </section>
  );
}
