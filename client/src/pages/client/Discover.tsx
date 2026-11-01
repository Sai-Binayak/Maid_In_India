import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, session } from "../../api";
import { Layout } from "../../layouts";
import { Button, Card, EmptyState, MaidCard, SkeletonGrid, useToast } from "../../ui";
import MapView from "../../MapView";
import { t } from "../../i18n";
import { CITIES } from "../Login";

const SERVICES = ["House Cleaning", "Cooking", "Babysitting", "Elderly Care", "Laundry", "Housekeeping"], DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const mins = (s: string) => { const [h, m] = s.split(":").map(Number); return h * 60 + m; };

function Hire({ m, onClose }: any) {
  const toast = useToast(), [f, setF] = useState<any>({ salary: m.expectedSalary, start: "", months: 3, days: [1, 2, 3, 4, 5], from: "09:00", to: "11:00", freq: "MONTHLY", notes: "" });
  const set = (k: string) => (e: any) => setF({ ...f, [k]: e.target.value });
  const submit = async () => {
    try {
      await api("/requests", { maidId: m.id, services: m.skills.map((s: any) => s.category.name), startDate: f.start, durationMonths: +f.months, days: f.days, startMin: mins(f.from), endMin: mins(f.to), offeredSalary: +f.salary, payFrequency: f.freq, notes: f.notes || undefined });
      toast("Request sent. The maid has 72 hours to reply.", "success"); onClose();
    } catch (e: any) { toast(e.message, "error"); }
  };
  return <div style={{ position: "fixed", inset: 0, background: "#0006", display: "grid", placeItems: "center", zIndex: 40, overflow: "auto" }}>
    <Card style={{ width: "min(520px,94vw)" }}>
      <h3>Employment request to {m.user.name}</h3>
      <label>Monthly/weekly offer (₹)<input type="number" value={f.salary} onChange={set("salary")} /></label>
      <label>Payment<select value={f.freq} onChange={set("freq")}><option value="MONTHLY">Monthly</option><option value="WEEKLY">Weekly</option></select></label>
      <label>Start date<input type="date" value={f.start} onChange={set("start")} /></label>
      <label>Duration (months)<input type="number" min={1} value={f.months} onChange={set("months")} /></label>
      <div style={{ display: "flex", gap: 8 }}><label>From<input type="time" value={f.from} onChange={set("from")} /></label><label>To<input type="time" value={f.to} onChange={set("to")} /></label></div>
      <div style={{ margin: "8px 0" }}>{DAYS.map((d, i) => <label key={d} style={{ marginRight: 8 }}><input type="checkbox" style={{ width: "auto" }} checked={f.days.includes(i)} onChange={() => setF({ ...f, days: f.days.includes(i) ? f.days.filter((x: number) => x !== i) : [...f.days, i] })} /> {d}</label>)}</div>
      <textarea placeholder="Additional requirements" value={f.notes} onChange={set("notes")} />
      <p style={{ background: "var(--cream)", padding: 8, borderRadius: 10 }}><b>Summary:</b> ₹{f.salary} {f.freq.toLowerCase()} · {f.days.length} days/week · {f.from}–{f.to} · {f.months} months from {f.start || "—"}</p>
      <div style={{ display: "flex", gap: 8 }}><Button disabled={!f.start || !f.days.length} onClick={submit}>Send request</Button><Button variant="ghost" onClick={onClose}>Cancel</Button></div>
    </Card></div>;
}

export default function Discover() {
  const nav = useNavigate(), toast = useToast();
  const [rows, setRows] = useState<any[] | null>(null), [map, setMap] = useState(false), [hire, setHire] = useState<any>(null);
  const [q, setQ] = useState({ city: "Bhubaneswar", skill: "", budget: "9000", sort: "recommended", verified: false });
  useEffect(() => {
    setRows(null); const [lat, lng] = CITIES[q.city];
    api(`/maids?lat=${lat}&lng=${lng}&budget=${q.budget}&sort=${q.sort}&skills=${q.skill}${q.verified ? "&verified=true" : ""}`).then(d => setRows(d.data)).catch(e => toast(e.message, "error"));
  }, [q]);
  const startHire = (m: any) => session()?.role === "CLIENT" ? setHire(m) : (toast("Please log in as a client to hire", "info"), nav("/login"));
  const set = (k: string) => (e: any) => setQ({ ...q, [k]: e.target.value });
  return <Layout>
    <div className="card" style={{ background: "var(--cream)", marginBottom: 16 }}><h1 style={{ margin: 0 }}>{t("title")}</h1><p>Compare verified domestic workers near you and hire with a clear, written agreement.</p></div>
    <div className="layout">
      <Card style={{ alignSelf: "start", display: "grid", gap: 8 }}>
        <b>Filters</b>
        <select value={q.city} onChange={set("city")}>{Object.keys(CITIES).map(c => <option key={c}>{c}</option>)}</select>
        <select value={q.skill} onChange={set("skill")}><option value="">All services</option>{SERVICES.map(s => <option key={s}>{s}</option>)}</select>
        <label>Budget ₹{q.budget}<input type="range" min={4000} max={20000} step={500} value={q.budget} onChange={set("budget")} /></label>
        <select value={q.sort} onChange={set("sort")}>{[["recommended", "Recommended"], ["nearest", "Nearest first"], ["rated", "Highest rated"], ["cheapest", "Lowest salary"], ["experienced", "Most experienced"]].map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
        <label><input type="checkbox" style={{ width: "auto" }} checked={q.verified} onChange={e => setQ({ ...q, verified: e.target.checked })} /> Verified only</label>
        <Button variant="ghost" onClick={() => setMap(!map)}>{map ? "Hide map" : "Show map"}</Button>
      </Card>
      <div>
        {map && rows && <div style={{ marginBottom: 16 }}><MapView key={q.city} center={CITIES[q.city]} maids={rows.map(m => ({ ...m, lat: +m.lat.toFixed(2), lng: +m.lng.toFixed(2) }))} /></div>}
        {!rows ? <SkeletonGrid /> : !rows.length ? <EmptyState title="No maids match" hint="Try a higher budget or fewer filters." /> : <div className="grid">{rows.map(m => <MaidCard key={m.id} m={m} onHire={startHire} onShortlist={() => toast("Shortlisted (saved on this device)", "success")} />)}</div>}
      </div>
    </div>
    {hire && <Hire m={hire} onClose={() => setHire(null)} />}
  </Layout>;
}
