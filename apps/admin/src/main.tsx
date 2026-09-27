import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Link, Navigate, Route, Routes } from "react-router-dom";
import { Compass, Loader2 } from "lucide-react";
import { api } from "@ti/client";
import { FeatureRadarAdmin } from "@ti/feature-radar/client";
import { ComponentList } from "./ComponentList";
import { Editor } from "./Editor";
import { Layout } from "./Layout";
import { Login } from "./Login";
import { Overview } from "./Overview";
import { Privileges } from "./Privileges";
import { initTheme } from "./theme";
import { Card, EmptyState, PageHeader, ToastProvider, buttonClass } from "./ui";
import "./index.css";

type Session = { state: "loading" } | { state: "out" } | { state: "in"; username: string };

function FeatureRadarPage() {
  return (
    <>
      <PageHeader
        title="Feature radar"
        description="Feature requests collected from catalogue searches. Review and update their status."
      />
      <Card className="overflow-hidden">
        <FeatureRadarAdmin />
      </Card>
    </>
  );
}

function NotFound() {
  return (
    <Card>
      <EmptyState
        icon={Compass}
        title="Page not found"
        description="This admin page does not exist."
        action={
          <Link to="/" className={buttonClass("primary")}>
            Back to overview
          </Link>
        }
      />
    </Card>
  );
}

function App() {
  const [session, setSession] = useState<Session>({ state: "loading" });
  const check = () =>
    api<{ username?: string }>("/api/admin/me")
      .then((me) => setSession({ state: "in", username: me.username ?? "admin" }))
      .catch(() => setSession({ state: "out" }));
  useEffect(() => {
    void check();
  }, []);

  if (session.state === "loading")
    return (
      <div
        role="status"
        className="flex min-h-screen items-center justify-center gap-2 text-sm text-muted-foreground"
      >
        <Loader2 className="size-4 animate-spin" aria-hidden />
        Loading admin...
      </div>
    );
  if (session.state === "out") return <Login onDone={() => void check()} />;

  const logout = () =>
    void api("/api/admin/logout", { method: "POST" }).finally(() => setSession({ state: "out" }));
  return (
    <Layout username={session.username} onLogout={logout}>
      <Routes>
        <Route path="/" element={<Overview />} />
        <Route path="/components" element={<ComponentList />} />
        <Route path="/components/:slug" element={<Editor />} />
        <Route path="/new" element={<Editor />} />
        <Route path="/privileges" element={<Privileges />} />
        <Route path="/customers" element={<Privileges />} />
        <Route path="/feature-radar" element={<FeatureRadarPage />} />
        <Route path="/components-list" element={<Navigate to="/components" replace />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Layout>
  );
}

initTheme();
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter basename="/admin">
      <ToastProvider>
        <App />
      </ToastProvider>
    </BrowserRouter>
  </StrictMode>,
);
