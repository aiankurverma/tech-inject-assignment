import * as React from "react";
import { Check, Globe, Link2, Lock, X } from "lucide-react";
import { Avatar } from "@/components/crm/avatar";
import { Button } from "@/components/crm/button";
import { Dialog, DialogClose, DialogContent, DialogSection } from "@/components/crm/dialog";
import { cn } from "@/lib/utils";

export type ShareRole = "owner" | "editor" | "commenter" | "viewer";
export type LinkAccess = "restricted" | "workspace" | "anyone";

export interface ShareMember {
  id: string;
  name: string;
  email: string;
  src?: string;
  role: ShareRole;
  /** Invitation sent but not accepted yet. */
  pending?: boolean;
}

export interface ShareInvite {
  emails: string[];
  role: Exclude<ShareRole, "owner">;
  message: string;
  notify: boolean;
}

export interface ShareDialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Name of the record being shared, e.g. "Acme Corp · Q4 renewal". */
  resourceName: string;
  members: ShareMember[];
  /** Signed-in user; only owners and editors can invite or change roles. */
  currentUserId: string;
  onInvite?: (invite: ShareInvite) => Promise<void> | void;
  onRoleChange?: (memberId: string, role: ShareRole | "remove") => void;
  linkAccess?: LinkAccess;
  onLinkAccessChange?: (access: LinkAccess) => void;
  /** Link copied by "Copy link". */
  shareUrl?: string;
  /** Workspace email domain; invites outside it are flagged as external. */
  workspaceDomain?: string;
  /** Name shown for the workspace option ("Anyone at Northwind"). */
  workspaceName?: string;
  /** Maximum seats; invites beyond it are blocked. */
  seatLimit?: number;
}

const roleLabels: Record<ShareRole, string> = {
  owner: "Owner",
  editor: "Can edit",
  commenter: "Can comment",
  viewer: "Can view",
};

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function RoleSelect({
  value,
  onChange,
  allowRemove,
  disabled,
  label,
}: {
  value: ShareRole;
  onChange: (v: ShareRole | "remove") => void;
  allowRemove?: boolean;
  disabled?: boolean;
  label: string;
}) {
  return (
    <select
      aria-label={label}
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value as ShareRole | "remove")}
      className="h-7 cursor-pointer rounded-md border border-crm-input/60 bg-crm-raised px-1.5 text-xs text-crm-fg outline-none [color-scheme:dark] focus-visible:ring-2 focus-visible:ring-crm-ring/40 disabled:cursor-default disabled:border-transparent disabled:bg-transparent disabled:text-crm-soft"
    >
      {(Object.keys(roleLabels) as ShareRole[])
        .filter((r) => r !== "owner" || value === "owner")
        .map((r) => (
          <option key={r} value={r}>
            {roleLabels[r]}
          </option>
        ))}
      {allowRemove ? <option value="remove">Remove access</option> : null}
    </select>
  );
}

/**
 * Share a record: invite by email (paste many, comma or Enter separated) with validation,
 * duplicate and external-domain checks, seat limit, role per person, general link access and
 * copy link. Viewers see the list read-only.
 */
export function ShareDialog({
  open,
  onOpenChange,
  resourceName,
  members,
  currentUserId,
  onInvite,
  onRoleChange,
  linkAccess = "restricted",
  onLinkAccessChange,
  shareUrl,
  workspaceDomain,
  workspaceName = "your workspace",
  seatLimit,
}: ShareDialogProps) {
  const [emails, setEmails] = React.useState<string[]>([]);
  const [draft, setDraft] = React.useState("");
  const [role, setRole] = React.useState<ShareInvite["role"]>("editor");
  const [message, setMessage] = React.useState("");
  const [notify, setNotify] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [sending, setSending] = React.useState(false);
  const [copied, setCopied] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const helpId = React.useId();

  const me = members.find((m) => m.id === currentUserId);
  const canManage = me?.role === "owner" || me?.role === "editor";
  const existing = new Set(members.map((m) => m.email.toLowerCase()));
  const seatsLeft = seatLimit === undefined ? Infinity : seatLimit - members.length - emails.length;

  const addFrom = (raw: string) => {
    const parts = raw
      .split(/[\s,;]+/)
      .map((s) => s.trim().replace(/^<|>$/g, ""))
      .filter(Boolean);
    if (!parts.length) return;
    const next = [...emails];
    const problems: string[] = [];
    for (const p of parts) {
      const e = p.toLowerCase();
      if (!EMAIL.test(e)) problems.push(`"${p}" is not a valid email`);
      else if (existing.has(e)) problems.push(`${e} already has access`);
      else if (next.includes(e)) continue;
      else if (seatLimit !== undefined && members.length + next.length >= seatLimit)
        problems.push(`Seat limit of ${seatLimit} reached`);
      else next.push(e);
    }
    setEmails(next);
    setError(problems[0] ?? null);
    setDraft(
      problems.length ? parts.filter((p) => !next.includes(p.toLowerCase())).join(", ") : "",
    );
  };

  const external = workspaceDomain
    ? emails.filter((e) => !e.endsWith(`@${workspaceDomain.toLowerCase()}`))
    : [];

  const reset = () => {
    setEmails([]);
    setDraft("");
    setMessage("");
    setError(null);
  };

  const send = async () => {
    if (draft.trim()) {
      addFrom(draft);
      return;
    }
    if (!emails.length || !onInvite) return;
    setSending(true);
    try {
      await onInvite({ emails, role, message: message.trim(), notify });
      reset();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not send invites");
    } finally {
      setSending(false);
    }
  };

  const copy = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Clipboard is blocked; copy the link manually.");
    }
  };

  const sorted = [...members].sort(
    (a, b) =>
      (a.id === currentUserId ? -1 : b.id === currentUserId ? 1 : 0) ||
      Number(!!a.pending) - Number(!!b.pending) ||
      a.name.localeCompare(b.name),
  );

  const linkIcon = linkAccess === "restricted" ? Lock : linkAccess === "workspace" ? Link2 : Globe;
  const LinkIcon = linkIcon;

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset();
        onOpenChange?.(o);
      }}
    >
      <DialogContent
        title={`Share “${resourceName}”`}
        description={
          seatLimit !== undefined
            ? `${members.length} of ${seatLimit} seats used`
            : `${members.length} ${members.length === 1 ? "person has" : "people have"} access`
        }
        footer={
          <>
            {shareUrl ? (
              <Button variant="ghost" onClick={copy} className="mr-auto">
                {copied ? <Check aria-hidden /> : <Link2 aria-hidden />}
                {copied ? "Copied" : "Copy link"}
              </Button>
            ) : null}
            <DialogClose asChild>
              <Button>Done</Button>
            </DialogClose>
          </>
        }
      >
        {canManage && onInvite ? (
          <DialogSection title="Invite people">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
              <div
                onClick={() => inputRef.current?.focus()}
                className={cn(
                  "flex min-h-9 flex-1 cursor-text flex-wrap items-center gap-1 rounded-crm border bg-crm-raised px-2 py-1",
                  error ? "border-crm-danger" : "border-crm-input/60 focus-within:border-crm-input",
                )}
              >
                {emails.map((e) => (
                  <span
                    key={e}
                    className={cn(
                      "inline-flex h-6 items-center gap-1 rounded-full pr-1 pl-2 text-xs",
                      external.includes(e)
                        ? "bg-crm-warning/15 text-crm-warning"
                        : "bg-crm-muted text-crm-fg",
                    )}
                  >
                    {e}
                    <button
                      type="button"
                      aria-label={`Remove ${e}`}
                      onClick={() => setEmails(emails.filter((x) => x !== e))}
                      className="rounded-full p-0.5 hover:bg-black/20"
                    >
                      <X className="size-3" aria-hidden />
                    </button>
                  </span>
                ))}
                <input
                  ref={inputRef}
                  value={draft}
                  onChange={(e) => {
                    setDraft(e.target.value);
                    setError(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === "," || e.key === "Tab") {
                      if (draft.trim()) {
                        e.preventDefault();
                        addFrom(draft);
                      }
                    } else if (e.key === "Backspace" && !draft && emails.length) {
                      setEmails(emails.slice(0, -1));
                    }
                  }}
                  onPaste={(e) => {
                    const text = e.clipboardData.getData("text");
                    if (/[\s,;]/.test(text)) {
                      e.preventDefault();
                      addFrom(draft + text);
                    }
                  }}
                  onBlur={() => draft.trim() && addFrom(draft)}
                  aria-label="Emails to invite"
                  aria-invalid={!!error || undefined}
                  aria-describedby={helpId}
                  placeholder={emails.length ? "" : "name@company.com, …"}
                  className="h-7 min-w-[140px] flex-1 bg-transparent text-sm text-crm-fg outline-none placeholder:text-crm-subtle"
                />
              </div>
              <RoleSelect
                label="Role for new people"
                value={role}
                onChange={(v) => v !== "remove" && v !== "owner" && setRole(v)}
              />
            </div>
            <p
              id={helpId}
              className={cn("crm-caption", error ? "text-crm-danger" : "text-crm-subtle")}
              role={error ? "alert" : undefined}
            >
              {error ??
                (external.length
                  ? `${external.length} ${external.length === 1 ? "person is" : "people are"} outside ${workspaceDomain}.`
                  : seatsLeft !== Infinity
                    ? `${Math.max(0, seatsLeft)} seats left`
                    : "Separate multiple emails with commas.")}
            </p>
            {emails.length ? (
              <>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Add a message (optional)"
                  aria-label="Message"
                  rows={2}
                  maxLength={500}
                  className="w-full resize-none rounded-crm border border-crm-input/60 bg-crm-raised px-3 py-2 text-sm text-crm-fg outline-none placeholder:text-crm-subtle focus-visible:border-crm-input"
                />
                <div className="flex items-center justify-between gap-3">
                  <label className="flex items-center gap-2 text-xs text-crm-soft">
                    <input
                      type="checkbox"
                      checked={notify}
                      onChange={(e) => setNotify(e.target.checked)}
                      className="accent-[var(--color-crm-primary)]"
                    />
                    Notify by email
                  </label>
                  <Button variant="primary" loading={sending} onClick={send}>
                    Invite {emails.length}
                  </Button>
                </div>
              </>
            ) : null}
          </DialogSection>
        ) : null}

        <DialogSection title="People with access">
          <ul className="-mx-2 flex max-h-64 flex-col overflow-y-auto">
            {sorted.map((m) => {
              const isMe = m.id === currentUserId;
              const owners = members.filter((x) => x.role === "owner").length;
              const locked =
                !canManage || isMe || (m.role === "owner" && owners <= 1) || !onRoleChange;
              return (
                <li key={m.id} className="flex items-center gap-3 rounded-md px-2 py-1.5">
                  <Avatar name={m.name} src={m.src} size="md" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-crm-fg">
                      {m.name}
                      {isMe ? <span className="text-crm-subtle"> (you)</span> : null}
                      {m.pending ? (
                        <span className="ml-1.5 rounded-full bg-crm-muted px-1.5 text-[10px] text-crm-soft">
                          Pending
                        </span>
                      ) : null}
                    </p>
                    <p className="truncate crm-caption text-crm-soft">{m.email}</p>
                  </div>
                  <RoleSelect
                    label={`Role for ${m.name}`}
                    value={m.role}
                    disabled={locked}
                    allowRemove
                    onChange={(v) => onRoleChange?.(m.id, v)}
                  />
                </li>
              );
            })}
          </ul>
        </DialogSection>

        <DialogSection title="General access">
          <div className="flex items-center gap-3">
            <span className="grid size-8 place-items-center rounded-full bg-crm-muted text-crm-fg">
              <LinkIcon className="size-3.5" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <select
                aria-label="Who can open the link"
                value={linkAccess}
                disabled={!canManage || !onLinkAccessChange}
                onChange={(e) => onLinkAccessChange?.(e.target.value as LinkAccess)}
                className="-ml-1 cursor-pointer rounded bg-transparent px-1 text-sm text-crm-fg outline-none [color-scheme:dark] focus-visible:ring-2 focus-visible:ring-crm-ring/40 disabled:cursor-default"
              >
                <option value="restricted">Restricted</option>
                <option value="workspace">Anyone at {workspaceName}</option>
                <option value="anyone">Anyone with the link</option>
              </select>
              <p className="crm-caption text-crm-soft">
                {linkAccess === "restricted"
                  ? "Only people added above can open this record."
                  : linkAccess === "workspace"
                    ? `Members of ${workspaceName} with the link can view.`
                    : "Anyone on the internet with the link can view. Avoid for customer data."}
              </p>
            </div>
          </div>
        </DialogSection>
      </DialogContent>
    </Dialog>
  );
}
