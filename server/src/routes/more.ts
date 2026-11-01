import { Router } from "express";
import { z } from "zod";
import { prisma } from "./index.js";
import { auth } from "../middleware/auth.js";
import { env } from "../config/env.js";
import { calcSalary } from "../services/salary.js";

export const more = Router();
const wrap = (f:any) => (req:any,res:any,next:any) => Promise.resolve(f(req,res)).catch(next);
const fail = (m:string,status:number) => Object.assign(new Error(m),{ status });
const notify = (userId:string,title:string,body:string) => prisma.notification.create({ data:{ userId,title,body } });
const audit = (actorId:string,action:string,entity:string,entityId:string,meta?:any) => prisma.auditLog.create({ data:{ actorId,action,entity,entityId,meta } });
const A = auth("CLIENT","MAID"), ADM = auth("ADMIN");

async function loadReq(id:string, uid:string) {
  const r = await prisma.employmentRequest.findUniqueOrThrow({ where:{ id }, include:{ client:true, maid:true } });
  const side = r.client.userId===uid ? "CLIENT" : r.maid.userId===uid ? "MAID" : null;
  if (!side) throw fail("Forbidden",403);
  return { r, side:side as "CLIENT"|"MAID", other: side==="CLIENT" ? r.maid.userId : r.client.userId };
}
async function loadContract(id:string, uid:string) {
  const c = await prisma.employmentContract.findUniqueOrThrow({ where:{ id }, include:{ client:true, maid:true, schedules:true } });
  const isC = c.client.userId===uid, isM = c.maid.userId===uid;
  if (!isC && !isM) throw fail("Forbidden",403);
  return { c, isC, other: isC ? c.maid.userId : c.client.userId };
}

// ---- Me / lists ----
more.get("/requests", A, wrap(async (req:any,res:any) => res.json(await prisma.employmentRequest.findMany({
  where: req.user.role==="CLIENT" ? { client:{ userId:req.user.id } } : { maid:{ userId:req.user.id } }, include:{ negotiations:true, client:{ include:{ user:{ select:{ name:true } } } }, maid:{ include:{ user:{ select:{ name:true } } } } }, orderBy:{ createdAt:"desc" } }))));
more.get("/contracts", A, wrap(async (req:any,res:any) => res.json(await prisma.employmentContract.findMany({
  where: req.user.role==="CLIENT" ? { client:{ userId:req.user.id } } : { maid:{ userId:req.user.id } }, include:{ schedules:true, attendance:{ take:10, orderBy:{ date:"desc" } } } }))));
more.put("/maid/profile", auth("MAID"), wrap(async (req:any,res:any) => {
  const d = z.object({ bio:z.string().max(500), expectedSalary:z.number().positive(), flexibilityPct:z.number().min(0).max(50), availableDays:z.array(z.number().min(0).max(6)), maxTravelKm:z.number().min(1).max(50), fullTime:z.boolean() }).partial().parse(req.body);
  res.json(await prisma.maidProfile.update({ where:{ userId:req.user.id }, data:d }));
}));
more.post("/maid/documents", auth("MAID"), wrap(async (req:any,res:any) => {
  const d = z.object({ type:z.enum(["IDENTITY","ADDRESS"]), privateRef:z.string(), consent:z.literal(true) }).parse(req.body);
  const m = await prisma.maidProfile.findUniqueOrThrow({ where:{ userId:req.user.id } });
  await prisma.verificationDocument.create({ data:{ maidId:m.id, type:d.type, privateRef:d.privateRef } }); // privateRef = private storage key (never a public URL)
  res.json(await prisma.maidProfile.update({ where:{ id:m.id }, data:{ verification:"PENDING" } }));
}));
more.get("/maids/:id/reviews", wrap(async (req:any,res:any) => res.json(await prisma.review.findMany({ where:{ flagged:false, contract:{ maidId:req.params.id } }, select:{ rating:true, comment:true, createdAt:true } }))));

// ---- Negotiation ----
more.post("/requests/:id/negotiate", A, wrap(async (req:any,res:any) => {
  const { amount } = z.object({ amount:z.number().positive() }).parse(req.body);
  const { r, side, other } = await loadReq(req.params.id, req.user.id);
  if (!["PENDING","NEGOTIATING"].includes(r.status) || r.expiresAt<new Date()) throw fail("Request is closed",409);
  const [n] = await prisma.$transaction([ prisma.salaryNegotiation.create({ data:{ requestId:r.id, fromRole:side, amount } }), prisma.employmentRequest.update({ where:{ id:r.id }, data:{ status:"NEGOTIATING" } }) ]);
  await notify(other,"New counteroffer",`₹${amount}`); res.status(201).json(n);
}));
more.post("/requests/:id/negotiate/accept", A, wrap(async (req:any,res:any) => {
  const { r, side, other } = await loadReq(req.params.id, req.user.id);
  const last = await prisma.salaryNegotiation.findFirst({ where:{ requestId:r.id }, orderBy:{ createdAt:"desc" } });
  if (!last || last.fromRole===side) throw fail("No offer from the other party to accept",409);
  await prisma.$transaction([ prisma.salaryNegotiation.update({ where:{ id:last.id }, data:{ accepted:true } }), prisma.employmentRequest.update({ where:{ id:r.id }, data:{ offeredSalary:last.amount } }) ]);
  await notify(other,"Offer accepted",`Agreed ₹${last.amount}. The maid can now accept the request to create the contract.`); res.json({ agreed:last.amount });
}));
more.post("/chats", A, wrap(async (req: any, res: any) => {
  const { r } = await loadReq(req.body.requestId, req.user.id);
  const ex = await prisma.chat.findFirst({ where: { requestId: r.id } });
  res.json(ex ?? await prisma.chat.create({ data: { requestId: r.id, members: { connect: [{ id: r.client.userId }, { id: r.maid.userId }] } } }));
}));
more.get("/chats/:id/messages", A, wrap(async (req: any, res: any) => {
  const ok = await prisma.chat.findFirst({ where: { id: req.params.id, members: { some: { id: req.user.id } } } });
  if (!ok) throw fail("Forbidden", 403);
  res.json(await prisma.message.findMany({ where: { chatId: ok.id }, orderBy: { createdAt: "asc" } }));
}));

// ---- Contracts: sign / amend (revision history) / terminate / complete ----
more.post("/contracts/:id/sign", A, wrap(async (req:any,res:any) => {
  const { c, isC, other } = await loadContract(req.params.id, req.user.id);
  if (c.status!=="PENDING_SIGNATURE") throw fail("Contract is not awaiting signatures",409);
  const now = new Date(), cA = isC ? now : c.clientAcceptedAt, mA = !isC ? now : c.maidAcceptedAt;
  const u = await prisma.employmentContract.update({ where:{ id:c.id }, data:{ clientAcceptedAt:cA, maidAcceptedAt:mA, status: cA&&mA ? "ACTIVE" : "PENDING_SIGNATURE" } });
  await notify(other, u.status==="ACTIVE" ? "Contract active" : "Contract awaiting your signature", `Contract rev ${u.revision}`); res.json(u);
}));
more.post("/contracts/:id/amend", A, wrap(async (req:any,res:any) => {
  const d = z.object({ salary:z.number().positive().optional(), noticeDays:z.number().int().min(0).optional(), paidLeaveDays:z.number().int().min(0).optional() }).parse(req.body);
  const { c, isC, other } = await loadContract(req.params.id, req.user.id);
  if (!["ACTIVE","PENDING_SIGNATURE"].includes(c.status)) throw fail("Contract cannot be amended",409);
  const t:any = c.terms ?? {}; const history = [...(t.history ?? []), { revision:c.revision, salary:c.salary, noticeDays:c.noticeDays, paidLeaveDays:c.paidLeaveDays, at:new Date() }];
  const now = new Date();
  const u = await prisma.employmentContract.update({ where:{ id:c.id }, data:{ ...d, revision:{ increment:1 }, terms:{ ...t, history }, status:"PENDING_SIGNATURE", clientAcceptedAt:isC?now:null, maidAcceptedAt:isC?null:now } });
  await notify(other,"Contract change proposed","Review and sign the new terms. Old terms stay in force until both parties sign."); res.json(u);
}));
more.post("/contracts/:id/terminate", A, wrap(async (req:any,res:any) => {
  const { c, other } = await loadContract(req.params.id, req.user.id);
  if (c.status!=="ACTIVE") throw fail("Only active contracts can be terminated",409);
  const endDate = new Date(Date.now()+c.noticeDays*864e5); // notice period honoured
  const u = await prisma.employmentContract.update({ where:{ id:c.id }, data:{ status:"TERMINATED", endDate } });
  await notify(other,"Employment terminated",`Last working day: ${endDate.toDateString()}. Please leave a review.`); await audit(req.user.id,"TERMINATE","EmploymentContract",c.id); res.json(u);
}));
more.post("/contracts/:id/complete", auth("CLIENT"), wrap(async (req:any,res:any) => {
  const { c } = await loadContract(req.params.id, req.user.id);
  if (c.status!=="ACTIVE") throw fail("Not active",409);
  const [u] = await prisma.$transaction([ prisma.employmentContract.update({ where:{ id:c.id }, data:{ status:"COMPLETED" } }), prisma.maidProfile.update({ where:{ id:c.maidId }, data:{ completedJobs:{ increment:1 } } }) ]);
  await notify(c.client.userId,"Please review your maid","Reviews are required for completed employment."); res.json(u);
}));

// ---- Leave ----
more.post("/leave", auth("MAID"), wrap(async (req:any,res:any) => {
  const d = z.object({ contractId:z.string(), date:z.coerce.date(), paid:z.boolean() }).parse(req.body);
  const { c } = await loadContract(d.contractId, req.user.id);
  if (c.status!=="ACTIVE") throw fail("Contract not active",409);
  const l = await prisma.leaveRequest.create({ data:d }); await notify(c.client.userId,"Leave request",d.date.toDateString()); res.status(201).json(l);
}));
more.patch("/leave/:id", auth("CLIENT"), wrap(async (req:any,res:any) => {
  const { approved } = z.object({ approved:z.boolean() }).parse(req.body);
  const l = await prisma.leaveRequest.findUniqueOrThrow({ where:{ id:req.params.id } });
  const { c } = await loadContract(l.contractId, req.user.id);
  const u = await prisma.leaveRequest.update({ where:{ id:l.id }, data:{ approved } });
  if (approved) await prisma.attendance.upsert({ where:{ contractId_date:{ contractId:c.id, date:l.date } }, update:{ status:"LEAVE" }, create:{ contractId:c.id, date:l.date, status:"LEAVE" } });
  await notify(c.maid.userId, approved?"Leave approved":"Leave rejected", l.date.toDateString()); res.json(u);
}));

// ---- Payments (demo gateway fallback when no Razorpay keys) ----
more.post("/payments/generate", auth("CLIENT"), wrap(async (req:any,res:any) => {
  const { contractId, month } = z.object({ contractId:z.string(), month:z.string().regex(/^\d{4}-\d{2}$/) }).parse(req.body);
  const { c } = await loadContract(contractId, req.user.id);
  const [y,m] = month.split("-").map(Number), start = new Date(Date.UTC(y,m-1,1)), end = new Date(Date.UTC(y,m,1));
  if (await prisma.payment.findFirst({ where:{ contractId, periodStart:start } })) throw fail("Payment for this period already exists",409);
  const days = c.schedules[0]?.days ?? []; let wd = 0;
  for (let d=1; d<=new Date(Date.UTC(y,m,0)).getUTCDate(); d++) if (days.includes(new Date(Date.UTC(y,m-1,d)).getUTCDay())) wd++;
  const unpaid = await prisma.attendance.count({ where:{ contractId, status:"ABSENT", date:{ gte:start, lt:end } } }); // paid/approved leave & holidays never deducted
  const s = calcSalary({ monthly: c.payFrequency==="WEEKLY" ? Math.round(c.salary*4.33) : c.salary, workingDays:Math.max(wd,1), unpaidAbsences:unpaid, commissionPct:env.commissionPct });
  res.status(201).json(await prisma.payment.create({ data:{ contractId, periodStart:start, periodEnd:end, gross:s.gross, deductions:s.deductions, net:s.net, commission:s.commission } }));
}));
more.post("/payments/:id/pay", auth("CLIENT"), wrap(async (req:any,res:any) => {
  const p = await prisma.payment.findUniqueOrThrow({ where:{ id:req.params.id }, include:{ contract:{ include:{ client:true, maid:true } } } });
  if (p.contract.client.userId!==req.user.id) throw fail("Forbidden",403);
  if (p.status==="PAID") throw fail("Already paid",409);
  const ref = (process.env.RAZORPAY_KEY_ID ? "rzp_pending_" : "demo_")+p.id; // TODO: create Razorpay order + verify webhook signature when keys are set
  await prisma.$transaction([ prisma.paymentTransaction.create({ data:{ paymentId:p.id, gatewayRef:ref, status:"PAID" } }), prisma.payment.update({ where:{ id:p.id }, data:{ status:"PAID" } }) ]);
  await notify(p.contract.maid.userId,"Payment received",`₹${p.net}`); res.json({ paid:true, ref });
}));
more.post("/payments/:id/dispute", A, wrap(async (req:any,res:any) => {
  const p = await prisma.payment.findUniqueOrThrow({ where:{ id:req.params.id } }); await loadContract(p.contractId, req.user.id);
  await prisma.$transaction([ prisma.payment.update({ where:{ id:p.id }, data:{ status:"DISPUTED" } }), prisma.dispute.create({ data:{ category:"SALARY", contractId:p.contractId, raisedBy:req.user.id, notes:[String(req.body.reason ?? "")] } }) ]);
  res.json({ disputed:true });
}));
more.get("/payments", A, wrap(async (req:any,res:any) => res.json(await prisma.payment.findMany({ where:{ contract: req.user.role==="CLIENT" ? { client:{ userId:req.user.id } } : { maid:{ userId:req.user.id } } }, include:{ tx:true }, orderBy:{ periodStart:"desc" } }))));

// ---- Reviews ----
more.post("/reviews", auth("CLIENT"), wrap(async (req:any,res:any) => {
  const d = z.object({ contractId:z.string(), rating:z.number().int().min(1).max(5), comment:z.string().max(1000).optional() }).parse(req.body);
  const { c } = await loadContract(d.contractId, req.user.id);
  if (!["COMPLETED","TERMINATED"].includes(c.status)) throw fail("Reviews open after employment ends",409);
  const r = await prisma.review.create({ data:d });
  const agg = await prisma.review.aggregate({ where:{ flagged:false, contract:{ maidId:c.maidId } }, _avg:{ rating:true } });
  await prisma.maidProfile.update({ where:{ id:c.maidId }, data:{ rating:agg._avg.rating ?? 0 } }); res.status(201).json(r);
}));
more.post("/reviews/:id/flag", A, wrap(async (req:any,res:any) => res.json(await prisma.review.update({ where:{ id:req.params.id }, data:{ flagged:true } }))));

// ---- Disputes (no automatic bans) / SOS / support ----
const cats = z.enum(["ATTENDANCE","SALARY","MISCONDUCT","SERVICE_QUALITY","CONTRACT_VIOLATION","SAFETY","FRAUD"]);
more.post("/disputes", A, wrap(async (req:any,res:any) => {
  const d = z.object({ category:cats, contractId:z.string().optional(), description:z.string().min(5) }).parse(req.body);
  res.status(201).json(await prisma.dispute.create({ data:{ category:d.category, contractId:d.contractId, raisedBy:req.user.id, notes:[d.description] } }));
}));
more.post("/disputes/:id/evidence", A, wrap(async (req:any,res:any) => {
  const dsp = await prisma.dispute.findUniqueOrThrow({ where:{ id:req.params.id } }); if (dsp.raisedBy!==req.user.id) throw fail("Forbidden",403);
  res.status(201).json(await prisma.disputeEvidence.create({ data:{ disputeId:dsp.id, privateRef:String(req.body.privateRef) } }));
}));
more.post("/disputes/:id/appeal", A, wrap(async (req:any,res:any) => {
  const dsp = await prisma.dispute.findUniqueOrThrow({ where:{ id:req.params.id } });
  if (dsp.raisedBy!==req.user.id || dsp.status!=="RESOLVED") throw fail("Only the filer can appeal a resolved dispute",409);
  res.json(await prisma.dispute.update({ where:{ id:dsp.id }, data:{ status:"APPEALED", notes:{ push:`Appeal: ${req.body.reason ?? ""}` } } }));
}));
more.post("/sos", A, wrap(async (req:any,res:any) => {
  const d = await prisma.dispute.create({ data:{ category:"SAFETY_SOS", raisedBy:req.user.id, notes:[String(req.body.message ?? "SOS"), `Contacts alerted: ${(req.body.contacts ?? []).join(", ")}`] } });
  const admins = await prisma.user.findMany({ where:{ role:"ADMIN" } });
  await prisma.notification.createMany({ data:admins.map(a=>({ userId:a.id, title:"SOS raised", body:`Incident ${d.id}` })) }); await audit(req.user.id,"SOS","Dispute",d.id);
  res.status(201).json({ incident:d.id, notice:"Support has been alerted. This app is NOT an emergency service: call 112 (India) in an emergency." });
}));
more.post("/support", A, wrap(async (req:any,res:any) => res.status(201).json(await prisma.supportTicket.create({ data:{ userId:req.user.id, subject:String(req.body.subject), body:String(req.body.body) } }))));
more.get("/support", A, wrap(async (req:any,res:any) => res.json(await prisma.supportTicket.findMany({ where:{ userId:req.user.id } }))));
more.get("/faq", (_:any,res:any) => res.json([{ q:"How long do requests last?", a:"72 hours." },{ q:"Is my ID shown publicly?", a:"Never." },{ q:"How is salary deducted?", a:"Only for unpaid, unapproved absences." }]));

// ---- Notifications / promos / subscriptions / referrals ----
more.get("/notifications", auth(), wrap(async (req:any,res:any) => res.json(await prisma.notification.findMany({ where:{ userId:req.user.id }, orderBy:{ createdAt:"desc" }, take:50 }))));
more.post("/notifications/:id/read", auth(), wrap(async (req:any,res:any) => res.json(await prisma.notification.updateMany({ where:{ id:req.params.id, userId:req.user.id }, data:{ read:true } }))));
more.get("/promotions", wrap(async (_:any,res:any) => res.json(await prisma.promotion.findMany({ where:{ active:true } }))));
more.post("/subscriptions", auth("CLIENT"), wrap(async (req:any,res:any) => {
  const plan = z.enum(["BASIC","PREMIUM","FAMILY"]).parse(req.body.plan), expiresAt = new Date(Date.now()+30*864e5);
  res.json(await prisma.subscription.upsert({ where:{ userId:req.user.id }, update:{ plan, expiresAt }, create:{ userId:req.user.id, plan, expiresAt } }));
}));
more.get("/referrals/me", A, wrap(async (req:any,res:any) => {
  const code = "MII"+req.user.id.slice(-6).toUpperCase();
  if (!(await prisma.referral.findFirst({ where:{ code, referredId:null } }))) await prisma.referral.create({ data:{ code, referrerId:req.user.id } });
  res.json({ code, redeemed:await prisma.referral.count({ where:{ referrerId:req.user.id, referredId:{ not:null } } }) });
}));
more.post("/referrals/redeem", A, wrap(async (req:any,res:any) => {
  const base = await prisma.referral.findFirst({ where:{ code:String(req.body.code), referredId:null } });
  if (!base || base.referrerId===req.user.id) throw fail("Invalid code",400);
  if (await prisma.referral.findFirst({ where:{ referredId:req.user.id } })) throw fail("Already redeemed",409);
  res.json(await prisma.referral.create({ data:{ code:base.code, referrerId:base.referrerId, referredId:req.user.id } }));
}));

// ---- Admin ----
more.get("/admin/users", ADM, wrap(async (req:any,res:any) => res.json(await prisma.user.findMany({ where:{ ...(req.query.role?{ role:req.query.role }:{}), ...(req.query.q?{ name:{ contains:String(req.query.q), mode:"insensitive" } }:{}) }, select:{ id:true, name:true, role:true, status:true, createdAt:true }, take:50, skip:(+(req.query.page??1)-1)*50 }))));
more.post("/admin/users/:id/status", ADM, wrap(async (req:any,res:any) => {
  const { status, reason } = z.object({ status:z.enum(["ACTIVE","SUSPENDED"]), reason:z.string().min(10) }).parse(req.body); // documented reason required
  const u = await prisma.user.findUniqueOrThrow({ where:{ id:req.params.id } }); if (u.role==="ADMIN") throw fail("Cannot change admin accounts",403);
  await prisma.user.update({ where:{ id:u.id }, data:{ status } }); await audit(req.user.id,status,"User",u.id,{ reason });
  await notify(u.id, status==="SUSPENDED"?"Account suspended":"Account reactivated", status==="SUSPENDED"?`Reason: ${reason}. You may appeal via Support.`:"Welcome back."); res.json({ ok:true });
}));
more.get("/admin/verifications", ADM, wrap(async (_:any,res:any) => res.json(await prisma.maidProfile.findMany({ where:{ verification:"PENDING" }, include:{ user:{ select:{ name:true } }, documents:true } }))));
more.post("/admin/maids/:id/request-docs", ADM, wrap(async (req:any,res:any) => { const m = await prisma.maidProfile.findUniqueOrThrow({ where:{ id:req.params.id } }); await notify(m.userId,"More documents needed",String(req.body.note)); await audit(req.user.id,"REQUEST_DOCS","MaidProfile",m.id); res.json({ ok:true }); }));
more.get("/admin/contracts", ADM, wrap(async (req:any,res:any) => res.json(await prisma.employmentContract.findMany({ where:req.query.status?{ status:req.query.status }:{}, take:100 }))));
more.get("/admin/payments", ADM, wrap(async (_:any,res:any) => res.json({ payments:await prisma.payment.findMany({ take:100, include:{ tx:true } }), commission:(await prisma.payment.aggregate({ where:{ status:"PAID" }, _sum:{ commission:true } }))._sum.commission ?? 0 })));
more.get("/admin/disputes", ADM, wrap(async (_:any,res:any) => res.json(await prisma.dispute.findMany({ include:{ evidence:true }, orderBy:{ createdAt:"desc" } }))));
more.patch("/admin/disputes/:id", ADM, wrap(async (req:any,res:any) => {
  const d = z.object({ status:z.nativeEnum((await import("@prisma/client")).DisputeStatus).optional(), note:z.string().optional(), assignedTo:z.string().optional() }).parse(req.body);
  const u = await prisma.dispute.update({ where:{ id:req.params.id }, data:{ status:d.status, assignedTo:d.assignedTo, ...(d.note?{ notes:{ push:d.note } }:{}) } }); await audit(req.user.id,"DISPUTE_UPDATE","Dispute",u.id,d); res.json(u);
}));
more.get("/admin/reviews/flagged", ADM, wrap(async (_:any,res:any) => res.json(await prisma.review.findMany({ where:{ flagged:true } }))));
more.post("/admin/reviews/:id/moderate", ADM, wrap(async (req:any,res:any) => { req.body.remove ? await prisma.review.delete({ where:{ id:req.params.id } }) : await prisma.review.update({ where:{ id:req.params.id }, data:{ flagged:false } }); await audit(req.user.id,"MODERATE","Review",req.params.id); res.json({ ok:true }); }));
more.get("/admin/support", ADM, wrap(async (_:any,res:any) => res.json(await prisma.supportTicket.findMany({ orderBy:{ id:"desc" } }))));
more.post("/admin/promotions", ADM, wrap(async (req:any,res:any) => res.status(201).json(await prisma.promotion.create({ data:{ title:String(req.body.title), code:req.body.code, discountPct:req.body.discountPct } }))));
more.patch("/admin/promotions/:id", ADM, wrap(async (req:any,res:any) => res.json(await prisma.promotion.update({ where:{ id:req.params.id }, data:{ active:!!req.body.active } }))));
more.get("/admin/analytics", ADM, wrap(async (_:any,res:any) => res.json({
  contractsByStatus:await prisma.employmentContract.groupBy({ by:["status"], _count:true }), requestsByStatus:await prisma.employmentRequest.groupBy({ by:["status"], _count:true }),
  maidsByCity:await prisma.maidProfile.groupBy({ by:["city"], _count:true }), ratings:await prisma.review.groupBy({ by:["rating"], _count:true }), revenue:(await prisma.payment.aggregate({ where:{ status:"PAID" }, _sum:{ commission:true } }))._sum.commission ?? 0 })));
