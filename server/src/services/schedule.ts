import { km } from "./geo.js";
export type Slot = { days:number[]; startMin:number; endMin:number; lat:number; lng:number };
const TRAVEL_KMH = 20, BUFFER_MIN = 10;
export const travelMin = (a:Slot,b:Slot) => Math.ceil(km(a,b)/TRAVEL_KMH*60)+BUFFER_MIN;
/** Returns a conflict reason or null. Call inside the accept transaction (server-side). */
export function findConflict(existing:Slot[], next:Slot, maxWeeklyMin=60*60): string|null {
  let weekly = next.days.length*(next.endMin-next.startMin);
  for (const e of existing) {
    weekly += e.days.length*(e.endMin-e.startMin);
    if (!e.days.some(d=>next.days.includes(d))) continue;
    if (next.startMin < e.endMin && e.startMin < next.endMin) return "Working hours overlap";
    const gap = next.startMin >= e.endMin ? next.startMin-e.endMin : e.startMin-next.endMin;
    if (gap < travelMin(e,next)) return "Insufficient travel time between jobs";
  }
  return weekly > maxWeeklyMin ? "Weekly working limit exceeded" : null;
}
