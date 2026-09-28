import * as React from "react";
import { AlertTriangle, CheckCircle2, Wand2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/crm/button";
import { FileDrop } from "@/components/crm/file-drop";
import { FormField, Input } from "@/components/crm/input";
import { SegmentedControl } from "@/components/crm/segmented-control";
import { Textarea } from "@/components/crm/textarea";

export interface BrandingValue {
  companyName: string;
  /** Object URL or hosted URL of the logo. */
  logoUrl?: string;
  /** #RRGGBB */
  accent: string;
  /** Portal / quote custom domain, e.g. "portal.acme.com". */
  customDomain: string;
  emailFooter: string;
  cornerStyle: "sharp" | "rounded" | "pill";
}

export interface SettingsBrandingProps {
  defaultValue: BrandingValue;
  /** Upload the logo; resolve the hosted URL. Defaults to a local object URL. */
  onUploadLogo?: (file: File) => Promise<string> | string;
  onSave: (value: BrandingValue) => Promise<void> | void;
  /** Suggested brand colours shown as quick picks. */
  presets?: string[];
  className?: string;
}

const HEX_RE = /^#[0-9a-f]{6}$/i;
const DOMAIN_RE = /^(?=.{4,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i;

function channel(c: number) {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}
function luminance(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  return (
    0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255)
  );
}
/** WCAG 2.x contrast ratio between two #RRGGBB colours (1-21). */
export function contrastRatio(a: string, b: string) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}
function darken(hex: string, amount: number) {
  const n = parseInt(hex.slice(1), 16);
  const f = (v: number) => Math.max(0, Math.round(v * (1 - amount)));
  const r = f((n >> 16) & 255);
  const g = f((n >> 8) & 255);
  const b = f(n & 255);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}
/** Darken until white text on the colour passes WCAG AA (4.5:1). */
export function fixContrast(hex: string) {
  let c = hex;
  for (let i = 0; i < 20 && contrastRatio(c, "#ffffff") < 4.5; i++) c = darken(c, 0.06);
  return c;
}

const RADIUS = { sharp: "2px", rounded: "8px", pill: "999px" } as const;

/** Workspace branding: logo upload, accent with WCAG contrast check and auto-fix, corner style, custom domain, email footer, live portal + email preview. */
export function SettingsBranding({
  defaultValue,
  onUploadLogo,
  onSave,
  presets = ["#6246ff", "#0f766e", "#e11d48", "#ea580c", "#2563eb", "#111827"],
  className,
}: SettingsBrandingProps) {
  const id = React.useId();
  const [saved, setSaved] = React.useState(defaultValue);
  const [v, setV] = React.useState(defaultValue);
  const [hexDraft, setHexDraft] = React.useState(defaultValue.accent);
  const [saving, setSaving] = React.useState(false);
  const [uploading, setUploading] = React.useState(false);
  const [status, setStatus] = React.useState("");

  const patch = (p: Partial<BrandingValue>) => setV((s) => ({ ...s, ...p }));
  const setAccent = (hex: string) => {
    setHexDraft(hex);
    if (HEX_RE.test(hex)) patch({ accent: hex.toLowerCase() });
  };

  const dirty = JSON.stringify(v) !== JSON.stringify(saved);
  const ratio = contrastRatio(v.accent, "#ffffff");
  const passes = ratio >= 4.5;
  const hexErr = HEX_RE.test(hexDraft) ? undefined : "Use a 6-digit hex colour like #6246ff.";
  const domain = v.customDomain.trim().toLowerCase();
  const domainErr =
    domain && !DOMAIN_RE.test(domain) ? "Enter a hostname like portal.yourcompany.com." : undefined;
  const nameErr = v.companyName.trim() ? undefined : "Company name is required.";
  const invalid = !!(hexErr || domainErr || nameErr);

  const upload = async (file: File) => {
    setUploading(true);
    try {
      const url = onUploadLogo ? await onUploadLogo(file) : URL.createObjectURL(file);
      patch({ logoUrl: url });
      setStatus("Logo updated.");
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Logo upload failed.");
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    if (invalid) return;
    setSaving(true);
    try {
      const clean = { ...v, customDomain: domain };
      await onSave(clean);
      setSaved(clean);
      setV(clean);
      setStatus("Branding saved.");
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Could not save branding.");
    } finally {
      setSaving(false);
    }
  };

  const radius = RADIUS[v.cornerStyle];
  const initials = v.companyName
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className={cn("grid w-full gap-6 font-crm lg:grid-cols-[minmax(0,1fr)_340px]", className)}>
      <p className="sr-only" aria-live="polite">
        {status}
      </p>
      <div className="flex min-w-0 flex-col gap-6">
        <section className="flex flex-col gap-4 rounded-xl border border-crm-border bg-crm-card p-4 shadow-crm-raised sm:p-5">
          <h2 className="crm-eyebrow text-crm-subtle">Identity</h2>
          <FormField label="Company name" htmlFor={`${id}-name`} required error={nameErr}>
            <Input
              id={`${id}-name`}
              value={v.companyName}
              invalid={!!nameErr}
              onChange={(e) => patch({ companyName: e.target.value })}
            />
          </FormField>
          <div className="flex flex-col gap-1.5">
            <span className="text-xs text-crm-soft">Logo {uploading ? "(uploading...)" : ""}</span>
            <FileDrop
              onFile={(f) => void upload(f)}
              hint="Square PNG or SVG, at least 256×256, up to 2 MB. Shown on quotes, invoices and the portal."
            />
          </div>
        </section>

        <section className="flex flex-col gap-4 rounded-xl border border-crm-border bg-crm-card p-4 shadow-crm-raised sm:p-5">
          <h2 className="crm-eyebrow text-crm-subtle">Colour and shape</h2>
          <div className="flex flex-col gap-1.5">
            <label htmlFor={`${id}-hex`} className="text-xs text-crm-soft">
              Accent colour
            </label>
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="color"
                aria-label="Pick accent colour"
                value={v.accent}
                onChange={(e) => setAccent(e.target.value)}
                className="size-9 cursor-pointer rounded-crm border border-crm-input/60 bg-crm-raised p-1"
              />
              <Input
                id={`${id}-hex`}
                className="w-28 font-mono"
                value={hexDraft}
                invalid={!!hexErr}
                maxLength={7}
                aria-describedby={`${id}-contrast`}
                onChange={(e) =>
                  setAccent(e.target.value.startsWith("#") ? e.target.value : `#${e.target.value}`)
                }
              />
              <div role="radiogroup" aria-label="Preset colours" className="flex gap-1.5">
                {presets.map((p) => (
                  <button
                    key={p}
                    type="button"
                    role="radio"
                    aria-checked={v.accent === p}
                    aria-label={p}
                    onClick={() => setAccent(p)}
                    className={cn(
                      "size-6 rounded-full border border-crm-border focus-visible:ring-2 focus-visible:ring-crm-ring/60 focus-visible:outline-none",
                      v.accent === p && "ring-2 ring-crm-fg ring-offset-2 ring-offset-crm-card",
                    )}
                    style={{ backgroundColor: p }}
                  />
                ))}
              </div>
            </div>
            <div
              id={`${id}-contrast`}
              className="flex flex-wrap items-center gap-2 text-xs"
              aria-live="polite"
            >
              {hexErr ? (
                <span className="text-crm-danger">{hexErr}</span>
              ) : passes ? (
                <span className="flex items-center gap-1.5 text-crm-success">
                  <CheckCircle2 className="size-3.5" aria-hidden />
                  Contrast with white text {ratio.toFixed(2)}:1 - passes WCAG AA
                </span>
              ) : (
                <>
                  <span className="flex items-center gap-1.5 text-crm-warning">
                    <AlertTriangle className="size-3.5" aria-hidden />
                    Contrast {ratio.toFixed(2)}:1 - button text will be hard to read (AA needs
                    4.5:1)
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setAccent(fixContrast(v.accent))}
                  >
                    <Wand2 />
                    Fix contrast
                  </Button>
                </>
              )}
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-xs text-crm-soft">Button corners</span>
            <SegmentedControl
              label="Button corners"
              value={v.cornerStyle}
              onValueChange={(c) => patch({ cornerStyle: c as BrandingValue["cornerStyle"] })}
              options={[
                { value: "sharp", label: "Sharp" },
                { value: "rounded", label: "Rounded" },
                { value: "pill", label: "Pill" },
              ]}
            />
          </div>
        </section>

        <section className="flex flex-col gap-4 rounded-xl border border-crm-border bg-crm-card p-4 shadow-crm-raised sm:p-5">
          <h2 className="crm-eyebrow text-crm-subtle">Customer-facing</h2>
          <FormField
            label="Custom portal domain"
            htmlFor={`${id}-domain`}
            error={domainErr}
            hint={
              domain
                ? `Add a CNAME record: ${domain} → portals.kitbase.app`
                : "Optional. Leave empty to use the default URL."
            }
          >
            <Input
              id={`${id}-domain`}
              placeholder="portal.yourcompany.com"
              value={v.customDomain}
              invalid={!!domainErr}
              aria-describedby={`${id}-domain-msg`}
              onChange={(e) => patch({ customDomain: e.target.value })}
            />
          </FormField>
          <FormField
            label="Email footer"
            htmlFor={`${id}-footer`}
            hint="Include your postal address - required by CAN-SPAM for marketing email."
          >
            <Textarea
              id={`${id}-footer`}
              rows={3}
              maxLength={280}
              showCount
              value={v.emailFooter}
              aria-describedby={`${id}-footer-msg`}
              onChange={(e) => patch({ emailFooter: e.target.value })}
            />
          </FormField>
        </section>

        <div className="flex items-center justify-end gap-2">
          {dirty ? <span className="mr-auto text-xs text-crm-soft">Unsaved changes</span> : null}
          <Button
            variant="ghost"
            disabled={!dirty}
            onClick={() => {
              setV(saved);
              setHexDraft(saved.accent);
            }}
          >
            Discard
          </Button>
          <Button
            variant="primary"
            disabled={!dirty || invalid}
            loading={saving}
            onClick={() => void save()}
          >
            Save branding
          </Button>
        </div>
      </div>

      <aside
        aria-label="Live preview"
        className="flex flex-col gap-3 lg:sticky lg:top-4 lg:self-start"
      >
        <span className="crm-eyebrow px-1 text-crm-subtle">Live preview</span>
        <div className="overflow-hidden rounded-xl border border-crm-border bg-white text-[#111827] shadow-crm-raised">
          <div className="flex items-center gap-2 border-b border-black/10 px-4 py-3">
            {v.logoUrl ? (
              <img src={v.logoUrl} alt="" className="size-7 rounded object-contain" />
            ) : (
              <span
                className="flex size-7 items-center justify-center rounded text-xs font-semibold text-white"
                style={{ backgroundColor: v.accent }}
              >
                {initials || "?"}
              </span>
            )}
            <span className="truncate text-sm font-semibold">{v.companyName || "Company"}</span>
            <span className="ml-auto truncate text-[10px] text-black/50">
              {domain || "app.kitbase.io/p/…"}
            </span>
          </div>
          <div className="flex flex-col gap-3 p-4">
            <p className="text-sm font-medium">Quote Q-2041 · Annual plan</p>
            <p className="text-xs text-black/60">Total due $18,400.00 · Valid until Oct 31</p>
            <button
              type="button"
              tabIndex={-1}
              className="h-9 px-4 text-sm font-medium text-white"
              style={{ backgroundColor: v.accent, borderRadius: radius }}
            >
              Accept and sign
            </button>
          </div>
          <div className="border-t border-black/10 px-4 py-3 text-[10px] whitespace-pre-wrap text-black/50">
            {v.emailFooter || "Email footer"}
          </div>
        </div>
      </aside>
    </div>
  );
}
