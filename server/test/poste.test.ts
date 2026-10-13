import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { emptyStudy, exampleStudy } from "@beffroi/shared";
import type { SessionUser } from "../src/auth.js";
import { LocalStudyStore } from "../src/local-store.js";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "beffroi-poste-test-"));
afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

const user = { id: "local", username: "ana", displayName: "Ana" } as SessionUser;
const meta = { name: "Étude", reference: "R-1", organisation: "Org", protection: "DR" };

describe("mode poste seul : stockage en fichiers", () => {
  const store = new LocalStudyStore(dir);

  it("crée, liste, relit et supprime une étude", async () => {
    const m = await store.create(user, meta, exampleStudy());
    expect(m).toMatchObject({ name: "Étude", major: 1, minor: 0, rev: 1, access: "owner", ownerName: "Ana" });
    expect(fs.existsSync(path.join(dir, "etudes", `${m.id}.json`))).toBe(true);
    expect((await store.list(user)).map((s) => s.id)).toContain(m.id);
    const { data } = await store.getData(user, m.id);
    expect(data.risks.length).toBeGreaterThan(0);
    await store.updateMeta(user, m.id, { name: "Renommée" });
    expect((await store.getMeta(user, m.id)).name).toBe("Renommée");
    await store.delete(user, m.id);
    await expect(store.getMeta(user, m.id)).rejects.toMatchObject({ status: 404 });
  });

  it("contrôle la révision (deux onglets) et refuse un document invalide", async () => {
    const m = await store.create(user, meta, emptyStudy(4));
    const { data } = await store.getData(user, m.id);
    expect(await store.save(user, m.id, 1, data)).toMatchObject({ rev: 2 });
    await expect(store.save(user, m.id, 1, data)).rejects.toMatchObject({ status: 409 });
    expect(await store.save(user, m.id, 1, data, true)).toMatchObject({ rev: 3 });
    await expect(store.save(user, m.id, 3, { framing: 42 })).rejects.toMatchObject({ status: 400 });
  });

  it("fige la version courante et ouvre la suivante", async () => {
    const m = await store.create(user, meta, emptyStudy(4));
    expect(await store.newVersion(user, m.id, "operational", "Revue", [1])).toMatchObject({ major: 1, minor: 1 });
    expect(await store.newVersion(user, m.id, "strategic", "Cycle", [1, 2])).toMatchObject({ major: 2, minor: 0 });
    const versions = await store.versions(user, m.id);
    expect(versions.map((v) => `${v.major}.${v.minor}`)).toEqual(["2.0", "1.1", "1.0"]);
    expect(versions.filter((v) => v.frozen)).toHaveLength(2);
    const old = versions[2];
    const { meta: om, data } = await store.getData(user, m.id, old.id);
    expect(om.frozen).toBe(true);
    expect(data).toBeTruthy();
  });

  it("refuse les identifiants qui sortent du dossier et le partage", async () => {
    for (const id of ["../instance", "..\\x", "a".repeat(36)]) await expect(store.getMeta(user, id)).rejects.toMatchObject({ status: 404 });
    await expect(store.setAcl()).rejects.toMatchObject({ status: 400 });
  });
});
