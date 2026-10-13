import { Router } from "express";
import { z } from "zod";
import { emptyStudy, exampleStudy, type StudyData } from "@beffroi/shared";
import { actor, requireAnalyst } from "../auth.js";
import { idParam, json, parse, studyMetaInput, studyMetaPatch, type AppContext } from "../http.js";
import type { StudyStore } from "../studies.js";

/** Stockage des études : PostgreSQL (serveur d'équipe) ou fichiers locaux (poste seul). */
export type StudyRepository = Pick<
  StudyStore,
  "list" | "create" | "getMeta" | "updateMeta" | "delete" | "getData" | "save" | "versions" | "newVersion" | "acl" | "setAcl" | "require"
>;

export function studyRoutes(ctx: { audit: Pick<AppContext["audit"], "write">; store: StudyRepository }): Router {
  const { audit, store } = ctx;
  const r = Router();

  r.get("/studies", json(async (req) => store.list(requireAnalyst(req))));

  r.post(
    "/studies",
    json(async (req) => {
      const u = requireAnalyst(req);
      const body = parse(
        studyMetaInput.extend({ scaleSize: z.union([z.literal(4), z.literal(5)]).default(4), template: z.enum(["empty", "example"]).default("empty") }),
        req.body,
      );
      const data = body.template === "example" ? exampleStudy() : emptyStudy(body.scaleSize);
      const meta = await store.create(u, body, data);
      await audit.write(actor(req), "study.create", "study", meta.id, { template: body.template, protection: body.protection });
      return meta;
    }),
  );

  r.post(
    "/studies/import",
    json(async (req) => {
      const u = requireAnalyst(req);
      const body = parse(studyMetaInput.extend({ data: z.unknown() }), req.body);
      const meta = await store.create(u, body, body.data as StudyData);
      await audit.write(actor(req), "study.import", "study", meta.id, { protection: body.protection });
      return meta;
    }),
  );

  r.post(
    "/studies/:id/duplicate",
    json(async (req) => {
      const u = requireAnalyst(req);
      const id = idParam(req);
      const src = await store.getData(u, id);
      const body = parse(studyMetaPatch, req.body ?? {});
      const meta = await store.create(
        u,
        {
          name: body.name ?? `${src.meta.name} (copie)`,
          reference: body.reference ?? src.meta.reference,
          organisation: body.organisation ?? src.meta.organisation,
          protection: body.protection ?? src.meta.protection,
        },
        src.data,
      );
      await audit.write(actor(req), "study.duplicate", "study", meta.id, { from: id });
      return meta;
    }),
  );

  r.get("/studies/:id", json(async (req) => store.getMeta(requireAnalyst(req), idParam(req))));

  r.patch(
    "/studies/:id",
    json(async (req) => {
      const u = requireAnalyst(req);
      const id = idParam(req);
      const body = parse(studyMetaPatch, req.body);
      const meta = await store.updateMeta(u, id, body);
      await audit.write(actor(req), "study.metadata_update", "study", id, { fields: Object.keys(body), ...(body.protection ? { protection: body.protection } : {}) });
      return meta;
    }),
  );

  r.delete(
    "/studies/:id",
    json(async (req) => {
      const u = requireAnalyst(req);
      const id = idParam(req);
      await store.delete(u, id);
      await audit.write(actor(req), "study.delete", "study", id);
      return { ok: true };
    }),
  );

  r.get(
    "/studies/:id/data",
    json(async (req) => {
      const u = requireAnalyst(req);
      const id = idParam(req);
      const { version } = parse(z.object({ version: z.string().max(100).optional() }), req.query);
      const res = await store.getData(u, id, version);
      await audit.write(actor(req), "study.read", "study", id, { version: `${res.meta.major}.${res.meta.minor}` });
      return res;
    }),
  );

  // Imputabilité des écritures ; les sauvegardes automatiques rapprochées sont regroupées (5 min).
  const lastWriteLog = new Map<string, number>();
  r.put(
    "/studies/:id/data",
    json(async (req) => {
      const u = requireAnalyst(req);
      const id = idParam(req);
      const body = parse(z.object({ rev: z.number().int(), data: z.unknown(), force: z.boolean().optional() }), req.body);
      const res = await store.save(u, id, body.rev, body.data, body.force);
      const key = `${u.id}:${id}`;
      if (body.force || Date.now() - (lastWriteLog.get(key) ?? 0) > 5 * 60_000) {
        await audit.write(actor(req), "study.write", "study", id, { rev: res.rev, ...(body.force ? { force: true } : {}) });
        lastWriteLog.set(key, Date.now());
        if (lastWriteLog.size > 10_000) lastWriteLog.clear();
      }
      return res;
    }),
  );

  r.get("/studies/:id/versions", json(async (req) => store.versions(requireAnalyst(req), idParam(req))));

  r.post(
    "/studies/:id/versions",
    json(async (req) => {
      const u = requireAnalyst(req);
      const id = idParam(req);
      const body = parse(
        z.object({
          changeType: z.enum(["operational", "strategic"]),
          summary: z.string().trim().min(1, "décrivez les modifications majeures").max(5000),
          workshops: z.array(z.number().int().min(1).max(5)).min(1, "sélectionnez au moins un atelier"),
        }),
        req.body,
      );
      const v = await store.newVersion(u, id, body.changeType, body.summary, body.workshops);
      await audit.write(actor(req), "study.version_create", "study", id, { version: `${v.major}.${v.minor}`, changeType: body.changeType });
      return v;
    }),
  );

  r.get("/studies/:id/acl", json(async (req) => store.acl(requireAnalyst(req), idParam(req))));

  r.put(
    "/studies/:id/acl",
    json(async (req) => {
      const u = requireAnalyst(req);
      const id = idParam(req);
      const body = parse(
        z.array(z.object({ principalType: z.enum(["user", "group"]), principalId: z.string().max(100), access: z.enum(["read", "write", "owner"]) })).max(500),
        req.body,
      );
      const res = await store.setAcl(u, id, body);
      await audit.write(actor(req), "study.acl_update", "study", id, { entries: body.length });
      return res;
    }),
  );

  r.post(
    "/studies/:id/export-log",
    json(async (req) => {
      const u = requireAnalyst(req);
      const id = idParam(req);
      await store.require(u, id, "read");
      const body = parse(z.object({ format: z.string().max(40), scope: z.string().max(200).default("") }), req.body);
      await audit.write(actor(req), "study.export", "study", id, body);
      return { ok: true };
    }),
  );

  return r;
}
