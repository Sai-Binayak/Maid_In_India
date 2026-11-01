# Where each file goes
| File | Copy to | Extra steps |
|---|---|---|
| 1-theme.css, 1-ui.tsx | client/src/theme.css, client/src/ui.tsx | `import "./theme.css"` in main.tsx; wrap app in `<ToastProvider>` |
| 2-MapView.tsx | client/src/MapView.tsx | `npm i leaflet && npm i -D @types/leaflet` (in client) |
| 3-swagger.ts | server/src/swagger.ts | `npm i swagger-ui-express && npm i -D @types/swagger-ui-express`; call `mountSwagger(app)` in app.ts |
| 4-schema-additions.prisma | append to prisma/schema.prisma | add `refreshTokens RefreshToken[]` to `model User`; `npm run migrate` |
| 4-refresh.ts | server/src/routes/refresh.ts | edit app.ts + login/register as written in the file header |
| 5-integrations.ts | server/src/routes/integrations.ts | mount in app.ts; set env vars (all optional, demo fallback) |
| 6-settings.ts | server/src/routes/settings.ts | needs the schema additions; mount in app.ts |
| 7-api.integration.test.ts | server/tests/api.integration.test.ts | seeded test DB; `npm test` |
| 8-reminders.ts | server/src/jobs/reminders.ts | `startReminders()` in server.ts |

Final app.ts mount line: `app.use("/api", api, more, refresh, integrations, settings);`
Do the schema migration (4) before 4-refresh and 6-settings, or the server won't compile.
Not tested here (no network in my sandbox): run `npm run build` in server after adding files and fix any type errors.
