// server/src/routes/integrations.ts — real OTP (Twilio), email (Nodemailer), Cloudinary signed uploads, Razorpay orders. Demo fallback when env vars are absent.
// Mount in app.ts:  import { integrations } from "./routes/integrations.js";  app.use("/api", api, more, integrations);
// Optional deps:  npm i nodemailer   (email only).  Env: TWILIO_SID TWILIO_TOKEN TWILIO_FROM | SMTP_URL | CLOUDINARY_CLOUD_NAME CLOUDINARY_API_KEY CLOUDINARY_API_SECRET | RAZORPAY_KEY_ID RAZORPAY_KEY_SECRET RAZORPAY_WEBHOOK_SECRET
import { Router } from "express";
import crypto from "crypto";
import { prisma } from "./index.js";
import { auth } from "../middleware/auth.js";

export const integrations = Router();
const wrap = (f: any) => (req: any, res: any, next: any) => Promise.resolve(f(req, res)).catch(next);
const fail = (m: string, status: number) => Object.assign(new Error(m), { status });
const E = process.env;

// ---------- OTP (in-memory store: use Redis if you run >1 server instance) ----------
const otps = new Map<string, { code: string; exp: number; tries: number }>();
export async function sendOtp(phone: string) {
  const live = !!E.TWILIO_SID;
  const code = live ? String(crypto.randomInt(100000, 1000000)) : "123456";
  otps.set(phone, { code, exp: Date.now() + 5 * 60e3, tries: 0 });
  if (!live) return { demo: true };
  const to = /^\d{10}$/.test(phone) ? "+91" + phone : phone;
  const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${E.TWILIO_SID}/Messages.json`, { method: "POST",
    headers: { Authorization: "Basic " + Buffer.from(`${E.TWILIO_SID}:${E.TWILIO_TOKEN}`).toString("base64"), "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ To: to, From: E.TWILIO_FROM!, Body: `Your Maid In India code is ${code}. Valid 5 minutes.` }) });
  if (!r.ok) throw fail("Could not send SMS", 502);
  return { demo: false };
}
export function checkOtp(phone: string, code: string) {
  const o = otps.get(phone);
  if (!o || o.exp < Date.now() || ++o.tries > 5) { otps.delete(phone); return false; }
  if (o.code !== code) return false;
  otps.delete(phone); return true;
}

// ---------- Email ----------
export async function sendEmail(to: string, subject: string, html: string) {
  if (!E.SMTP_URL) { console.log(`[demo email] to=${to} subject=${subject}`); return { demo: true }; }
  const nodemailer: any = await import("nodemailer");
  await nodemailer.createTransport(E.SMTP_URL).sendMail({ from: E.MAIL_FROM ?? "no-reply@maidinindia.demo", to, subject, html });
  return { demo: false };
}

// ---------- Cloudinary: client uploads directly with a server-signed request; documents are type=authenticated (never public) ----------
export function signUpload(folder: string) {
  const { CLOUDINARY_CLOUD_NAME: cloud, CLOUDINARY_API_KEY: key, CLOUDINARY_API_SECRET: secret } = E;
  if (!cloud || !key || !secret) return { demo: true, privateRef: `demo/${folder}/${crypto.randomUUID()}` };
  const timestamp = Math.floor(Date.now() / 1000), type = "authenticated";
  const signature = crypto.createHash("sha1").update(`folder=${folder}&timestamp=${timestamp}&type=${type}${secret}`).digest("hex");
  return { demo: false, url: `https://api.cloudinary.com/v1_1/${cloud}/auto/upload`, fields: { api_key: key, timestamp, signature, folder, type } };
}

// ---------- Razorpay ----------
const rzpAuth = () => "Basic " + Buffer.from(`${E.RAZORPAY_KEY_ID}:${E.RAZORPAY_KEY_SECRET}`).toString("base64");
const hmac = (secret: string, data: string | Buffer) => crypto.createHmac("sha256", secret).update(data).digest("hex");
const same = (a: string, b: string) => a.length === b.length && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));

integrations.post("/auth/otp/send", wrap(async (req: any, res: any) => res.json(await sendOtp(String(req.body.phone)))));
integrations.post("/auth/otp/verify", wrap(async (req: any, res: any) => {
  if (!checkOtp(String(req.body.phone), String(req.body.code))) throw fail("Invalid or expired code", 400);
  await prisma.user.update({ where: { phone: String(req.body.phone) }, data: { phoneVerified: true } });
  res.json({ verified: true });
}));
integrations.post("/uploads/sign", auth("MAID", "CLIENT"), wrap(async (req: any, res: any) => res.json(signUpload(`private/${req.user.id}`))));

integrations.post("/payments/:id/order", auth("CLIENT"), wrap(async (req: any, res: any) => {
  const p = await prisma.payment.findUniqueOrThrow({ where: { id: req.params.id }, include: { contract: { include: { client: true } } } });
  if (p.contract.client.userId !== req.user.id) throw fail("Forbidden", 403);
  if (!E.RAZORPAY_KEY_ID) return res.json({ demo: true, hint: "No Razorpay keys: use POST /payments/:id/pay" });
  const r = await fetch("https://api.razorpay.com/v1/orders", { method: "POST", headers: { Authorization: rzpAuth(), "Content-Type": "application/json" },
    body: JSON.stringify({ amount: p.net * 100, currency: "INR", receipt: p.id.slice(0, 40) }) });
  if (!r.ok) throw fail("Razorpay order failed", 502);
  const o: any = await r.json();
  await prisma.paymentTransaction.create({ data: { paymentId: p.id, gatewayRef: o.id, status: "PENDING" } });
  res.json({ orderId: o.id, amount: o.amount, keyId: E.RAZORPAY_KEY_ID });
}));
// Called by checkout success handler: verifies signature server-side before marking paid
integrations.post("/payments/verify", auth("CLIENT"), wrap(async (req: any, res: any) => {
  const { orderId, paymentId, signature } = req.body;
  if (!E.RAZORPAY_KEY_SECRET || !same(hmac(E.RAZORPAY_KEY_SECRET, `${orderId}|${paymentId}`), String(signature))) throw fail("Bad signature", 400);
  const tx = await prisma.paymentTransaction.findFirstOrThrow({ where: { gatewayRef: orderId } });
  await prisma.$transaction([ prisma.paymentTransaction.update({ where: { id: tx.id }, data: { status: "PAID" } }), prisma.payment.update({ where: { id: tx.paymentId }, data: { status: "PAID" } }) ]);
  res.json({ paid: true });
}));
// Webhook: in app.ts register BEFORE express.json():  app.post("/api/webhooks/razorpay", express.raw({ type: "*/*" }), razorpayWebhook)
export const razorpayWebhook = async (req: any, res: any) => {
  const sig = String(req.headers["x-razorpay-signature"] ?? "");
  if (!E.RAZORPAY_WEBHOOK_SECRET || !same(hmac(E.RAZORPAY_WEBHOOK_SECRET, req.body), sig)) return res.status(400).end();
  const ev = JSON.parse(req.body.toString());
  if (ev.event === "payment.failed") await prisma.paymentTransaction.updateMany({ where: { gatewayRef: ev.payload.payment.entity.order_id }, data: { status: "FAILED" } });
  res.json({ ok: true });
};
