# Deployment and operations

Everything needed to put this on the internet and keep it running.

## Hosting requirements

This is a **Next.js server application**, not a static site:

- **Node.js 20.9+** (Node 22 LTS is what it is built on) running `npm start`
  behind a reverse proxy. The pages, admin area, image pipeline and JSON API all
  need a long-lived Node process — there is no static export mode.
- A **PostgreSQL database** the app can reach — from the build step *and* from
  the running server. `next build` prerenders the gallery and shop pages from
  the database, so a database the build environment cannot reach fails the
  deploy, not just a request.
- **Persistent disk** only if `STORAGE_DRIVER=local` (single-server setups).
  Render's filesystem is ephemeral, so anything deployed there needs
  `STORAGE_DRIVER=s3`.

Shared hosting without Node.js support (a plain PHP cPanel/DirectAdmin plan)
**cannot host this app** — there is nothing to run the server. Use **Render**, a
**VPS**, or any Node/container platform. If the database lives on shared hosting
and the app runs elsewhere, remember that those databases usually accept
connections only from within the host's own network ("remote database"
allowlists exist but are brittle) — a box that runs both is the simplest shape.

---

## 1. Checklist before the first deploy

- [ ] `AUTH_SECRET` is a fresh 32-byte random value (`node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`)
- [ ] `NEXT_PUBLIC_SITE_URL` is the real `https://` origin, **no trailing slash**
- [ ] `DATABASE_URL` is the PostgreSQL connection string (`DIRECT_URL` empty unless your provider exposes a separate pooled/direct pair; on Render the Blueprint injects both the URL and `AUTH_SECRET` for you)
- [ ] Storage decided: `STORAGE_DRIVER=s3` with a bucket (required on Render, whose filesystem is ephemeral), or `local` on a server with a persistent disk
- [ ] `NEXT_PUBLIC_WHATSAPP_NUMBER` is the real number, digits only, no `+`
- [ ] The seeded staff password has been changed after first login
- [ ] `npm run db:deploy` has been run against production
- [ ] `outbox:drain` is scheduled
- [ ] A photo uploaded through `/admin` after deploy renders in `/gallery`

`NEXT_PUBLIC_SITE_URL` is not cosmetic: it is the base for canonical URLs,
`sitemap.xml`, and the absolute OpenGraph image URLs that decide whether a link
shared on WhatsApp shows a preview card or a bare URL.

---

## 2. Database (PostgreSQL)

### Connection string

```
postgresql://<db-user>:<db-password>@<db-host>:5432/<db-name>
```

- Percent-encode special characters in the password (`p@ss` → `p%40ss`); the
  port can be omitted when it is the default 5432.
- Render rejects plaintext **external** connections, so append
  `?sslmode=require` to an external URL. Internal URLs encrypt too.
- `DIRECT_URL` only exists for providers that expose a separate endpoint for
  migrations — a PgBouncer pooler that cannot run DDL, for example. With a
  single endpoint (Render Postgres without pooling, a VPS) leave it empty and
  the Prisma CLI falls back to `DATABASE_URL`.

### Render Postgres

`render.yaml` creates the database and wires it in; the dashboard
(**New → Postgres**) does the same by hand. Its **Info** page shows two URLs:

| URL | Reachable from | Used for |
| --- | --- | --- |
| **Internal** | Render services in the same region *and their builds* | what the Blueprint injects as `DATABASE_URL` — lowest latency, traffic never leaves Render's private network |
| **External** | anywhere, your laptop included | running `db:deploy` / `db:seed` from a developer machine |

The build has database access, which is why migrations can run inside the build
command (see §4) — the same pattern as Render's own
[Django](https://github.com/render-examples/django) and Rails templates.

External access is enabled by default. To limit the database to the private
network — after which only Render services and their builds can reach it — add
this to `render.yaml` and sync:

```yaml
databases:
  - name: pastry-db
    ipAllowList: []
```

A paid plan is required for anything real: free Render Postgres instances expire
30 days after creation, have no backups, and cap at 1 GB.

### Apply migrations

```bash
npm run db:deploy        # production: applies pending migrations, never prompts
npm run db:migrate       # development: creates a migration from schema changes
```

`db:deploy` is the only command CI/CD should run — on Render it is part of the
web service's build command (see §4). `db:migrate` can generate destructive
diffs, requires a shadow database, and is for local development only.

### Self-hosted Postgres (Docker)

```bash
docker compose up -d
npm run db:deploy && npm run db:seed
```

`docker-compose.yml` maps the host port to **5433** to avoid colliding with a
Postgres already installed on 5432.

### Pools and connection limits

`DATABASE_POOL_MAX` (default 5) is the pool size **per process**. Every instance
and every worker `next build`/`next start` spawns opens its own pool, so keep
the total (instances × workers × this value) under the plan's connection limit.

### Migration history

The history is the two PostgreSQL baselines under `prisma/migrations`
(`20261007072215_init`, `20261007073000_product_image_bytesize`). A database
left over from the MariaDB detour — or the PostgreSQL schema from before it —
cannot be migrated in place: dump the data as SQL/CSV and re-import it after
`db:deploy` creates the tables on a fresh database.

---

## 3. Pictures: how uploads work

Photos enter the site **only through the admin area** — there is no FTP or File
Manager step and nothing to copy into `public/`:

1. Sign in at `/admin/login`.
2. Open **Cakes → Add bake** (or edit an existing one), or a product.
3. Pick photos with the file chooser (up to 15 MB each; JPEG, PNG, WebP, AVIF,
   HEIC/HEIF — a phone camera roll works directly).
4. Save. Published bakes appear in `/gallery` immediately, no rebuild.

Each file is normalised once on the way in — EXIF rotation baked in, metadata
(GPS) stripped, long edge capped at 2400 px, converted to WebP, plus a tiny blur
placeholder — and then written to the configured storage driver. Deleting a
photo in the admin removes the stored object too.

`STORAGE_DRIVER` decides where those bytes live.

### `local` — the server's disk (fine for a single VPS)

```
STORAGE_DRIVER="local"
STORAGE_LOCAL_DIR=".uploads"          # relative to the app directory
```

Files are served through `/api/media/...`. Requirements:

- a **persistent** disk — a VPS qualifies; a Render service's filesystem does
  not (it is wiped on every deploy, restart and spin-down)
- **back the folder up** together with the database; photos cannot be
  reconstructed from the database alone
- the directory must be writable by the Node process, and must survive deploys
  (keep it outside the folder that a deploy replaces — e.g.
  `/srv/data/uploads` on a VPS)

### `s3` — object storage (needed at scale or on multiple instances)

Required when the filesystem is ephemeral or several instances serve traffic.
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

The admin UI currently posts files through a **Server Action** for both drivers,
so upload bytes pass through the app server on their way to the bucket — fine at
a bakery's upload volume, and the 15 MB per-file limit sits well inside the
20 MB Server Action body limit configured in `next.config.ts`. The `s3` driver
additionally exposes presigned uploads (`/api/admin/uploads/presign`,
`ADMIN`-only) for a browser-direct path if that volume ever changes. Reads never
touch the server — images are served straight from `STORAGE_PUBLIC_BASE_URL` —
so the bucket needs no CORS policy.

---

## 4. Deploying the app

### Render (Blueprint included)

`render.yaml` in the repository root is a complete Blueprint: a Starter web
service, a PostgreSQL database and a cron job for `outbox:drain`, all in one
region. Deploying is three steps.

1. Push the repository to GitHub — Render deploys the branch named in the
   Blueprint (`main`).
2. In the [Render Dashboard](https://dashboard.render.com): **New → Blueprint**,
   pick the repository, and apply. You are prompted for the `sync: false` values
   from `render.yaml`: the WhatsApp number, the business contact details, the
   `SEED_ADMIN_*` credentials, and the `S3_*` / `STORAGE_PUBLIC_BASE_URL` bucket
   settings (§3 explains the R2 side).
3. Wait for the first build. It runs, in order:

   ```
   npm ci                    # installs dependencies; postinstall generates the Prisma client
   npm run db:deploy         # applies the migrations — the build can reach the database
   npm run db:seed-if-empty  # fills an empty catalogue, then gets out of the way
   npm run build             # prerenders the gallery and shop from the database
   ```

   Both database steps live in the **build** command on purpose:

   - `next build` reads the database, so the schema has to exist first — a
     pre-deploy command would run too late on a fresh database.
     `prisma migrate deploy` is idempotent, so re-runs are harmless.
   - Cache Components require `generateStaticParams` to return at least one
     result, so a database with **no cakes or no products makes the build fail**
     (`/shop/[slug]`, `/gallery/[slug]`). `db:seed-if-empty` fills whichever
     collection is still empty and skips the rest, so it seeds a fresh database
     once and never resets rows the owner has edited — which is why the plain
     `db:seed` (which resets the demo rows in place) is *not* what runs here.

   The seed drives the real image pipeline, so the build also proves the bucket
   wiring works. The service then starts (`npm start`) and the health check at
   `GET /api/health` goes green.

Everything else is wired for you: `DATABASE_URL` comes from the database
(`fromDatabase`, the private-network URL), `AUTH_SECRET` is generated, and the
cron job references the web service's values instead of duplicating them.

After the first deploy:

- If Render assigned a different subdomain than `pastry-by-kanyi`, update
  `NEXT_PUBLIC_SITE_URL` in the dashboard and redeploy — canonical URLs,
  `sitemap.xml` and WhatsApp link previews all use it.
- Sign in at `/admin/login` with the seeded credentials and **change the
  password**.
- Point the real domain at the service under **Settings → Custom Domains**;
  Render provisions TLS. Then update `NEXT_PUBLIC_SITE_URL` and redeploy.

Notes worth knowing:

- **Region.** The Blueprint uses `frankfurt`. Services and database must share a
  region for the private network to work. Render has no African region;
  Frankfurt and London are the closest to South Africa.
- **Deploys are zero-downtime** — Render builds, health-checks and only then
  switches traffic (§10 covers rolling back).
- **Plan IDs.** Render renamed compute plans in August 2026: services still accept
  the legacy names (`starter`, `standard`, …), but **new Postgres databases
  require the new IDs** (`0.1c-256mb`, `1c-2g`, …) — the Blueprint already uses them.
- **Free plan** is a demo-only option: free services sleep after 15 minutes idle,
  free Postgres expires after 30 days, and cron jobs (like most deploy features)
  require a paid plan.

### VPS (nginx + Node)

One-time setup on the server (Ubuntu/Debian):

```bash
# Node.js 22 LTS
curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && apt-get install -y nodejs

# PostgreSQL, if the database lives on this box
apt-get install -y postgresql
# then, as the postgres user:
#   CREATE DATABASE pastry;
#   CREATE USER pastry WITH PASSWORD '…';
#   GRANT ALL PRIVILEGES ON DATABASE pastry TO pastry;
#   GRANT ALL ON SCHEMA public TO pastry;

# nginx + TLS
apt-get install -y nginx certbot python3-certbot-nginx
```

App install (per deploy):

```bash
cd /srv && git clone <repo> pastry-by-kanyi && cd pastry-by-kanyi
cp .env.example .env && nano .env        # DATABASE_URL, AUTH_SECRET, NEXT_PUBLIC_*, storage
npm ci
npm run build
npm run db:deploy
npm start                                 # keep alive with systemd or pm2
```

Keep the process alive with a systemd unit instead of a terminal. `/etc/systemd/system/pastry.service`:

```ini
[Unit]
Description=Pastry by Kanyi (Next.js)
After=network.target postgresql.service

[Service]
Type=simple
User=pastry
WorkingDirectory=/srv/pastry-by-kanyi
Environment=NODE_ENV=production
Environment=PORT=3000
ExecStart=/usr/bin/npm start
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

```bash
systemctl daemon-reload && systemctl enable --now pastry
```

Next.js loads `.env` from the app directory at startup, so no extra
`EnvironmentFile` is needed — just keep the file readable only by the service
user (`chmod 600 .env`, `chown -R pastry:pastry /srv/pastry-by-kanyi`).

nginx as the TLS-terminating reverse proxy — `/etc/nginx/sites-available/pastry`:

```nginx
server {
    listen 80;
    server_name pastrybykanyi.com www.pastrybykanyi.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

```bash
ln -s /etc/nginx/sites-available/pastry /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
certbot --nginx -d pastrybykanyi.com -d www.pastrybykanyi.com
```

Then open only 80/443 in the firewall — port 3000 stays on loopback.

Two notes for a self-hosted database:

- With `STORAGE_DRIVER=local`, point the uploads directory at an **absolute
  path outside the git checkout** — `STORAGE_LOCAL_DIR="/srv/data/uploads"` —
  so redeploys cannot wipe photos.
- With the database on the same box, `DATABASE_URL` uses `localhost` and no
  TLS. A managed database elsewhere needs its external URL, usually with
  `?sslmode=require`.

Add the cron entry from §5 (`outbox:drain`) once the site is up.

### Other Node/container platforms (Fly.io, Railway, Vercel, …)

A standalone Next server is enough; no Dockerfile is shipped because none of
these providers need one, but the shape is:

```
npm ci                 # postinstall generates the Prisma client
npm run db:deploy      # release step, once per deploy
npm run build
npm start              # PORT from the environment
```

Requirements and caveats:

- Node.js **20.9+** (Next 16 minimum). Node 22 LTS is what this was built on.
- The database must be reachable from the **build** environment as well as at
  runtime — `next build` queries it. Platforms that isolate builds from their
  private network need a database that is reachable over the public internet
  (or a build runner you control).
- Serverless platforms need `STORAGE_DRIVER=s3` — the filesystem is ephemeral.
- `sharp` has prebuilt binaries for linux-x64/arm64; no build toolchain needed.
- Migrations and seeds are not run automatically, and `outbox:drain` needs a
  scheduler (§5). Run them deliberately.

### Health checks

Point the platform's health check at `GET /api/health`. It returns `200` only
when the database answers a `SELECT 1`, and `503` otherwise, so an instance that
is running but cannot reach the database is pulled out of rotation instead of
serving errors.

---

## 5. Scheduled jobs

On Render the Blueprint provisions a **cron job** (`pastry-by-kanyi-outbox`)
that runs `npm run outbox:drain` every five minutes, so there is nothing to
schedule by hand. Render builds it once per deploy and bills it per second of
runtime; cron jobs are not available on the free plan.

On a VPS, one cron entry (`crontab -e` as the service user):

```cron
*/5 * * * * cd /srv/pastry-by-kanyi && /usr/bin/npm run outbox:drain >> /var/log/pastry-outbox.log 2>&1
```

The `cd` matters: the script reads `.env` from the working directory.

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

On Render, steps 1 and 2 happen automatically in the web service's build command
(`db:deploy` then `db:seed-if-empty`). Both are also safe to run by hand from a
local checkout pointed at the production `DATABASE_URL` (the external URL).

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

Useful queries (camelCase identifiers need double quotes, `Order` is reserved):

```sql
-- orders that never got notified
SELECT id, type, attempts, "lastError" FROM "OutboxEvent" WHERE status = 'FAILED';

-- today's orders
SELECT status, count(*) FROM "Order" WHERE "createdAt" >= CURRENT_DATE GROUP BY status;

-- storage used by uploaded images
SELECT ROUND(SUM("byteSize") / 1024.0 / 1024.0, 1) AS megabytes FROM "CakeImage";
```

---

## 9. Backups

Enable the provider's automated daily backups and keep the dumps off the server.
Paid Render Postgres plans include automated backups and point-in-time recovery
in the dashboard; on a VPS, `pg_dump` on a cron is the straightforward option.

What to keep:

- **the database** — the order book and the catalog. This is the asset that
  cannot be reconstructed.
- **`STORAGE_LOCAL_DIR`** when `STORAGE_DRIVER=local` — the uploaded photos. A
  nightly `tar` of the folder is enough; with `STORAGE_DRIVER=s3` the bucket is
  the storage of record and its own versioning/backup rules apply.

Test a restore once, before you need one.

---

## 10. Rolling back

The app is stateless, so redeploy the previous build — on Render that is
**Deploys → Rollback** to the last good deploy.

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
