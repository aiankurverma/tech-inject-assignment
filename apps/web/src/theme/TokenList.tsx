import { useEffect, useState } from "react";
import { RotateCcw } from "lucide-react";
import { cssValue, themeVariables, type ThemeSpec } from "@ti/core";
import { inputClass } from "../components/ui";

const isColor = (name: string) => name.startsWith("--color-");

function TokenRow({
  name,
  value,
  overridden,
  onChange,
  onReset,
}: {
  name: string;
  value: string;
  overridden: boolean;
  onChange: (v: string) => void;
  onReset: () => void;
}) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  const commit = () => {
    const v = cssValue(draft);
    if (v && v !== value) onChange(v);
    else setDraft(value);
  };
  return (
    <li className="grid grid-cols-[1fr_auto] items-center gap-x-2 gap-y-1 py-1.5 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
      <label htmlFor={`token-${name}`} className="truncate font-mono text-xs text-foreground">
        {name}
        {overridden ? (
          <span className="ml-1.5 rounded bg-primary/10 px-1 text-[10px] font-sans text-primary">
            override
          </span>
        ) : null}
      </label>
      <button
        type="button"
        onClick={onReset}
        disabled={!overridden}
        className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground disabled:invisible sm:order-last"
        aria-label={`Reset ${name}`}
        title="Reset to derived value"
      >
        <RotateCcw className="size-3.5" aria-hidden />
      </button>
      <div className="col-span-2 flex items-center gap-1.5 sm:col-span-1">
        {isColor(name) && /^#[0-9a-f]{6}$/i.test(value) ? (
          <input
            type="color"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="size-7 shrink-0 cursor-pointer rounded border border-border bg-background p-0.5"
            aria-label={`${name} colour picker`}
          />
        ) : null}
        <input
          id={`token-${name}`}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          }}
          spellCheck={false}
          className={`${inputClass} h-7 min-w-0 flex-1 font-mono text-[11px]`}
        />
      </div>
    </li>
  );
}

/** Every crm-theme.css variable the theme produces; editing one stores an override. */
export function TokenList({
  spec,
  onOverride,
}: {
  spec: ThemeSpec;
  onOverride: (name: string, value: string | null) => void;
}) {
  const vars = themeVariables(spec);
  const groups: [string, RegExp][] = [
    ["Core colours", /^--color-crm-/],
    ["Tag colours", /^--color-tag-/],
    ["Primary scale", /^--color-primary-/],
    ["Neutral scale", /^--color-neutral-/],
    ["Shape, type and shadows", /^--(font|radius|shadow|spacing)/],
  ];
  return (
    <div className="flex flex-col gap-3 text-sm">
      {groups.map(([title, re]) => (
        <details key={title} className="rounded-lg border border-border">
          <summary className="cursor-pointer px-3 py-2 font-medium text-foreground">
            {title}{" "}
            <span className="text-xs font-normal text-muted-foreground">
              {vars.filter(([k]) => re.test(k)).length}
            </span>
          </summary>
          <ul className="divide-y divide-border px-3 pb-2">
            {vars
              .filter(([k]) => re.test(k))
              .map(([name, value]) => (
                <TokenRow
                  key={name}
                  name={name}
                  value={value}
                  overridden={name in spec.overrides}
                  onChange={(v) => onOverride(name, v)}
                  onReset={() => onOverride(name, null)}
                />
              ))}
          </ul>
        </details>
      ))}
    </div>
  );
}
