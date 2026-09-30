import { Route, Routes } from "react-router-dom";
import { Home, ComponentsIndex } from "./pages/Home";
import { GetStarted } from "./pages/GetStarted";
import { Screens } from "./pages/Screens";
import { ComponentPage } from "./pages/ComponentPage";
import { SignIn } from "./pages/SignIn";
import { Account } from "./pages/Account";
import { NotFound } from "./pages/NotFound";

export function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/components" element={<ComponentsIndex />} />
      <Route path="/docs/get-started" element={<GetStarted />} />
      <Route path="/screens" element={<Screens />} />
      <Route path="/components/:slug" element={<ComponentPage />} />
      <Route path="/sign-in" element={<SignIn />} />
      <Route path="/account" element={<Account />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
