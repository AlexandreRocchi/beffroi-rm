// Lance le serveur API (rechargement automatique) et le client Vite en parallèle.
import { spawn } from "node:child_process";

const env = { ...process.env, DATA_DIR: process.env.DATA_DIR ?? "data", PORT: process.env.PORT ?? "8080" };
const procs = [
  spawn("npm", ["run", "dev", "-w", "server"], { stdio: "inherit", env }),
  spawn("npm", ["run", "dev", "-w", "web"], { stdio: "inherit", env }),
];
const stop = () => procs.forEach((p) => p.kill("SIGTERM"));
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
for (const p of procs) p.on("exit", (code) => { if (code) { stop(); process.exit(code); } });
