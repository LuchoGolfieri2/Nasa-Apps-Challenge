import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// base "./" para que el sitio funcione igual en Vercel, GitHub Pages o abierto desde una subcarpeta.
export default defineConfig({
  base: "./",
  plugins: [react()],
  server: { port: 5173 },
});
