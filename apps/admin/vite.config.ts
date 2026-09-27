import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  base: "/admin/",
  envDir: "../..",
  plugins: [react(), tailwindcss()],
  server: {
    port: 5184,
    strictPort: true,
    proxy: { "/api": "http://localhost:4000", "/cli": "http://localhost:4000" },
  },
});
