// server/src/routes/profile.ts — profile dashboard data, avatar, addresses, maid→client ratings
import { Router } from "express";
import { z } from "zod";
import { prisma } from "./index.js";
import { auth } from "../middleware/auth.js";

export const profile = Router();
const wrap = (f: any) => (req: any, res: any, next: any) => Promise.resolve(f(req, res)).catch(next);
const fail = (m: string, status: number) => Object.assign(new Error(m), { status });
const A = auth("CLIENT", "MAID");

profile.get("/me/profile", A, wrap(async (req: any, res: any) => {
  const u = await prisma.user.findUniqueOrThrow({ where: { id: req.user.id }, select: { id: true, role: true, name: true, phone: true, email: true, avatarUrl: true, phoneVerified: true, createdAt: true, addresses: true } });
  const { role, addresses, ...user } = u;
  if (role === "CLIENT") {
    const cp = await prisma.clientProfile.findUniqueOrThrow({ where: { userId: u.id } });
    const cs = await prisma.employmentContract.findMany({ where: { clientId: cp.id, status: { in: ["ACTIVE", "PENDING_SIGNATURE", "COMPLETED", "TERMINATED"] } },
      include: { maid: { include: { user: { select: { name: true, avatarUrl: true } } } }, clientRating: true }, orderBy: { startDate: "desc" } });
    const row = (c: any) => ({ id: c.id, maidName: c.maid.user.name, maidAvatar: c.maid.user.avatarUrl, maidRating: c.maid.rating, salary: c.salary, startDate: c.startDate, endDate: c.endDate, status: c.status, ratedYou: c.clientRating?.rating ?? null });
    const rated = cs.filter(c => c.clientRating);
    return res.json({ role, user, city: cp.city, addresses,
      rating: { avg: rated.length ? rated.reduce((s, c) => s + c.clientRating!.rating, 0) / rated.length : 0, count: rated.length,
        list: rated.map(c => ({ rating: c.clientRating!.rating, comment: c.clientRating!.comment, maidName: c.maid.user.name.split(" ")[0], createdAt: c.clientRating!.createdAt })) },
      current: cs.filter(c => ["ACTIVE", "PENDING_SIGNATURE"].includes(c.status)).map(row), previous: cs.filter(c => ["COMPLETED", "TERMINATED"].includes(c.status)).map(row),
      stats: { hired: cs.length, active: cs.filter(c => c.status === "ACTIVE").length } });
  }
  const mp = await prisma.maidProfile.findUniqueOrThrow({ where: { userId: u.id }, include: { skills: { include: { category: true } }, languages: true } });
  const cs = await prisma.employmentContract.findMany({ where: { maidId: mp.id }, include: { client: { include: { user: { select: { name: true } } } }, clientRating: true, review: true }, orderBy: { startDate: "desc" } });
  res.json({ role, user, profile: { city: mp.city, rating: mp.rating, completedJobs: mp.completedJobs, experienceYears: mp.experienceYears, expectedSalary: mp.expectedSalary, flexibilityPct: mp.flexibilityPct,
      verification: mp.verification, bio: mp.bio, maxTravelKm: mp.maxTravelKm, fullTime: mp.fullTime, skills: mp.skills.map(s => s.category.name), languages: mp.languages.map(l => l.name) },
    employers: cs.map(c => ({ id: c.id, clientName: c.client.user.name, clientCity: c.client.city, salary: c.salary, status: c.status, startDate: c.startDate, endDate: c.endDate, ratedByYou: c.clientRating?.rating ?? null })),
    reviews: cs.filter(c => c.review).map(c => ({ rating: c.review!.rating, comment: c.review!.comment, createdAt: c.review!.createdAt })) });
}));

profile.put("/me/avatar", A, wrap(async (req: any, res: any) => {
  const { avatarUrl } = z.object({ avatarUrl: z.string().startsWith("data:image/").max(300_000) }).parse(req.body);
  await prisma.user.update({ where: { id: req.user.id }, data: { avatarUrl } }); res.json({ ok: true });
}));
profile.put("/me", A, wrap(async (req: any, res: any) => {
  const d = z.object({ name: z.string().min(2).max(80) }).parse(req.body);
  res.json(await prisma.user.update({ where: { id: req.user.id }, data: d, select: { id: true, name: true } }));
}));
profile.post("/me/addresses", auth("CLIENT"), wrap(async (req: any, res: any) => {
  const d = z.object({ line: z.string().min(3).max(200), city: z.string().min(2) }).parse(req.body);
  res.status(201).json(await prisma.address.create({ data: { ...d, userId: req.user.id } }));
}));
profile.post("/client-ratings", auth("MAID"), wrap(async (req: any, res: any) => {
  const d = z.object({ contractId: z.string(), rating: z.number().int().min(1).max(5), comment: z.string().max(500).optional() }).parse(req.body);
  const c = await prisma.employmentContract.findUniqueOrThrow({ where: { id: d.contractId }, include: { maid: true } });
  if (c.maid.userId !== req.user.id) throw fail("Forbidden", 403);
  if (!["COMPLETED", "TERMINATED"].includes(c.status)) throw fail("You can rate a client after employment ends", 409);
  res.status(201).json(await prisma.clientRating.create({ data: d }));
}));
