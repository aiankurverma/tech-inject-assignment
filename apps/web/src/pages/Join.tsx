import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Loader2, LogIn, MailX, Users } from "lucide-react";
import { api } from "@ti/client";
import { Layout } from "../components/Layout";
import { useSession } from "../context/session";
import { btn, EmptyState } from "../components/ui";
import { JOIN_TOKEN_KEY, readJoinToken } from "../lib/teams";

interface Inspect {
  team: { name: string; slug: string };
  role: "admin" | "member";
}

/** One neutral message for every failure: the link never says which check failed. */
const INVALID = "This invite link is not valid. It may have expired, been used or been revoked.";

/**
 * Invite landing page. The token arrives in the URL fragment and is removed from the address
 * bar on first render; it is then only ever sent in a POST body.
 */
export function Join() {
  const { me, loadingMe, refreshTeams } = useSession();
  const navigate = useNavigate();
  const [token] = useState(() => {
    const fromHash = readJoinToken(window.location, window.history);
    if (fromHash) return fromHash;
    try {
      return sessionStorage.getItem(JOIN_TOKEN_KEY);
    } catch {
      return null;
    }
  });
  const [info, setInfo] = useState<Inspect | null>(null);
  const [state, setState] = useState<"idle" | "busy" | "invalid" | "declined">("idle");

  // Signed out: keep the token for this tab and come back after sign-in.
  useEffect(() => {
    if (loadingMe || me || !token) return;
    try {
      sessionStorage.setItem(JOIN_TOKEN_KEY, token);
    } catch {
      // Storage blocked: the user can open the link again after signing in.
    }
    navigate("/sign-in", { state: { from: "/join" }, replace: true });
  }, [loadingMe, me, token, navigate]);

  // Signed in: show the team name before anything is accepted.
  useEffect(() => {
    if (!me || !token) return;
    let alive = true;
    api<Inspect>("/api/join/inspect", { method: "POST", json: { token } })
      .then((i) => alive && setInfo(i))
      .catch(() => alive && setState("invalid"));
    return () => {
      alive = false;
    };
  }, [me, token]);

  const clearStored = () => {
    try {
      sessionStorage.removeItem(JOIN_TOKEN_KEY);
    } catch {
      // ignore
    }
  };
  const accept = async () => {
    if (!token || !info) return;
    setState("busy");
    try {
      await api("/api/join", { method: "POST", json: { token } });
      clearStored();
      refreshTeams();
      navigate(`/teams/${info.team.slug}`, { replace: true });
    } catch {
      setState("invalid");
    }
  };
  const decline = () => {
    clearStored();
    setState("declined");
  };

  const body = () => {
    if (!token || state === "invalid")
      return (
        <EmptyState
          icon={<MailX className="size-5" />}
          title="Invite not valid"
          action={
            <Link to="/account" className={btn.secondary}>
              Go to account
            </Link>
          }
        >
          {INVALID}
        </EmptyState>
      );
    if (loadingMe || (!me && token))
      return (
        <EmptyState icon={<Loader2 className="size-5 animate-spin" />} title="One moment">
          Checking your session. Accounts are created by the Kitbase admin; there is no public
          sign-up.
        </EmptyState>
      );
    if (state === "declined")
      return (
        <EmptyState icon={<Users className="size-5" />} title="Invite declined">
          Nothing was changed. You can close this page.
        </EmptyState>
      );
    if (!info)
      return (
        <EmptyState icon={<Loader2 className="size-5 animate-spin" />} title="Checking invite">
          Looking up the team.
        </EmptyState>
      );
    return (
      <EmptyState
        icon={<LogIn className="size-5" />}
        title={`Join ${info.team.name} as ${info.role}?`}
        action={
          <>
            <button
              type="button"
              className={btn.primary}
              onClick={() => void accept()}
              disabled={state === "busy"}
            >
              {state === "busy" ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
              Accept
            </button>
            <button type="button" className={btn.secondary} onClick={decline}>
              Decline
            </button>
          </>
        }
      >
        You are signed in as {me?.email}. Accepting gives this account access to the private
        components of <code>@{info.team.slug}</code>.
      </EmptyState>
    );
  };

  return (
    <Layout wide>
      <div className="mx-auto mt-10 max-w-lg sm:mt-20">{body()}</div>
    </Layout>
  );
}
