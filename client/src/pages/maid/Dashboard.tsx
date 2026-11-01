import React, { useState } from "react";
import { Tabs } from "../../layouts";
import { ContractsTab, NotificationsTab, PaymentsTab, RequestsTab, useAct } from "../shared";
import { api } from "../../api";
import { Button, Card } from "../../ui";

function ProfileTab() {
  const act = useAct(), [f, setF] = useState<any>({ expectedSalary: 7000, bio: "", maxTravelKm: 10, availableDays: [1, 2, 3, 4, 5, 6] }), [consent, setConsent] = useState(false);
  const set = (k: string) => (e: any) => setF({ ...f, [k]: e.target.value });
  const doc = (type: string) => act(async () => { const s = await api("/uploads/sign", {}); await api("/maid/documents", { type, privateRef: s.privateRef ?? `uploaded/${Date.now()}`, consent: true }); }, "Document submitted for verification");
  return <div style={{ display: "grid", gap: 12, maxWidth: 520 }}>
    <Card><h3>Salary & availability</h3>
      <label>Expected monthly salary (₹)<input type="number" value={f.expectedSalary} onChange={set("expectedSalary")} /></label>
      <label>Max travel (km)<input type="number" value={f.maxTravelKm} onChange={set("maxTravelKm")} /></label>
      <label>About you<textarea value={f.bio} onChange={set("bio")} /></label><br />
      <Button onClick={() => act(() => api("/maid/profile", { ...f, expectedSalary: +f.expectedSalary, maxTravelKm: +f.maxTravelKm }, "PUT"), "Profile saved")}>Save</Button></Card>
    <Card><h3>Verification</h3><p>Documents are stored privately and never shown to clients.</p>
      <label><input type="checkbox" style={{ width: "auto" }} checked={consent} onChange={e => setConsent(e.target.checked)} /> I consent to identity and address verification</label><br /><br />
      <Button disabled={!consent} onClick={() => doc("IDENTITY")}>Submit ID proof</Button> <Button disabled={!consent} variant="alt" onClick={() => doc("ADDRESS")}>Submit address proof</Button></Card>
  </div>;
}
export default function MaidDashboard() {
  return <><h2 style={{ fontSize: 28 }}>My work</h2><Tabs tabs={[
    ["Job requests", <RequestsTab role="MAID" />], ["My jobs & attendance", <ContractsTab role="MAID" />],
    ["Earnings", <PaymentsTab role="MAID" />], ["Notifications", <NotificationsTab />], ["Profile & documents", <ProfileTab />],
    ["Help", <Card><Button variant="danger" onClick={() => confirm("Send an SOS to support? In an emergency call 112.") && api("/sos", { message: "SOS from maid" }).then(r => alert(r.notice))}>🆘 SOS</Button></Card>],
  ]} /></>;
}
