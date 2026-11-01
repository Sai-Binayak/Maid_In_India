// server/src/jobs/reminders.ts — review reminders (ended employment without review) + month-end payment-due reminders
// server.ts:  import { startReminders } from "./jobs/reminders.js";   then call  startReminders();  after srv.listen(...)
import { prisma } from "../routes/index.js";

const recently = (userId: string, title: string, key: string, days: number) =>
  prisma.notification.findFirst({ where: { userId, title, body: { contains: key }, createdAt: { gt: new Date(Date.now() - days * 864e5) } } });

export async function runReminders() {
  // Reviews: remind client every 3 days until they review
  const unreviewed = await prisma.employmentContract.findMany({ where: { status: { in: ["COMPLETED", "TERMINATED"] }, review: { is: null } }, include: { client: true } });
  for (const c of unreviewed)
    if (!(await recently(c.client.userId, "Review reminder", c.id, 3)))
      await prisma.notification.create({ data: { userId: c.client.userId, title: "Review reminder", body: `Please rate your maid. Ref ${c.id}` } });

  // Payments: from the 28th, remind clients with no payment generated for this month
  const now = new Date();
  if (now.getUTCDate() >= 28) {
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const active = await prisma.employmentContract.findMany({ where: { status: "ACTIVE", payments: { none: { periodStart: start } } }, include: { client: true } });
    for (const c of active)
      if (!(await recently(c.client.userId, "Payment due", c.id, 5)))
        await prisma.notification.create({ data: { userId: c.client.userId, title: "Payment due", body: `Generate and pay this month's salary. Ref ${c.id}` } });
  }
}
export function startReminders(everyHours = 6) {
  runReminders().catch(console.error);
  setInterval(() => runReminders().catch(console.error), everyHours * 3600e3).unref();
}
