import { lazy, Suspense, useEffect } from "react";
import { Route, Routes, useLocation, useParams } from "react-router-dom";
import { Home, ComponentsIndex } from "./pages/Home";
import { TeamPage } from "./pages/Team";
import { Join } from "./pages/Join";
import { NotFound } from "./pages/NotFound";
import { Screens } from "./pages/Screens";
import { Builder } from "./pages/Builder";
import { useSession } from "./context/session";
import { applyRouteMeta, routeMeta } from "./lib/seo";

// Heavier or less-visited routes load on demand, keeping the catalogue's first paint small.
const ComponentPage = lazy(() =>
  import("./pages/ComponentPage").then((m) => ({ default: m.ComponentPage })),
);
const GetStarted = lazy(() =>
  import("./pages/GetStarted").then((m) => ({ default: m.GetStarted })),
);
const ThemeStudio = lazy(() =>
  import("./pages/ThemeStudio").then((m) => ({ default: m.ThemeStudio })),
);
const SignIn = lazy(() => import("./pages/SignIn").then((m) => ({ default: m.SignIn })));
const SignUp = lazy(() => import("./pages/SignUp").then((m) => ({ default: m.SignUp })));
const Account = lazy(() => import("./pages/Account").then((m) => ({ default: m.Account })));
const CategoryPage = lazy(() =>
  import("./pages/CategoryPage").then((m) => ({ default: m.CategoryPage })),
);
const Requests = lazy(() => import("./pages/Requests").then((m) => ({ default: m.Requests })));
const Changelog = lazy(() => import("./pages/Changelog").then((m) => ({ default: m.Changelog })));

/** Keeps title/canonical/robots/OG/JSON-LD in sync when the SPA navigates. */
function RouteSeo() {
  const { pathname } = useLocation();
  const { components } = useSession();
  useEffect(() => {
    applyRouteMeta(routeMeta(pathname, components ?? []));
  }, [pathname, components]);
  return null;
}

/** Same page as the public catalogue, pointed at the team's private API. */
function TeamComponentPage() {
  const { team = "" } = useParams();
  return <ComponentPage key={team} apiBase={`/api/teams/${team}`} teamSlug={team} />;
}

export function App() {
  return (
    <Suspense fallback={null}>
      <RouteSeo />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/components" element={<ComponentsIndex />} />
        <Route path="/components/category/:category" element={<CategoryPage />} />
        <Route path="/requests" element={<Requests />} />
        <Route path="/changelog" element={<Changelog />} />
        <Route path="/docs/get-started" element={<GetStarted />} />
        <Route path="/screens" element={<Screens />} />
        <Route path="/components/:slug" element={<ComponentPage />} />
        <Route path="/teams/:team" element={<TeamPage />} />
        <Route path="/teams/:team/components/:slug" element={<TeamComponentPage />} />
        <Route path="/join" element={<Join />} />
        <Route path="/theme" element={<ThemeStudio />} />
        <Route path="/builder" element={<Builder />} />
        <Route path="/sign-in" element={<SignIn />} />
        <Route path="/sign-up" element={<SignUp />} />
        <Route path="/account" element={<Account />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
}
