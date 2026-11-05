import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  // GitHub Pages serves this project from /Aurora/, not the domain root.
  // Vercel and local development continue to use the root path.
  base: process.env.GITHUB_ACTIONS ? "/Aurora/" : "/",
  plugins: [react()],
  server: {
    host: "127.0.0.1",
    port: 5173,
    strictPort: true
  }
});
