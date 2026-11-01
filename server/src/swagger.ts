// server/src/swagger.ts — needs: npm i swagger-ui-express && npm i -D @types/swagger-ui-express
// In app.ts:  import { mountSwagger } from "./swagger.js";  ...  mountSwagger(app);   → open http://localhost:4000/docs
import swaggerUi from "swagger-ui-express";
import type { Express } from "express";

const R: [string, string, string, string][] = [
  ["post","/auth/register","public","Register client or maid"],["post","/auth/login","public","Login"],
  ["get","/maids","public","Search/recommend maids (lat,lng,skills,budget,day,sort,verified,page)"],["get","/maids/:id/reviews","public","Public reviews of a maid"],
  ["get","/promotions","public","Active promotions"],["get","/faq","public","FAQ"],
  ["get","/requests","user","My employment requests"],["post","/requests","CLIENT","Create employment request (72h expiry)"],
  ["post","/requests/:id/respond","MAID","Accept/reject request (transactional + conflict check)"],
  ["post","/requests/:id/negotiate","user","Send salary offer/counteroffer"],["post","/requests/:id/negotiate/accept","user","Accept latest offer from the other party"],
  ["post","/chats","user","Create/get chat for request"],["get","/chats/:id/messages","user","Chat history"],
  ["get","/contracts","user","My contracts"],["post","/contracts/:id/sign","user","Sign contract"],["post","/contracts/:id/amend","user","Propose amended terms (new revision)"],
  ["post","/contracts/:id/terminate","user","Terminate with notice period"],["post","/contracts/:id/complete","CLIENT","Mark completed"],
  ["post","/attendance/:contractId/check-in","MAID","Check in"],["post","/attendance/:id/verify","CLIENT","Verify or dispute attendance"],
  ["post","/leave","MAID","Request leave"],["patch","/leave/:id","CLIENT","Approve/reject leave"],
  ["get","/payments","user","My payments"],["post","/payments/generate","CLIENT","Generate period payment"],["post","/payments/:id/pay","CLIENT","Pay (demo gateway)"],["post","/payments/:id/dispute","user","Dispute payment"],
  ["post","/reviews","CLIENT","Review after employment ends"],["post","/reviews/:id/flag","user","Flag review"],
  ["post","/disputes","user","Open dispute"],["post","/disputes/:id/evidence","user","Add evidence"],["post","/disputes/:id/appeal","user","Appeal resolved dispute"],
  ["post","/sos","user","Emergency SOS (not an emergency service)"],["post","/support","user","Create ticket"],["get","/support","user","My tickets"],
  ["get","/notifications","user","My notifications"],["post","/notifications/:id/read","user","Mark read"],
  ["post","/subscriptions","CLIENT","Choose plan"],["get","/referrals/me","user","My referral code"],["post","/referrals/redeem","user","Redeem referral code"],
  ["put","/maid/profile","MAID","Update profile"],["post","/maid/documents","MAID","Submit verification document (consent required)"],
  ["get","/admin/stats","ADMIN","Dashboard counts"],["get","/admin/analytics","ADMIN","Analytics"],["get","/admin/users","ADMIN","List users"],["post","/admin/users/:id/status","ADMIN","Suspend/reactivate (reason required)"],
  ["get","/admin/verifications","ADMIN","Pending verifications"],["post","/admin/maids/:id/verify","ADMIN","Approve/reject maid"],["post","/admin/maids/:id/request-docs","ADMIN","Request more documents"],
  ["get","/admin/contracts","ADMIN","All contracts"],["get","/admin/payments","ADMIN","All payments + commission"],["get","/admin/disputes","ADMIN","Disputes"],["patch","/admin/disputes/:id","ADMIN","Update dispute"],
  ["get","/admin/reviews/flagged","ADMIN","Flagged reviews"],["post","/admin/reviews/:id/moderate","ADMIN","Moderate review"],["get","/admin/support","ADMIN","Support tickets"],
  ["post","/admin/promotions","ADMIN","Create promotion"],["patch","/admin/promotions/:id","ADMIN","Toggle promotion"],
];
export function mountSwagger(app: Express) {
  const paths: any = {};
  for (const [m, p, role, summary] of R) {
    const path = p.replace(/:(\w+)/g, "{$1}");
    (paths[path] ??= {})[m] = { summary, tags: [role], security: role === "public" ? [] : [{ bearer: [] }],
      parameters: [...p.matchAll(/:(\w+)/g)].map(x => ({ name: x[1], in: "path", required: true, schema: { type: "string" } })), responses: { 200: { description: "OK" } } };
  }
  const spec = { openapi: "3.0.3", info: { title: "Maid In India API", version: "1.0.0" }, servers: [{ url: "/api" }], components: { securitySchemes: { bearer: { type: "http", scheme: "bearer", bearerFormat: "JWT" } } }, paths };
  app.get("/api/openapi.json", (_, res) => res.json(spec));
  app.use("/docs", swaggerUi.serve, swaggerUi.setup(spec));
}
