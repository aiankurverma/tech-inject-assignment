import { useEffect, useState } from "react";
import { Monitor, Moon, Sun } from "lucide-react";

export type ThemePref = "light" | "dark" | "system";

/** Same key the inline script in index.html reads before first paint. */
const KEY = "ti-theme";
const media = () => window.matchMedia("(prefers-color-scheme: dark)");

function readPref(): ThemePref {
  try {
    const v = localStorage.getItem(KEY);
    return v === "light" || v === "dark" ? v : "system";
  } catch {
    return "system";
  }
}

function apply(pref: ThemePref) {
  const dark = pref === "dark" || (pref === "system" && media().matches);
  const root = document.documentElement;
  root.classList.toggle("dark", dark);
  root.style.colorScheme = dark ? "dark" : "light";
}

/** Applies the stored theme; main.tsx calls it before the first render. */
export function initTheme() {
  apply(readPref());
}

const options = [
  { value: "light", label: "Light", Icon: Sun },
  { value: "dark", label: "Dark", Icon: Moon },
  { value: "system", label: "System", Icon: Monitor },
] as const;

/** Light / Dark / System switch. Persists the choice and follows the OS in "system". */
export function ThemeToggle() {
  const [pref, setPref] = useState<ThemePref>(readPref);

  useEffect(() => {
    apply(pref);
    try {
      if (pref === "system") localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, pref);
    } catch {
      // Storage can be blocked (private mode); the theme still applies for this visit.
    }
    if (pref !== "system") return;
    const mq = media();
    const onChange = () => apply("system");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [pref]);

  const move = (dir: 1 | -1) => {
    const i = options.findIndex((o) => o.value === pref);
    const next = options[(i + dir + options.length) % options.length];
    if (!next) return;
    setPref(next.value);
    document.getElementById(`theme-${next.value}`)?.focus();
  };

  const current = options.find((o) => o.value === pref) ?? options[2];
  const cycle = () => {
    const next = options[(options.findIndex((o) => o.value === pref) + 1) % options.length];
    if (next) setPref(next.value);
  };

  return (
    <>
      <button
        type="button"
        onClick={cycle}
        aria-label={`Color theme: ${current.label}. Switch theme`}
        title={`Theme: ${current.label}`}
        className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground sm:hidden"
      >
        <current.Icon className="size-4" aria-hidden />
      </button>
      <div
        role="radiogroup"
        aria-label="Color theme"
        className="hidden h-8 items-center rounded-full border border-border p-0.5 sm:inline-flex"
        onKeyDown={(e) => {
          if (e.key === "ArrowRight" || e.key === "ArrowDown") {
            e.preventDefault();
            move(1);
          }
          if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
            e.preventDefault();
            move(-1);
          }
        }}
      >
        {options.map(({ value, label, Icon }) => {
          const checked = pref === value;
          return (
            <button
              key={value}
              id={`theme-${value}`}
              type="button"
              role="radio"
              aria-checked={checked}
              aria-label={`${label} theme`}
              title={`${label} theme`}
              tabIndex={checked ? 0 : -1}
              onClick={() => setPref(value)}
              className={`inline-flex size-6.5 items-center justify-center rounded-full transition-colors ${
                checked ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="size-3.5" aria-hidden />
            </button>
          );
        })}
      </div>
    </>
  );
}
