import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api";
import { Layout } from "../layouts";
import { Card, MaidCard, SkeletonGrid } from "../ui";
import { CITIES } from "./Login";
import { t } from "../i18n";

const SERVICES = [["House Cleaning", "🧹"], ["Cooking", "🍳"], ["Babysitting", "🧸"], ["Elderly Care", "🧓"], ["Laundry", "🧺"], ["Housekeeping", "🏠"]];
const STEPS = ["Search for domestic workers", "Compare verified profiles", "Send employment requests", "Negotiate and finalise terms", "Start employment"];
const TRUST = [["🛡️", "Verified identities", "Documents are checked by our team and never shown publicly."], ["📄", "Transparent terms", "Salary, hours and notice period are written in the agreement."], ["⭐", "Honest reviews", "Clients and maids rate each other after working together."], ["🔒", "Secure communication", "Chat inside the app. Your phone number stays private."], ["🎧", "Customer support", "Help centre, tickets and an in-app SOS to our support team."]];
const PROMOS = [["🎁", "First booking offer", "Zero platform fee on your first hire"], ["🪔", "Festival special", "Flat ₹300 off any 3-month hire"], ["👨‍👩‍👧", "Family plan", "Hire up to 3 helpers on one plan"]];

export default function Landing() {
  const nav = useNavigate(), [city, setCity] = useState("Bhubaneswar"), [skill, setSkill] = useState(""), [maids, setMaids] = useState<any[] | null>(null);
  useEffect(() => { api("/maids?lat=20.2961&lng=85.8245&sort=rated&verified=true").then(d => setMaids(d.data.slice(0, 4))).catch(() => setMaids([])); }, []);
  const go = (s = skill) => nav(`/find?city=${city}&skill=${encodeURIComponent(s)}`);
  return <Layout bare>
    <section className="hero"><div className="hero-in">
      <div>
        <span className="badge">🇮🇳 Trusted home help across India</span>
        <h1>{t("title").replace("Just Around the Corner.", "")}<span>Just Around the Corner.</span></h1>
        <p style={{ fontSize: 18, color: "var(--muted)" }}>Find verified housemaids, cooks, babysitters and caregivers near you. Compare profiles, agree terms and manage attendance and pay, all in one place.</p>
        <div className="searchbar">
          <select value={city} onChange={e => setCity(e.target.value)}>{Object.keys(CITIES).map(c => <option key={c} value={c}>📍 {c}</option>)}</select>
          <select value={skill} onChange={e => setSkill(e.target.value)}><option value="">All services</option>{SERVICES.map(([s]) => <option key={s}>{s}</option>)}</select>
          <button className="btn" onClick={() => go()}>Search</button>
        </div>
        <p style={{ marginTop: 14 }}><b>5,000+</b> demo profiles · <b>5</b> cities · <b>72h</b> to respond</p>
      </div>
      <div className="art"><div className="blob" /><div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", fontSize: 120 }}>🏡</div>
        <div className="float" style={{ top: 20, left: 0 }}>✔ Verified profile</div><div className="float" style={{ top: 120, right: 0 }}>⭐ 4.8 · 120 jobs</div><div className="float" style={{ bottom: 20, left: 30 }}>📅 Attendance & pay</div></div>
    </div></section>

    <section className="section"><h2>Offers for you</h2><p className="sub">Demo promotions for this prototype</p>
      <div className="grid">{PROMOS.map(([i, h, p]) => <Card key={h} className="promo"><div style={{ fontSize: 34 }}>{i}</div><b>{h}</b><div>{p}</div></Card>)}</div></section>

    <section className="section"><h2>Popular services</h2><p className="sub">Pick a service to see workers near you</p>
      <div className="tiles">{SERVICES.map(([s, i]) => <Card key={s} className="tile" onClick={() => go(s)}><div className="ico">{i}</div><b>{s}</b></Card>)}</div></section>

    <section className="section"><h2>Recommended maids</h2><p className="sub">Top-rated verified professionals</p>
      {!maids ? <SkeletonGrid n={4} /> : <div className="grid">{maids.map(m => <MaidCard key={m.id} m={m} onHire={() => nav("/find")} onShortlist={() => nav("/find")} />)}</div>}
      <p><Link to="/find">See all maids →</Link></p></section>

    <div className="band" id="how"><section className="section"><h2>How it works</h2><p className="sub">From search to start date in five steps</p>
      <div className="steps">{STEPS.map(s => <Card key={s} className="step"><b>{s}</b></Card>)}</div></section></div>

    <section className="section" id="login"><h2>Get started</h2><p className="sub">Choose how you want to use Maid In India</p>
      <div className="grid">
        <Card className="path"><h3>👤 I need help at home</h3><p>Find, hire and manage domestic workers.</p><Link className="btn" to="/login?as=CLIENT">Client login</Link> <Link className="btn ghost" to="/register?role=CLIENT">Register</Link></Card>
        <Card className="path m"><h3>🧹 I'm looking for work</h3><p>Create a profile, get requests and track your earnings.</p><Link className="btn alt" to="/login?as=MAID" style={{ color: "var(--text)" }}>Maid login</Link> <Link className="btn ghost" to="/register?role=MAID">Register</Link></Card>
        <Card className="path a"><h3>🛠️ Platform team</h3><p>Verification, disputes and analytics.</p><Link className="btn" style={{ background: "var(--text)" }} to="/login?as=ADMIN">Admin login</Link></Card>
      </div></section>

    <div className="band" id="trust"><section className="section"><h2>Trust & safety</h2><p className="sub">Built for peace of mind on both sides</p>
      <div className="grid">{TRUST.map(([i, h, p]) => <Card key={h}><div style={{ fontSize: 30 }}>{i}</div><b>{h}</b><p style={{ color: "var(--muted)" }}>{p}</p></Card>)}</div></section></div>

    <footer className="foot" id="contact"><div className="section" style={{ padding: 0 }}>
      <b style={{ color: "#fff" }}>🏡 Maid In India</b><p>support@maidinindia.demo · Demo project with fictional data. Not an emergency service: call 112 in an emergency.</p>
      {["About", "Careers", "Contact", "FAQs", "Terms", "Privacy", "Safety"].map(l => <a key={l} href="#contact">{l}</a>)}</div></footer>
  </Layout>;
}
