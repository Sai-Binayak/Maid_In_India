import React, { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import { api, useApi } from "../api";
import { Badge, Button, Card, EmptyState, SkeletonGrid, useToast } from "../ui";

const tone = (s: string): "" | "warn" | "bad" => ["ACTIVE", "PAID", "ACCEPTED", "PRESENT", "COMPLETED"].includes(s) ? "" : ["REJECTED", "EXPIRED", "TERMINATED", "DISPUTED", "FAILED"].includes(s) ? "bad" : "warn";
export const inr = (n: number) => "₹" + Number(n).toLocaleString("en-IN");
const day = (d: string) => new Date(d).toLocaleDateString("en-IN");
export function useAct() { const toast = useToast(); return async (fn: () => Promise<any>, ok: string, done?: () => void) => { try { await fn(); toast(ok, "success"); done?.(); } catch (e: any) { toast(e.message, "error"); } }; }
const Wait = ({ d, e, empty }: any) => e ? <p>{e}</p> : !d ? <SkeletonGrid n={3} /> : !d.length ? empty : null;

export function Chat({ chatId }: any) {
  const [msgs, setMsgs] = useState<any[]>([]), [text, setText] = useState(""), [status, setStatus] = useState("Connecting…"), [err, setErr] = useState(""), [loaded, setLoaded] = useState(false);
  const end = useRef<HTMLDivElement>(null), me = JSON.parse(localStorage.getItem("user") ?? "{}").id;
  const merge = (list: any[]) => setMsgs(prev => { const m = new Map(prev.map(x => [x.id, x])); list.forEach(x => m.set(x.id, x)); return [...m.values()].sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt)); });
  const load = () => api(`/chats/${chatId}/messages`).then(l => { merge(l); setLoaded(true); setErr(""); }).catch(e => setErr(e.message));
  useEffect(() => {
    load(); const poll = setInterval(load, 3000); // fallback: works even if live updates are blocked
    const s = io({ auth: { token: localStorage.getItem("tok") } });
    s.on("connect", () => setStatus("● Live")); s.on("disconnect", () => setStatus("Reconnecting…"));
    s.on("connect_error", e => setStatus(`Live updates off (${e.message}). Checking every 3s.`));
    s.on("message", (m: any) => { if (m.chatId === chatId) merge([m]); });
    return () => { clearInterval(poll); s.disconnect(); };
  }, [chatId]);
  useEffect(() => { end.current?.scrollIntoView({ block: "nearest" }); }, [msgs.length]);
  const send = async () => { const body = text.trim(); if (!body) return; setText(""); try { merge([await api(`/chats/${chatId}/messages`, { body })]); setErr(""); } catch (e: any) { setErr(e.message); setText(body); } };
  return <Card style={{ background: "var(--cream)", marginTop: 8 }}>
    <small style={{ color: "var(--muted)" }}>{status}</small>
    <div style={{ minHeight: 80, maxHeight: 260, overflow: "auto", margin: "6px 0" }}>
      {!loaded && !err && <small>Loading messages…</small>}
      {loaded && !msgs.length && <small>No messages yet. Say hello 👋</small>}
      {msgs.map(m => <div key={m.id} style={{ textAlign: m.senderId === me ? "right" : "left", margin: 4 }}>
        <span style={{ display: "inline-block", maxWidth: "80%", padding: "6px 12px", borderRadius: 14, background: m.senderId === me ? "var(--primary)" : "#fff", color: m.senderId === me ? "#fff" : "inherit", boxShadow: "var(--shadow)", textAlign: "left" }}>{m.body}</span>
        <div><small style={{ color: "var(--muted)" }}>{new Date(m.createdAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</small></div></div>)}
      <div ref={end} />
    </div>
    {err && <div style={{ color: "var(--danger)" }}>{err}</div>}
    <div style={{ display: "flex", gap: 8 }}><input value={text} onChange={e => setText(e.target.value)} onKeyDown={e => e.key === "Enter" && send()} placeholder="Type a message" /><Button onClick={send}>Send</Button></div>
  </Card>;
}

export function RequestsTab({ role }: any) {
  const { data, error, reload } = useApi("/requests"), act = useAct(), toast = useToast();
  const [chat, setChat] = useState<{ req: string; id: string } | null>(null), [offer, setOffer] = useState<any>({});
  const w = Wait({ d: data, e: error, empty: <EmptyState title="No requests yet" hint={role === "CLIENT" ? "Find a maid and send an employment request." : "New requests will appear here."} /> });
  if (w) return w;
  return <div style={{ display: "grid", gap: 12 }}>{data.map((r: any) => {
    const open = ["PENDING", "NEGOTIATING"].includes(r.status), neg = [...r.negotiations].sort((a: any, b: any) => +new Date(a.createdAt) - +new Date(b.createdAt)), last = neg[neg.length - 1];
    const who = role === "CLIENT" ? r.maid.user.name : r.client.user.name, hrs = Math.max(0, Math.round((+new Date(r.expiresAt) - Date.now()) / 36e5));
    return <Card key={r.id}>
      <div style={{ display: "flex", justifyContent: "space-between" }}><b>{who}</b><Badge tone={tone(r.status)}>{r.status}</Badge></div>
      <div>{r.services.join(", ")} · {r.days.length} days/week · from {day(r.startDate)} · {r.durationMonths} mo</div>
      <div><b>Current offer: {inr(r.offeredSalary)}</b> ({r.payFrequency.toLowerCase()}){open && <> · expires in {hrs}h</>}</div>
      {neg.map((n: any) => <div key={n.id} style={{ color: "var(--muted)" }}>{n.fromRole === role ? "You" : "They"} offered {inr(n.amount)}{n.accepted ? " ✔ agreed" : ""}</div>)}
      {open && <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
        <input style={{ width: 130 }} type="number" placeholder="Counter ₹" value={offer[r.id] ?? ""} onChange={e => setOffer({ ...offer, [r.id]: e.target.value })} />
        <Button variant="alt" onClick={() => act(() => api(`/requests/${r.id}/negotiate`, { amount: +offer[r.id] }), "Offer sent", reload)}>Counteroffer</Button>
        {last && last.fromRole !== role && !last.accepted && <Button onClick={() => act(() => api(`/requests/${r.id}/negotiate/accept`, {}), "Offer accepted", reload)}>Accept {inr(last.amount)}</Button>}
        {role === "MAID" && <><Button onClick={() => act(() => api(`/requests/${r.id}/respond`, { action: "ACCEPT" }), "Request accepted. Contract created.", reload)}>Accept job</Button>
          <Button variant="danger" onClick={() => act(() => api(`/requests/${r.id}/respond`, { action: "REJECT" }), "Request rejected", reload)}>Reject</Button></>}
      </div>}
      <div style={{ marginTop: 8 }}><Button variant="ghost" onClick={async () => { if (chat?.req === r.id) return setChat(null); try { setChat({ req: r.id, id: (await api("/chats", { requestId: r.id })).id }); } catch (e: any) { toast(e.message, "error"); } }}>💬 Chat</Button></div>
      {chat?.req === r.id && <Chat key={chat.id} chatId={chat.id} />}
    </Card>; })}</div>;
}

export function ContractsTab({ role }: any) {
  const { data, error, reload } = useApi("/contracts"), act = useAct(), [geo, setGeo] = useState(false);
  const w = Wait({ d: data, e: error, empty: <EmptyState icon="📄" title="No contracts yet" hint="A contract appears once a maid accepts your request." /> });
  if (w) return w;
  return <div style={{ display: "grid", gap: 12 }}>{data.map((c: any) => {
    const mine = role === "CLIENT" ? c.clientAcceptedAt : c.maidAcceptedAt, ended = ["COMPLETED", "TERMINATED"].includes(c.status);
    return <Card key={c.id}>
      <div style={{ display: "flex", justifyContent: "space-between" }}><b>Contract #{c.id.slice(-6)} · rev {c.revision}</b><Badge tone={tone(c.status)}>{c.status.replace("_", " ")}</Badge></div>
      <div>{inr(c.salary)} {c.payFrequency.toLowerCase()} · {day(c.startDate)} → {day(c.endDate)} · notice {c.noticeDays}d · {c.paidLeaveDays} paid leave days</div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "8px 0" }}>
        {c.status === "PENDING_SIGNATURE" && !mine && <Button onClick={() => act(() => api(`/contracts/${c.id}/sign`, {}), "Signed", reload)}>Sign agreement</Button>}
        {c.status === "PENDING_SIGNATURE" && mine && <Badge tone="warn">Waiting for the other party</Badge>}
        {c.status === "ACTIVE" && <>
          <Button variant="alt" onClick={() => { const s = prompt("Propose new monthly salary (₹)"); if (s) act(() => api(`/contracts/${c.id}/amend`, { salary: +s }), "Change proposed", reload); }}>Propose change</Button>
          <Button variant="danger" onClick={() => confirm(`Terminate? ${c.noticeDays}-day notice applies.`) && act(() => api(`/contracts/${c.id}/terminate`, {}), "Terminated", reload)}>Terminate</Button>
          {role === "CLIENT" && <Button variant="ghost" onClick={() => act(() => api(`/contracts/${c.id}/complete`, {}), "Marked completed", reload)}>Mark completed</Button>}
          {role === "MAID" && <>
            <label><input type="checkbox" style={{ width: "auto" }} checked={geo} onChange={e => setGeo(e.target.checked)} /> Share location (optional)</label>
            <Button onClick={() => act(() => api(`/attendance/${c.id}/check-in`, { geoConsent: geo }), "Checked in. Client notified.", reload)}>Check in today</Button>
            <Button variant="ghost" onClick={() => { const d = prompt("Leave date (YYYY-MM-DD)"); if (d) act(() => api("/leave", { contractId: c.id, date: d, paid: confirm("Paid leave? (OK = paid, Cancel = unpaid)") }), "Leave requested", reload); }}>Request leave</Button></>}
        </>}
        {role === "MAID" && ended && <Button variant="alt" onClick={() => { const r = prompt("Rate this client 1-5"); if (r) act(() => api("/client-ratings", { contractId: c.id, rating: +r, comment: prompt("Comment (optional)") ?? undefined }), "Client rated", reload); }}>Rate client</Button>}
        {role === "CLIENT" && ended && <Button onClick={() => { const r = prompt("Rating 1-5"); if (r) act(() => api("/reviews", { contractId: c.id, rating: +r, comment: prompt("Comment (optional)") ?? undefined }), "Review posted", reload); }}>Leave review</Button>}
      </div>
      {c.attendance.length > 0 && <><b>Recent attendance</b>{c.attendance.map((a: any) => <div key={a.id} style={{ display: "flex", gap: 8, alignItems: "center" }}>
        {day(a.date)} <Badge tone={tone(a.status)}>{a.status}</Badge>{a.verifiedAt && "✔ verified"}
        {role === "CLIENT" && a.status === "PENDING" && <><Button onClick={() => act(() => api(`/attendance/${a.id}/verify`, { status: "PRESENT" }), "Verified", reload)}>Confirm</Button> <Button variant="danger" onClick={() => act(() => api(`/attendance/${a.id}/verify`, { status: "DISPUTED" }), "Marked disputed", reload)}>Dispute</Button></>}
      </div>)}</>}
    </Card>; })}</div>;
}

export function PaymentsTab({ role }: any) {
  const { data, error, reload } = useApi("/payments"), cs = useApi(role === "CLIENT" ? "/contracts" : null), act = useAct();
  const [sel, setSel] = useState(""), [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const paid = (data ?? []).filter((p: any) => p.status === "PAID").reduce((s: number, p: any) => s + p.net, 0), pend = (data ?? []).filter((p: any) => p.status === "PENDING").reduce((s: number, p: any) => s + p.net, 0);
  return <div style={{ display: "grid", gap: 12 }}>
    <div className="grid"><Card><small>{role === "MAID" ? "Total earned" : "Total paid"}</small><h2>{inr(paid)}</h2></Card><Card><small>Pending</small><h2>{inr(pend)}</h2></Card></div>
    {role === "CLIENT" && <Card><b>Generate salary slip</b><div style={{ display: "flex", gap: 8, marginTop: 8 }}>
      <select value={sel} onChange={e => setSel(e.target.value)}><option value="">Select contract</option>{(cs.data ?? []).filter((c: any) => c.status === "ACTIVE").map((c: any) => <option key={c.id} value={c.id}>#{c.id.slice(-6)} · {inr(c.salary)}</option>)}</select>
      <input type="month" value={month} onChange={e => setMonth(e.target.value)} />
      <Button disabled={!sel} onClick={() => act(() => api("/payments/generate", { contractId: sel, month }), "Slip generated", reload)}>Generate</Button></div></Card>}
    {Wait({ d: data, e: error, empty: <EmptyState icon="💸" title="No payments yet" /> }) ?? data.map((p: any) => <Card key={p.id}>
      <div style={{ display: "flex", justifyContent: "space-between" }}><b>{day(p.periodStart)} – {day(p.periodEnd)}</b><Badge tone={tone(p.status)}>{p.status}</Badge></div>
      <div>Gross {inr(p.gross)}</div>{(p.deductions ?? []).map((d: any, i: number) => <div key={i} style={{ color: "var(--muted)" }}>− {inr(d.amount)} · {d.reason}</div>)}
      <div><b>Net {inr(p.net)}</b> · platform fee {inr(p.commission)}</div>
      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
        {role === "CLIENT" && p.status === "PENDING" && <Button onClick={() => act(() => api(`/payments/${p.id}/pay`, {}), "Paid (demo gateway)", reload)}>Pay now</Button>}
        {p.status !== "DISPUTED" && <Button variant="ghost" onClick={() => { const r = prompt("Why are you disputing this payment?"); if (r) act(() => api(`/payments/${p.id}/dispute`, { reason: r }), "Dispute opened", reload); }}>Dispute</Button>}
      </div></Card>)}
  </div>;
}

export function NotificationsTab() {
  const { data, error, reload } = useApi("/notifications");
  const w = Wait({ d: data, e: error, empty: <EmptyState icon="🔔" title="You're all caught up" /> });
  return w ?? <div style={{ display: "grid", gap: 8 }}>{data.map((n: any) => <Card key={n.id} style={{ opacity: n.read ? .6 : 1 }}>
    <b>{n.title}</b> <small>{new Date(n.createdAt).toLocaleString("en-IN")}</small><div>{n.body}</div>
    {!n.read && <Button variant="ghost" onClick={() => api(`/notifications/${n.id}/read`, {}).then(reload)}>Mark read</Button>}</Card>)}</div>;
}
