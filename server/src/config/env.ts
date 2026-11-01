export const env = {
  port: +(process.env.PORT ?? 4000),
  jwt: process.env.JWT_SECRET ?? "dev-secret",
  client: process.env.CLIENT_URL ?? "http://localhost:5173",
  requestTtlHours: 72, commissionPct: +(process.env.COMMISSION_PCT ?? 10),
  weights: { distance: .25, skill: .25, availability: .2, salary: .15, rating: .1, experience: .05 },
};
