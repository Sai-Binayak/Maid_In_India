import React from "react";
import { Tabs } from "../../layouts";
import { api, useApi } from "../../api";
import { Badge, Button, Card, SkeletonGrid } from "../../ui";
import { useAct } from "../shared";

const Stats = () => {
  const s = useApi("/admin/stats"), a = useApi("/admin/analytics");
  if (!s.data) return <SkeletonGrid n={6} />;
  const L: any = { clients: "Clients", maids: "Maids", verified: "Verified maids", pending: "Pending verification", activeContracts: "Active contracts", openDisputes: "Open disputes" };
  return <><div className="grid">{Object.entries(L).map(([k, l]: any) => <Card key={k}><small>{l}</small><h1 style={{ margin: 0 }}>{s.data[k]}</h1></Card>)}
    <Card><small>Platform revenue</small><h1 style={{ margin: 0 }}>₹{a.data?.revenue ?? 0}</h1></Card></div>
    {a.data && <div className="grid" style={{ marginTop: 16 }}>{[["Contracts", a.data.contractsByStatus, "status"], ["Requests", a.data.requestsByStatus, "status"], ["Maids by city", a.data.maidsByCity, "city"], ["Ratings", a.data.ratings, "rating"]].map(([t, rows, k]: any) =>
      <Card key={t}><b>{t}</b>{rows.length ? rows.map((r: any) => <div key={r[k]}>{r[k]}: {r._count}</div>) : <div>No data</div>}</Card>)}</div>}</>;
};
const Verification = () => {
  const { data, reload } = useApi("/admin/verifications"), act = useAct();
  if (!data) return <SkeletonGrid n={2} />;
  return data.length ? <div style={{ display: "grid", gap: 12 }}>{data.map((m: any) => <Card key={m.id}>
    <b>{m.user.name}</b> · {m.city} · {m.experienceYears} yrs<div>{m.documents.map((d: any) => <Badge key={d.id} tone="warn">{d.type}</Badge>)}</div>
    <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
      <Button onClick={() => act(() => api(`/admin/maids/${m.id}/verify`, { approve: true }), "Approved", reload)}>Approve</Button>
      <Button variant="danger" onClick={() => { const r = prompt("Rejection reason"); if (r) act(() => api(`/admin/maids/${m.id}/verify`, { approve: false, reason: r }), "Rejected", reload); }}>Reject</Button>
      <Button variant="ghost" onClick={() => { const n = prompt("What else is needed?"); if (n) act(() => api(`/admin/maids/${m.id}/request-docs`, { note: n }), "Requested"); }}>Request docs</Button></div></Card>)}</div> : <p>Nothing pending 🎉</p>;
};
const Disputes = () => {
  const { data, reload } = useApi("/admin/disputes"), act = useAct();
  if (!data) return <SkeletonGrid n={2} />;
  return data.length ? <div style={{ display: "grid", gap: 12 }}>{data.map((d: any) => <Card key={d.id}>
    <div style={{ display: "flex", justifyContent: "space-between" }}><b>{d.category}</b><Badge tone={d.status === "OPEN" ? "bad" : ""}>{d.status}</Badge></div>
    {d.notes.map((n: string, i: number) => <div key={i} style={{ color: "var(--muted)" }}>• {n}</div>)}
    <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
      <select style={{ width: 180 }} value={d.status} onChange={e => act(() => api(`/admin/disputes/${d.id}`, { status: e.target.value }, "PATCH"), "Status updated", reload)}>{["OPEN", "INVESTIGATING", "MEDIATION", "RESOLVED", "APPEALED", "CLOSED"].map(s => <option key={s}>{s}</option>)}</select>
      <Button variant="ghost" onClick={() => { const n = prompt("Internal note"); if (n) act(() => api(`/admin/disputes/${d.id}`, { note: n }, "PATCH"), "Note added", reload); }}>Add note</Button></div></Card>)}</div> : <p>No disputes.</p>;
};
const Users = () => {
  const { data, reload } = useApi("/admin/users"), act = useAct();
  if (!data) return <SkeletonGrid n={3} />;
  return <div style={{ display: "grid", gap: 8 }}>{data.map((u: any) => <Card key={u.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
    <span><b>{u.name}</b> <Badge>{u.role}</Badge> <Badge tone={u.status === "ACTIVE" ? "" : "bad"}>{u.status}</Badge></span>
    {u.role !== "ADMIN" && <Button variant={u.status === "ACTIVE" ? "danger" : "alt"} onClick={() => { const r = prompt("Documented reason (min 10 characters)"); if (r) act(() => api(`/admin/users/${u.id}/status`, { status: u.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE", reason: r }), "Updated", reload); }}>{u.status === "ACTIVE" ? "Suspend" : "Reactivate"}</Button>}</Card>)}</div>;
};
export default function AdminDashboard() { return <><h2>Admin console</h2><Tabs tabs={[["Overview", <Stats />], ["Verification", <Verification />], ["Disputes", <Disputes />], ["Users", <Users />]]} /></>; }
