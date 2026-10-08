# Deployment and operations

Everything needed to put this on the internet and keep it running.

## Hosting requirements

This is a **Next.js server application**, not a static site:

- **Node.js 20.9+** (Node 22 LTS is what it is built on) running `npm start`
  behind a reverse proxy. The pages, admin area, image pipeline and JSON API all
  need a long-lived Node process — there is no static export mode.
- A **MariaDB/MySQL database** the app can reach from that process.
- **Persistent disk** only if `STORAGE_DRIVER=local` (single-server setups).

Shared hosting without Node.js support (a plain PHP cPanel/DirectAdmin plan)
**cannot host this app** — there is nothing to run the server. Use a **VPS or
dedicated server**, or any Node/container platform. If the database is on shared
hosting and the app runs elsewhere, remember that cPanel databases usually
accept connections only from within the host's own network ("Remote MySQL"
allowlists exist but are brittle) — a VPS that runs both is the simplest shape.

---

## 1. Checklist before the first deploy

- [ ] `AUTH_SECRET` is a fresh 32-byte random value (`node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`)
- [ ] `NEXT_PUBLIC_SITE_URL` is the real `https://` origin, **no trailing slash**
- [ ] `DATABASE_URL` is the MariaDB/MySQL connection string from the host's panel (`DIRECT_URL` empty unless your provider exposes separate endpoints)
- [ ] Storage decided: `STORAGE_DRIVER=s3` with a bucket, or `local` on a server with a persistent disk
- [ ] `NEXT_PUBLIC_WHATSAPP_NUMBER` is the real number, digits only, no `+`
- [ ] The seeded staff password has been changed after first login
- [ ] `npm run db:deploy` has been run against production
- [ ] `outbox:drain` is scheduled
- [ ] A photo uploaded through `/admin` after deploy renders in `/gallery`

`NEXT_PUBLIC_SITE_URL` is not cosmetic: it is the base for canonical URLs,
`sitemap.xml`, and the absolute OpenGraph image URLs that decide whether a link
shared on WhatsApp shows a preview card or a bare URL.

---

## 2. Database (MariaDB / MySQL)

### Connection string

```
mysql://<db-user>:<db-password>@<db-host>:3306/<db-name>
```

- Compose it from the database section of the host's panel. Percent-encode
  special characters in the password (`p@ss` → `p%40ss`).
- `mariadb://` is accepted as well; both mean the same database.
- `DIRECT_URL` only exists for providers that expose a separate endpoint for
  migrations (a pooler that cannot run DDL, for example). With a single
  endpoint — HostAfrica, a VPS — leave it empty and the Prisma CLI falls back to
  `DATABASE_URL`.

### HostAfrica (cPanel / DirectAdmin database)

1. In the panel open **Databases → MySQL/MariaDB Databases**.
2. Create the database (e.g. `kanyi_pastry`), then a user with a strong
   password, and grant that user ALL PRIVILEGES on the database.
3. The database host is `localhost` when the app runs on the same machine; use
   the hostname from the panel if it differs.
4. Put the values into `DATABASE_URL`, then run `npm run db:deploy` from the
   machine that can reach the database (usually the VPS itself).

Panel database users normally cannot `CREATE DATABASE`, so `npm run db:migrate`
(the dev command that needs a shadow database) does not work against them — use
`db:deploy`, which applies the committed migration files without a shadow.

### Apply migrations

```bash
npm run db:deploy        # production: applies pending migrations, never prompts
npm run db:migrate       # development: creates a migration from schema changes
```

`db:deploy` is the only command CI/CD should run. `db:migrate` can generate
destructive diffs, requires a shadow database, and is for local development.

### Self-hosted MariaDB (Docker)

```bash
docker compose up -d
npm run db:deploy && npm run db:seed
```

`docker-compose.yml` maps the host port to **3307** to avoid colliding with a
MariaDB/MySQL already installed on 3306.

### Pools and connection limits

`DATABASE_POOL_MAX` (default 5) is the pool size **per process**. Keep the pool
small enough that every app process together stays under the database account's
connection cap (shared hosts often allow only 15–30 connections per user).

### Migration history

The MySQL schema starts from a single baseline migration
(`prisma/migrations/20261008073743_init`); the PostgreSQL migrations that
preceded it are gone from the history. A database that already carries the
PostgreSQL schema cannot be migrated in place — dump the data as SQL/CSV and
re-import it after `db:deploy` creates the tables.

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

- a **persistent** disk — a HostAfrica VPS qualifies; anything ephemeral does not
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

With S3, uploads go **browser → bucket** via presigned URLs
(`/api/admin/uploads/presign`), so image bytes never pass through the app server.
The presign endpoint requires an authenticated `ADMIN` session. With the local
driver the admin UI posts files through the server instead, which is fine for a
single box.

---

## 4. Deploying the app

### HostAfrica VPS (nginx + Node, most common shape)

One-time setup on the server (Ubuntu/Debian):

```bash
# Node.js 22 LTS
curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && apt-get install -y nodejs

# MariaDB, if the database lives on this box
apt-get install -y mariadb-server && mysql_secure_installation
# then, in `mariadb`:
#   CREATE DATABASE pastry CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
#   CREATE USER 'pastry'@'localhost' IDENTIFIED BY '…';
#   GRANT ALL PRIVILEGES ON pastry.* TO 'pastry'@'localhost';

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
After=network.target mariadb.service

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

Two HostAfrica-specific notes:

- With `STORAGE_DRIVER=local`, point the uploads directory at an **absolute
  path outside the git checkout** — `STORAGE_LOCAL_DIR="/srv/data/uploads"` —
  so redeploys cannot wipe photos.
- If you want to keep the database account from your old shared plan instead of
  creating one on the VPS, add the VPS IP under **Remote MySQL** in the panel;
  otherwise create the database in the VPS's own MariaDB (the one-time setup
  above) and use `localhost` as the host.

Add the cron entry from §5 (`outbox:drain`) once the site is up.

### Vercel or another serverless/Node platform

1. Import the repository.
2. Add every variable from `.env.example`.
3. Build command `npm run build`; install command `npm install`.
4. **Do not** add a build-time migration step unless you are certain the database
   is reachable from the build environment — prefer a release step or a manual
   `npm run db:deploy`.
5. Serverless platforms need `STORAGE_DRIVER=s3` — the filesystem is ephemeral.

Migrations and seeds are not run automatically. Run them deliberately.

### Container host (Fly.io, Railway, Render, …)

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
is running but cannot reach the database is pulled out of rotation instead of
serving errors.

---

## 5. Scheduled jobs

One cron entry (`crontab -e` as the service user):

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

Useful queries (camelCase identifiers need backticks, `Order` is reserved):

```sql
-- orders that never got notified
SELECT id, type, attempts, lastError FROM `OutboxEvent` WHERE status = 'FAILED';

-- today's orders
SELECT status, count(*) FROM `Order` WHERE createdAt >= CURRENT_DATE GROUP BY status;

-- storage used by uploaded images
SELECT ROUND(SUM(byteSize) / 1024 / 1024, 1) AS megabytes FROM `CakeImage`;
```

---

## 9. Backups

Enable the provider's automated daily backups and keep the dumps off the server.
On a VPS, `mysqldump` on a cron is the straightforward option; shared-panel
databases have a backup feature in the control panel.

What to keep:

- **the database** — the order book and the catalog. This is the asset that
  cannot be reconstructed.
- **`STORAGE_LOCAL_DIR`** when `STORAGE_DRIVER=local` — the uploaded photos. A
  nightly `tar` of the folder is enough; with `STORAGE_DRIVER=s3` the bucket is
  the storage of record and its own versioning/backup rules apply.

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
