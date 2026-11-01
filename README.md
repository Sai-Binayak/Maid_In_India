# 🏡 Maid In India

A full-stack marketplace that connects households with verified domestic workers (housemaids, cooks, babysitters, elderly caregivers, cleaners). Clients discover and hire workers, negotiate salary, sign a digital agreement, verify attendance and pay. Workers manage jobs, schedules and earnings. Admins verify workers, resolve disputes and monitor the platform.

> **Demo project.** All seeded people, phone numbers and offers are fictional. OTP, payments and document uploads run in **demo mode** unless you add real provider keys (see [Integrations](#integrations)). SOS is a support alert, **not** an emergency service. Call 112 in an emergency.

<!-- Add screenshots: landing page, discovery, client dashboard, maid dashboard, profile drawer, admin console -->

---

## Table of contents
- [Features](#features)
- [Tech stack](#tech-stack)
- [Project structure](#project-structure)
- [Quick start](#quick-start)
- [Demo accounts](#demo-accounts)
- [Environment variables](#environment-variables)
- [Integrations](#integrations)
- [API overview](#api-overview)
- [Business rules enforced by the server](#business-rules-enforced-by-the-server)
- [Testing](#testing)
- [Deployment](#deployment)
- [Security and privacy](#security-and-privacy)
- [Status and roadmap](#status-and-roadmap)

---

## Features

### Public landing page
- Hero with city and service search, demo offers, popular services and recommended verified maids.
- "How it works", trust and safety section, and separate **Client / Maid / Admin** login entry points.
- Language switcher (English, Hindi, Odia, Bengali for core strings).

### Client
- **Discovery** with filters (city, service, budget, verified only), sorting (recommended, nearest, highest rated, lowest salary, most experienced) and an optional map view.
- **Smart recommendations**: weighted score of distance, skill match, availability, salary compatibility, rating and experience. Weights are configurable in `server/src/config/env.ts`. Ineligible workers (out of range or unavailable) are excluded.
- **Employment request** form with a summary before sending. The maid has **72 hours** to respond, then the request auto-expires and the client is notified.
- **Negotiation**: offer, counteroffer, accept offer, with a request-linked chat.
- **Contracts**: both parties must sign. Amendments create a new revision (history kept) and need re-signing. Termination honours the notice period.
- **Attendance**: the maid checks in, the client confirms or disputes.
- **Payments**: generate monthly salary slips with transparent deductions, pay, or dispute.
- **Reviews** after employment ends, and notifications, support tickets and SOS.
- **Profile drawer** (right side, about 1/3 of the screen): photo, contact, saved addresses, ratings received from maids, current and previous employees.

### Maid
- Simple mobile-first dashboard with large buttons.
- Job requests: accept, reject or counter. **Schedule conflicts are rejected on the server.**
- Jobs and attendance: check-in (optional location consent), leave requests (paid or unpaid).
- Earnings: totals, pending amounts, deductions and payment disputes.
- Profile and documents: salary, availability, travel distance, verification submission with explicit consent.
- Rate clients after employment ends.
- **Profile drawer**: photo, rating, expected salary, verification, type of work, languages, employers (current and past) and client reviews.

### Admin
- Overview cards and analytics (contracts and requests by status, maids by city, rating distribution, revenue).
- Maid verification queue: approve, reject with reason, request more documents. Every action is written to an **audit log**.
- Dispute management: status workflow, internal notes, appeals. Disputes never auto-ban anyone.
- User management: suspend or reactivate. A documented reason is required, and the user is notified.
- API-only (no UI yet): review moderation, payments and commission report, promotions, platform settings and city management.

### Platform
- JWT access tokens with **refresh-token rotation and reuse detection**.
- Role-based access control (client, maid, admin).
- Real-time chat (Socket.IO push, REST send, automatic polling fallback) with notifications.
- Swagger/OpenAPI docs at `/docs`.
- Subscriptions (basic, premium, family), referral codes, support tickets and FAQ endpoints.
- Background jobs: request expiry, review reminders, month-end payment reminders.

---

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite, TypeScript, React Router, Socket.IO client, Leaflet |
| Backend | Node.js, Express, TypeScript, Zod validation, Socket.IO |
| Database | PostgreSQL with Prisma ORM |
| Auth | JWT, rotating refresh tokens, bcrypt |
| Tooling | Vitest, Docker Compose (local database), Swagger UI |

---

## Project structure

```
Maid-In-India/
├── client/                  React + Vite app
│   └── src/
│       ├── pages/           Landing, Login/Register, shared tabs
│       │   ├── client/      Discover, Dashboard
│       │   ├── maid/        Dashboard
│       │   └── admin/       Dashboard
│       ├── api.ts           fetch wrapper with token refresh
│       ├── layouts.tsx      nav, route guards, tabs
│       ├── profile.tsx      avatar and profile drawer
│       └── ui.tsx, theme.css, MapView.tsx, i18n.ts
├── server/
│   ├── src/
│   │   ├── routes/          index, more, refresh, integrations, settings, profile, chat
│   │   ├── services/        schedule conflicts, salary, recommendations, geo
│   │   ├── sockets/         Socket.IO setup
│   │   ├── jobs/            reminders
│   │   ├── middleware/      auth and RBAC
│   │   ├── app.ts, server.ts, seed.ts, swagger.ts
│   └── tests/
├── prisma/schema.prisma     31 models
├── docker-compose.yml       local PostgreSQL
└── render.yaml              backend deploy blueprint
```

---

## Quick start

**Requirements:** Node.js 18+, Docker Desktop (or a local PostgreSQL).

```bash
# 1. Database
docker compose up -d db

# 2. Server
cd server
cp ../.env.example .env        # then edit values (see below)
npm install
npx prisma generate --schema ../prisma/schema.prisma
npx prisma migrate dev --schema ../prisma/schema.prisma
npm run seed
npm run dev                    # API on http://localhost:4000

# 3. Client (new terminal)
cd client
npm install
npm run dev                    # App on http://localhost:5173
```

Useful URLs: API health `http://localhost:4000/health`, API docs `http://localhost:4000/docs`.
Inspect data with `npx prisma studio --schema ../prisma/schema.prisma`.

> If port 5432 is already used by a local PostgreSQL, change the mapping in `docker-compose.yml` (for example `"5433:5432"`) and use the same port in `DATABASE_URL`.

---

## Demo accounts

All demo accounts use the password **`Demo@12345`**.

| Role | Login |
|---|---|
| Client | `client@maidinindia.demo` |
| Maid | `maid@maidinindia.demo` |
| Admin | `admin@maidinindia.demo` |

The seed also creates 25 maids and 10 clients across five cities (Bhubaneswar, Mumbai, Delhi, Bengaluru, Kolkata). Phones follow `91000000NN` (clients) and `92000000NN` (maids). **Never seed or publish these credentials on a public deployment.**

Try the main flow: log in as the client → **Find Maids** → **Hire** → log in as the maid in a private window → accept the request → both sign the contract → check in, verify attendance, generate and pay a salary slip.

---

## Environment variables

Create `server/.env`:

```env
DATABASE_URL=postgresql://maid:maid@localhost:5432/maidinindia
JWT_SECRET=use-a-long-random-string
PORT=4000
CLIENT_URL=http://localhost:5173
COMMISSION_PCT=10
```

Optional (everything works in demo mode without these):

```env
TWILIO_SID=  TWILIO_TOKEN=  TWILIO_FROM=              # real SMS OTP
SMTP_URL=  MAIL_FROM=                                  # email via Nodemailer
CLOUDINARY_CLOUD_NAME=  CLOUDINARY_API_KEY=  CLOUDINARY_API_SECRET=
RAZORPAY_KEY_ID=  RAZORPAY_KEY_SECRET=  RAZORPAY_WEBHOOK_SECRET=
```

Never commit `.env`.

---

## Integrations

| Service | Without keys (demo) | With keys |
|---|---|---|
| OTP / SMS | Code is always `123456` | Twilio sends a real 6-digit code (5 min expiry, 5 attempts) |
| Email | Logged to console | Sent through SMTP |
| Documents | Placeholder reference stored | Signed private Cloudinary uploads |
| Payments | Demo gateway marks the payment paid | Razorpay order creation, server-side signature check, webhook |

The integration code lives in `server/src/routes/integrations.ts`. The OTP flow endpoints exist but are not yet wired into the sign-up form.

---

## API overview

Interactive docs: `/docs` (Swagger UI), raw spec: `/api/openapi.json`.

| Area | Examples |
|---|---|
| Auth | `POST /api/auth/register`, `/auth/login`, `/auth/refresh`, `/auth/logout` |
| Discovery | `GET /api/maids?lat&lng&skills&budget&sort&verified` |
| Requests | `POST /api/requests`, `POST /requests/:id/respond`, `/negotiate`, `/negotiate/accept` |
| Contracts | `GET /api/contracts`, `/contracts/:id/sign`, `/amend`, `/terminate`, `/complete` |
| Attendance & leave | `/attendance/:contractId/check-in`, `/attendance/:id/verify`, `/leave` |
| Payments | `/payments/generate`, `/payments/:id/pay`, `/payments/:id/dispute` |
| Trust & support | `/reviews`, `/client-ratings`, `/disputes`, `/sos`, `/support`, `/faq` |
| Profile & chat | `/me/profile`, `/me/avatar`, `/chats`, `/chats/:id/messages` |
| Admin | `/admin/stats`, `/analytics`, `/users`, `/verifications`, `/disputes`, `/settings` |

---

## Business rules enforced by the server

- A client can hire many maids, and a maid can hold many jobs.
- Accepting a request runs in a **database transaction** and rejects overlapping hours, insufficient travel time between jobs, and weekly-hours overflow.
- Duplicate open requests to the same maid are blocked.
- Requests expire after 72 hours.
- A contract becomes active only after **both** parties sign. Any change creates a new revision that needs both signatures again.
- Salary is deducted **only** for unpaid, unapproved absences. Paid leave, client-approved leave and holidays are never deducted. Every deduction is itemised.
- Termination respects the contract's notice period.
- Reviews open only after employment ends.
- Suspensions require a written reason, are audit-logged and notify the user (appeal via support).
- Verification documents are stored as private references and never exposed publicly.

---

## Testing

```bash
cd server
npm test
```

- **Unit tests** (no database): schedule-conflict detection and salary calculation.
- **Integration tests** (`tests/api.integration.test.ts`): need a migrated and seeded database. Use a throwaway database because the tests create and delete rows.

---

## Deployment

Typical free-tier setup:

| Part | Host |
|---|---|
| Database | Neon, Supabase, Render Postgres or Railway |
| Backend (`server`) | Render or Railway |
| Frontend (`client`) | Vercel |

Backend build: `npm install --include=dev && npx prisma generate --schema ../prisma/schema.prisma && npm run build`
Backend start: `npx prisma migrate deploy --schema ../prisma/schema.prisma && npm start`

For a separate-origin deployment, set `CLIENT_URL` on the server to your frontend URL, and point the client at the API (for example a `VITE_API_URL` variable used by `client/src/api.ts`). A `render.yaml` blueprint is included.

---

## Security and privacy

- Passwords hashed with bcrypt, short-lived access tokens, rotating refresh tokens with reuse detection.
- Role checks on every protected route, ownership checks on every contract, payment and chat.
- Input validation with Zod, centralised error handling, request rate limiting.
- Public maid profiles never include documents, ID numbers or exact addresses. The map rounds coordinates to roughly 1 km. A client's full address is visible only to that client.
- Location check-in is optional and consent-based.

---

## Status and roadmap

**Working:** everything listed under [Features](#features).

**Known limitations**
- OTP, payments and document upload are demo-mode by default and are not production ready.
- Admin UI covers overview, verification, disputes and users. Promotions, settings, cities, payments and review moderation are API-only.
- Several quick inputs use browser prompts (leave dates, ratings) instead of forms.
- Translations cover core strings only. A lot of the interface is English.
- Maid onboarding is a single profile tab, not a guided wizard. No shortlist persistence yet.
- No automated browser (end-to-end) tests.

**Ideas for next steps:** guided maid onboarding, proper forms and modals, admin UI for settings and promotions, wiring OTP into sign-up, push/email notifications, PDF export of agreements, mobile app.

---

## License

Add a license of your choice (for example MIT) before publishing.