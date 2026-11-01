import http from "http";
import { Server } from "socket.io";
import { app } from "./app.js";
import { env } from "./config/env.js";
import { initSockets } from "./sockets/chat.js";
import { prisma } from "./routes/index.js";
import { startReminders } from "./jobs/reminders.js";
const srv = http.createServer(app);
initSockets(new Server(srv, { cors:{ origin:env.client } }));
// Expire stale requests every 10 min (72h rule)
setInterval(async () => {
  const stale = await prisma.employmentRequest.findMany({ where:{ status:{ in:["PENDING","NEGOTIATING"] }, expiresAt:{ lt:new Date() } }, include:{ client:true } });
  for (const r of stale) await prisma.$transaction([ prisma.employmentRequest.update({ where:{ id:r.id }, data:{ status:"EXPIRED" } }), prisma.notification.create({ data:{ userId:r.client.userId, title:"Request expired", body:"The maid did not respond within 72 hours." } }) ]);
}, 600_000).unref();
srv.listen(env.port, () => console.log(`API on :${env.port}`));
startReminders();