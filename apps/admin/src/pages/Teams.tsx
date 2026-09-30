import { useMemo, useState } from "react";
import { Ban, Crown, SearchX, ShieldCheck, Users } from "lucide-react";
import { api } from "@ti/client";
import { errorMessage, relativeTime } from "../types";
import { useLoad } from "../hooks/useLoad";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  PageHeader,
  SearchInput,
  Table,
  TableSkeleton,
  Td,
  Th,
  THead,
  cn,
  selectClass,
  useToast,
} from "../components/ui";

interface TeamRow {
  id: string;
  slug: string;
  name: string;
  owners: string[];
  memberCount: number;
  componentCount: number;
  disabled: boolean;
  createdAt: string;
}
interface MemberRow {
  customerId: string;
  email: string;
  name: string;
  role: "owner" | "admin" | "member";
}

/**
 * Platform view of team workspaces: metadata and switches only. The admin never sees a
 * team's component source; that stays private to the team's members.
 */
export function Teams() {
  const toast = useToast();
  const teams = useLoad(() => api<TeamRow[]>("/api/admin/teams"));
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [assign, setAssign] = useState<{ team: TeamRow; members: MemberRow[] } | null>(null);

  const rows = useMemo(() => {
    const n = query.trim().toLowerCase();
    return (teams.data ?? []).filter(
      (t) =>
        !n ||
        t.slug.includes(n) ||
        t.name.toLowerCase().includes(n) ||
        t.owners.some((o) => o.includes(n)),
    );
  }, [teams.data, query]);

  const act = async (key: string, path: string, json: unknown, success: string) => {
    setBusy(key);
    try {
      await api(path, { method: "POST", json });
      await teams.reload();
      toast.success(success);
    } catch (e) {
      toast.error("Action failed", errorMessage(e, "Action failed"));
    } finally {
      setBusy(null);
    }
  };

  const openAssign = async (team: TeamRow) => {
    try {
      const members = await api<MemberRow[]>(`/api/admin/teams/${team.id}/members`);
      setAssign({ team, members });
    } catch (e) {
      toast.error("Could not load members", errorMessage(e));
    }
  };

  return (
    <>
      <PageHeader
        title="Teams"
        description="Customer team workspaces. Disable a team to lock everyone out at once, or assign an owner to rescue a team. Team source code is never shown here."
      />
      <Card>
        <div className="flex flex-col gap-3 border-b border-border p-3 sm:flex-row sm:items-center sm:px-5">
          <SearchInput
            value={query}
            onChange={setQuery}
            placeholder="Search by slug, name or owner"
            label="Search teams"
            className="sm:w-80"
          />
          <p className="text-xs text-muted-foreground sm:ml-auto">
            Private means private from other customers, not from the platform operator.
          </p>
        </div>
        {teams.error ? (
          <ErrorState message={teams.error} onRetry={() => void teams.reload()} />
        ) : !teams.data ? (
          <TableSkeleton rows={4} cols={6} />
        ) : teams.data.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No teams yet"
            description="Customers create teams from their Account page."
          />
        ) : rows.length === 0 ? (
          <EmptyState icon={SearchX} title="No matching teams" description="Try another search." />
        ) : (
          <Table label="Teams" className="md:min-w-[760px]">
            <THead>
              <tr>
                <Th>Team</Th>
                <Th className="hidden md:table-cell">Owners</Th>
                <Th className="hidden sm:table-cell">Members</Th>
                <Th className="hidden sm:table-cell">Components</Th>
                <Th className="hidden lg:table-cell">Created</Th>
                <Th>Status</Th>
                <Th className="text-right">Actions</Th>
              </tr>
            </THead>
            <tbody className="divide-y divide-border/60">
              {rows.map((t) => (
                <tr
                  key={t.id}
                  className={cn(
                    "transition-colors hover:bg-muted/40",
                    t.disabled && "bg-subtle/70",
                  )}
                >
                  <Td>
                    <p className="font-medium text-foreground">{t.name}</p>
                    <p className="font-mono text-xs text-muted-foreground">@{t.slug}</p>
                  </Td>
                  <Td className="hidden md:table-cell">
                    <span className="text-xs text-muted-foreground">
                      {t.owners.length ? t.owners.join(", ") : "none"}
                    </span>
                  </Td>
                  <Td className="hidden tabular-nums sm:table-cell">{t.memberCount}</Td>
                  <Td className="hidden tabular-nums sm:table-cell">{t.componentCount}</Td>
                  <Td className="hidden text-muted-foreground lg:table-cell">
                    {relativeTime(t.createdAt)}
                  </Td>
                  <Td>
                    {t.disabled ? (
                      <Badge variant="danger" dot>
                        Disabled
                      </Badge>
                    ) : (
                      <Badge variant="success" dot>
                        Active
                      </Badge>
                    )}
                  </Td>
                  <Td>
                    <div className="flex justify-end gap-1.5">
                      <Button
                        size="sm"
                        variant="secondary"
                        icon={Crown}
                        disabled={!!busy}
                        onClick={() => void openAssign(t)}
                      >
                        Assign owner
                      </Button>
                      <Button
                        size="sm"
                        variant={t.disabled ? "secondary" : "ghost"}
                        icon={t.disabled ? ShieldCheck : Ban}
                        loading={busy === t.id}
                        disabled={!!busy}
                        aria-pressed={!t.disabled}
                        className={
                          t.disabled
                            ? undefined
                            : "text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10"
                        }
                        onClick={() =>
                          void act(
                            t.id,
                            `/api/admin/teams/${t.id}/status`,
                            { disabled: !t.disabled },
                            t.disabled ? `Enabled @${t.slug}` : `Disabled @${t.slug}`,
                          )
                        }
                      >
                        {t.disabled ? "Enable" : "Disable"}
                      </Button>
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      {assign ? (
        <Card className="mt-4 p-5">
          <h2 className="text-base font-semibold text-foreground">
            Assign an owner for @{assign.team.slug}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Only existing members can become owners. Use this when a team has lost its owner.
          </p>
          {assign.members.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">This team has no members.</p>
          ) : (
            <form
              className="mt-3 flex flex-col gap-2 sm:flex-row"
              onSubmit={(e) => {
                e.preventDefault();
                const customerId = String(new FormData(e.currentTarget).get("customerId"));
                void act(
                  assign.team.id,
                  `/api/admin/teams/${assign.team.id}/owner`,
                  { customerId },
                  `Owner assigned for @${assign.team.slug}`,
                ).then(() => setAssign(null));
              }}
            >
              <select
                name="customerId"
                className={cn(selectClass, "sm:flex-1")}
                aria-label="Member"
              >
                {assign.members.map((m) => (
                  <option key={m.customerId} value={m.customerId}>
                    {m.email} ({m.role})
                  </option>
                ))}
              </select>
              <Button
                type="submit"
                variant="primary"
                icon={Crown}
                loading={busy === assign.team.id}
              >
                Make owner
              </Button>
              <Button type="button" variant="ghost" onClick={() => setAssign(null)}>
                Cancel
              </Button>
            </form>
          )}
        </Card>
      ) : null}
    </>
  );
}
