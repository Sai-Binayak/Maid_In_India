import React, { useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { api } from "../api";
import { Layout } from "../layouts";
import { Button, Card, useToast } from "../ui";

export const CITIES: any = { Bhubaneswar: [20.2961, 85.8245], Mumbai: [19.076, 72.8777], Delhi: [28.6139, 77.209], Bengaluru: [12.9716, 77.5946], Kolkata: [22.5726, 88.3639] };
const ROLES: any = { CLIENT: ["👤", "Client", "client@maidinindia.demo"], MAID: ["🧹", "Maid", "maid@maidinindia.demo"], ADMIN: ["🛠️", "Admin", "admin@maidinindia.demo"] };

async function finish(nav: any, identifier: string, password: string, expect?: string) {
  const d = await api("/auth/login", { identifier, password });
  if (expect && d.user.role !== expect) throw new Error(`This is a ${d.user.role.toLowerCase()} account. Use the ${d.user.role.toLowerCase()} login.`);
  localStorage.setItem("tok", d.token); localStorage.setItem("refresh", d.refresh); localStorage.setItem("user", JSON.stringify(d.user));
  nav(d.user.role === "CLIENT" ? "/find" : "/" + d.user.role.toLowerCase());
}
export function Login() {
  const nav = useNavigate(), toast = useToast(), [q, setQ] = useSearchParams(), as = ROLES[q.get("as") ?? ""] ? q.get("as")! : "CLIENT";
  const [id, setId] = useState(""), [pw, setPw] = useState("");
  return <Layout><div style={{ maxWidth: 440, margin: "0 auto" }}>
    <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>{Object.entries(ROLES).map(([k, v]: any) => <button key={k} className={`btn ${k === as ? "" : "ghost"}`} style={{ flex: 1 }} onClick={() => setQ({ as: k })}>{v[0]} {v[1]}</button>)}</div>
    <Card>
      <h2>{ROLES[as][1]} login</h2>
      <input placeholder="Email or phone" value={id} onChange={e => setId(e.target.value)} /><br /><br />
      <input type="password" placeholder="Password" value={pw} onChange={e => setPw(e.target.value)} onKeyDown={e => e.key === "Enter" && finish(nav, id, pw, as).catch(x => toast(x.message, "error"))} /><br /><br />
      <Button onClick={() => finish(nav, id, pw, as).catch(e => toast(e.message, "error"))}>Login</Button>{" "}
      <Button variant="ghost" onClick={() => { setId(ROLES[as][2]); setPw("Demo@12345"); }}>Fill demo</Button>
      {as !== "ADMIN" && <p>New here? <Link to={`/register?role=${as}`}>Create an account</Link></p>}
    </Card></div></Layout>;
}
export function Register() {
  const [q] = useSearchParams(), role = q.get("role") === "MAID" ? "MAID" : "CLIENT", nav = useNavigate(), toast = useToast();
  const [f, setF] = useState({ name: "", phone: "", password: "", city: "Bhubaneswar", expectedSalary: "7000" });
  const set = (k: string) => (e: any) => setF({ ...f, [k]: e.target.value });
  const go = async () => {
    try {
      const [lat, lng] = CITIES[f.city];
      await api("/auth/register", { role, name: f.name, phone: f.phone, password: f.password, city: f.city, lat, lng, expectedSalary: +f.expectedSalary });
      toast("Account created. Demo OTP: 123456", "success"); await finish(nav, f.phone, f.password);
    } catch (e: any) { toast(e.message, "error"); }
  };
  return <Layout><Card style={{ maxWidth: 440, margin: "0 auto" }}>
    <h2>{role === "MAID" ? "Find work near you" : "Create your client account"}</h2>
    <input placeholder="Full name" value={f.name} onChange={set("name")} /><br /><br />
    <input placeholder="Phone (10 digits)" value={f.phone} onChange={set("phone")} /><br /><br />
    <input type="password" placeholder="Password (min 8)" value={f.password} onChange={set("password")} /><br /><br />
    <select value={f.city} onChange={set("city")}>{Object.keys(CITIES).map(c => <option key={c}>{c}</option>)}</select><br /><br />
    {role === "MAID" && <><input type="number" placeholder="Expected monthly salary ₹" value={f.expectedSalary} onChange={set("expectedSalary")} /><br /><br /></>}
    <Button onClick={go}>Create account</Button> <Link to={`/login?as=${role}`}>I already have an account</Link>
  </Card></Layout>;
}
