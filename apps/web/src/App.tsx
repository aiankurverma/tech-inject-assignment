import { lazy, Suspense } from "react";
import { Route, Routes } from "react-router-dom";
import { Home, ComponentsIndex } from "./pages/Home";
import { NotFound } from "./pages/NotFound";

// Heavier or less-visited routes load on demand, keeping the catalogue's first paint small.
const ComponentPage = lazy(() =>
  import("./pages/ComponentPage").then((m) => ({ default: m.ComponentPage })),
);
const GetStarted = lazy(() =>
  import("./pages/GetStarted").then((m) => ({ default: m.GetStarted })),
);
const SignIn = lazy(() => import("./pages/SignIn").then((m) => ({ default: m.SignIn })));
const Account = lazy(() => import("./pages/Account").then((m) => ({ default: m.Account })));

export function App() {
  return (
    <Suspense fallback={null}>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/components" element={<ComponentsIndex />} />
        <Route path="/docs/get-started" element={<GetStarted />} />
        <Route path="/components/:slug" element={<ComponentPage />} />
        <Route path="/sign-in" element={<SignIn />} />
        <Route path="/account" element={<Account />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
}
