import React, { useRef } from "react";
import { api } from "./api";
import { Badge, Card, EmptyState, Skeleton, useToast } from "./ui";

export function Avatar({ name = "?", src, size = 40 }: { name?: string; src?: string | null; size?: number }) {
  if (src) return <img src={src} alt={name} style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover" }} />;
  const hue = [...name].reduce((a, c) => a + c.charCodeAt(0), 0) % 360;
  return <div style={{ width: size, height: size, borderRadius: "50%", background: `hsl(${hue} 45% 38%)`, color: "#fff", display: "grid", placeItems: "center", fontWeight: 700, fontSize: size / 2.6 }}>{name.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase()}</div>;
}
export const Stars = ({ v }: { v: number }) => <span style={{ color: "var(--gold)", letterSpacing: 1 }}>{"★".repeat(Math.round(v))}{"☆".repeat(5 - Math.round(v))} <small style={{ color: "var(--muted)" }}>{v ? v.toFixed(1) : "No ratings yet"}</small></span>;
const inr = (n: number) => "₹" + Number(n).toLocaleString("en-IN");
const d = (x: string) => new Date(x).toLocaleDateString("en-IN", { month: "short", year: "numeric" });
const resize = (file: File) => new Promise<string>((ok, no) => {
  const img = new Image(), url = URL.createObjectURL(file);
  img.onload = () => { const c = document.createElement("canvas"); c.width = c.height = 200; const s = Math.min(img.width, img.height);
    c.getContext("2d")!.drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, 200, 200); URL.revokeObjectURL(url); ok(c.toDataURL("image/jpeg", .8)); };
  img.onerror = no; img.src = url;
});
const Sec = ({ title, children }: any) => <Card><b>{title}</b><div style={{ marginTop: 8 }}>{children}</div></Card>;

export function ProfileDrawer({ open, onClose, prof }: any) {
  const toast = useToast(), file = useRef<HTMLInputElement>(null), p = prof.data;
  const upload = async (f?: File) => { if (!f) return; try { await api("/me/avatar", { avatarUrl: await resize(f) }, "PUT"); toast("Photo updated", "success"); prof.reload(); } catch (e: any) { toast(e.message, "error"); } };
  const addAddr = async () => { const line = prompt("Address line"); const city = line && prompt("City"); if (line && city) api("/me/addresses", { line, city }).then(prof.reload).catch(e => toast(e.message, "error")); };
  return <>
    <div className={`scrim ${open ? "open" : ""}`} onClick={onClose} />
    <aside className={`drawer ${open ? "open" : ""}`} aria-hidden={!open}>
      <div className="head"><button className="x" onClick={onClose} aria-label="Close">×</button>
        {!p ? <Skeleton h={90} /> : <>
          <div style={{ display: "grid", placeItems: "center", cursor: "pointer" }} onClick={() => file.current?.click()} title="Change photo"><Avatar name={p.user.name} src={p.user.avatarUrl} size={88} /></div>
          <input ref={file} type="file" accept="image/*" hidden onChange={e => upload(e.target.files?.[0])} />
          <h3 style={{ margin: "10px 0 2px" }}>{p.user.name}</h3>
          <Badge>{p.role === "CLIENT" ? "Client" : "Domestic professional"}</Badge>
          <div style={{ marginTop: 6 }}><Stars v={p.role === "CLIENT" ? p.rating.avg : p.profile.rating} /></div>
          <small style={{ opacity: .8 }}>Tap photo to change</small></>}
      </div>
      <div className="body">
        {prof.error && <p>{prof.error}</p>}
        {p?.role === "CLIENT" && <>
          <div className="grid" style={{ gridTemplateColumns: "1fr 1fr" }}><Card><small>Hired so far</small><h2 style={{ margin: 0 }}>{p.stats.hired}</h2></Card><Card><small>Active now</small><h2 style={{ margin: 0 }}>{p.stats.active}</h2></Card></div>
          <Sec title="Contact"><div className="row"><span>Phone</span><span>{p.user.phone} {p.user.phoneVerified && "✔"}</span></div><div className="row"><span>Email</span><span>{p.user.email ?? "—"}</span></div><div className="row"><span>Member since</span><span>{d(p.user.createdAt)}</span></div></Sec>
          <Sec title="Saved addresses">{p.addresses.map((a: any) => <div className="row" key={a.id}><span>{a.line}</span><small>{a.city}</small></div>)}{!p.addresses.length && <small>No address saved</small>}<br /><button className="btn ghost" onClick={addAddr}>+ Add address</button></Sec>
          <Sec title={`Ratings from maids (${p.rating.count})`}>{p.rating.list.length ? p.rating.list.map((r: any, i: number) => <div className="row" key={i}><span><Stars v={r.rating} /><br /><small>{r.comment ?? ""}</small></span><small>{r.maidName}</small></div>) : <small>No maid has rated you yet</small>}</Sec>
          <Sec title="Current employees">{p.current.length ? p.current.map((c: any) => <div className="row" key={c.id}><span style={{ display: "flex", gap: 8, alignItems: "center" }}><Avatar name={c.maidName} src={c.maidAvatar} size={32} />{c.maidName}</span><span>{inr(c.salary)}</span></div>) : <small>None</small>}</Sec>
          <Sec title="Previous employees">{p.previous.length ? p.previous.map((c: any) => <div className="row" key={c.id}><span style={{ display: "flex", gap: 8, alignItems: "center" }}><Avatar name={c.maidName} src={c.maidAvatar} size={32} /><span>{c.maidName}<br /><small>{d(c.startDate)} – {d(c.endDate)} · {inr(c.salary)}</small></span></span><span>{c.ratedYou ? <>rated you ★{c.ratedYou}</> : <small>not rated</small>}</span></div>) : <EmptyState icon="🧑‍🤝‍🧑" title="No previous employees" />}</Sec></>}
        {p?.role === "MAID" && <>
          <div className="grid" style={{ gridTemplateColumns: "1fr 1fr" }}><Card><small>Expected salary</small><h2 style={{ margin: 0 }}>{inr(p.profile.expectedSalary)}</h2><small>±{p.profile.flexibilityPct}% flexible</small></Card><Card><small>Jobs done</small><h2 style={{ margin: 0 }}>{p.profile.completedJobs}</h2><small>{p.profile.experienceYears} yrs experience</small></Card></div>
          <Sec title="Verification"><Badge tone={p.profile.verification === "VERIFIED" ? "" : "warn"}>{p.profile.verification === "VERIFIED" ? "✔ Verified" : p.profile.verification}</Badge> <small>{p.profile.city} · up to {p.profile.maxTravelKm} km · {p.profile.fullTime ? "Full-time" : "Part-time"}</small></Sec>
          <Sec title="Type of work">{p.profile.skills.map((s: string) => <Badge key={s}>{s}</Badge>)}{!p.profile.skills.length && <small>Add your skills in Profile & documents</small>}<div style={{ marginTop: 6 }}><small>Languages: {p.profile.languages.join(", ") || "—"}</small></div>{p.profile.bio && <p>{p.profile.bio}</p>}</Sec>
          <Sec title="Employers">{p.employers.length ? p.employers.map((e: any) => <div className="row" key={e.id}><span>{e.clientName}<br /><small>{e.clientCity} · {d(e.startDate)} – {d(e.endDate)}</small></span><span style={{ textAlign: "right" }}>{inr(e.salary)}<br /><Badge tone={e.status === "ACTIVE" ? "" : "warn"}>{e.status.replace("_", " ")}</Badge></span></div>) : <small>No employers yet</small>}</Sec>
          <Sec title="Reviews from clients">{p.reviews.length ? p.reviews.map((r: any, i: number) => <div className="row" key={i}><span><Stars v={r.rating} /><br /><small>{r.comment ?? ""}</small></span><small>{d(r.createdAt)}</small></div>) : <small>No reviews yet</small>}</Sec></>}
      </div>
    </aside></>;
}
