import React, { useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { logout, session, useApi } from "./api";
import { setLang } from "./i18n";
import { Avatar, ProfileDrawer } from "./profile";

const LINKS: any = { CLIENT: [["Home", "/"], ["Find Maids", "/find"], ["Dashboard", "/client"]], MAID: [["Home", "/"], ["Dashboard", "/maid"]], ADMIN: [["Home", "/"], ["Admin", "/admin"]] };
export function Layout({ children, bare }: any) {
  const u = session(), hasProfile = u && u.role !== "ADMIN", [open, setOpen] = useState(false), prof = useApi(hasProfile ? "/me/profile" : null);
  return <div>
    <nav className="nav"><Link to="/"><b>🏡 Maid In India</b></Link>
      {u ? LINKS[u.role].map(([l, to]: string[]) => <Link key={to} to={to}>{l}</Link>) : <>
        <Link to="/">Home</Link><Link to="/find">Find Maids</Link><a href="/#how">How it works</a><a href="/#trust">About us</a><a href="/#contact">Contact</a></>}
      <span className="grow" />
      <select style={{ width: 70 }} onChange={e => setLang(e.target.value)}>{["en", "hi", "or", "bn"].map(l => <option key={l}>{l}</option>)}</select>
      {u ? <>
        {hasProfile && <button onClick={() => setOpen(true)} title="My profile" style={{ background: "none", border: 0, cursor: "pointer", padding: 0 }}><Avatar name={u.name} src={prof.data?.user?.avatarUrl} size={36} /></button>}
        <a href="#" onClick={e => { e.preventDefault(); logout(); }}>Logout</a></> : <>
        <details className="menu"><summary>Login ▾</summary><div className="pop"><Link to="/login?as=CLIENT">👤 Client login</Link><Link to="/login?as=MAID">🧹 Maid login</Link><Link to="/login?as=ADMIN">🛠️ Admin login</Link></div></details>
        <Link to="/register?role=CLIENT" className="btn alt" style={{ color: "var(--text)" }}>Register</Link></>}
    </nav>
    <main className={bare ? "" : "container"}>{children}</main>
    {hasProfile && <ProfileDrawer open={open} onClose={() => setOpen(false)} prof={prof} />}
  </div>;
}
export const Guard = ({ role, children }: any) => session()?.role === role ? <Layout>{children}</Layout> : <Navigate to={`/login?as=${role}`} />;
export const Tabs = ({ tabs }: { tabs: [string, React.ReactNode][] }) => {
  const [i, setI] = React.useState(0);
  return <>
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>{tabs.map(([t], k) => <button key={t} className={`btn ${k === i ? "" : "ghost"}`} onClick={() => setI(k)}>{t}</button>)}</div>
    {tabs[i][1]}
  </>;
};
