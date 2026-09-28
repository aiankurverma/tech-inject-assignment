import * as React from "react";
import {
  Globe,
  KeyRound,
  Laptop,
  LogOut,
  Plus,
  ShieldCheck,
  Smartphone,
  Timer,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/crm/button";
import { Input } from "@/components/crm/input";
import { Select } from "@/components/crm/select";
import { SettingsGroup, SettingsRow } from "@/components/crm/settings-row";
import { Switch } from "@/components/crm/switch";
import { Tag } from "@/components/crm/tag";

export interface SecurityPolicy {
  enforce2fa: boolean;
  ssoOnly: boolean;
  passwordMinLength: number;
  requireSymbols: boolean;
  /** Minutes of inactivity before sign-out. 0 = never. */
  sessionTimeout: number;
  ipAllowlist: string[];
}

export interface ActiveSession {
  id: string;
  device: string;
  kind: "desktop" | "mobile";
  location: string;
  ip: string;
  lastSeen: string;
  current?: boolean;
}

export interface SettingsSecurityProps {
  value?: SecurityPolicy;
  defaultValue?: SecurityPolicy;
  onChange?: (p: SecurityPolicy) => void;
  sessions?: ActiveSession[];
  onRevokeSession?: (id: string | "all-others") => void;
  /** Share of members that already enrolled 2FA (0..1); enforcing warns about the rest. */
  twoFactorAdoption?: number;
  /** IP of the admin editing; the allowlist must include it or they lock themselves out. */
  currentIp?: string;
  ssoConfigured?: boolean;
  className?: string;
}

const ipToInt = (ip: string) => ip.split(".").reduce((n, o) => n * 256 + Number(o), 0);

/** Validates IPv4 or IPv4/CIDR. Returns an error message or null. */
export function validateCidr(entry: string): string | null {
  const m = /^(\d{1,3}(?:\.\d{1,3}){3})(?:\/(\d{1,2}))?$/.exec(entry.trim());
  if (!m) return "Use an IPv4 address or CIDR, e.g. 203.0.113.0/24";
  if (m[1]!.split(".").some((o) => Number(o) > 255)) return "Each octet must be 0-255";
  if (m[2] !== undefined && Number(m[2]) > 32) return "Prefix must be 0-32";
  return null;
}

/** True when `ip` falls inside the IPv4 CIDR range. */
export function ipInCidr(ip: string, cidr: string) {
  const [base = "", bits = "32"] = cidr.split("/");
  const b = Number(bits);
  const mask = b === 0 ? 0 : (~0 << (32 - b)) >>> 0;
  return (ipToInt(ip) & mask) >>> 0 === (ipToInt(base) & mask) >>> 0;
}

/** 0-100 posture score from the policy. */
export function securityScore(p: SecurityPolicy) {
  let s = 0;
  if (p.enforce2fa) s += 30;
  if (p.ssoOnly) s += 20;
  s += Math.min(20, Math.max(0, (p.passwordMinLength - 8) * 4));
  if (p.requireSymbols) s += 10;
  if (p.sessionTimeout > 0 && p.sessionTimeout <= 480) s += 10;
  if (p.ipAllowlist.length) s += 10;
  return s;
}

const DEFAULT: SecurityPolicy = {
  enforce2fa: false,
  ssoOnly: false,
  passwordMinLength: 8,
  requireSymbols: false,
  sessionTimeout: 0,
  ipAllowlist: [],
};

/** Workspace security: posture score, 2FA/SSO enforcement with impact warnings, password policy, session timeout, IP allowlist with CIDR + self-lockout check, active sessions. */
export function SettingsSecurity({
  value,
  defaultValue = DEFAULT,
  onChange,
  sessions = [],
  onRevokeSession,
  twoFactorAdoption = 1,
  currentIp,
  ssoConfigured = false,
  className,
}: SettingsSecurityProps) {
  const [inner, setInner] = React.useState(defaultValue);
  const p = value ?? inner;
  const set = (patch: Partial<SecurityPolicy>) => {
    const next = { ...p, ...patch };
    if (value === undefined) setInner(next);
    onChange?.(next);
  };
  const [ipDraft, setIpDraft] = React.useState("");
  const [ipError, setIpError] = React.useState<string | null>(null);
  const [revoked, setRevoked] = React.useState<string[]>([]);

  const score = securityScore(p);
  const scoreTone =
    score >= 70 ? "text-crm-success" : score >= 40 ? "text-crm-warning" : "text-crm-danger";
  const lockedOut =
    !!currentIp && p.ipAllowlist.length > 0 && !p.ipAllowlist.some((c) => ipInCidr(currentIp, c));
  const liveSessions = sessions.filter((s) => !revoked.includes(s.id));

  function addIp(e: React.FormEvent) {
    e.preventDefault();
    const entry = ipDraft.trim();
    const err = validateCidr(entry);
    if (err) return setIpError(err);
    if (p.ipAllowlist.includes(entry)) return setIpError("Already on the list");
    set({ ipAllowlist: [...p.ipAllowlist, entry] });
    setIpDraft("");
    setIpError(null);
  }

  function revoke(id: string | "all-others") {
    onRevokeSession?.(id);
    setRevoked((r) =>
      id === "all-others" ? sessions.filter((s) => !s.current).map((s) => s.id) : [...r, id],
    );
  }

  return (
    <section className={cn("flex flex-col gap-5 font-crm", className)} aria-labelledby="sec-h">
      <header className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-crm-border bg-crm-card p-4 shadow-crm-raised">
        <div>
          <p className="crm-eyebrow text-crm-subtle">Settings</p>
          <h2 id="sec-h" className="text-lg font-semibold text-crm-fg">
            Security
          </h2>
        </div>
        <div className="flex items-center gap-3">
          <ShieldCheck className={cn("size-6", scoreTone)} aria-hidden />
          <div>
            <p
              className={cn("text-2xl font-semibold tabular-nums", scoreTone)}
              aria-label={`Security score ${score} of 100`}
            >
              {score}
              <span className="text-xs text-crm-subtle">/100</span>
            </p>
            <p className="text-xs text-crm-soft">Security score</p>
          </div>
        </div>
      </header>

      <SettingsGroup heading="Authentication">
        <SettingsRow
          icon={<Smartphone />}
          label="Require two-factor authentication"
          htmlFor="sec-2fa"
          description={
            p.enforce2fa && twoFactorAdoption < 1
              ? `${Math.round((1 - twoFactorAdoption) * 100)}% of members will be asked to set up 2FA at next sign-in.`
              : "Members must use an authenticator app or passkey."
          }
          badge={
            twoFactorAdoption < 1 ? (
              <Tag size="sm" color="amber">
                {Math.round(twoFactorAdoption * 100)}% enrolled
              </Tag>
            ) : null
          }
          control={
            <Switch
              id="sec-2fa"
              checked={p.enforce2fa}
              onCheckedChange={(v) => set({ enforce2fa: v })}
            />
          }
        />
        <SettingsRow
          icon={<KeyRound />}
          label="SSO only"
          htmlFor="sec-sso"
          disabled={!ssoConfigured}
          description={
            ssoConfigured
              ? "Disable password sign-in; everyone uses your identity provider."
              : "Configure SAML SSO first."
          }
          control={
            <Switch
              id="sec-sso"
              checked={p.ssoOnly}
              disabled={!ssoConfigured}
              onCheckedChange={(v) => set({ ssoOnly: v })}
            />
          }
        />
        <SettingsRow
          label="Minimum password length"
          htmlFor="sec-pwlen"
          disabled={p.ssoOnly}
          description={`${p.passwordMinLength} characters${p.passwordMinLength < 10 ? " · 12+ recommended" : ""}`}
          control={
            <input
              id="sec-pwlen"
              type="range"
              min={8}
              max={24}
              value={p.passwordMinLength}
              onChange={(e) => set({ passwordMinLength: Number(e.target.value) })}
              className="w-40 accent-crm-primary"
            />
          }
        />
        <SettingsRow
          label="Require symbols and numbers"
          htmlFor="sec-sym"
          disabled={p.ssoOnly}
          control={
            <Switch
              id="sec-sym"
              checked={p.requireSymbols}
              onCheckedChange={(v) => set({ requireSymbols: v })}
            />
          }
        />
        <SettingsRow
          icon={<Timer />}
          label="Idle session timeout"
          control={
            <Select
              aria-label="Idle session timeout"
              className="w-36"
              value={String(p.sessionTimeout)}
              onValueChange={(v) => set({ sessionTimeout: Number(v) })}
              options={[
                { value: "30", label: "30 minutes" },
                { value: "120", label: "2 hours" },
                { value: "480", label: "8 hours" },
                { value: "1440", label: "24 hours" },
                { value: "0", label: "Never" },
              ]}
            />
          }
        />
      </SettingsGroup>

      <div className="flex flex-col gap-2">
        <h3 className="crm-eyebrow px-1 text-crm-subtle">IP allowlist</h3>
        <div className="flex flex-col gap-3 rounded-xl border border-crm-border bg-crm-card p-4 shadow-crm-raised">
          <form onSubmit={addIp} className="flex gap-2">
            <div className="relative flex-1">
              <Globe
                className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-crm-subtle"
                aria-hidden
              />
              <Input
                aria-label="IP or CIDR"
                placeholder="203.0.113.0/24"
                value={ipDraft}
                invalid={!!ipError}
                aria-describedby="sec-ip-msg"
                onChange={(e) => {
                  setIpDraft(e.target.value);
                  setIpError(null);
                }}
                className="pl-8"
              />
            </div>
            <Button type="submit" size="lg">
              <Plus /> Add
            </Button>
          </form>
          <p
            id="sec-ip-msg"
            className={cn("text-xs", ipError ? "text-crm-danger" : "text-crm-subtle")}
          >
            {ipError ??
              (p.ipAllowlist.length
                ? "Sign-ins from other addresses are blocked."
                : "Empty list allows sign-in from anywhere.")}
          </p>
          {lockedOut ? (
            <p
              role="alert"
              className="rounded-crm bg-crm-danger/15 px-3 py-2 text-xs text-crm-danger"
            >
              Your current IP {currentIp} is not on the list. Saving would sign you out.
            </p>
          ) : null}
          {p.ipAllowlist.length ? (
            <ul className="flex flex-wrap gap-1.5" aria-label="Allowed ranges">
              {p.ipAllowlist.map((c) => (
                <li
                  key={c}
                  className="flex items-center gap-1 rounded-full bg-crm-raised py-1 pr-1 pl-2.5 font-mono text-xs text-crm-fg shadow-crm-raised"
                >
                  {c}
                  {currentIp && ipInCidr(currentIp, c) ? (
                    <span className="text-crm-success">· you</span>
                  ) : null}
                  <button
                    type="button"
                    aria-label={`Remove ${c}`}
                    onClick={() => set({ ipAllowlist: p.ipAllowlist.filter((x) => x !== c) })}
                    className="rounded-full p-0.5 text-crm-subtle hover:text-crm-fg"
                  >
                    <X className="size-3" />
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between px-1">
          <h3 className="crm-eyebrow text-crm-subtle">Active sessions ({liveSessions.length})</h3>
          <Button
            size="sm"
            variant="ghost"
            disabled={liveSessions.filter((s) => !s.current).length === 0}
            onClick={() => revoke("all-others")}
          >
            <LogOut /> Sign out all others
          </Button>
        </div>
        <ul className="divide-y divide-crm-border rounded-xl border border-crm-border bg-crm-card shadow-crm-raised">
          {liveSessions.length === 0 ? (
            <li className="p-6 text-center text-xs text-crm-soft">No active sessions.</li>
          ) : null}
          {liveSessions.map((s) => (
            <li key={s.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <span className="flex min-w-0 items-center gap-3">
                {s.kind === "mobile" ? (
                  <Smartphone className="size-4 shrink-0 text-crm-soft" aria-hidden />
                ) : (
                  <Laptop className="size-4 shrink-0 text-crm-soft" aria-hidden />
                )}
                <span className="min-w-0">
                  <span className="flex items-center gap-2 text-sm text-crm-fg">
                    <span className="truncate">{s.device}</span>
                    {s.current ? (
                      <Tag size="sm" color="green">
                        This device
                      </Tag>
                    ) : null}
                  </span>
                  <span className="block truncate text-xs text-crm-soft">
                    {s.location} · <span className="font-mono">{s.ip}</span> ·{" "}
                    {new Date(s.lastSeen).toLocaleString(undefined, {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </span>
                </span>
              </span>
              {!s.current ? (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => revoke(s.id)}
                  aria-label={`Sign out ${s.device}`}
                >
                  Revoke
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
