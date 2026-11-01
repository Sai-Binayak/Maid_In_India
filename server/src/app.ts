import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { env } from "./config/env.js";
import { api } from "./routes/index.js";
import { more } from "./routes/more.js";
import { refresh } from "./routes/refresh.js";
import { integrations } from "./routes/integrations.js";
import { settings } from "./routes/settings.js";
import { profile } from "./routes/profile.js";
import { chat } from "./routes/chat.js";
import { mountSwagger } from "./swagger.js";

export const app = express();
app.use(cors({ origin: env.client }), express.json({ limit: "1mb" }), rateLimit({ windowMs: 60_000, limit: 300 }));
app.get("/health", (_, res) => res.json({ ok: true }));
app.use("/api", api, more, refresh, integrations, settings, profile, chat);
mountSwagger(app);
app.use((e: any, _req: any, res: any, _n: any) => {
  if (e.code === "P2002") return res.status(409).json({ error: "An account with this phone number or email already exists. Try logging in." });
  if (e.name === "ZodError") return res.status(400).json({ error: e.issues.map((i: any) => `${i.path.join(".")}: ${i.message}`).join("; ") });
  console.error(e);
  res.status(e.status ?? 500).json({ error: e.message });
});
