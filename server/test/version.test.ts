import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { APP_VERSION } from "../src/http.js";

const root = path.resolve(import.meta.dirname, "../..");
const versionOf = (dir: string) => JSON.parse(fs.readFileSync(path.join(root, dir, "package.json"), "utf8")).version as string;

describe("version de l'application", () => {
  it("APP_VERSION (http.ts) égale la version du package.json de la racine", () => {
    expect(APP_VERSION).toBe(versionOf("."));
  });

  it.each(["server", "shared", "web"])("la version du workspace %s égale celle de la racine", (workspace) => {
    expect(versionOf(workspace)).toBe(versionOf("."));
    expect(versionOf(workspace)).toBe(APP_VERSION);
  });
});
