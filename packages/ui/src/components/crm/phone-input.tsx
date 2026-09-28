import * as React from "react";
import * as Popover from "@radix-ui/react-popover";
import { Check, ChevronDown, Search } from "lucide-react";
import { cn } from "@/lib/utils";

export interface PhoneCountry {
  /** ISO 3166-1 alpha-2 code. */
  iso: string;
  name: string;
  dial: string;
  /** National number mask, "#" = digit. The digit count of the mask is the max length. */
  mask: string;
  /** Minimum valid national digits (defaults to the mask length). */
  min?: number;
}

const FALLBACK_COUNTRY: PhoneCountry = {
  iso: "US",
  name: "United States",
  dial: "1",
  mask: "(###) ###-####",
};

export const PHONE_COUNTRIES: PhoneCountry[] = [
  { iso: "US", name: "United States", dial: "1", mask: "(###) ###-####" },
  { iso: "CA", name: "Canada", dial: "1", mask: "(###) ###-####" },
  { iso: "GB", name: "United Kingdom", dial: "44", mask: "#### ######" },
  { iso: "IN", name: "India", dial: "91", mask: "##### #####" },
  { iso: "DE", name: "Germany", dial: "49", mask: "#### ########", min: 10 },
  { iso: "FR", name: "France", dial: "33", mask: "# ## ## ## ##" },
  { iso: "ES", name: "Spain", dial: "34", mask: "### ### ###" },
  { iso: "NL", name: "Netherlands", dial: "31", mask: "# ########" },
  { iso: "AU", name: "Australia", dial: "61", mask: "### ### ###" },
  { iso: "SG", name: "Singapore", dial: "65", mask: "#### ####" },
  { iso: "AE", name: "United Arab Emirates", dial: "971", mask: "## ### ####" },
  { iso: "BR", name: "Brazil", dial: "55", mask: "(##) #####-####", min: 10 },
  { iso: "MX", name: "Mexico", dial: "52", mask: "## #### ####" },
  { iso: "JP", name: "Japan", dial: "81", mask: "##-####-####", min: 9 },
  { iso: "ZA", name: "South Africa", dial: "27", mask: "## ### ####" },
];

const flag = (iso: string) =>
  String.fromCodePoint(...[...iso.toUpperCase()].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));

const maxDigits = (c: PhoneCountry) => c.mask.split("#").length - 1;

/** Apply a country mask to national digits, stopping at the last typed digit. */
export function formatNational(digits: string, country: PhoneCountry): string {
  let out = "";
  let i = 0;
  for (const ch of country.mask) {
    if (i >= digits.length) break;
    if (ch === "#") out += digits[i++];
    else out += ch;
  }
  return out + digits.slice(i);
}

/** Parse "+44 20 7946 0958" style input into a country and national digits (longest dial match). */
export function parseE164(
  value: string,
  countries: PhoneCountry[] = PHONE_COUNTRIES,
  preferIso?: string,
): { country: PhoneCountry; national: string } | null {
  const digits = value.replace(/\D/g, "");
  if (!value.trim().startsWith("+") || !digits) return null;
  const matches = countries
    .filter((c) => digits.startsWith(c.dial))
    .sort((a, b) => b.dial.length - a.dial.length);
  if (!matches.length) return null;
  const top = matches[0];
  if (!top) return null;
  const best = matches.find((c) => c.iso === preferIso && c.dial === top.dial) ?? top;
  return { country: best, national: digits.slice(best.dial.length) };
}

export interface PhoneValue {
  /** E.164 string ("+14155550142"), or "" when empty. */
  e164: string;
  country: string;
  national: string;
  valid: boolean;
}

export interface PhoneInputProps {
  /** E.164 value (controlled). */
  value?: string;
  defaultValue?: string;
  onChange?: (value: PhoneValue) => void;
  defaultCountry?: string;
  /** Restrict / reorder the list. Countries in `preferred` are pinned on top. */
  countries?: PhoneCountry[];
  preferred?: string[];
  placeholder?: string;
  disabled?: boolean;
  invalid?: boolean;
  /** Show a built-in "Too short" / "Too long" hint after blur. */
  showValidation?: boolean;
  id?: string;
  name?: string;
  "aria-label"?: string;
  "aria-describedby"?: string;
  className?: string;
}

/**
 * Country picker + masked national number. Emits E.164 plus validity; pasting an international
 * number ("+44 …") switches the country automatically. The country list is a searchable listbox
 * with arrow-key navigation.
 */
export function PhoneInput({
  value,
  defaultValue = "",
  onChange,
  defaultCountry = "US",
  countries = PHONE_COUNTRIES,
  preferred = [],
  placeholder,
  disabled,
  invalid,
  showValidation = true,
  id,
  name,
  "aria-label": ariaLabel,
  "aria-describedby": describedBy,
  className,
}: PhoneInputProps) {
  const find = (iso: string) =>
    countries.find((c) => c.iso === iso) ?? countries[0] ?? FALLBACK_COUNTRY;
  const init = () => {
    const parsed = parseE164(value ?? defaultValue, countries, defaultCountry);
    return parsed ?? { country: find(defaultCountry), national: "" };
  };
  const [state, setState] = React.useState(init);
  const [touched, setTouched] = React.useState(false);
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [active, setActive] = React.useState(0);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const listId = React.useId();
  const hintId = React.useId();

  // Sync controlled value when it changes from outside.
  const lastEmitted = React.useRef<string | undefined>(value);
  React.useEffect(() => {
    if (value === undefined || value === lastEmitted.current) return;
    lastEmitted.current = value;
    const parsed = parseE164(value, countries, state.country.iso);
    setState(parsed ?? { country: state.country, national: "" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const { country, national } = state;
  const len = national.length;
  const min = country.min ?? maxDigits(country);
  const valid = len >= min && len <= maxDigits(country);
  const problem =
    len === 0 ? null : len < min ? "Too short" : len > maxDigits(country) ? "Too long" : null;

  const emit = (next: { country: PhoneCountry; national: string }) => {
    setState(next);
    const e164 = next.national ? `+${next.country.dial}${next.national}` : "";
    lastEmitted.current = e164;
    const m = next.country.min ?? maxDigits(next.country);
    onChange?.({
      e164,
      country: next.country.iso,
      national: next.national,
      valid: next.national.length >= m && next.national.length <= maxDigits(next.country),
    });
  };

  const onInput = (raw: string) => {
    if (raw.trim().startsWith("+")) {
      const parsed = parseE164(raw, countries, country.iso);
      if (parsed) return emit(parsed);
    }
    let digits = raw.replace(/\D/g, "");
    // Strip a national trunk prefix "0" for countries that use it in local notation.
    if (country.dial !== "1" && digits.length > maxDigits(country) && digits.startsWith("0"))
      digits = digits.slice(1);
    emit({ country, national: digits.slice(0, maxDigits(country) + 2) });
  };

  const sorted = React.useMemo(() => {
    const pinned = preferred
      .map((iso) => countries.find((c) => c.iso === iso))
      .filter((c): c is PhoneCountry => !!c);
    const rest = countries.filter((c) => !preferred.includes(c.iso));
    return [...pinned, ...rest];
  }, [countries, preferred]);

  const q = query.trim().toLowerCase().replace(/^\+/, "");
  const filtered = q
    ? sorted.filter(
        (c) =>
          c.name.toLowerCase().includes(q) || c.iso.toLowerCase() === q || c.dial.startsWith(q),
      )
    : sorted;

  const pick = (c: PhoneCountry) => {
    emit({ country: c, national: national.slice(0, maxDigits(c)) });
    setOpen(false);
    setQuery("");
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  const onListKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const c = filtered[active];
      if (c) pick(c);
    }
  };

  const showError = invalid || (showValidation && touched && !!problem);

  return (
    <div className={cn("flex flex-col gap-1 font-crm", className)}>
      <div
        className={cn(
          "flex h-9 w-full items-stretch rounded-crm border bg-crm-raised text-sm transition-[border-color,box-shadow] duration-150 ease-crm",
          "focus-within:border-crm-ring focus-within:ring-2 focus-within:ring-crm-ring/40",
          showError ? "border-crm-danger/70" : "border-crm-input/60 hover:border-crm-input",
          disabled && "pointer-events-none opacity-50",
        )}
      >
        <Popover.Root
          open={open}
          onOpenChange={(o) => {
            setOpen(o);
            if (o)
              setActive(
                Math.max(
                  0,
                  filtered.findIndex((c) => c.iso === country.iso),
                ),
              );
            else setQuery("");
          }}
        >
          <Popover.Trigger asChild>
            <button
              type="button"
              disabled={disabled}
              aria-label={`Country code: ${country.name} +${country.dial}`}
              aria-haspopup="listbox"
              className="flex shrink-0 cursor-pointer items-center gap-1.5 rounded-l-crm border-r border-crm-input/40 pr-2 pl-2.5 text-crm-fg outline-none hover:bg-crm-muted focus-visible:bg-crm-muted"
            >
              <span aria-hidden className="text-base leading-none">
                {flag(country.iso)}
              </span>
              <span className="text-xs text-crm-soft tabular-nums">+{country.dial}</span>
              <ChevronDown aria-hidden className="size-3 text-crm-subtle" />
            </button>
          </Popover.Trigger>
          <Popover.Portal>
            <Popover.Content
              align="start"
              sideOffset={6}
              className="z-50 w-[260px] rounded-xl border border-crm-border bg-crm-popover p-1.5 font-crm shadow-crm-overlay outline-none data-[state=open]:animate-crm-in"
            >
              <div className="mb-1 flex h-8 items-center gap-2 rounded-crm bg-crm-raised px-2">
                <Search aria-hidden className="size-3.5 text-crm-subtle" />
                <input
                  autoFocus
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setActive(0);
                  }}
                  onKeyDown={onListKey}
                  role="combobox"
                  aria-expanded
                  aria-controls={listId}
                  aria-activedescendant={
                    filtered[active] ? `${listId}-${filtered[active].iso}` : undefined
                  }
                  aria-label="Search countries"
                  placeholder="Country or code"
                  className="min-w-0 flex-1 bg-transparent text-xs text-crm-fg outline-none placeholder:text-crm-subtle"
                />
              </div>
              <ul
                id={listId}
                role="listbox"
                aria-label="Countries"
                className="max-h-60 overflow-y-auto"
              >
                {filtered.length === 0 ? (
                  <li className="px-2 py-3 text-center text-xs text-crm-subtle">
                    No matching country
                  </li>
                ) : (
                  filtered.map((c, i) => {
                    const selected = c.iso === country.iso;
                    return (
                      <li
                        key={c.iso}
                        id={`${listId}-${c.iso}`}
                        role="option"
                        aria-selected={selected}
                        onMouseEnter={() => setActive(i)}
                        onClick={() => pick(c)}
                        className={cn(
                          "flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-xs text-crm-fg",
                          i === active && "bg-crm-muted",
                          i === preferred.length - 1 &&
                            !q &&
                            "mb-1 border-b border-crm-border pb-2",
                        )}
                      >
                        <span aria-hidden className="text-base leading-none">
                          {flag(c.iso)}
                        </span>
                        <span className="flex-1 truncate">{c.name}</span>
                        <span className="text-crm-subtle tabular-nums">+{c.dial}</span>
                        {selected ? (
                          <Check aria-hidden className="size-3 text-crm-primary" />
                        ) : null}
                      </li>
                    );
                  })
                )}
              </ul>
            </Popover.Content>
          </Popover.Portal>
        </Popover.Root>
        <input
          ref={inputRef}
          id={id}
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          disabled={disabled}
          value={formatNational(national, country)}
          onChange={(e) => onInput(e.target.value)}
          onBlur={() => setTouched(true)}
          placeholder={placeholder ?? country.mask.replace(/#/g, "0")}
          aria-label={ariaLabel}
          aria-invalid={showError || undefined}
          aria-describedby={cn(describedBy, showError && problem && hintId) || undefined}
          className="min-w-0 flex-1 bg-transparent px-2.5 text-crm-fg tabular-nums outline-none placeholder:text-crm-faint"
        />
        {name ? (
          <input type="hidden" name={name} value={national ? `+${country.dial}${national}` : ""} />
        ) : null}
      </div>
      {showValidation && touched && problem ? (
        <span id={hintId} className="text-xs text-crm-danger">
          {problem} for {country.name} (
          {min === maxDigits(country) ? min : `${min}–${maxDigits(country)}`} digits)
        </span>
      ) : valid && showValidation && touched ? (
        <span className="sr-only" role="status">
          Valid number
        </span>
      ) : null}
    </div>
  );
}
