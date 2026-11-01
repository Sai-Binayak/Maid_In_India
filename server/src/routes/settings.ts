// server/src/routes/settings.ts — admin platform settings + city management (needs 4-schema-additions.prisma)
// app.ts:  import { settings } from "./routes/settings.js";  app.use("/api", api, more, settings);
// To honour settings elsewhere:  const ttl = await getSetting("requestTtlHours", 72);  const pct = await getSetting("commissionPct", 10);
import { Router } from "express";
import { z } from "zod";
import { prisma } from "./index.js";
import { auth } from "../middleware/auth.js";

export const settings = Router();
const wrap = (f: any) => (req: any, res: any, next: any) => Promise.resolve(f(req, res)).catch(next);
const ADM = auth("ADMIN");
const KEYS: Record<string, z.ZodTypeAny> = {
  commissionPct: z.number().min(0).max(50),
  requestTtlHours: z.number().int().min(1).max(336),
  verificationPolicy: z.object({ requireIdentity: z.boolean(), requireAddress: z.boolean(), backgroundCheckOptional: z.boolean() }),
  notifications: z.object({ email: z.boolean(), sms: z.boolean(), inApp: z.boolean() }),
  paymentSettings: z.object({ weeklyEnabled: z.boolean(), monthlyEnabled: z.boolean() }),
  terms: z.string().max(50000),
  privacyPolicy: z.string().max(50000),
};
export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const r = await prisma.platformSetting.findUnique({ where: { key } });
  return (r?.value as T) ?? fallback;
}
settings.get("/cities", wrap(async (_: any, res: any) => res.json(await prisma.city.findMany({ where: { active: true }, orderBy: { name: "asc" } }))));
settings.get("/admin/settings", ADM, wrap(async (_: any, res: any) => res.json(Object.fromEntries((await prisma.platformSetting.findMany()).map(s => [s.key, s.value])))));
settings.put("/admin/settings/:key", ADM, wrap(async (req: any, res: any) => {
  const schema = KEYS[req.params.key];
  if (!schema) return res.status(404).json({ error: `Unknown setting. Allowed: ${Object.keys(KEYS).join(", ")}` });
  const value = schema.parse(req.body.value);
  const s = await prisma.platformSetting.upsert({ where: { key: req.params.key }, update: { value }, create: { key: req.params.key, value } });
  await prisma.auditLog.create({ data: { actorId: req.user.id, action: "SETTING_UPDATE", entity: "PlatformSetting", entityId: s.key, meta: { value } } });
  res.json(s);
}));
settings.post("/admin/cities", ADM, wrap(async (req: any, res: any) => res.status(201).json(await prisma.city.create({ data: z.object({ name: z.string().min(2), state: z.string().min(2) }).parse(req.body) }))));
settings.patch("/admin/cities/:id", ADM, wrap(async (req: any, res: any) => res.json(await prisma.city.update({ where: { id: req.params.id }, data: { active: !!req.body.active } }))));
