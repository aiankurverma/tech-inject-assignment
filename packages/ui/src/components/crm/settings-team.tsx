import * as React from "react";
import { MailPlus, RotateCw, Search, Trash2, Users, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/crm/avatar";
import { Button } from "@/components/crm/button";
import { Input } from "@/components/crm/input";
import { Select } from "@/components/crm/select";
import { Tag } from "@/components/crm/tag";

export type TeamRole = "owner" | "admin" | "manager" | "member" | "viewer";

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: TeamRole;
  /** "invited" rows are pending invitations that have not been accepted yet. */
  status: "active" | "invited" | "suspended";
  team?: string;
  /** ISO date of last activity (active) or invite send date (invited). */
  lastActive?: string;
  /** Viewers are free and do not consume a paid seat. */
  avatarUrl?: string;
}

export interface SettingsTeamProps {
  members?: TeamMember[];
  defaultMembers?: TeamMember[];
  onMembersChange?: (members: TeamMember[]) => void;
  /** Paid seats on the plan. Viewers do not count. */
  seatLimit?: number;
  /** The signed-in user; cannot change their own role or remove themselves. */
  currentUserId?: string;
  /** Called with validated emails + role. Return a rejected promise to show an error. */
  onInvite?: (emails: string[], role: TeamRole) => Promise<void> | void;
  onResendInvite?: (member: TeamMember) => void;
  loading?: boolean;
  className?: string;
}

const ROLE_OPTIONS: { value: TeamRole; label: string }[] = [
  { value: "owner", label: "Owner" },
  { value: "admin", label: "Admin" },
  { value: "manager", label: "Manager" },
  { value: "member", label: "Member" },
  { value: "viewer", label: "Viewer" },
];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const isPaid = (m: TeamMember) => m.role !== "viewer" && m.status !== "suspended";

function ago(iso?: string) {
  if (!iso) return "Never";
  const d = (Date.now() - new Date(iso).getTime()) / 86_400_000;
  if (d < 1 / 24) return "Just now";
  if (d < 1) return `${Math.floor(d * 24)}h ago`;
  if (d < 30) return `${Math.floor(d)}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/** Parses a comma/space/newline separated list into valid + invalid + duplicate emails. */
export function parseInviteEmails(raw: string, existing: string[]) {
  const seen = new Set(existing.map((e) => e.toLowerCase()));
  const valid: string[] = [];
  const invalid: string[] = [];
  const duplicate: string[] = [];
  for (const token of raw.split(/[\s,;]+/).filter(Boolean)) {
    const e = token.toLowerCase();
    if (!EMAIL_RE.test(e)) invalid.push(token);
    else if (seen.has(e)) duplicate.push(token);
    else {
      seen.add(e);
      valid.push(e);
    }
  }
  return { valid, invalid, duplicate };
}

/** Team members admin page: seat usage, bulk invite with validation, role changes, owner guard, pending invites. */
export function SettingsTeam({
  members,
  defaultMembers = [],
  onMembersChange,
  seatLimit = 10,
  currentUserId,
  onInvite,
  onResendInvite,
  loading,
  className,
}: SettingsTeamProps) {
  const [inner, setInner] = React.useState(defaultMembers);
  const list = members ?? inner;
  const commit = (next: TeamMember[]) => {
    if (members === undefined) setInner(next);
    onMembersChange?.(next);
  };

  const [query, setQuery] = React.useState("");
  const [roleFilter, setRoleFilter] = React.useState<"all" | TeamRole>("all");
  const [draft, setDraft] = React.useState("");
  const [inviteRole, setInviteRole] = React.useState<TeamRole>("member");
  const [inviteError, setInviteError] = React.useState<string | null>(null);
  const [sending, setSending] = React.useState(false);
  const [confirmId, setConfirmId] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState("");

  const used = list.filter(isPaid).length;
  const owners = list.filter((m) => m.role === "owner" && m.status === "active").length;
  const pct = Math.min(100, Math.round((used / Math.max(1, seatLimit)) * 100));

  const q = query.trim().toLowerCase();
  const visible = list
    .filter((m) => roleFilter === "all" || m.role === roleFilter)
    .filter(
      (m) =>
        !q ||
        m.name.toLowerCase().includes(q) ||
        m.email.toLowerCase().includes(q) ||
        (m.team ?? "").toLowerCase().includes(q),
    )
    .sort((a, b) =>
      a.status === b.status ? a.name.localeCompare(b.name) : a.status === "invited" ? 1 : -1,
    );

  const parsed = parseInviteEmails(
    draft,
    list.map((m) => m.email),
  );
  const newPaid = inviteRole === "viewer" ? 0 : parsed.valid.length;
  const overSeats = used + newPaid > seatLimit;

  async function sendInvites(e: React.FormEvent) {
    e.preventDefault();
    if (parsed.invalid.length) return setInviteError(`Invalid: ${parsed.invalid.join(", ")}`);
    if (!parsed.valid.length) return setInviteError("Add at least one new email address.");
    if (overSeats)
      return setInviteError(
        `Needs ${used + newPaid - seatLimit} more seat(s). Upgrade or invite as Viewer.`,
      );
    setInviteError(null);
    setSending(true);
    try {
      await onInvite?.(parsed.valid, inviteRole);
      const now = new Date().toISOString();
      commit([
        ...list,
        ...parsed.valid.map((email) => ({
          id: `inv-${email}`,
          name: email.split("@")[0] ?? email,
          email,
          role: inviteRole,
          status: "invited" as const,
          lastActive: now,
        })),
      ]);
      setNotice(`${parsed.valid.length} invitation(s) sent.`);
      setDraft("");
    } catch (err) {
      setInviteError(err instanceof Error ? err.message : "Could not send invites.");
    } finally {
      setSending(false);
    }
  }

  function changeRole(m: TeamMember, role: TeamRole) {
    if (m.role === "owner" && role !== "owner" && owners <= 1) {
      setNotice("A workspace needs at least one owner. Promote someone else first.");
      return;
    }
    if (m.role === "viewer" && role !== "viewer" && used >= seatLimit) {
      setNotice("No free seats. Upgrade the plan to promote this viewer.");
      return;
    }
    commit(list.map((x) => (x.id === m.id ? { ...x, role } : x)));
    setNotice(`${m.name} is now ${role}.`);
  }

  function remove(m: TeamMember) {
    commit(list.filter((x) => x.id !== m.id));
    setConfirmId(null);
    setNotice(`${m.name} ${m.status === "invited" ? "invitation revoked" : "removed"}.`);
  }

  return (
    <section className={cn("flex flex-col gap-5 font-crm", className)} aria-labelledby="team-h">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="crm-eyebrow text-crm-subtle">Settings</p>
          <h2 id="team-h" className="text-lg font-semibold text-crm-fg">
            Team members
          </h2>
          <p className="text-xs text-crm-soft">
            Invite teammates and control what they can access.
          </p>
        </div>
        <div className="w-full sm:w-64">
          <div className="flex justify-between text-xs text-crm-soft">
            <span className="flex items-center gap-1">
              <Users className="size-3.5" aria-hidden /> Paid seats
            </span>
            <span className={cn("tabular-nums", pct >= 100 && "text-crm-danger")}>
              {used} / {seatLimit}
            </span>
          </div>
          <div
            role="meter"
            aria-label="Seats used"
            aria-valuemin={0}
            aria-valuemax={seatLimit}
            aria-valuenow={used}
            className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-crm-muted"
          >
            <div
              className={cn(
                "h-full rounded-full transition-[width]",
                pct >= 100 ? "bg-crm-danger" : pct >= 80 ? "bg-crm-warning" : "bg-crm-primary",
              )}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      </header>

      <form
        onSubmit={sendInvites}
        className="flex flex-col gap-3 rounded-xl border border-crm-border bg-crm-card p-4 shadow-crm-raised"
        aria-labelledby="invite-h"
      >
        <h3 id="invite-h" className="text-sm font-medium text-crm-fg">
          Invite people
        </h3>
        <div className="flex flex-col gap-2 md:flex-row">
          <Input
            aria-label="Email addresses"
            placeholder="priya@acme.com, dev@acme.com"
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              setInviteError(null);
            }}
            invalid={!!inviteError}
            aria-describedby="invite-msg"
            className="md:flex-1"
          />
          <Select
            aria-label="Role for invitees"
            className="md:w-36"
            value={inviteRole}
            onValueChange={(v) => setInviteRole(v as TeamRole)}
            options={ROLE_OPTIONS.filter((r) => r.value !== "owner")}
          />
          <Button type="submit" variant="primary" size="lg" loading={sending}>
            <MailPlus /> Send invites
          </Button>
        </div>
        <p
          id="invite-msg"
          className={cn("text-xs", inviteError ? "text-crm-danger" : "text-crm-subtle")}
        >
          {inviteError ??
            (draft
              ? `${parsed.valid.length} new · ${parsed.duplicate.length} already on team · ${parsed.invalid.length} invalid${overSeats ? " · over seat limit" : ""}`
              : "Separate multiple emails with commas. Viewers are free.")}
        </p>
      </form>

      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative sm:flex-1">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-crm-subtle"
            aria-hidden
          />
          <Input
            aria-label="Search members"
            placeholder="Search name, email or team"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-8"
          />
        </div>
        <Select
          aria-label="Filter by role"
          className="sm:w-40"
          value={roleFilter}
          onValueChange={(v) => setRoleFilter(v as "all" | TeamRole)}
          options={[{ value: "all", label: "All roles" }, ...ROLE_OPTIONS]}
        />
      </div>

      <p role="status" aria-live="polite" className="sr-only">
        {notice}
      </p>
      {notice ? (
        <div className="flex items-center justify-between rounded-crm border border-crm-border bg-crm-raised px-3 py-2 text-xs text-crm-soft">
          {notice}
          <button
            type="button"
            aria-label="Dismiss"
            onClick={() => setNotice("")}
            className="text-crm-subtle hover:text-crm-fg"
          >
            <X className="size-3.5" />
          </button>
        </div>
      ) : null}

      <div className="overflow-hidden rounded-xl border border-crm-border bg-crm-card shadow-crm-raised">
        {loading ? (
          <ul aria-busy className="divide-y divide-crm-border">
            {[0, 1, 2].map((i) => (
              <li key={i} className="flex items-center gap-3 p-4">
                <span className="size-8 animate-pulse rounded-full bg-crm-muted" />
                <span className="h-3 w-40 animate-pulse rounded bg-crm-muted" />
              </li>
            ))}
          </ul>
        ) : visible.length === 0 ? (
          <p className="p-8 text-center text-sm text-crm-soft">
            {list.length
              ? "No members match these filters."
              : "No teammates yet. Invite one above."}
          </p>
        ) : (
          <ul className="divide-y divide-crm-border">
            {visible.map((m) => {
              const self = m.id === currentUserId;
              return (
                <li
                  key={m.id}
                  className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <Avatar name={m.name} src={m.avatarUrl} size="md" />
                    <div className="min-w-0">
                      <p className="flex items-center gap-2 truncate text-sm font-medium text-crm-fg">
                        {m.name}
                        {self ? <Tag size="sm">You</Tag> : null}
                        {m.status === "invited" ? (
                          <Tag size="sm" color="amber">
                            Pending
                          </Tag>
                        ) : null}
                        {m.status === "suspended" ? (
                          <Tag size="sm" color="red">
                            Suspended
                          </Tag>
                        ) : null}
                      </p>
                      <p className="truncate text-xs text-crm-soft">
                        {m.email}
                        {m.team ? ` · ${m.team}` : ""} ·{" "}
                        {m.status === "invited"
                          ? `Invited ${ago(m.lastActive)}`
                          : ago(m.lastActive)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Select
                      aria-label={`Role for ${m.name}`}
                      className="w-32"
                      value={m.role}
                      disabled={self}
                      onValueChange={(v) => changeRole(m, v as TeamRole)}
                      options={ROLE_OPTIONS}
                    />
                    {m.status === "invited" ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          onResendInvite?.(m);
                          setNotice(`Invite re-sent to ${m.email}.`);
                        }}
                      >
                        <RotateCw /> Resend
                      </Button>
                    ) : null}
                    {confirmId === m.id ? (
                      <span className="flex items-center gap-1">
                        <Button size="sm" variant="danger" onClick={() => remove(m)}>
                          Confirm
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setConfirmId(null)}>
                          Cancel
                        </Button>
                      </span>
                    ) : (
                      <Button
                        size="sm"
                        variant="ghost"
                        aria-label={`Remove ${m.name}`}
                        disabled={self || (m.role === "owner" && owners <= 1)}
                        onClick={() => setConfirmId(m.id)}
                      >
                        <Trash2 />
                      </Button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
