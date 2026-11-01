import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { auth, sign } from "../middleware/auth.js";
import { issueRefresh } from "./refresh.js";
import { env } from "../config/env.js";
import { km } from "../services/geo.js";
import { score } from "../services/recommend.js";
import { findConflict } from "../services/schedule.js";

export const prisma = new PrismaClient();
export const api = Router();
const wrap = (f:any) => (req:any,res:any,next:any) => Promise.resolve(f(req,res)).catch(next);
const fail = (m:string,status:number) => Object.assign(new Error(m),{ status });

api.post("/auth/register", wrap(async (req:any,res:any) => {
  const d = z.object({ role:z.enum(["CLIENT","MAID"]), name:z.string().min(2), phone:z.string().min(10), password:z.string().min(8), email:z.string().email().optional(), city:z.string().optional(), lat:z.number().optional(), lng:z.number().optional(), expectedSalary:z.number().positive().optional() }).parse(req.body);
  const user = await prisma.user.create({ data:{ role:d.role, name:d.name, phone:d.phone, email:d.email, passwordHash:await bcrypt.hash(d.password,10), ...(d.role==="CLIENT" ? { client:{ create:{ city:d.city } } } : { maid:{ create:{ city:d.city ?? "Bhubaneswar", lat:d.lat ?? 20.2961, lng:d.lng ?? 85.8245, expectedSalary:d.expectedSalary ?? 6000, availableDays:[1,2,3,4,5,6] } } }) } });
  res.status(201).json({ token:sign(user), refresh:await issueRefresh(user), otp:"DEMO-123456" });
}));
api.post("/auth/login", wrap(async (req:any,res:any) => {
  const { identifier, password } = req.body;
  const u = await prisma.user.findFirst({ where:{ OR:[{ email:identifier },{ phone:identifier }] } });
  if (!u || u.status!=="ACTIVE" || !(await bcrypt.compare(password,u.passwordHash))) return res.status(401).json({ error:"Invalid credentials" });
  res.json({ token:sign(u), refresh:await issueRefresh(u), user:{ id:u.id, role:u.role, name:u.name } });
}));

api.get("/maids", wrap(async (req:any,res:any) => {
  const { lat, lng, skills="", budget="0", day, sort="recommended", verified, page="1" } = req.query;
  const q = { skills:String(skills).split(",").filter(Boolean), budget:+budget, day: day!=null ? +day : undefined };
  const maids = await prisma.maidProfile.findMany({ where:{ user:{ status:"ACTIVE" }, ...(verified==="true" ? { verification:"VERIFIED" } : {}) },
    include:{ user:{ select:{ name:true } }, skills:{ include:{ category:true } }, languages:true } });
  const here = lat&&lng ? { lat:+lat, lng:+lng } : null;
  const rows = maids.map(m => { const d = here ? km(here,m) : 0; return { ...m, distanceKm:+d.toFixed(1), score:score(m,d,q) }; }).filter(m => !here || m.score>0);
  const by:any = { recommended:(a:any,b:any)=>b.score-a.score, nearest:(a:any,b:any)=>a.distanceKm-b.distanceKm, rated:(a:any,b:any)=>b.rating-a.rating, cheapest:(a:any,b:any)=>a.expectedSalary-b.expectedSalary, experienced:(a:any,b:any)=>b.experienceYears-a.experienceYears };
  rows.sort(by[sort] ?? by.recommended);
  res.json({ total:rows.length, data:rows.slice((+page-1)*12, +page*12) });
}));

const reqSchema = z.object({ maidId:z.string(), services:z.array(z.string()).min(1), startDate:z.coerce.date(), durationMonths:z.number().int().min(1), days:z.array(z.number().min(0).max(6)).min(1), startMin:z.number(), endMin:z.number(), offeredSalary:z.number().positive(), payFrequency:z.enum(["WEEKLY","MONTHLY"]), notes:z.string().optional() }).refine(d=>d.endMin>d.startMin);
api.post("/requests", auth("CLIENT"), wrap(async (req:any,res:any) => {
  const { maidId, ...d } = reqSchema.parse(req.body);
  const client = await prisma.clientProfile.findUniqueOrThrow({ where:{ userId:req.user.id } });
  if (await prisma.employmentRequest.findFirst({ where:{ clientId:client.id, maidId, status:{ in:["PENDING","NEGOTIATING"] } } })) throw fail("An open request to this maid already exists",409);
  const m = await prisma.maidProfile.findUniqueOrThrow({ where:{ id:maidId } });
  const r = await prisma.employmentRequest.create({ data:{ ...d, maid:{ connect:{ id:maidId } }, client:{ connect:{ id:client.id } }, expiresAt:new Date(Date.now()+env.requestTtlHours*3600e3) } });
  await prisma.notification.create({ data:{ userId:m.userId, title:"New employment request", body:`Offer ₹${d.offeredSalary}` } });
  res.status(201).json(r);
}));
api.post("/requests/:id/respond", auth("MAID"), wrap(async (req:any,res:any) => {
  const { action } = z.object({ action:z.enum(["ACCEPT","REJECT"]) }).parse(req.body);
  res.json(await prisma.$transaction(async tx => {
    const r = await tx.employmentRequest.findUniqueOrThrow({ where:{ id:req.params.id }, include:{ maid:true, client:true } });
    if (r.maid.userId!==req.user.id) throw fail("Forbidden",403);
    if (!["PENDING","NEGOTIATING"].includes(r.status)) throw fail("Request is no longer open",409);
    if (r.expiresAt<new Date()) { await tx.employmentRequest.update({ where:{ id:r.id }, data:{ status:"EXPIRED" } }); throw fail("Request expired",410); }
    if (action==="REJECT") return tx.employmentRequest.update({ where:{ id:r.id }, data:{ status:"REJECTED" } });
    const addr = await tx.address.findFirst({ where:{ userId:r.client.userId } });
    const slot = { days:r.days, startMin:r.startMin, endMin:r.endMin, lat:addr?.lat??r.maid.lat, lng:addr?.lng??r.maid.lng };
    const existing = await tx.employmentSchedule.findMany({ where:{ maidId:r.maidId, contract:{ status:{ in:["ACTIVE","PENDING_SIGNATURE"] } } } });
    const conflict = findConflict(existing, slot);
    if (conflict) throw fail(conflict,409);
    const end = new Date(r.startDate); end.setMonth(end.getMonth()+r.durationMonths);
    await tx.employmentContract.create({ data:{ requestId:r.id, clientId:r.clientId, maidId:r.maidId, salary:r.offeredSalary, payFrequency:r.payFrequency, startDate:r.startDate, endDate:end, maidAcceptedAt:new Date(), terms:{ services:r.services }, schedules:{ create:{ maidId:r.maidId, ...slot } } } });
    return tx.employmentRequest.update({ where:{ id:r.id }, data:{ status:"ACCEPTED" } });
  }));
}));

api.post("/attendance/:contractId/check-in", auth("MAID"), wrap(async (req:any,res:any) => {
  const c = await prisma.employmentContract.findUniqueOrThrow({ where:{ id:req.params.contractId }, include:{ maid:true } });
  if (c.maid.userId!==req.user.id || c.status!=="ACTIVE") throw fail("Not allowed",403);
  const date = new Date(new Date().toDateString());
  res.json(await prisma.attendance.upsert({ where:{ contractId_date:{ contractId:c.id, date } }, update:{}, create:{ contractId:c.id, date, checkIn:new Date(), geoConsent:!!req.body.geoConsent } }));
}));
api.post("/attendance/:id/verify", auth("CLIENT"), wrap(async (req:any,res:any) => {
  const a = await prisma.attendance.findUniqueOrThrow({ where:{ id:req.params.id }, include:{ contract:{ include:{ client:true } } } });
  if (a.contract.client.userId!==req.user.id) throw fail("Forbidden",403);
  res.json(await prisma.attendance.update({ where:{ id:a.id }, data:{ status:req.body.status==="DISPUTED"?"DISPUTED":"PRESENT", verifiedAt:new Date() } }));
}));

api.get("/admin/stats", auth("ADMIN"), wrap(async (_:any,res:any) => res.json({
  clients:await prisma.user.count({ where:{ role:"CLIENT" } }), maids:await prisma.user.count({ where:{ role:"MAID" } }),
  verified:await prisma.maidProfile.count({ where:{ verification:"VERIFIED" } }), pending:await prisma.maidProfile.count({ where:{ verification:"PENDING" } }),
  activeContracts:await prisma.employmentContract.count({ where:{ status:"ACTIVE" } }), openDisputes:await prisma.dispute.count({ where:{ status:"OPEN" } }) })));
api.post("/admin/maids/:id/verify", auth("ADMIN"), wrap(async (req:any,res:any) => {
  const { approve, reason } = req.body;
  const m = await prisma.maidProfile.update({ where:{ id:req.params.id }, data:{ verification:approve?"VERIFIED":"REJECTED", verifiedAt:approve?new Date():null } });
  await prisma.auditLog.create({ data:{ actorId:req.user.id, action:approve?"VERIFY":"REJECT", entity:"MaidProfile", entityId:m.id, meta:{ reason } } });
  res.json(m);
}));