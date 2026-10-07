# Deployment and operations

Everything needed to put this on the internet and keep it running.

---

## 1. Checklist before the first deploy

- [ ] `AUTH_SECRET` is a fresh 32-byte random value (`node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`)
- [ ] `NEXT_PUBLIC_SITE_URL` is the real `https://` origin, **no trailing slash**
- [ ] `DATABASE_URL` is the **pooled** endpoint, `DIRECT_URL` the **direct** one
- [ ] `STORAGE_DRIVER=s3` with an object-store bucket and `STORAGE_PUBLIC_BASE_URL` pointing at the CDN
- [ ] `NEXT_PUBLIC_WHATSAPP_NUMBER` is the real number, digits only, no `+`
- [ ] The seeded staff password has been changed after first login
- [ ] `npm run db:deploy` has been run against production
- [ ] `outbox:drain` is scheduled

`NEXT_PUBLIC_SITE_URL` is not cosmetic: it is the base for canonical URLs,
`sitemap.xml`, and the absolute OpenGraph image URLs that decide whether a link
shared on WhatsApp shows a preview card or a bare URL.

---

## 2. Database

### Managed Postgres (recommended)

Neon and Supabase both work; neither has a free-tier storage story, so pair them
with object storage below.

| Provider | `DATABASE_URL` (runtime) | `DIRECT_URL` (migrations) |
| --- | --- | --- |
| Supabase | `…pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1` | `…supabase.com:5432/postgres` |
| Neon | `…-pooler.region.aws.neon.tech/db?sslmode=require` | `…region.aws.neon.tech/db?sslmode=require` |

Migrations must not run through a transaction-mode pooler — PgBouncer cannot
execute DDL inside one. `prisma7.config.ts` already points the CLI at
`DIRECT_URL`, and the runtime client uses `DATABASE_URL` through the driver
adapter, so the two never cross.

`DATABASE_POOL_MAX` (default 5) is the pool size **per process**. Serverless
platforms run many instances; keep it small and let the pooler multiplex.

### Apply migrations

```bash
npm run db:deploy        # production: applies pending migrations, never prompts
npm run db:migrate       # development: creates a migration from schema changes
```

`db:deploy` is the only command CI/CD should run. `db:migrate` can generate
destructive diffs and requires a shadow database.

### Self-hosted Postgres

```bash
docker compose up -d
npm run db:deploy && npm run db:seed
```

`docker-compose.yml` maps the host port to **5433** to avoid colliding with a
Postgres already installed on 5432.

---

## 3. Object storage

Required in production. `STORAGE_DRIVER=local` writes to disk, which is fine on a
laptop and wrong on any platform with an ephemeral filesystem.

**Cloudflare R2 is the recommended target**: S3-compatible and it charges no
egress, and a photo gallery is almost entirely egress.

```bash
STORAGE_DRIVER="s3"
S3_BUCKET="pastry-by-kanyi-media"
S3_REGION="auto"                                  # R2 uses "auto"; AWS uses e.g. eu-west-1
S3_ENDPOINT="https://<account-id>.r2.cloudflarestorage.com"   # omit entirely for AWS
S3_ACCESS_KEY_ID="…"
S3_SECRET_ACCESS_KEY="…"
STORAGE_PUBLIC_BASE_URL="https://cdn.pastrybykanyi.com"       # trailing slash not needed
```

Then:

1. Expose the bucket publicly (R2 custom domain, or a Cloudflare in front of S3)
   and set `STORAGE_PUBLIC_BASE_URL` to that host. `next.config.ts` reads it to
   allow the host in `images.remotePatterns` — Next will refuse to optimise
   images from a host it does not know.
2. Grant the credentials only `PutObject` and `DeleteObject` on that bucket.
   The app never lists, so it does not need `ListBucket`.

Uploads go **browser → bucket** via presigned URLs
(`/api/admin/uploads/presign`), so image bytes never pass through the app server.
The presign endpoint requires an authenticated `ADMIN` session.

---

## 4. Deploying the app

### Vercel

1. Import the repository.
2. Add every variable from `.env.example`.
3. Build command `npm run build`; install command `npm install`.
4. **Do not** add a build-time migration step unless you are certain the database
   is reachable from the build environment — prefer a release step or a manual
   `npm run db:deploy`.

Migrations and seeds are not run automatically. Run them deliberately.

### Container host (Fly.io, Railway, Render, a VPS)

A standalone Next server is enough; no Dockerfile is shipped because none of the
providers need one, but the shape is:

```
npm ci
npm run build
npm run db:deploy      # release step, once per deploy
npm start              # PORT from the environment
```

Requirements:

- Node.js **20.9+** (Next 16 minimum). Node 22 LTS is what this was built on.
- A writable filesystem is **not** required when `STORAGE_DRIVER=s3`.
- `sharp` has prebuilt binaries for linux-x64/arm64; no build toolchain needed.

### Health checks

Point the platform's health check at `GET /api/health`. It returns `200` only
when the database answers a `SELECT 1`, and `503` otherwise, so an instance that
is running but cannot reach Postgres is pulled out of rotation instead of serving
errors.

---

## 5. Scheduled jobs

One cron entry:

```bash
# every 5 minutes
npm run outbox:drain
```

It processes queued side effects (new-order notifications) with exponential
backoff, and opportunistically prunes expired sessions. It is safe to run
concurrently with itself and with the web app — work is claimed with an atomic
status transition — so overlapping schedules are harmless.

It exits non-zero when work failed, so the scheduler surfaces the problem.

---

## 6. Launch-day sequence

```bash
# 1. schema
npm run db:deploy

# 2. staff account (uses SEED_ADMIN_* from the environment)
npm run db:seed

# 3. verify
curl -s https://your-domain/api/health
curl -sI https://your-domain/ | head -1          # expect 200
curl -s  https://your-domain/robots.txt           # should NOT be "Disallow: /"
```

Then sign in at `/admin/login` and **change the password immediately**.

`npm run db:seed` is idempotent: re-running updates catalog rows in place and
leaves an existing password hash untouched, so it will never silently reset a
production password.

---

## 7. Post-deploy verification

1. `/api/health` returns `{"status":"ok","checks":{"database":"ok"}}`.
2. Paste a gallery link into a WhatsApp chat with yourself — the preview card
   should show the cake name, occasion and price. If it shows a bare URL,
   `NEXT_PUBLIC_SITE_URL` is wrong or not `https://`.
3. Sign in to `/admin`, upload a bake with photos, publish it, and confirm it
   appears in `/gallery` **immediately** (no rebuild).
4. Place a test order and confirm it appears in `/admin/orders` as *Awaiting
   confirmation*, and that `outbox:drain` logs the notification.
5. Load `/gallery` on a real phone on mobile data: it should feel instant, and
   images should sharpen progressively rather than popping in.

---

## 8. Monitoring

Structured JSON logs go to stdout with `level`, `time`, `message` and `context`.
Secrets are redacted by key name in `lib/logger.ts`, so a token cannot be logged
by accident.

Worth alerting on:

| Signal | Meaning |
| --- | --- |
| `api.unhandled_error` | a real bug; includes the route and stack |
| `outbox.event.failed` with `attempts >= 5` | a lost notification; the order exists but nobody was told |
| `auth.login.failed` spike | credential stuffing |
| `media.traversal.blocked` | someone probing the media route |
| `/api/health` returning 503 | database unreachable |

Useful queries:

```bash
# orders that never got notified
SELECT id, type, attempts, last_error FROM "OutboxEvent" WHERE status = 'FAILED';

# today's orders
SELECT status, count(*) FROM "Order" WHERE "createdAt" >= CURRENT_DATE GROUP BY status;

# storage used by uploaded images
SELECT pg_size_pretty(sum("byteSize")::bigint) FROM "CakeImage";
```

---

## 9. Backups

Enable the provider's automated daily backups and point-in-time recovery. The
database is the only irreplaceable asset — images can be re-uploaded from the
phone that took them, an order book cannot be reconstructed.

Test a restore once, before you need one.

---

## 10. Rolling back

The app is stateless, so redeploy the previous build.

If the bad deploy included a migration, the schema is now ahead of the code.
Prefer a **forward fix** — additive migrations are written to be backward
compatible (new nullable columns, new tables), so the older app generally runs
against the newer schema. Only roll a migration back deliberately:

```bash
npx prisma migrate resolve --rolled-back <migration_name>
```

Do not delete rows from `_prisma_migrations`.

---

## 11. Upgrades

- **Next.js** — this codebase targets 16.x and leans on Cache Components
  semantics (`'use cache'`, `updateTag`, `connection()`, `proxy.ts`). Read the
  version-matched docs in `node_modules/next/dist/docs/` before bumping the major.
- **Prisma** — the CLI is pinned to `^7` to match `@prisma/client`. Prisma 8
  changed config and generator behaviour; upgrade both together.
- After any upgrade: `npm run typecheck && npm run lint && npm test && npm run build`,
  then re-run the post-deploy verification above.
