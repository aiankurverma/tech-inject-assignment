import * as React from "react";
import {
  AlertTriangle,
  Check,
  Copy,
  Mail,
  MousePointerClick,
  RefreshCw,
  Send,
  ShieldCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/crm/button";
import { FormField, Input } from "@/components/crm/input";
import { Select } from "@/components/crm/select";
import { SettingsGroup, SettingsRow } from "@/components/crm/settings-row";
import { Switch } from "@/components/crm/switch";
import { Tag } from "@/components/crm/tag";
import { Textarea } from "@/components/crm/textarea";

export interface ConnectedMailbox {
  id: string;
  address: string;
  provider: "google" | "microsoft" | "imap";
  status: "connected" | "syncing" | "error";
  /** ISO date of the last successful sync. */
  lastSyncedAt?: string;
  isDefault?: boolean;
  errorMessage?: string;
}

export interface DnsRecord {
  type: "TXT" | "CNAME" | "MX";
  /** SPF, DKIM, DMARC, Return-Path... */
  purpose: string;
  host: string;
  value: string;
  status: "verified" | "pending" | "failed";
}

export interface EmailSettingsValue {
  fromName: string;
  replyTo: string;
  signature: string;
  trackOpens: boolean;
  trackClicks: boolean;
  /** Max emails per mailbox per day for sequences. */
  dailyLimit: number;
  /** Minimum minutes between automated sends. */
  sendGap: string;
  unsubscribeFooter: boolean;
}

export interface SettingsEmailProps {
  mailboxes: ConnectedMailbox[];
  domain: string;
  dnsRecords: DnsRecord[];
  defaultValue: EmailSettingsValue;
  /** Values used to preview {{merge_fields}} in the signature. */
  sender?: Record<string, string>;
  onConnect?: (provider: ConnectedMailbox["provider"]) => void;
  onDisconnect?: (id: string) => void;
  onSetDefault?: (id: string) => void;
  onResync?: (id: string) => void;
  /** Re-check DNS; resolve the fresh records. */
  onVerifyDomain?: () => Promise<DnsRecord[]> | DnsRecord[];
  onSave: (value: EmailSettingsValue) => Promise<void> | void;
  className?: string;
}

const PROVIDER: Record<ConnectedMailbox["provider"], string> = {
  google: "Google Workspace",
  microsoft: "Microsoft 365",
  imap: "IMAP / SMTP",
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PROVIDER_CAP = 2000;

function ago(iso?: string) {
  if (!iso) return "never";
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  return h < 24 ? `${h} h ago` : `${Math.round(h / 24)} d ago`;
}

/** Replace {{field}} tokens; unknown fields are left visible so typos stand out. */
export function renderMergeFields(text: string, data: Record<string, string>) {
  return text.replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, (all, key: string) => data[key] ?? all);
}

/** Email admin page: connected mailboxes, sending identity, signature with live merge preview, tracking, send limits and SPF/DKIM/DMARC status. */
export function SettingsEmail({
  mailboxes,
  domain,
  dnsRecords,
  defaultValue,
  sender = {},
  onConnect,
  onDisconnect,
  onSetDefault,
  onResync,
  onVerifyDomain,
  onSave,
  className,
}: SettingsEmailProps) {
  const id = React.useId();
  const [saved, setSaved] = React.useState(defaultValue);
  const [v, setV] = React.useState(defaultValue);
  const [records, setRecords] = React.useState(dnsRecords);
  const [checking, setChecking] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [copied, setCopied] = React.useState<string | null>(null);
  const [status, setStatus] = React.useState("");
  const [saveError, setSaveError] = React.useState<string | null>(null);

  React.useEffect(() => setRecords(dnsRecords), [dnsRecords]);

  const dirty = JSON.stringify(v) !== JSON.stringify(saved);
  const patch = (p: Partial<EmailSettingsValue>) => setV((s) => ({ ...s, ...p }));

  const replyErr =
    v.replyTo && !EMAIL_RE.test(v.replyTo) ? "Enter a valid email address." : undefined;
  const limitErr =
    !Number.isFinite(v.dailyLimit) || v.dailyLimit < 1
      ? "Must be at least 1."
      : v.dailyLimit > PROVIDER_CAP
        ? `Your provider caps sending at ${PROVIDER_CAP.toLocaleString()}/day.`
        : undefined;
  const nameErr = !v.fromName.trim() ? "Sender name is required." : undefined;
  const invalid = !!(replyErr || limitErr || nameErr);

  const verifiedCount = records.filter((r) => r.status === "verified").length;
  const domainHealthy = verifiedCount === records.length && records.length > 0;
  const unknownFields = Array.from(v.signature.matchAll(/\{\{\s*([a-z_]+)\s*\}\}/gi))
    .map((m) => m[1] ?? "")
    .filter((k) => !(k in sender));

  const copy = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      window.setTimeout(() => setCopied((c) => (c === key ? null : c)), 1500);
    } catch {
      setStatus("Copy failed - select the value and copy it manually.");
    }
  };

  const verify = async () => {
    if (!onVerifyDomain) return;
    setChecking(true);
    try {
      const fresh = await onVerifyDomain();
      setRecords(fresh);
      const ok = fresh.filter((r) => r.status === "verified").length;
      setStatus(`DNS checked: ${ok} of ${fresh.length} records verified.`);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "DNS check failed. Try again in a minute.");
    } finally {
      setChecking(false);
    }
  };

  const save = async () => {
    if (invalid) return;
    setSaving(true);
    try {
      await onSave(v);
      setSaved(v);
      setStatus("Email settings saved.");
      setSaveError(null);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Could not save email settings.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={cn("flex w-full max-w-3xl flex-col gap-8 font-crm", className)}>
      <p className="sr-only" aria-live="polite">
        {status}
      </p>

      <section className="flex flex-col gap-2" aria-labelledby={`${id}-mb`}>
        <div className="flex flex-wrap items-end justify-between gap-2 px-1">
          <h2 id={`${id}-mb`} className="crm-eyebrow text-crm-subtle">
            Connected mailboxes
          </h2>
          {onConnect ? (
            <div className="flex gap-2">
              <Button size="sm" onClick={() => onConnect("google")}>
                Connect Google
              </Button>
              <Button size="sm" onClick={() => onConnect("microsoft")}>
                Connect Microsoft
              </Button>
            </div>
          ) : null}
        </div>
        {mailboxes.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-crm-border p-8 text-center">
            <Mail className="size-6 text-crm-subtle" aria-hidden />
            <p className="text-sm text-crm-fg">No mailbox connected</p>
            <p className="text-xs text-crm-soft">
              Connect a mailbox to log emails to records and send sequences from your own address.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-crm-border rounded-xl border border-crm-border bg-crm-card shadow-crm-raised">
            {mailboxes.map((m) => (
              <li
                key={m.id}
                className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex min-w-0 items-start gap-3">
                  <span
                    className={cn(
                      "mt-1.5 size-2 shrink-0 rounded-full",
                      m.status === "connected" && "bg-crm-success",
                      m.status === "syncing" && "animate-pulse bg-crm-warning",
                      m.status === "error" && "bg-crm-danger",
                    )}
                    aria-hidden
                  />
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2 text-sm text-crm-fg">
                      <span className="truncate">{m.address}</span>
                      {m.isDefault ? (
                        <Tag size="sm" color="purple">
                          Default
                        </Tag>
                      ) : null}
                    </p>
                    <p className="text-xs text-crm-soft">
                      {PROVIDER[m.provider]} ·{" "}
                      {m.status === "error" ? (
                        <span className="text-crm-danger">{m.errorMessage ?? "Sync failed"}</span>
                      ) : m.status === "syncing" ? (
                        "Syncing..."
                      ) : (
                        `Synced ${ago(m.lastSyncedAt)}`
                      )}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  {m.status === "error" && onResync ? (
                    <Button size="sm" variant="primary" onClick={() => onResync(m.id)}>
                      <RefreshCw />
                      Reconnect
                    </Button>
                  ) : null}
                  {!m.isDefault && onSetDefault ? (
                    <Button size="sm" variant="ghost" onClick={() => onSetDefault(m.id)}>
                      Make default
                    </Button>
                  ) : null}
                  {onDisconnect ? (
                    <Button
                      size="sm"
                      variant="danger"
                      disabled={m.isDefault && mailboxes.length > 1}
                      title={
                        m.isDefault && mailboxes.length > 1
                          ? "Choose another default first"
                          : undefined
                      }
                      onClick={() => onDisconnect(m.id)}
                    >
                      Disconnect
                    </Button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-2" aria-labelledby={`${id}-id`}>
        <h2 id={`${id}-id`} className="crm-eyebrow px-1 text-crm-subtle">
          Sending identity
        </h2>
        <div className="grid gap-4 rounded-xl border border-crm-border bg-crm-card p-4 shadow-crm-raised sm:grid-cols-2">
          <FormField label="From name" htmlFor={`${id}-from`} required error={nameErr}>
            <Input
              id={`${id}-from`}
              value={v.fromName}
              invalid={!!nameErr}
              onChange={(e) => patch({ fromName: e.target.value })}
            />
          </FormField>
          <FormField
            label="Reply-to address"
            htmlFor={`${id}-reply`}
            error={replyErr}
            hint="Leave empty to use the mailbox address."
          >
            <Input
              id={`${id}-reply`}
              type="email"
              value={v.replyTo}
              invalid={!!replyErr}
              aria-describedby={`${id}-reply-msg`}
              onChange={(e) => patch({ replyTo: e.target.value })}
            />
          </FormField>
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <label htmlFor={`${id}-sig`} className="text-xs text-crm-soft">
              Signature
            </label>
            <div className="grid gap-3 md:grid-cols-2">
              <Textarea
                id={`${id}-sig`}
                rows={6}
                value={v.signature}
                aria-describedby={`${id}-sig-help`}
                onChange={(e) => patch({ signature: e.target.value })}
              />
              <div
                className="min-h-32 rounded-crm border border-crm-border bg-crm-raised p-3 text-sm whitespace-pre-wrap text-crm-fg"
                aria-label="Signature preview"
              >
                <span className="crm-caption mb-1 block text-crm-subtle">Preview</span>
                {renderMergeFields(v.signature, sender) || (
                  <span className="text-crm-subtle">Empty signature</span>
                )}
              </div>
            </div>
            <p id={`${id}-sig-help`} className="text-xs text-crm-subtle">
              Merge fields:{" "}
              {Object.keys(sender)
                .map((k) => `{{${k}}}`)
                .join(" ") || "none"}
            </p>
            {unknownFields.length ? (
              <p className="flex items-center gap-1.5 text-xs text-crm-warning" role="alert">
                <AlertTriangle className="size-3.5" aria-hidden />
                Unknown merge field{unknownFields.length > 1 ? "s" : ""}: {unknownFields.join(", ")}
              </p>
            ) : null}
          </div>
        </div>
      </section>

      <SettingsGroup heading="Tracking and limits">
        <SettingsRow
          icon={<Mail />}
          label="Track opens"
          htmlFor={`${id}-opens`}
          description="Adds an invisible pixel. Apple Mail Privacy Protection may inflate open rates."
          control={
            <Switch
              id={`${id}-opens`}
              checked={v.trackOpens}
              onCheckedChange={(c) => patch({ trackOpens: c })}
            />
          }
        />
        <SettingsRow
          icon={<MousePointerClick />}
          label="Track link clicks"
          htmlFor={`${id}-clicks`}
          description="Rewrites links through your tracking domain."
          control={
            <Switch
              id={`${id}-clicks`}
              checked={v.trackClicks}
              onCheckedChange={(c) => patch({ trackClicks: c })}
            />
          }
        />
        <SettingsRow
          icon={<Send />}
          label="Daily send limit per mailbox"
          htmlFor={`${id}-limit`}
          description={
            limitErr ? (
              <span className="text-crm-danger">{limitErr}</span>
            ) : (
              "Sequences pause once the limit is hit and resume the next day."
            )
          }
          control={
            <Input
              id={`${id}-limit`}
              type="number"
              min={1}
              max={PROVIDER_CAP}
              className="w-28 text-right tabular-nums"
              invalid={!!limitErr}
              value={Number.isFinite(v.dailyLimit) ? v.dailyLimit : ""}
              onChange={(e) => patch({ dailyLimit: e.target.valueAsNumber })}
            />
          }
        />
        <SettingsRow
          label="Gap between automated sends"
          description="Randomised around this value to look human and protect deliverability."
          control={
            <Select
              aria-label="Gap between automated sends"
              className="w-36"
              value={v.sendGap}
              onValueChange={(sendGap) => patch({ sendGap })}
              options={[
                { value: "1", label: "~1 minute" },
                { value: "3", label: "~3 minutes" },
                { value: "5", label: "~5 minutes" },
                { value: "10", label: "~10 minutes" },
              ]}
            />
          }
        />
        <SettingsRow
          label="Unsubscribe footer"
          htmlFor={`${id}-unsub`}
          badge={
            <Tag size="sm" color="amber">
              Required for bulk
            </Tag>
          }
          description="One-click unsubscribe header and footer link (Gmail/Yahoo bulk-sender rules)."
          control={
            <Switch
              id={`${id}-unsub`}
              checked={v.unsubscribeFooter}
              onCheckedChange={(c) => patch({ unsubscribeFooter: c })}
            />
          }
        />
      </SettingsGroup>

      <section className="flex flex-col gap-2" aria-labelledby={`${id}-dns`}>
        <div className="flex flex-wrap items-end justify-between gap-2 px-1">
          <h2 id={`${id}-dns`} className="crm-eyebrow text-crm-subtle">
            Domain authentication · {domain}
          </h2>
          <span className="flex items-center gap-2">
            <Tag size="sm" color={domainHealthy ? "green" : "amber"}>
              {verifiedCount}/{records.length} verified
            </Tag>
            {onVerifyDomain ? (
              <Button size="sm" loading={checking} onClick={() => void verify()}>
                <ShieldCheck />
                Verify DNS
              </Button>
            ) : null}
          </span>
        </div>
        <div className="overflow-x-auto rounded-xl border border-crm-border bg-crm-card shadow-crm-raised">
          <table className="w-full min-w-[560px] text-left text-xs">
            <caption className="sr-only">DNS records for {domain}</caption>
            <thead className="text-crm-subtle">
              <tr className="border-b border-crm-border">
                <th scope="col" className="px-4 py-2 font-medium">
                  Record
                </th>
                <th scope="col" className="px-4 py-2 font-medium">
                  Host
                </th>
                <th scope="col" className="px-4 py-2 font-medium">
                  Value
                </th>
                <th scope="col" className="px-4 py-2 font-medium">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-crm-border">
              {records.map((r, i) => {
                const key = `${r.purpose}-${i}`;
                return (
                  <tr key={key}>
                    <td className="px-4 py-3 text-crm-fg">
                      {r.purpose} <span className="text-crm-subtle">{r.type}</span>
                    </td>
                    <td className="px-4 py-3 font-mono text-crm-soft">{r.host}</td>
                    <td className="max-w-[240px] px-4 py-3">
                      <span className="flex items-center gap-1.5">
                        <code className="truncate font-mono text-crm-soft" title={r.value}>
                          {r.value}
                        </code>
                        <button
                          type="button"
                          aria-label={`Copy ${r.purpose} value`}
                          onClick={() => void copy(r.value, key)}
                          className="shrink-0 rounded p-1 text-crm-subtle hover:bg-crm-muted hover:text-crm-fg focus-visible:ring-2 focus-visible:ring-crm-ring/40 focus-visible:outline-none"
                        >
                          {copied === key ? (
                            <Check className="size-3.5 text-crm-success" />
                          ) : (
                            <Copy className="size-3.5" />
                          )}
                        </button>
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <Tag
                        size="sm"
                        color={
                          r.status === "verified"
                            ? "green"
                            : r.status === "pending"
                              ? "amber"
                              : "red"
                        }
                      >
                        {r.status === "verified"
                          ? "Verified"
                          : r.status === "pending"
                            ? "Pending"
                            : "Not found"}
                      </Tag>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {!domainHealthy ? (
          <p className="px-1 text-xs text-crm-soft">
            DNS changes can take up to 48 hours to propagate. Unverified domains send from a shared
            domain with lower deliverability.
          </p>
        ) : null}
      </section>

      <div
        className={cn(
          "sticky bottom-4 flex items-center justify-between gap-3 rounded-crm border border-crm-border bg-crm-raised px-4 py-3 shadow-crm-raised transition-opacity",
          dirty ? "opacity-100" : "pointer-events-none opacity-0",
        )}
        aria-hidden={!dirty}
      >
        <span className="text-xs text-crm-soft" role={saveError ? "alert" : undefined}>
          {saveError ? (
            <span className="text-crm-danger">{saveError}</span>
          ) : (
            "You have unsaved changes"
          )}
        </span>
        <span className="flex gap-2">
          <Button variant="ghost" tabIndex={dirty ? 0 : -1} onClick={() => setV(saved)}>
            Discard
          </Button>
          <Button
            variant="primary"
            tabIndex={dirty ? 0 : -1}
            disabled={invalid}
            loading={saving}
            onClick={() => void save()}
          >
            Save changes
          </Button>
        </span>
      </div>
    </div>
  );
}
