import React from "react";
import { Tabs } from "../../layouts";
import { ContractsTab, NotificationsTab, PaymentsTab, RequestsTab } from "../shared";
import { api } from "../../api";
import { Button, Card } from "../../ui";

export default function ClientDashboard() {
  return <><h2>Client dashboard</h2><Tabs tabs={[
    ["Requests", <RequestsTab role="CLIENT" />], ["Employees & attendance", <ContractsTab role="CLIENT" />],
    ["Payments", <PaymentsTab role="CLIENT" />], ["Notifications", <NotificationsTab />],
    ["Help", <Card><h3>Safety & support</h3>
      <Button variant="danger" onClick={() => confirm("Send an SOS to support? In an emergency call 112.") && api("/sos", { message: "SOS from client" }).then(r => alert(r.notice))}>🆘 SOS</Button>{" "}
      <Button variant="ghost" onClick={() => { const s = prompt("Subject"); if (s) api("/support", { subject: s, body: prompt("Describe the issue") ?? "" }).then(() => alert("Ticket created")); }}>Contact support</Button></Card>],
  ]} /></>;
}
