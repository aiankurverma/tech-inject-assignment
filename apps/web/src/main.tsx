import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { App } from "./App";
import { SessionProvider } from "./context/session";
import { initTheme } from "./context/theme";
import "./index.css";

initTheme();

// Cloudflare Web Analytics is enabled only when a token is configured. It is cookieless and
// measures real users separately from bot traffic; no consent banner is required for it.
const analyticsToken = document
  .querySelector('meta[name="cf-analytics-token"]')
  ?.getAttribute("content")
  ?.trim();
if (analyticsToken) {
  const beacon = document.createElement("script");
  beacon.defer = true;
  beacon.src = "https://static.cloudflareinsights.com/beacon.min.js";
  beacon.dataset.cfBeacon = JSON.stringify({ token: analyticsToken });
  document.head.appendChild(beacon);
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <SessionProvider>
        <App />
      </SessionProvider>
    </BrowserRouter>
  </StrictMode>,
);
