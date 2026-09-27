import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  base: "/",
  envDir: "../..",
  plugins: [react(), tailwindcss()],
  server: {
    port: 5183,
    strictPort: true,
    proxy: { "/api": "http://localhost:4000", "/cli": "http://localhost:4000" },
  },
});
