import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { api } from "@ti/client";
import type { TeamSummary } from "../lib/teams";

export interface Me {
  email: string;
  name: string;
  plan: "free" | "premium";
}

export interface ListItem {
  slug: string;
  name: string;
  description: string;
  category: string;
  access: "free" | "premium";
  version: string;
  locked: null | "sign_in_required" | "premium_required";
  /** ISO dates; optional so older API responses still type-check. */
  createdAt?: string | null;
  publishedAt?: string | null;
}

interface Session {
  me: Me | null;
  loadingMe: boolean;
  components: ListItem[] | null;
  componentsError: string | null;
  /** Teams the signed-in customer belongs to (empty when signed out). Never part of public data. */
  teams: TeamSummary[];
  refreshTeams: () => void;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refresh: () => void;
}

const Ctx = createContext<Session | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  const [loadingMe, setLoadingMe] = useState(true);
  const [components, setComponents] = useState<ListItem[] | null>(null);
  const [componentsError, setComponentsError] = useState<string | null>(null);
  const [teams, setTeams] = useState<TeamSummary[]>([]);
  const [tick, setTick] = useState(0);
  const [teamTick, setTeamTick] = useState(0);
  const refresh = useCallback(() => setTick((t) => t + 1), []);
  const refreshTeams = useCallback(() => setTeamTick((t) => t + 1), []);

  useEffect(() => {
    api<Me | null>("/api/auth/me")
      .then(setMe)
      .catch(() => setMe(null))
      .finally(() => setLoadingMe(false));
    api<ListItem[]>("/api/components")
      .then((c) => {
        setComponents(c);
        setComponentsError(null);
      })
      .catch((e: Error) => setComponentsError(e.message));
  }, [tick]);

  // Teams are private: only asked for when signed in, and dropped on sign-out.
  useEffect(() => {
    if (!me) {
      setTeams([]);
      return;
    }
    api<TeamSummary[]>("/api/teams")
      .then(setTeams)
      .catch(() => setTeams([]));
  }, [me, teamTick]);

  const signIn = async (email: string, password: string) => {
    setMe(await api<Me>("/api/auth/login", { method: "POST", json: { email, password } }));
    refresh();
  };
  const signOut = async () => {
    await api("/api/auth/logout", { method: "POST" });
    setMe(null);
    refresh();
  };

  return (
    <Ctx.Provider
      value={{
        me,
        loadingMe,
        components,
        componentsError,
        teams,
        refreshTeams,
        signIn,
        signOut,
        refresh,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useSession() {
  const s = useContext(Ctx);
  if (!s) throw new Error("useSession outside SessionProvider");
  return s;
}
