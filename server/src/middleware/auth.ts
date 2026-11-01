import jwt from "jsonwebtoken";
import type { Request, Response, NextFunction } from "express";
import { env } from "../config/env.js";
export const sign = (u:{id:string;role:string}) => jwt.sign({ id:u.id, role:u.role }, env.jwt, { expiresIn: "15m" });
export const signRefresh = (u:{id:string;role:string}) => jwt.sign({ id:u.id, role:u.role }, env.jwt+"-r", { expiresIn: "30d" });
export function auth(...roles:string[]) {
  return (req:Request & {user?:any}, res:Response, next:NextFunction) => {
    try {
      const u:any = jwt.verify((req.headers.authorization??"").replace("Bearer ",""), env.jwt);
      if (roles.length && !roles.includes(u.role)) return res.status(403).json({ error:"Forbidden" });
      req.user = u; next();
    } catch { res.status(401).json({ error:"Unauthorized" }); }
  };
}
