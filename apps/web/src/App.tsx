import { Route, Routes, useParams } from "react-router-dom";
import { Home, ComponentsIndex } from "./pages/Home";
import { GetStarted } from "./pages/GetStarted";
import { ComponentPage } from "./pages/ComponentPage";
import { SignIn } from "./pages/SignIn";
import { Account } from "./pages/Account";
import { TeamPage } from "./pages/Team";
import { Join } from "./pages/Join";
import { NotFound } from "./pages/NotFound";

/** Same page as the public catalogue, pointed at the team's private API. */
function TeamComponentPage() {
  const { team = "" } = useParams();
  return <ComponentPage key={team} apiBase={`/api/teams/${team}`} teamSlug={team} />;
}

export function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/components" element={<ComponentsIndex />} />
      <Route path="/docs/get-started" element={<GetStarted />} />
      <Route path="/components/:slug" element={<ComponentPage />} />
      <Route path="/teams/:team" element={<TeamPage />} />
      <Route path="/teams/:team/components/:slug" element={<TeamComponentPage />} />
      <Route path="/join" element={<Join />} />
      <Route path="/sign-in" element={<SignIn />} />
      <Route path="/account" element={<Account />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
