import { useEffect, useState } from "react";
import { parseColor, toHex } from "@ti/core";
import { inputClass } from "../components/ui";

/**
 * Colour role editor: the label sits on its own line above the swatch and hex input, so it
 * stays fully readable at any width (including 375px phones).
 */
export function ColorField({
  label,
  value,
  onChange,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  hint?: string;
}) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  const id = `theme-colour-${label.replace(/\W+/g, "-").toLowerCase()}`;
  return (
    <div className="flex min-w-0 flex-col gap-1.5 text-sm">
      <label htmlFor={id} className="flex items-baseline justify-between gap-2">
        <span className="text-foreground">{label}</span>
        {hint ? <span className="truncate text-xs text-muted-foreground">{hint}</span> : null}
      </label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="size-9 shrink-0 cursor-pointer rounded-md border border-border bg-background p-0.5"
          aria-label={`${label} colour picker`}
        />
        <input
          id={id}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => {
            const rgb = parseColor(draft);
            if (rgb) onChange(toHex(rgb));
            else setDraft(value);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          }}
          spellCheck={false}
          className={`${inputClass} min-w-0 flex-1 font-mono text-xs`}
          aria-label={`${label} hex value`}
        />
      </div>
    </div>
  );
}
