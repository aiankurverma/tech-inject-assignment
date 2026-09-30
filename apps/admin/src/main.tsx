import { lazy, StrictMode, Suspense, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Link, Navigate, Route, Routes } from "react-router-dom";
import { Compass, Loader2 } from "lucide-react";
import { api } from "@ti/client";
import { FeatureRadarAdmin } from "@ti/feature-radar/client";
import { ComponentList } from "./pages/ComponentList";
import { Layout } from "./components/Layout";
import { Login } from "./pages/Login";
import { Overview } from "./pages/Overview";
import { Privileges } from "./pages/Privileges";
import { initTheme } from "./context/theme";
import { Card, EmptyState, PageHeader, ToastProvider, buttonClass } from "./components/ui";
import "./index.css";

// Heavy pages (code editor, capture tool, charts) load on demand.
const Editor = lazy(() => import("./pages/Editor").then((m) => ({ default: m.Editor })));
const Capture = lazy(() => import("./pages/Capture").then((m) => ({ default: m.Capture })));
const Analytics = lazy(() => import("./pages/Analytics").then((m) => ({ default: m.Analytics })));

function PageLoading() {
  return (
    <div role="status" className="flex items-center gap-2 py-10 text-sm text-muted-foreground">
      <Loader2 className="size-4 animate-spin" aria-hidden />
      Loading...
    </div>
  );
}

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
      <Suspense fallback={<PageLoading />}>
        <Routes>
          <Route path="/" element={<Overview />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/components" element={<ComponentList />} />
          <Route path="/components/:slug" element={<Editor />} />
          <Route path="/new" element={<Editor />} />
          <Route path="/privileges" element={<Privileges />} />
          <Route path="/customers" element={<Privileges />} />
          <Route path="/capture" element={<Capture />} />
          <Route path="/capture/:id" element={<Capture />} />
          <Route path="/feature-radar" element={<FeatureRadarPage />} />
          <Route path="/components-list" element={<Navigate to="/components" replace />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
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
