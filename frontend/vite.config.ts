import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// `npm run dev` proxies /api to the FastAPI server; `npm run build` outputs to dist/
// which server.py serves at "/".
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: true,
    proxy: { "/api": "http://localhost:8000" },
  },
  build: { outDir: "dist", chunkSizeWarningLimit: 2000 },
});
