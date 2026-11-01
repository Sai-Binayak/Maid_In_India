export type SalaryInput = { monthly:number; workingDays:number; unpaidAbsences:number; commissionPct?:number };
/** Only UNPAID, unapproved absences reduce salary; paid/approved leave and holidays never do. */
export function calcSalary(i:SalaryInput) {
  const daily = i.monthly/i.workingDays;
  const deduction = Math.round(daily*i.unpaidAbsences);
  const net = i.monthly-deduction;
  return { gross:i.monthly, daily:Math.round(daily), deductions:[{ reason:`${i.unpaidAbsences} unpaid absence(s) x ₹${Math.round(daily)}`, amount:deduction }], net, commission:Math.round(net*(i.commissionPct??0)/100) };
}
