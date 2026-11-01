import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

let io: Server | null = null;
export const getIo = () => io;
export function initSockets(server: Server) {
  io = server;
  io.use((s, next) => { try { s.data.user = jwt.verify(String(s.handshake.auth.token), env.jwt); next(); } catch { next(new Error("session expired")); } });
  io.on("connection", s => { s.join(`user:${s.data.user.id}`); });
}