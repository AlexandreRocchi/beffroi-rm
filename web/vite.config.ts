import fs from "node:fs";
import path from "node:path";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { defineConfig, type Plugin } from "vite";

/** Liste des modules réellement embarqués (inventaire des composants tiers livrés). */
const moduleInventory = (): Plugin => ({
  name: "beffroi-inventaire-modules",
  apply: "build",
  generateBundle() {
    const ids = [...this.getModuleIds()].map((id) => path.relative(path.resolve(__dirname, ".."), id.replace(/^\0/, "").split("?")[0]));
    fs.writeFileSync(path.resolve(__dirname, "modules.json"), JSON.stringify(ids.sort(), null, 1));
  },
});

export default defineConfig({
  plugins: [svelte(), moduleInventory()],
  resolve: {
    alias: { "@beffroi/shared": path.resolve(__dirname, "../shared/src/index.ts") },
  },
  server: {
    port: 5173,
    proxy: { "/api": "http://127.0.0.1:8080" },
  },
  build: {
    outDir: "dist",
    chunkSizeWarningLimit: 2000,
    sourcemap: false,
  },
});
