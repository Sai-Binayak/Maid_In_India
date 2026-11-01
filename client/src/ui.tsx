// client/src/ui.tsx — reusable components: Button, Card, Badge, Skeleton, EmptyState, Toast, MaidCard
import React, { createContext, useContext, useState, useCallback } from "react";

export const Button = ({ variant = "", ...p }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "" | "alt" | "ghost" | "danger" }) => <button {...p} className={`btn ${variant} ${p.className ?? ""}`} />;
export const Card = (p: React.HTMLAttributes<HTMLDivElement>) => <div {...p} className={`card ${p.className ?? ""}`} />;
export const Badge = ({ tone = "", children }: { tone?: "" | "warn" | "bad"; children: React.ReactNode }) => <span className={`badge ${tone}`}>{children}</span>;
export const Skeleton = ({ h = 16, w = "100%" }: { h?: number; w?: number | string }) => <div className="skeleton" style={{ height: h, width: w }} />;
export const EmptyState = ({ icon = "🏡", title, hint }: { icon?: string; title: string; hint?: string }) => <div className="empty"><div style={{ fontSize: 40 }}>{icon}</div><b>{title}</b><div>{hint}</div></div>;
export const SkeletonGrid = ({ n = 6 }) => <div className="grid">{Array.from({ length: n }, (_, i) => <Card key={i}><Skeleton h={20} w="60%" /><br /><Skeleton /><br /><Skeleton w="40%" /></Card>)}</div>;

type T = { id: number; msg: string; kind: "info" | "error" | "success" };
const ToastCtx = createContext<(msg: string, kind?: T["kind"]) => void>(() => {});
export const useToast = () => useContext(ToastCtx);
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [list, setList] = useState<T[]>([]);
  const push = useCallback((msg: string, kind: T["kind"] = "info") => { const id = Date.now() + Math.random(); setList(l => [...l, { id, msg, kind }]); setTimeout(() => setList(l => l.filter(t => t.id !== id)), 3500); }, []);
  return <ToastCtx.Provider value={push}>{children}<div className="toast-wrap">{list.map(t => <div key={t.id} className={`toast ${t.kind}`}>{t.msg}</div>)}</div></ToastCtx.Provider>;
}

export function MaidCard({ m, onHire, onShortlist }: { m: any; onHire?: (m: any) => void; onShortlist?: (m: any) => void }) {
  const verified = m.verification === "VERIFIED";
  return <Card>
    <div style={{ display: "flex", justifyContent: "space-between" }}><b>{m.user?.name}</b><Badge tone={verified ? "" : "warn"}>{verified ? "✔ Verified" : "Pending verification"}</Badge></div>
    <div style={{ color: "var(--muted)" }}>{m.city} · {m.distanceKm} km · {m.experienceYears} yrs</div>
    <div style={{ margin: "8px 0" }}>{m.skills?.map((s: any) => <Badge key={s.categoryId}>{s.category.name}</Badge>)}</div>
    <div>{(m.languages ?? []).map((l: any) => l.name).join(", ")}</div>
    <div><b>₹{m.expectedSalary}</b>/month · ★ {Number(m.rating).toFixed(1)} · {m.completedJobs} jobs</div>
    <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
      <Button onClick={() => onHire?.(m)}>Hire now</Button><Button variant="ghost" onClick={() => onShortlist?.(m)}>Shortlist</Button>
    </div>
  </Card>;
}
// Usage: wrap app in <ToastProvider>; const toast = useToast(); toast("Request sent", "success");
