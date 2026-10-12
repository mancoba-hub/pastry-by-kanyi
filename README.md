# Pastry by Kanyi

A production-ready storefront for a South African home bakery: a live gallery of cakes
baked for real customers, a small shop for scones, and a staff area for uploading
bakes and managing orders.

Built so that **publishing a new bake is instant and costs the database nothing**,
because the gallery is the product and the business uploads constantly.

---

## What it does

| Audience | Journey |
| --- | --- |
| **Customer** | Browse the gallery on a phone → open a shared cake link → order on WhatsApp, or add priced items to a basket and check out |
| **Baker** | Sign in → upload photos from a phone → publish → manage orders through baking, ready, collected |
| **Both** | No payment gateway required: orders are confirmed on WhatsApp and paid on collection/delivery |

---

## Quick start

```bash
# 1. Install
npm install

# 2. Start Postgres (or point DATABASE_URL at a managed Postgres — see below)
docker compose up -d

# 3. Configure
cp .env.example .env          # then fill in DATABASE_URL, AUTH_SECRET

# 4. Create the schema and seed demo content
npm run db:deploy
npm run db:seed

# 5. Run
npm run dev                   # http://localhost:3000
```

Seeded staff login: `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` from `.env`
(defaults `kanyi@example.com` / `change-me-before-deploying` — **change this**).

### Database (PostgreSQL)

The app talks to PostgreSQL. `docker compose up -d` starts one locally; in
production point `DATABASE_URL` at any managed Postgres (Render, Neon, Supabase):

```
postgresql://<db-user>:<db-password>@<db-host>:5432/<db-name>
```

Percent-encode special characters in the password (`p@ss` → `p%40ss`).
Providers that expose a separate endpoint for migrations — a PgBouncer pooler,
for example — put it in `DIRECT_URL`, because PgBouncer cannot run DDL in
transaction mode. With a single endpoint (Render, a VPS) leave it empty and the
Prisma CLI falls back to `DATABASE_URL`.

`next build` prerenders the gallery and shop pages from the database, so the
endpoint the build uses must be reachable from the build environment. On Render
the Blueprint wires in the database's **internal** URL, which both the build and
the running service can reach; from a developer machine use the **external** URL
(with `?sslmode=require`).

`prisma migrate dev` (the local-dev command) creates a scratch shadow database,
so the user must be allowed to `CREATE DATABASE`. Production and hosted panels
usually run `npm run db:deploy` instead, which needs no such rights.

---

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build and serve |
| `npm run typecheck` | Generate route types + `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm test` | Vitest (unit + integration) |
| `npm run db:migrate` | Create and apply a migration (development) |
| `npm run db:deploy` | Apply pending migrations (production) |
| `npm run db:seed` | Seed staff user, demo bakes and shop items |
| `npm run db:seed-if-empty` | Same, but skips collections that already have rows (what the Render build runs) |
| `npm run db:studio` | Prisma Studio |
| `npm run outbox:drain` | Process queued side effects (run on a schedule) |

`db:seed` deliberately drives the **real image pipeline** — it renders
placeholders with sharp, pushes them through the configured storage driver and
records the rows. A successful seed therefore proves uploads, resizing, blur
placeholders and storage wiring all work in that environment.

---

## Environment

Full reference with descriptions: [`.env.example`](.env.example).

The only variables required to boot are `DATABASE_URL` and `AUTH_SECRET`.
`STORAGE_DRIVER` defaults to `local` (server disk — fine on a single VPS, with
backups); switch to `s3` when the filesystem is ephemeral or several instances
serve traffic — see [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

Environment is validated lazily at first use rather than at import, so a missing
runtime secret fails the request that needs it instead of breaking the build.

---

## Region and localisation

The app is set up for **South Africa** (ZAR, `+27` mobiles, `Africa/Johannesburg`,
`en-ZA`). Everything region-specific is confined to a handful of places, so
moving to another country is a short, contained change:

| Concern | Where | Current |
| --- | --- | --- |
| Currency + formatting | `src/lib/money.ts` | ZAR via the `en-ZA` locale (`R 7 800`) |
| Currency default | `src/lib/env.ts` → `NEXT_PUBLIC_CURRENCY` | `ZAR` |
| Phone parsing / display | `src/lib/phone.ts` | `+27`, mobiles only |
| Phone validation message | `src/lib/validation.ts` | "…South African mobile number…" |
| Timezone (order lead times, `datetime-local`) | `src/lib/datetime.ts` | `Africa/Johannesburg` |
| Dates across the UI | `en-ZA` locale strings in pages | `en-ZA` |
| Business details | `.env` → `NEXT_PUBLIC_*` | Cape Town, `27821234567` |
| Sample catalogue | `prisma/seed.ts` | melktert, peppermint crisp, naartjie, rooibos, Amarula, granadilla |

Three deliberate choices worth knowing:

**The time zone stays `Africa/Johannesburg`, even in Cape Town.** South Africa has
a single time zone (SAST, UTC+2) and `Africa/Johannesburg` is its canonical IANA
identifier — there is no `Africa/Cape Town`, and `Africa/Cape_Town` is not a
valid alias either. Passing either to `Intl` throws
`RangeError: Invalid time zone specified`, which takes out every page that formats
a collection date. The *city* customers see is separate copy driven by
`NEXT_PUBLIC_BUSINESS_LOCATION`; only the identifier itself must stay
`Africa/Johannesburg`. There is no daylight saving in South Africa, so the offset
is a constant `+02:00`.

**Landlines are rejected.** `normaliseSouthAfricanPhone()` accepts only 06x/07x/08x
mobiles, because an order is confirmed on WhatsApp and a landline cannot receive
that message. Accepting one would promise a confirmation the customer can never
get. Note that a South African 07x number and a Kenyan 07x number have the same
shape, so such numbers are simply read as South African — there is nothing to
distinguish them by.

**Money is integer cents.** ZAR is divided into 100 cents, so `priceCents` is
literal. `formatMoney()` renders whole rand without decimals and uses a comma for
the decimal separator when cents exist (`R 450,50`), matching `en-ZA` convention.

---

## Project structure

```
src/
  app/                     Next.js App Router
    (public)/              home, gallery, shop, cart, checkout, order, about, contact
    admin/
      login/               outside the authenticated shell
      (shell)/             authenticated: dashboard, cakes, products, orders
    api/                   versioned JSON API + health + media
  components/              UI primitives, layout chrome, gallery, admin
  features/                vertical slices: cakes, products, orders, cart, auth, admin
  lib/                     env, db, money, ids, slug, phone, result, rate-limit, logger
  server/
    auth/                  scrypt hashing, sessions, guards
    repositories/          data access (Prisma only)
    services/              business rules + cache tags
    storage/               local/S3 drivers + sharp image pipeline
    outbox/                transactional outbox dispatcher
  proxy.ts                 optimistic admin redirect (Next 16's `middleware`)
prisma/
  schema.prisma            data model
  migrations/              SQL migration history
  seed.ts                  idempotent seeding
docs/
  ARCHITECTURE.md          system design, schema, API surface, scaling
  DEPLOYMENT.md            deployment and operations runbook
tests/
  unit/                    pure logic
  integration/             order placement against a real database
```

### Layering

```
app/ (routes)  →  features/ or server/services  →  server/repositories  →  Prisma
     ↓                    ↓
 presentation      business rules            data access
```

Routes are thin. Business rules live in services so they can be tested without a
browser and reused by both the UI and the JSON API. Repositories contain no
policy — only queries — which keeps them safe to reuse from a future worker.

---

## Documentation

- **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)** — system architecture, data
  model, API endpoints, UI architecture, and how each part scales.
- **[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)** — deploying to Render (Blueprint
  included) or a VPS (systemd + nginx), photo storage, migrations, monitoring,
  and the runbook.

---

## Notes and known trade-offs

These are conscious decisions, documented rather than hidden.

**A cold 404 for an unknown gallery slug returns HTTP 200 on the very first
request.** The route is statically generated per slug and regenerated on demand,
and the layout contains Suspense boundaries, so the response shell is flushed
before `notFound()` can change the status. The miss is cached as a 404 and every
subsequent request returns a real 404, and the streamed response carries
`noindex`, which is the protection that actually matters for search. The
alternative — `dynamicParams = false` — would give perfect status codes but would
break instant publishing, which is the whole point of the site.

**The in-memory rate limiter is per instance.** It is correct for one process.
At more than one instance, set `REDIS_URL` and swap `createRateLimiter()` for a
shared implementation; the interface is one method wide for that reason.

**`npm audit` reports high-severity advisories in build-time tooling only** —
`deepmerge-ts` and `mysql2` in the Prisma CLI chain, `fast-glob`/`micromatch`/
`braces` in the ESLint chain. None of them are part of the production bundle:
the Prisma CLI only runs on a developer machine and during Render's build and
pre-deploy steps, and `mysql2` is never imported by the Postgres app. The
offered fixes are breaking downgrades (Prisma 6, an outdated
`eslint-config-next`), so the advisories are accepted and tracked.

**Payments are manual by design.** `placeOrder()` is the only place a total is
computed, and a `PaymentMethod` enum already models `GATEWAY`, so adding M-Pesa
or Stripe means implementing a provider behind that seam — not rewriting checkout.
