import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  Check,
  KeyRound,
  Link2,
  Loader2,
  Lock,
  Mail,
  Settings,
  Trash2,
  TriangleAlert,
  Upload,
} from "lucide-react";
import { api, ApiError, CodeBlock, PreviewFrame, type PreviewPayload } from "@ti/client";
import { Layout } from "../components/Layout";
import { useSession } from "../context/session";
import { atLeast, teamInstallCommand, type TeamRole, type TeamSummary } from "../lib/teams";
import {
  alertClass,
  btn,
  EmptyState,
  inputClass,
  PageHeader,
  Skeleton,
  Tabs,
  TeamBadge,
} from "../components/ui";

type Tab = "components" | "members" | "invites" | "tokens" | "settings";

interface Row {
  slug: string;
  status: "draft" | "published" | "unpublished";
  name: string;
  category: string;
  description: string;
  version: string;
  hasUnpublishedChanges: boolean;
}
interface Member {
  customerId: string;
  name: string;
  email: string;
  role: TeamRole;
  joinedAt: string;
}
interface Invite {
  id: string;
  kind: "email" | "link";
  role: "admin" | "member";
  prefix: string;
  email: string | null;
  expiresAt: string;
}

const selectClass = `${inputClass} appearance-none pr-8`;
const errText = (e: unknown, fallback: string) => (e instanceof Error ? e.message : fallback);

export function TeamPage() {
  const { team: slug = "" } = useParams();
  const { me, loadingMe, teams, refreshTeams } = useSession();
  const [params, setParams] = useSearchParams();
  const tab = (params.get("tab") as Tab | null) ?? "components";
  const setTab = (t: Tab) => setParams(t === "components" ? {} : { tab: t }, { replace: true });
  const [team, setTeam] = useState<TeamSummary | null>(null);
  const [error, setError] = useState<ApiError | null>(null);

  const load = useCallback(() => {
    setError(null);
    api<TeamSummary>(`/api/teams/${slug}`)
      .then(setTeam)
      .catch((e: ApiError) => setError(e));
  }, [slug]);
  useEffect(() => {
    if (me) load();
  }, [me, load, teams]);

  if (loadingMe)
    return (
      <Layout>
        <Skeleton className="h-9 w-56" />
        <Skeleton className="mt-6 h-40 w-full rounded-xl" />
      </Layout>
    );
  if (!me)
    return (
      <Layout>
        <EmptyState
          icon={<Lock className="size-5" />}
          title="Sign in to see this team"
          action={
            <Link to="/sign-in" state={{ from: `/teams/${slug}` }} className={btn.primary}>
              Sign in
            </Link>
          }
        >
          Team workspaces are private to their members.
        </EmptyState>
      </Layout>
    );
  if (error)
    return (
      <Layout>
        <EmptyState icon={<TriangleAlert className="size-5" />} title="Team not found">
          This team does not exist, or you are not a member.
        </EmptyState>
      </Layout>
    );
  if (!team)
    return (
      <Layout>
        <Skeleton className="h-9 w-56" />
        <Skeleton className="mt-6 h-40 w-full rounded-xl" />
      </Layout>
    );

  const admin = atLeast(team.role, "admin");
  const owner = team.role === "owner";
  const tabs: { value: Tab; label: string }[] = [
    { value: "components", label: "Components" },
    { value: "members", label: "Members" },
    ...(admin ? [{ value: "invites" as const, label: "Invites" }] : []),
    { value: "tokens", label: "Tokens" },
    ...(owner ? [{ value: "settings" as const, label: "Settings" }] : []),
  ];

  return (
    <Layout>
      <PageHeader
        eyebrow={
          <span className="inline-flex items-center gap-2">
            <TeamBadge team={team.slug} />
            <span>
              {team.memberCount} member{team.memberCount === 1 ? "" : "s"} · you are {team.role}
            </span>
          </span>
        }
        title={team.name}
      />
      <Tabs value={tab} onChange={setTab} label="Team sections" idPrefix="team" items={tabs} />
      <div className="mt-6">
        {tab === "components" ? (
          <Components team={team} admin={admin} onChange={refreshTeams} goTo={setTab} />
        ) : tab === "members" ? (
          <Members team={team} me={me.email} onChange={() => (load(), refreshTeams())} />
        ) : tab === "invites" && admin ? (
          <Invites team={team} />
        ) : tab === "tokens" ? (
          <TeamTokens team={team} />
        ) : tab === "settings" && owner ? (
          <TeamSettings team={team} onChange={() => (load(), refreshTeams())} />
        ) : null}
      </div>
    </Layout>
  );
}

// ---------------------------------------------------------------------------
// Components
// ---------------------------------------------------------------------------

function Components({
  team,
  admin,
  onChange,
  goTo,
}: {
  team: TeamSummary;
  admin: boolean;
  onChange: () => void;
  goTo: (t: Tab) => void;
}) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [upload, setUpload] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const load = useCallback(() => {
    api<Row[]>(`/api/teams/${team.slug}/components`)
      .then(setRows)
      .catch(() => setRows([]));
  }, [team.slug]);
  useEffect(load, [load]);

  const act = async (slug: string, action: "publish" | "unpublish" | "delete") => {
    if (action === "delete" && !window.confirm(`Delete ${slug} from @${team.slug}?`)) return;
    setBusy(slug);
    setErr(null);
    try {
      await api(
        action === "delete"
          ? `/api/teams/${team.slug}/components/${slug}`
          : `/api/teams/${team.slug}/components/${slug}/${action}`,
        { method: action === "delete" ? "DELETE" : "POST" },
      );
      load();
      onChange();
    } catch (e) {
      setErr(errText(e, "Action failed"));
    } finally {
      setBusy(null);
    }
  };

  if (!rows)
    return (
      <div className="grid gap-4 sm:grid-cols-2">
        <Skeleton className="h-40" />
        <Skeleton className="h-40" />
      </div>
    );

  if (upload)
    return (
      <UploadPanel
        team={team}
        onDone={() => {
          setUpload(false);
          load();
          onChange();
        }}
        onCancel={() => setUpload(false)}
      />
    );

  if (!rows.length)
    return (
      <div className="rounded-xl border border-dashed border-border p-6">
        <h2 className="text-base font-semibold text-foreground">Set up @{team.slug}</h2>
        <ul className="mt-4 space-y-3 text-sm">
          {[
            ["Invite teammates", "invites" as Tab, admin, team.memberCount > 1],
            ["Upload first component", "components" as Tab, admin, false],
            ["Create CI token", "tokens" as Tab, true, false],
          ].map(([label, target, allowed, done]) => (
            <li key={String(label)} className="flex items-center gap-3">
              <span
                className={`grid size-5 place-items-center rounded-full border ${done ? "border-foreground bg-foreground text-background" : "border-border"}`}
              >
                {done ? <Check className="size-3" aria-hidden /> : null}
              </span>
              {allowed ? (
                <button
                  type="button"
                  className="text-foreground underline-offset-4 hover:underline"
                  onClick={() => (target === "components" ? setUpload(true) : goTo(target as Tab))}
                >
                  {String(label)}
                </button>
              ) : (
                <span className="text-muted-foreground">{String(label)} (admins)</span>
              )}
            </li>
          ))}
        </ul>
      </div>
    );

  return (
    <div>
      {admin ? (
        <div className="mb-4 flex items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            {rows.length} component{rows.length === 1 ? "" : "s"}
          </p>
          <button type="button" className={btn.primary} onClick={() => setUpload(true)}>
            <Upload className="size-4" aria-hidden />
            Upload JSON
          </button>
        </div>
      ) : null}
      {err ? (
        <p role="alert" className={`${alertClass} mb-4`}>
          {err}
        </p>
      ) : null}
      <ul className="grid gap-4 sm:grid-cols-2">
        {rows.map((c) => (
          <li key={c.slug} className="flex flex-col rounded-xl border border-border">
            <Link
              to={`/teams/${team.slug}/components/${c.slug}`}
              className="block aspect-video overflow-hidden rounded-t-xl bg-[#161616]"
            >
              <img
                src={`/api/teams/${team.slug}/components/${c.slug}/thumbnail${c.status === "published" ? "" : "?draft=1"}`}
                alt=""
                loading="lazy"
                className="size-full object-cover"
              />
            </Link>
            <div className="flex flex-1 flex-col gap-2 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  to={`/teams/${team.slug}/components/${c.slug}`}
                  className="font-medium text-foreground"
                >
                  {c.name}
                </Link>
                <TeamBadge team={team.slug} />
                {c.status !== "published" ? (
                  <span className="rounded-full border border-dashed border-border px-2 text-[11px] text-muted-foreground">
                    {c.status === "draft" ? "Draft" : "Unpublished"}
                  </span>
                ) : c.hasUnpublishedChanges ? (
                  <span className="rounded-full border border-dashed border-border px-2 text-[11px] text-muted-foreground">
                    Draft changes
                  </span>
                ) : null}
              </div>
              <p className="text-sm text-muted-foreground">{c.description}</p>
              <p className="font-mono text-xs text-muted-foreground/70">
                {c.slug} · v{c.version}
              </p>
              {admin ? (
                <div className="mt-auto flex flex-wrap gap-2 pt-2">
                  <button
                    type="button"
                    disabled={busy === c.slug}
                    className={`${btn.secondary} h-8 px-3`}
                    onClick={() =>
                      void act(c.slug, c.status === "published" ? "unpublish" : "publish")
                    }
                  >
                    {c.status === "published" ? "Unpublish" : "Publish"}
                  </button>
                  <button
                    type="button"
                    disabled={busy === c.slug}
                    className={`${btn.ghost} h-8 px-3`}
                    onClick={() => void act(c.slug, "delete")}
                  >
                    <Trash2 className="size-3.5" aria-hidden />
                    Delete
                  </button>
                </div>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Upload JSON (file or paste) → /validate → inline errors → draft preview → Publish. */
function UploadPanel({
  team,
  onDone,
  onCancel,
}: {
  team: TeamSummary;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [text, setText] = useState("");
  const [errors, setErrors] = useState<string[] | null>(null);
  const [saved, setSaved] = useState<{ slug: string } | null>(null);
  const [payload, setPayload] = useState<PreviewPayload | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const parse = (): unknown => {
    try {
      return JSON.parse(text);
    } catch {
      setErrors(["The text is not valid JSON."]);
      return undefined;
    }
  };
  const validate = async () => {
    const body = parse();
    if (body === undefined) return;
    setBusy(true);
    try {
      const r = await api<{ ok: boolean; errors: string[] }>(`/api/teams/${team.slug}/validate`, {
        method: "POST",
        json: body,
      });
      setErrors(r.ok ? [] : r.errors);
    } catch (e) {
      setErrors([errText(e, "Validation failed")]);
    } finally {
      setBusy(false);
    }
  };
  const saveDraft = async () => {
    const body = parse();
    if (body === undefined) return;
    setBusy(true);
    setMessage(null);
    try {
      const slug = (body as { slug?: string }).slug ?? "";
      const exists = saved?.slug === slug;
      const res = await api<{ slug: string; status?: string }>(
        exists
          ? `/api/teams/${team.slug}/components/${slug}`
          : `/api/teams/${team.slug}/components`,
        { method: exists ? "PUT" : "POST", json: body },
      );
      if ("status" in res && res.status === "queued") {
        setMessage("Large bundle queued; it will appear in the list when saved.");
        return;
      }
      setSaved({ slug: res.slug });
      setErrors([]);
      setPayload(
        await api<PreviewPayload>(`/api/teams/${team.slug}/components/${res.slug}/draft-preview`),
      );
    } catch (e) {
      if (e instanceof ApiError && e.details.length) setErrors(e.details);
      else setErrors([errText(e, "Could not save the draft")]);
    } finally {
      setBusy(false);
    }
  };
  const publish = async () => {
    if (!saved) return;
    setBusy(true);
    try {
      await api(`/api/teams/${team.slug}/components/${saved.slug}/publish`, { method: "POST" });
      onDone();
    } catch (e) {
      setErrors([errText(e, "Publish failed")]);
    } finally {
      setBusy(false);
    }
  };
  const onFile = (file: File | undefined) => {
    if (!file) return;
    file.text().then(setText);
  };

  return (
    <section className="rounded-xl border border-border p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-foreground">Upload a component bundle</h2>
        <button type="button" className={`${btn.ghost} h-8 px-3`} onClick={onCancel}>
          Cancel
        </button>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        Same JSON format as the public catalogue. Files must live under{" "}
        <code>components/{team.slug}/</code>; thumbnails must be PNG or WebP; access is always free
        for team members.
      </p>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <input
          type="file"
          accept="application/json,.json"
          onChange={(e) => onFile(e.target.files?.[0])}
          className="text-sm text-muted-foreground file:mr-3 file:rounded-md file:border file:border-border file:bg-background file:px-3 file:py-1.5 file:text-sm file:text-foreground"
        />
      </div>
      <textarea
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setErrors(null);
        }}
        rows={10}
        placeholder='{"name": "...", "slug": "...", ...}'
        className={`${inputClass} mt-3 h-auto py-2 font-mono text-xs`}
      />
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          className={btn.secondary}
          disabled={busy || !text}
          onClick={() => void validate()}
        >
          Validate
        </button>
        <button
          type="button"
          className={btn.primary}
          disabled={busy || !text}
          onClick={() => void saveDraft()}
        >
          {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
          Save draft &amp; preview
        </button>
        {saved && payload ? (
          <button
            type="button"
            className={btn.primary}
            disabled={busy}
            onClick={() => void publish()}
          >
            Publish {saved.slug}
          </button>
        ) : null}
      </div>
      {message ? <p className="mt-3 text-sm text-muted-foreground">{message}</p> : null}
      {errors && errors.length ? (
        <ul role="alert" className={`${alertClass} mt-3 list-disc space-y-1 pl-6`}>
          {errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      ) : errors && errors.length === 0 ? (
        <p className="mt-3 flex items-center gap-2 text-sm text-foreground">
          <Check className="size-4" aria-hidden />
          Bundle is valid.
        </p>
      ) : null}
      {payload ? (
        <div className="mt-4 overflow-hidden rounded-xl border border-border">
          <p className="border-b border-border bg-subtle px-3 py-2 text-xs text-muted-foreground">
            Draft preview
          </p>
          <PreviewFrame
            payload={payload}
            example={0}
            title="Draft preview"
            height={360}
            frameClassName=""
          />
        </div>
      ) : null}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Members
// ---------------------------------------------------------------------------

function Members({ team, me, onChange }: { team: TeamSummary; me: string; onChange: () => void }) {
  const navigate = useNavigate();
  const [members, setMembers] = useState<Member[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const load = useCallback(() => {
    api<Member[]>(`/api/teams/${team.slug}/members`)
      .then(setMembers)
      .catch((e: Error) => setErr(e.message));
  }, [team.slug]);
  useEffect(load, [load]);

  const owners = members?.filter((m) => m.role === "owner").length ?? 0;
  const canEdit = (m: Member) => {
    if (m.email === me) return false;
    if (team.role === "owner") return true;
    return team.role === "admin" && m.role !== "owner";
  };
  const setRole = async (m: Member, role: TeamRole) => {
    setErr(null);
    try {
      await api(`/api/teams/${team.slug}/members/${m.customerId}`, {
        method: "PATCH",
        json: { role },
      });
      load();
      onChange();
    } catch (e) {
      setErr(errText(e, "Could not change the role"));
    }
  };
  const remove = async (m: Member) => {
    const self = m.email === me;
    if (!window.confirm(self ? `Leave @${team.slug}?` : `Remove ${m.email} from @${team.slug}?`))
      return;
    setErr(null);
    try {
      await api(`/api/teams/${team.slug}/members/${m.customerId}`, { method: "DELETE" });
      if (self) {
        onChange();
        navigate("/account");
        return;
      }
      load();
      onChange();
    } catch (e) {
      setErr(errText(e, "Could not remove the member"));
    }
  };

  if (!members) return <Skeleton className="h-40 w-full rounded-xl" />;
  const self = members.find((m) => m.email === me);
  return (
    <div>
      {err ? (
        <p role="alert" className={`${alertClass} mb-4`}>
          {err}
        </p>
      ) : null}
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[560px] text-left text-sm">
          <thead className="border-b border-border bg-subtle text-xs text-muted-foreground">
            <tr>
              <th className="h-10 px-4 font-medium">Member</th>
              <th className="h-10 px-4 font-medium">Role</th>
              <th className="h-10 px-4 font-medium">Joined</th>
              <th className="h-10 px-4 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {members.map((m) => (
              <tr key={m.customerId}>
                <td className="px-4 py-3">
                  <span className="block font-medium text-foreground">{m.name || m.email}</span>
                  <span className="block text-xs text-muted-foreground">{m.email}</span>
                </td>
                <td className="px-4 py-3">
                  {canEdit(m) ? (
                    <select
                      value={m.role}
                      onChange={(e) => void setRole(m, e.target.value as TeamRole)}
                      className={`${selectClass} h-8 w-auto`}
                      aria-label={`Role of ${m.email}`}
                    >
                      <option value="member">member</option>
                      <option value="admin">admin</option>
                      {team.role === "owner" ? <option value="owner">owner</option> : null}
                    </select>
                  ) : (
                    m.role
                  )}
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {new Date(m.joinedAt).toLocaleDateString()}
                </td>
                <td className="px-4 py-3 text-right">
                  {canEdit(m) ? (
                    <button
                      type="button"
                      className={`${btn.ghost} h-8 px-3`}
                      onClick={() => void remove(m)}
                    >
                      Remove
                    </button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {self ? (
        <div className="mt-4 flex items-center justify-between gap-3 text-sm text-muted-foreground">
          <span>
            {self.role === "owner" && owners === 1
              ? "You are the only owner. Make someone else an owner before leaving."
              : "Leaving removes your access and revokes your team tokens."}
          </span>
          <button
            type="button"
            className={`${btn.secondary} h-8 px-3`}
            disabled={self.role === "owner" && owners === 1}
            onClick={() => void remove(self)}
          >
            Leave team
          </button>
        </div>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Invites
// ---------------------------------------------------------------------------

function Invites({ team }: { team: TeamSummary }) {
  const [pending, setPending] = useState<Invite[] | null>(null);
  const [link, setLink] = useState<{ url: string; expiresAt: string } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const load = useCallback(() => {
    api<Invite[]>(`/api/teams/${team.slug}/invites`)
      .then(setPending)
      .catch((e: Error) => setErr(e.message));
  }, [team.slug]);
  useEffect(load, [load]);

  const submit = (kind: "email" | "link") => async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const role = String(form.get("role"));
    setErr(null);
    setNotice(null);
    try {
      const res = await api<{ url?: string; expiresAt?: string }>(
        `/api/teams/${team.slug}/invites`,
        {
          method: "POST",
          json: { kind, role, ...(email ? { email } : {}) },
        },
      );
      if (kind === "email")
        setNotice(
          "If this person has a Kitbase account, they'll see the invite on their Account page.",
        );
      else if (res.url && res.expiresAt) setLink({ url: res.url, expiresAt: res.expiresAt });
      e.currentTarget?.reset();
      load();
    } catch (er) {
      setErr(errText(er, "Could not create the invite"));
    }
  };
  const revoke = async (id: string) => {
    await api(`/api/teams/${team.slug}/invites/${id}`, { method: "DELETE" }).catch((e: Error) =>
      setErr(e.message),
    );
    load();
  };
  const roleSelect = (
    <select
      name="role"
      defaultValue="member"
      className={`${selectClass} sm:w-32`}
      aria-label="Role"
    >
      <option value="member">member</option>
      <option value="admin">admin</option>
    </select>
  );

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-border p-5">
        <h2 className="flex items-center gap-2 text-base font-semibold text-foreground">
          <Mail className="size-4" aria-hidden />
          Invite by email
        </h2>
        <form onSubmit={submit("email")} className="mt-3 flex flex-col gap-2 sm:flex-row">
          <input
            name="email"
            type="email"
            required
            placeholder="teammate@company.com"
            className={`${inputClass} sm:flex-1`}
          />
          {roleSelect}
          <button type="submit" className={btn.primary}>
            Send invite
          </button>
        </form>
        {notice ? <p className="mt-3 text-sm text-muted-foreground">{notice}</p> : null}
      </section>

      <section className="rounded-xl border border-border p-5">
        <h2 className="flex items-center gap-2 text-base font-semibold text-foreground">
          <Link2 className="size-4" aria-hidden />
          Create invite link
        </h2>
        <form onSubmit={submit("link")} className="mt-3 flex flex-col gap-2 sm:flex-row">
          <input
            name="email"
            type="email"
            placeholder="Lock to an email (optional)"
            className={`${inputClass} sm:flex-1`}
          />
          {roleSelect}
          <button type="submit" className={btn.secondary}>
            Create link
          </button>
        </form>
        {link ? (
          <div className="mt-4 space-y-2 rounded-lg border border-primary p-4">
            <p className="text-sm font-medium text-foreground">
              Copy this link now · shown once · 7 days · single use
            </p>
            <CodeBlock label="invite link" code={link.url} />
          </div>
        ) : null}
      </section>

      {err ? (
        <p role="alert" className={alertClass}>
          {err}
        </p>
      ) : null}

      <section className="rounded-xl border border-border">
        <h2 className="border-b border-border p-5 text-base font-semibold text-foreground">
          Pending invites
        </h2>
        {!pending ? (
          <Skeleton className="m-5 h-10" />
        ) : pending.length === 0 ? (
          <p className="p-5 text-sm text-muted-foreground">No pending invites.</p>
        ) : (
          <ul className="divide-y divide-border">
            {pending.map((i) => (
              <li key={i.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                <span>
                  <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
                    {i.prefix}…
                  </code>{" "}
                  <span className="text-muted-foreground">
                    {i.kind} · {i.role}
                    {i.email ? ` · ${i.email}` : ""} · expires{" "}
                    {new Date(i.expiresAt).toLocaleDateString()}
                  </span>
                </span>
                <button
                  type="button"
                  className={`${btn.secondary} h-8 px-3`}
                  onClick={() => void revoke(i.id)}
                >
                  Revoke
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tokens
// ---------------------------------------------------------------------------

function TeamTokens({ team }: { team: TeamSummary }) {
  const [created, setCreated] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const example = teamInstallCommand(window.location.origin, team.slug, "<slug>");
  const onCreate = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const name = String(new FormData(e.currentTarget).get("name"));
    setErr(null);
    try {
      const res = await api<{ token: string }>("/api/tokens", {
        method: "POST",
        json: { name, team: team.slug },
      });
      setCreated(res.token);
      e.currentTarget?.reset();
    } catch (er) {
      setErr(errText(er, "Could not create the token"));
    }
  };
  return (
    <section className="rounded-xl border border-border p-5">
      <h2 className="flex items-center gap-2 text-base font-semibold text-foreground">
        <KeyRound className="size-4" aria-hidden />
        Team token for CI and agents
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        A token scoped to <code>@{team.slug}</code> only installs this team&apos;s components: it
        never unlocks public premium components, and it stops working if you leave the team. Manage
        all your tokens on{" "}
        <Link to="/account" className="underline underline-offset-4">
          Account
        </Link>
        .
      </p>
      <form onSubmit={onCreate} className="mt-4 flex flex-col gap-2 sm:flex-row">
        <input
          name="name"
          required
          maxLength={60}
          placeholder="Token name, e.g. ci"
          className={`${inputClass} sm:flex-1`}
        />
        <button type="submit" className={btn.primary}>
          Create team token
        </button>
      </form>
      {err ? (
        <p role="alert" className={`${alertClass} mt-3`}>
          {err}
        </p>
      ) : null}
      {created ? (
        <div className="mt-4 space-y-3 rounded-lg border border-primary p-4">
          <p className="text-sm font-medium text-foreground">
            Copy this token now. It will not be shown again.
          </p>
          <CodeBlock label="token" code={created} />
          <CodeBlock label="terminal" code={`KITBASE_TOKEN=${created} ${example}`} />
        </div>
      ) : (
        <CodeBlock label="terminal" code={`KITBASE_TOKEN=<token> ${example}`} />
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Settings (owner)
// ---------------------------------------------------------------------------

function TeamSettings({ team, onChange }: { team: TeamSummary; onChange: () => void }) {
  const navigate = useNavigate();
  const [err, setErr] = useState<string | null>(null);
  const [confirm, setConfirm] = useState("");
  const rename = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const name = String(new FormData(e.currentTarget).get("name"));
    setErr(null);
    try {
      await api(`/api/teams/${team.slug}`, { method: "PATCH", json: { name } });
      onChange();
    } catch (er) {
      setErr(errText(er, "Rename failed"));
    }
  };
  const remove = async () => {
    setErr(null);
    try {
      await api(`/api/teams/${team.slug}`, { method: "DELETE", json: { confirm } });
      onChange();
      navigate("/account");
    } catch (er) {
      setErr(errText(er, "Delete failed"));
    }
  };
  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-border p-5">
        <h2 className="flex items-center gap-2 text-base font-semibold text-foreground">
          <Settings className="size-4" aria-hidden />
          Team name
        </h2>
        <form onSubmit={rename} className="mt-3 flex flex-col gap-2 sm:flex-row">
          <input
            name="name"
            defaultValue={team.name}
            required
            minLength={2}
            maxLength={60}
            className={`${inputClass} sm:flex-1`}
          />
          <button type="submit" className={btn.secondary}>
            Rename
          </button>
        </form>
        <p className="mt-2 text-xs text-muted-foreground">
          The slug <code>@{team.slug}</code> is used in install commands and cannot change.
        </p>
      </section>
      <section className="rounded-xl border border-red-200 p-5 dark:border-red-900/60">
        <h2 className="text-base font-semibold text-foreground">Delete team</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Removes every member, component, invite and team token. Installed copies are not affected.
          Type <code>{team.slug}</code> to confirm.
        </p>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <input
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder={team.slug}
            className={`${inputClass} sm:flex-1`}
          />
          <button
            type="button"
            disabled={confirm !== team.slug}
            className={btn.primary}
            onClick={() => void remove()}
          >
            <Trash2 className="size-4" aria-hidden />
            Delete team
          </button>
        </div>
      </section>
      {err ? (
        <p role="alert" className={alertClass}>
          {err}
        </p>
      ) : null}
    </div>
  );
}
