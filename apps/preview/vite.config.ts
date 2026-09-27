import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

/**
 * Strict CSP for the built preview. Uploaded code runs here, so it gets no network access
 * (connect-src 'none'), no cookies (the iframe is sandboxed without allow-same-origin)
 * and no secrets (this app has none). 'unsafe-eval' is needed to run the compiled bundle.
 */
const CSP = [
  "default-src 'none'",
  "script-src 'self' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src https://fonts.gstatic.com",
  "img-src 'self' data: blob:",
  "connect-src 'none'",
  "form-action 'none'",
  "base-uri 'none'",
].join("; ");

const cspPlugin = (): Plugin => ({
  name: "preview-csp",
  apply: "build",
  transformIndexHtml: (html) =>
    html.replace(
      "<head>",
      `<head>\n    <meta http-equiv="Content-Security-Policy" content="${CSP}" />`,
    ),
});

export default defineConfig({
  envDir: "../..",
  plugins: [react(), cspPlugin()],
  // The sandboxed iframe has an opaque ("null") origin, so module scripts need CORS.
  server: { port: 5185, strictPort: true, cors: { origin: "*" } },
  preview: { port: 5185, cors: { origin: "*" }, headers: { "Content-Security-Policy": CSP } },
});
