// server/src/routes/refresh.ts — refresh-token ROTATION with reuse detection (needs 4-schema-additions.prisma)
// 1) app.ts:  import { refresh } from "./routes/refresh.js";   app.use("/api", api, more, refresh);
// 2) routes/index.ts: import { issueRefresh } from "./refresh.js";
//    in /auth/register AND /auth/login replace  refresh:signRefresh(user)  /  refresh:signRefresh(u)
//    with  refresh:await issueRefresh(user)  /  refresh:await issueRefresh(u)
import { Router } from "express";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import { prisma } from "./index.js";
import { env } from "../config/env.js";
import { sign } from "../middleware/auth.js";

export const refresh = Router();
const hash = (t: string) => crypto.createHash("sha256").update(t).digest("hex");

export async function issueRefresh(user: { id: string; role: string }, family: string = crypto.randomUUID()) {
  const token = jwt.sign({ id: user.id, role: user.role, family, jti: crypto.randomUUID() }, env.jwt + "-r", { expiresIn: "30d" });
  await prisma.refreshToken.create({ data: { userId: user.id, family, tokenHash: hash(token), expiresAt: new Date(Date.now() + 30 * 864e5) } });
  return token;
}

refresh.post("/auth/refresh", async (req, res) => {
  try {
    const old = String(req.body.refresh);
    jwt.verify(old, env.jwt + "-r");
    const row = await prisma.refreshToken.findUnique({ where: { tokenHash: hash(old) } });
    if (!row || row.expiresAt < new Date()) return res.status(401).json({ error: "Invalid refresh token" });
    if (row.revokedAt) { // token reuse => assume theft, kill the whole family
      await prisma.refreshToken.updateMany({ where: { family: row.family, revokedAt: null }, data: { revokedAt: new Date() } });
      return res.status(401).json({ error: "Refresh token reuse detected. Please log in again." });
    }
    const user = await prisma.user.findUnique({ where: { id: row.userId } });
    if (!user || user.status !== "ACTIVE") return res.status(401).json({ error: "Account unavailable" });
    await prisma.refreshToken.update({ where: { id: row.id }, data: { revokedAt: new Date() } });
    res.json({ token: sign(user), refresh: await issueRefresh(user, row.family) });
  } catch { res.status(401).json({ error: "Invalid refresh token" }); }
});

refresh.post("/auth/logout", async (req, res) => {
  const row = await prisma.refreshToken.findUnique({ where: { tokenHash: hash(String(req.body.refresh)) } });
  if (row) await prisma.refreshToken.updateMany({ where: { family: row.family }, data: { revokedAt: new Date() } });
  res.json({ ok: true });
});
