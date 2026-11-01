import { Router } from "express";
import { z } from "zod";
import { prisma } from "./index.js";
import { auth } from "../middleware/auth.js";
import { getIo } from "../sockets/chat.js";

export const chat = Router();
chat.post("/chats/:id/messages", auth("CLIENT", "MAID"), async (req: any, res: any, next: any) => {
  try {
    const { body } = z.object({ body: z.string().trim().min(1).max(2000) }).parse(req.body);
    const c = await prisma.chat.findFirst({ where: { id: req.params.id, members: { some: { id: req.user.id } } }, include: { members: true } });
    if (!c) return res.status(403).json({ error: "Forbidden" });
    const m = await prisma.message.create({ data: { chatId: c.id, senderId: req.user.id, body } });
    await prisma.notification.createMany({ data: c.members.filter(u => u.id !== req.user.id).map(u => ({ userId: u.id, title: "New message", body: body.slice(0, 80) })) });
    c.members.forEach(u => getIo()?.to(`user:${u.id}`).emit("message", m));
    res.status(201).json(m);
  } catch (e) { next(e); }
});
