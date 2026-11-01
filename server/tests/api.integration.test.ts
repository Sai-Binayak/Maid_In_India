// server/tests/api.integration.test.ts — needs a migrated + SEEDED database. Use a throwaway DB: DATABASE_URL=...maidinindia_test npm test
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import http from "http";
import { app } from "../src/app";
import { prisma } from "../src/routes/index";

let srv: http.Server, base = "";
const createdRequests: string[] = [];
const call = async (path: string, method = "GET", body?: any, token?: string) => {
  const r = await fetch(base + path, { method, headers: { "Content-Type": "application/json", ...(token ? { Authorization: "Bearer " + token } : {}) }, body: body ? JSON.stringify(body) : undefined });
  return { status: r.status, data: await r.json().catch(() => ({})) as any };
};
const login = async (identifier: string) => (await call("/auth/login", "POST", { identifier, password: "Demo@12345" })).data.token as string;

beforeAll(() => new Promise<void>(r => { srv = app.listen(0, () => { base = `http://localhost:${(srv.address() as any).port}/api`; r(); }); }));
afterAll(async () => {
  await prisma.employmentContract.deleteMany({ where: { requestId: { in: createdRequests } } });
  await prisma.employmentRequest.deleteMany({ where: { id: { in: createdRequests } } });
  await prisma.$disconnect(); srv.close();
});

describe("auth & roles", () => {
  it("rejects wrong password", async () => expect((await call("/auth/login", "POST", { identifier: "client@maidinindia.demo", password: "nope" })).status).toBe(401));
  it("blocks client from admin API", async () => expect((await call("/admin/stats", "GET", undefined, await login("client@maidinindia.demo"))).status).toBe(403));
  it("allows admin", async () => expect((await call("/admin/stats", "GET", undefined, await login("admin@maidinindia.demo"))).status).toBe(200));
  it("rejects missing token", async () => expect((await call("/requests")).status).toBe(401));
});

describe("discovery", () => {
  it("returns nearby maids sorted by recommendation without sensitive data", async () => {
    const { status, data } = await call("/maids?lat=20.2961&lng=85.8245&budget=9000");
    expect(status).toBe(200); expect(data.data.length).toBeGreaterThan(0);
    expect(data.data[0]).not.toHaveProperty("documents");
  });
});

describe("employment flow", () => {
  const body = (maidId: string) => ({ maidId, services: ["House Cleaning"], startDate: "2030-01-01", durationMonths: 3, days: [1], startMin: 600, endMin: 720, offeredSalary: 8000, payFrequency: "MONTHLY" });
  let maidId = "", maidToken = "", reqA = "", reqB = "";
  it("creates a request, blocks duplicate", async () => {
    maidToken = await login("maid@maidinindia.demo");
    maidId = (await prisma.maidProfile.findFirstOrThrow({ where: { user: { email: "maid@maidinindia.demo" } } })).id;
    const a = await call("/requests", "POST", body(maidId), await login("client@maidinindia.demo"));
    expect(a.status).toBe(201); reqA = a.data.id; createdRequests.push(reqA);
    expect((await call("/requests", "POST", body(maidId), await login("client@maidinindia.demo"))).status).toBe(409);
  });
  it("accepts first job, rejects overlapping second job server-side", async () => {
    const b = await call("/requests", "POST", body(maidId), await login("9100000015")); // another client, same city
    expect(b.status).toBe(201); reqB = b.data.id; createdRequests.push(reqB);
    expect((await call(`/requests/${reqA}/respond`, "POST", { action: "ACCEPT" }, maidToken)).status).toBe(200);
    const c = await call(`/requests/${reqB}/respond`, "POST", { action: "ACCEPT" }, maidToken);
    expect(c.status).toBe(409); expect(c.data.error).toMatch(/overlap/i);
  });
  it("won't let a client respond as maid", async () => expect((await call(`/requests/${reqB}/respond`, "POST", { action: "ACCEPT" }, await login("client@maidinindia.demo"))).status).toBe(403));
  it("contract needs both signatures", async () => {
    const c = await prisma.employmentContract.findFirstOrThrow({ where: { requestId: reqA } });
    expect(c.status).toBe("PENDING_SIGNATURE");
    const s = await call(`/contracts/${c.id}/sign`, "POST", {}, await login("client@maidinindia.demo"));
    expect(s.data.status).toBe("ACTIVE");
  });
});
