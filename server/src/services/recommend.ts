import { env } from "../config/env.js";
export type Q = { skills:string[]; budget:number; day?:number };
export function score(m:any, distKm:number, q:Q, w=env.weights) {
  const have = m.skills.map((s:any)=>s.category.name);
  const skill = q.skills.length ? q.skills.filter(s=>have.includes(s)).length/q.skills.length : 1;
  const dist = Math.max(0, 1-distKm/m.maxTravelKm);
  const avail = q.day==null || m.availableDays.includes(q.day) ? 1 : 0;
  const hi = m.expectedSalary*(1+m.flexibilityPct/100), lo = m.expectedSalary*(1-m.flexibilityPct/100);
  const sal = q.budget>=hi ? 1 : q.budget>=lo ? .6 : Math.max(0, q.budget/lo*.4);
  if (!avail || dist===0) return 0;
  return w.distance*dist + w.skill*skill + w.availability*avail + w.salary*sal + w.rating*(m.rating/5) + w.experience*Math.min(m.experienceYears/10,1);
}
