import { describe, it, expect } from "vitest";
import { findConflict } from "../src/services/schedule";
import { calcSalary } from "../src/services/salary";
const a = { days:[1,2], startMin:540, endMin:660, lat:20.29, lng:85.82 };
describe("schedule", () => {
  it("detects overlap", () => expect(findConflict([a], { ...a, startMin:600, endMin:720 })).toMatch(/overlap/));
  it("detects insufficient travel", () => expect(findConflict([a], { ...a, lat:20.5, startMin:665, endMin:720 })).toMatch(/travel/));
  it("allows distinct days", () => expect(findConflict([a], { ...a, days:[3] })).toBeNull());
});
describe("salary", () => {
  it("deducts only unpaid absences", () => expect(calcSalary({ monthly:9000, workingDays:30, unpaidAbsences:2 }).net).toBe(8400));
  it("no deduction without unpaid absences", () => expect(calcSalary({ monthly:9000, workingDays:30, unpaidAbsences:0 }).net).toBe(9000));
});
