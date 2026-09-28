import * as React from "react";
import { Clock, MailX, ShieldAlert, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar, LogoTile } from "@/components/crm/avatar";
import { Button } from "@/components/crm/button";
import { FormField, Input } from "@/components/crm/input";
import { Tag, type TagColor } from "@/components/crm/tag";

export type InviteRole = "owner" | "admin" | "member" | "viewer" | "guest";

export interface Invitation {
  workspaceName: string;
  workspaceLogo?: React.ReactNode;
  memberCount: number;
  inviter: { name: string; email: string; avatarUrl?: string };
  role: InviteRole;
  /** Email the invite was sent to. */
  email: string;
  /** ISO timestamp. */
  expiresAt: string;
  status: "pending" | "revoked" | "accepted";
  /** Teams the invitee will be added to. */
  teams?: string[];
}

export interface InviteAcceptProps {
  invitation: Invitation;
  /** Email of the signed-in user, if any. A mismatch shows a warning. */
  currentUserEmail?: string;
  /** Ask for a display name (new accounts). */
  requireName?: boolean;
  onAccept: (data: { name?: string }) => Promise<void> | void;
  onDecline?: () => Promise<void> | void;
  onSwitchAccount?: () => void;
  /** Override "now" (tests, SSR). */
  now?: Date;
  className?: string;
}

const roleInfo: Record<InviteRole, { label: string; color: TagColor; summary: string }> = {
  owner: { label: "Owner", color: "purple", summary: "Full control including billing" },
  admin: { label: "Admin", color: "blue", summary: "Manage members, pipelines and settings" },
  member: { label: "Member", color: "green", summary: "Create and edit records" },
  viewer: { label: "Viewer", color: "neutral", summary: "Read-only access to records" },
  guest: { label: "Guest", color: "amber", summary: "Access to shared records only" },
};

function timeLeft(ms: number) {
  const h = Math.floor(ms / 3_600_000);
  if (h >= 48) return `${Math.floor(h / 24)} days`;
  if (h >= 1) return `${h} h ${Math.floor((ms % 3_600_000) / 60_000)} min`;
  return `${Math.max(1, Math.ceil(ms / 60_000))} min`;
}

/** Workspace invitation landing card: inviter, role scope, expiry countdown, account mismatch warning and accept/decline with async states. */
export function InviteAccept({
  invitation: inv,
  currentUserEmail,
  requireName,
  onAccept,
  onDecline,
  onSwitchAccount,
  now,
  className,
}: InviteAcceptProps) {
  const [tick, setTick] = React.useState(() => (now ?? new Date()).getTime());
  const [name, setName] = React.useState("");
  const [touched, setTouched] = React.useState(false);
  const [busy, setBusy] = React.useState<"accept" | "decline" | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [done, setDone] = React.useState<"accepted" | "declined" | null>(null);
  const nameId = React.useId();

  React.useEffect(() => {
    if (now) return;
    const t = window.setInterval(() => setTick(Date.now()), 30_000);
    return () => window.clearInterval(t);
  }, [now]);

  const remaining = new Date(inv.expiresAt).getTime() - (now ? now.getTime() : tick);
  const expired = remaining <= 0;
  const mismatch = !!currentUserEmail && currentUserEmail.toLowerCase() !== inv.email.toLowerCase();
  const nameError =
    requireName && touched && name.trim().length < 2 ? "Enter your name" : undefined;
  const role = roleInfo[inv.role];

  const run = async (kind: "accept" | "decline") => {
    if (kind === "accept" && requireName && name.trim().length < 2) {
      setTouched(true);
      return;
    }
    setBusy(kind);
    setError(null);
    try {
      if (kind === "accept") await onAccept({ name: requireName ? name.trim() : undefined });
      else await onDecline?.();
      setDone(kind === "accept" ? "accepted" : "declined");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong. Try again.");
    } finally {
      setBusy(null);
    }
  };

  const shell = (children: React.ReactNode) => (
    <section
      className={cn(
        "flex w-full max-w-md flex-col gap-5 rounded-crm border border-crm-border bg-crm-card p-6 font-crm text-crm-fg shadow-crm-raised",
        className,
      )}
    >
      {children}
    </section>
  );

  const blocked = (icon: React.ReactNode, title: string, body: string) =>
    shell(
      <div role="status" className="flex flex-col items-center gap-3 py-4 text-center">
        <LogoTile size="lg">{icon}</LogoTile>
        <h2 className="text-lg font-medium">{title}</h2>
        <p className="text-sm text-crm-muted-fg">{body}</p>
      </div>,
    );

  if (inv.status === "revoked")
    return blocked(
      <MailX />,
      "Invitation revoked",
      `${inv.inviter.name} cancelled this invitation. Ask them to send a new one.`,
    );
  if (inv.status === "accepted" || done === "accepted")
    return blocked(
      <Users />,
      `You're in ${inv.workspaceName}`,
      `You joined as ${role.label}. Redirecting to your workspace…`,
    );
  if (done === "declined")
    return blocked(<MailX />, "Invitation declined", `We let ${inv.inviter.name} know.`);
  if (expired)
    return blocked(
      <Clock />,
      "This invitation expired",
      `Invites are valid for a limited time. Ask ${inv.inviter.name} (${inv.inviter.email}) to resend it.`,
    );

  return shell(
    <>
      <header className="flex flex-col items-center gap-3 text-center">
        <LogoTile size="lg" aria-hidden>
          {inv.workspaceLogo ?? inv.workspaceName.slice(0, 1)}
        </LogoTile>
        <div className="flex items-center gap-2 text-sm text-crm-muted-fg">
          <Avatar name={inv.inviter.name} src={inv.inviter.avatarUrl} size="sm" />
          <span>
            <span className="text-crm-fg">{inv.inviter.name}</span> invited you to
          </span>
        </div>
        <h2 className="text-xl font-medium">{inv.workspaceName}</h2>
        <p className="crm-caption text-crm-subtle">
          {inv.memberCount.toLocaleString()} {inv.memberCount === 1 ? "member" : "members"}
        </p>
      </header>

      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2.5 rounded-crm border border-crm-border bg-crm-raised p-3 text-xs">
        <dt className="text-crm-subtle">Role</dt>
        <dd className="flex flex-wrap items-center gap-2">
          <Tag size="sm" color={role.color}>
            {role.label}
          </Tag>
          <span className="text-crm-soft">{role.summary}</span>
        </dd>
        {inv.teams?.length ? (
          <>
            <dt className="text-crm-subtle">Teams</dt>
            <dd className="text-crm-soft">{inv.teams.join(", ")}</dd>
          </>
        ) : null}
        <dt className="text-crm-subtle">Sent to</dt>
        <dd className="truncate text-crm-soft">{inv.email}</dd>
        <dt className="text-crm-subtle">Expires</dt>
        <dd className={cn(remaining < 86_400_000 ? "text-crm-warning" : "text-crm-soft")}>
          in {timeLeft(remaining)}
        </dd>
      </dl>

      {mismatch ? (
        <div
          role="alert"
          className="flex gap-2 rounded-crm border border-crm-warning/40 bg-crm-warning/10 p-3 text-xs text-crm-soft"
        >
          <ShieldAlert className="size-4 shrink-0 text-crm-warning" aria-hidden />
          <div className="flex flex-col gap-1.5">
            <span>
              You are signed in as <span className="text-crm-fg">{currentUserEmail}</span>, but this
              invite was sent to <span className="text-crm-fg">{inv.email}</span>.
            </span>
            {onSwitchAccount ? (
              <button
                type="button"
                onClick={onSwitchAccount}
                className="w-fit cursor-pointer text-crm-fg underline underline-offset-2 outline-none focus-visible:ring-2 focus-visible:ring-crm-ring/60"
              >
                Switch account
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      {requireName ? (
        <FormField label="Your name" htmlFor={nameId} required error={nameError}>
          <Input
            id={nameId}
            autoComplete="name"
            value={name}
            invalid={!!nameError}
            aria-describedby={`${nameId}-msg`}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => setTouched(true)}
          />
        </FormField>
      ) : null}

      {error ? (
        <p role="alert" className="text-xs text-crm-danger">
          {error}
        </p>
      ) : null}

      <div className="flex flex-col-reverse gap-2 sm:flex-row">
        {onDecline ? (
          <Button
            size="lg"
            variant="ghost"
            className="sm:flex-1"
            loading={busy === "decline"}
            disabled={busy !== null}
            onClick={() => void run("decline")}
          >
            Decline
          </Button>
        ) : null}
        <Button
          size="lg"
          variant="primary"
          className="sm:flex-1"
          loading={busy === "accept"}
          disabled={busy !== null || mismatch}
          onClick={() => void run("accept")}
        >
          Join {inv.workspaceName}
        </Button>
      </div>
    </>,
  );
}
