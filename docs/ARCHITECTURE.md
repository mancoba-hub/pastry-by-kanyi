# Architecture

How Pastry Box by Kanyi is built, and why. Written to be read by whoever inherits
this codebase — including the baker, who should be able to see what happens when
they tap "Publish".

---

## 1. The shape of the problem

Three facts drive every decision below.

1. **The gallery is the product.** Customers do not come to read copy; they come
   to look at cakes. Read traffic massively outnumbers write traffic.
2. **Sharing is the growth loop.** Links get pasted into WhatsApp and Instagram.
   A link that previews badly is a lost sale, so social metadata is functional
   infrastructure, not decoration.
3. **The baker uploads constantly, from a phone, in a kitchen.** The upload path
   must be fast, forgiving and reachable one-handed.

Two consequences:

- **Optimise reads into the CDN, not the database.** Public pages are static or
  partially prerendered. A gallery pageview should never reach Postgres.
- **Keep writes durable but non-blocking.** Placing an order must not wait on a
  third party, and publishing must be visible immediately without a redeploy.

---

## 2. System architecture

```
                        ┌──────────────────────────────┐
   customer (phone) ───▶│  CDN / edge cache            │
   WhatsApp scraper ───▶│  static shell + ISR pages    │
                        └──────────────┬───────────────┘
                                       │ cache miss / dynamic
                        ┌──────────────▼───────────────┐
                        │  Next.js 16 (App Router)     │
                        │  ┌────────────────────────┐  │
                        │  │ Server Components      │  │  read path
                        │  │  → cached service fns  │  │
                        │  ├────────────────────────┤  │
                        │  │ Server Actions         │  │  admin writes
                        │  │ Route Handlers (JSON)  │  │  public API
                        │  │ proxy.ts (optimistic)  │  │  admin gate
                        │  └────────────────────────┘  │
                        └───┬───────────┬──────────┬───┘
                            │           │          │
                 ┌──────────▼──┐  ┌─────▼──────┐  ┌▼─────────────────┐
                 │ Postgres    │  │ Object     │  │ Outbox worker    │
                 │ (managed)   │  │ storage    │  │ `outbox:drain`   │
                 │             │  │ R2/S3/CDN  │  │ (cron)           │
                 └─────────────┘  └────────────┘  └──────────────────┘
```

### Layers

| Layer | Location | Responsibility | May depend on |
| --- | --- | --- | --- |
| Presentation | `src/app`, `src/components` | routing, rendering, form state | features, services |
| Domain | `src/features/*` | schemas, form contracts, cart, admin actions | lib, services |
| Application | `src/server/services` | business rules, caching, invalidation | repositories, lib |
| Data access | `src/server/repositories` | Prisma queries only, no policy | lib/db |
| Infrastructure | `src/server/storage`, `src/server/outbox`, `src/lib/db` | Postgres, object storage, queues | — |

The rule that keeps this honest: **repositories never import services, and
services never import React.** That is what makes `placeOrder()` callable from a
test, a route handler and a future worker without change.

### Why Next.js App Router

- **Server Components** keep the gallery's JavaScript near zero on a mid-range
  Android phone. Cards, layout and metadata are HTML.
- **Cache Components** (`cacheComponents: true`) make caching explicit. Reads opt
  in with `'use cache'`; everything else is dynamic. There is no accidental
  "this page is cached and nobody knew".
- **Route Handlers** give a stable JSON API for the mobile client and for
  anything that outgrows the web UI.
- **`proxy.ts`** (Next 16's rename of `middleware`) handles the admin redirect
  before rendering.

---

## 3. Data model

Full definition: [`prisma/schema.prisma`](../prisma/schema.prisma).

```
User ──┬── Session                 (opaque, revocable, hashed tokens)
       └── AuditLog

Cake ──┬── CakeImage              (one cover, ordered gallery)
       ├── CakeTag                (facet labels: wedding, chocolate…)
       └── OrderItem

Product ──┬── ProductImage
          └── OrderItem

Order ──── OrderItem              (name/price snapshots)
           │
           └── OutboxEvent        (side effects, same transaction)

OutboxEvent                       (transactional outbox)
AuditLog                          (who changed what, when)
```

### Decisions worth knowing

**Money is an integer count of cents.** `priceCents`, `totalCents`. Floats lose
pennies and a bakery's books must reconcile. `lib/money.ts` is the only place
that formats or parses.

**Orders snapshot names and prices onto `OrderItem`.** Editing a cake's price
must not rewrite the history of orders already placed.

**`Order.publicRef` is an unguessable reference** (`PBK-8F2K9A`, 32-symbol
alphabet with `O/0/I/1` removed). It is the customer's only credential — no
account needed to check an order — which is why the lookup endpoint is rate
limited and returns a deliberately thin payload (no address, no phone, no notes).

**Keyset pagination, never `OFFSET`.** `(bakedAt, id)` is the sort key and the
cursor. `OFFSET 100000` still scans 100 000 rows, and offsets duplicate or skip
rows while the baker is uploading mid-scroll. The `id` tiebreaker is what makes
the cursor total.

**Denormalised counters.** `Cake.viewCount` / `likeCount` exist so a "most loved"
rail does not need an aggregate over an events table.

**`OutboxEvent` is written in the same transaction as the order.** "The customer
has an order" and "the baker will be notified" cannot diverge. A crash between
the two would silently lose a sale's notification.

### Indexes

Chosen for the queries the app actually runs:

| Index | Serves |
| --- | --- |
| `Cake(status, bakedAt desc)` | the gallery feed |
| `Cake(status, isFeatured, bakedAt desc)` | the home page rail |
| `Cake(status, viewCount desc)` | "most loved" |
| `CakeTag(slug)` | facet filtering |
| `Order(status, createdAt desc)` | the admin queue |
| `Session(tokenHash)` (unique) | every authenticated request |
| `OutboxEvent(status, availableAt)` | the drain query |

---

## 4. API surface

All JSON responses share one envelope:

```jsonc
// success
{ "data": …, "meta": { … } }
// failure
{ "error": { "code": "VALIDATION", "message": "…", "fields": { "phone": ["…"] } } }
```

`FailureCode` maps to HTTP status in exactly one place (`server/http.ts`), so no
endpoint can accidentally return 200 for a rejected order.

### Public — cacheable

| Method | Path | Notes |
| --- | --- | --- |
| `GET` | `/api/v1/cakes` | cursor feed. `?limit&cursor&tag&occasion`. `s-maxage` cacheable |
| `GET` | `/api/v1/cakes/[slug]` | one published bake |
| `POST` | `/api/v1/cakes/[slug]/view` | pageview beacon, best-effort |
| `GET` | `/api/v1/products` | shop listing |
| `GET` | `/api/health` | liveness **and** a `SELECT 1`; 503 when the DB is down |

### Public — writes

| Method | Path | Notes |
| --- | --- | --- |
| `POST` | `/api/v1/cart` | prices a basket. **The only shared pricing path** |
| `GET` | `/api/v1/orders/[ref]` | thin status payload, rate limited |
| `POST` | `/api/v1/orders` | creates an order. Rate limited, idempotent |

### Admin — session required

| Method | Path | Role |
| --- | --- | --- |
| `POST` | `/api/admin/uploads/presign` | ADMIN — direct-to-S3 upload |
| Server Action | login / logout | — |
| Server Action | create / update / publish / archive / delete cake | ADMIN (delete: OWNER) |
| Server Action | upload / delete cake image | ADMIN |
| Server Action | create / update / delete product | ADMIN (delete: OWNER) |
| Server Action | update order status | ADMIN |

**Why Server Actions for admin and Route Handlers for public?** Admin mutations
are form-shaped and benefit from progressive enhancement, inline validation and
`revalidatePath` in one place. The public API must be consumable by a mobile app
and by other clients, so it is a documented JSON contract. Both funnel into the
same services.

### Admin authentication

Sessions are **opaque random tokens in Postgres**, not JWTs:

- revocable — "sign out everywhere" is a single `UPDATE`
- a database leak yields SHA-256 digests, not usable credentials
- no signing-key rotation problem

Authorisation is enforced in `requireUser()` / `requireUserOrThrow()` on **every
admin page and action**. `proxy.ts` only checks whether a cookie is present — it
is a UX optimisation so anonymous visitors never render the admin tree. Delete
`proxy.ts` and the admin area is still protected.

---

## 5. UI architecture

### Route map

| Route | Type | Cache |
| --- | --- | --- |
| `/` | static | 1 min |
| `/gallery` | partial prerender | shell static, grid streamed |
| `/gallery/[slug]` | prerendered per slug | ISR, `updateTag` on publish |
| `/shop`, `/shop/[slug]` | static / prerendered | 1 h |
| `/cart`, `/checkout` | static shell, client-filled | 1 min |
| `/order/[ref]` | dynamic, `noindex` | — |
| `/order-lookup` | static | — |
| `/admin/*` | partial prerender, auth-gated | — |
| `/api/*` | dynamic (except `/api/v1/products`) | per endpoint |

### Server vs Client

Only four things are Client Components, because each genuinely needs the browser:

- `cart-store` / `use-cart` — the basket lives in `localStorage`
- `add-to-cart`, cart and checkout forms — interactive state
- `mobile-nav`, share button, view beacon — DOM APIs
- `active nav links` — `usePathname`

Everything else is a Server Component. The header, cards and layout contribute
almost nothing to the JavaScript bundle, which is the difference between a usable
and an unusable gallery on 3G.

### Mobile-first specifics

- Tap targets are ≥44px; the sticky header keeps the basket in thumb reach.
- Gallery cards use a fixed aspect ratio plus a server-inlined blur placeholder,
  so the grid never reflows as photos arrive.
- `sizes` on every `next/image` matches the real grid, so a phone downloads a
  ~400px image rather than a 2000px one.
- Filter facets are plain `<Link>`s — filter state lives in the URL, so it is
  shareable, back-button friendly and costs zero JavaScript.
- "Load more" appends via the API and de-duplicates, so scroll position survives.

### Cart design

The browser stores **only `{ kind, id, quantity }`**. Names, prices and
availability come from `POST /api/v1/cart`, which calls the *same*
`resolveLines()` that checkout calls. A client cannot dictate a price, and the
basket total can never disagree with what the customer is charged.

---

## 6. Caching and invalidation

```
read    → 'use cache' + cacheLife + cacheTag(CACHE_TAGS.cakes)
write   → updateTag(CACHE_TAGS.cakes)   // read-your-own-writes, instant
```

- `'use cache'` is applied **per function**, so write paths in the same service
  module stay uncached and can read request state.
- Tag names live in one module (`server/cache-tags.ts`) so a rename cannot
  silently leave a stale cache behind.
- Admin mutations call `updateTag` (immediate expiry within the same request)
  rather than `revalidateTag` (stale-while-revalidate), because a baker who taps
  "Publish" expects to see it live.

**Verified:** publishing a bake through the admin UI makes it appear in the
cached gallery immediately, with no rebuild and no manual purge.

### Cache Components rules that shaped the code

| Rule | Where it shows up |
| --- | --- |
| Uncached async data needs `<Suspense>` | every streamed section has a skeleton |
| Runtime APIs need `<Suspense>` | admin reads `cookies()`, so the shell streams |
| `'use cache'` cannot read `cookies()`/`headers()`/`searchParams` | caching is confined to catalog reads |
| Non-deterministic values (`new Date()`) are unstable during prerender | `server/services/site-service.ts` wraps them in `'use cache'` |
| `connection()` must not sit in a `try`/`catch` | it is awaited *before* `handleRoute()` |
| `usePathname()` blocks prerendering of dynamic routes | the nav highlight sits in its own Suspense boundary |
| A `"use server"` file may only export async functions | shared types live in `features/admin/schema.ts` |

---

## 7. Images

```
phone camera (4-12 MB JPEG/HEIC)
   → sharp: rotate by EXIF, strip metadata, cap long edge at 2400px
   → WebP q82  (measured: 73.8 KB → 17.1 KB, −77%)
   → tiny 16px blurred JPEG as an inline blurDataURL
   → object storage (content-addressed, immutable) → CDN
```

One canonical rendition is stored, not every size; `next/image` derives the
responsive variants on demand. Keys are content-addressed
(`cakes/<id>/<time>-<random>.webp`) so they are safe to cache forever and
impossible to enumerate.

**In production the browser uploads directly to the bucket** via a presigned URL
(`/api/admin/uploads/presign`), so image bytes never transit the app server. The
local driver exists for development and writes outside `public/`, so dev and
production behave the same way and a read-only filesystem does not surprise you
in production.

Upload ordering is deliberate: **bytes first, then the row.** A failure leaves an
orphaned object (harmless, cheap to sweep) rather than a row pointing at nothing
(a broken image on the live site).

---

## 8. Scaling to a lot of traffic

The read path is designed to survive a viral share; the write path is designed to
survive a busy Saturday.

| Stage | What to do | Why it holds |
| --- | --- | --- |
| **Now** | Deploy as-is | Public pages are CDN-served; the DB sees writes and admin reads only |
| **10×** | Add a read replica; point catalog reads at it; raise `minimumCacheTTL` | The feed is already index-backed and cursor-paginated |
| **100×** | Set `REDIS_URL` for shared rate limiting; move `viewCount` to a batched counter; add `@vercel/blob`-/R2-level image transforms | Removes the last per-request writes on the read path |
| **1000×** | Serve the gallery feed from a precomputed materialised view or a KV store keyed by cursor | Turns the feed into a single key lookup |

Levers already in the code:

- **`DATABASE_POOL_MAX`** — pool per process, kept small because every instance
  and every build/start worker multiplies it; the pool's total must fit the
  database plan's connection limit.
- **Direct or split URLs** — `DIRECT_URL` lets migrations bypass a pooler on
  hosts that use one, while the app always uses `DATABASE_URL`.
- **`s-maxage` + `stale-while-revalidate`** — a cache miss for one visitor is not
  a cache miss for thousands.
- **Outbox** — third-party latency is off the request path entirely, so a slow
  WhatsApp API cannot make checkout slow.
- **Idempotency keys** — retries are free; a double-tap cannot bake two cakes.
- **Cursor pagination** — cost per page is constant, not linear in depth.

Explicitly **not** built yet, and why: no Redis (one instance does not need it),
no queue service (the outbox table is a queue until throughput justifies one), no
read replica (premature until the DB shows up in a profile).

---

## 9. Security posture

| Concern | Mitigation |
| --- | --- |
| Password storage | scrypt (N=2¹⁵, r=8), parameters embedded so cost can be raised without invalidating hashes; `needsRehash()` upgrades on login |
| Session theft | httpOnly + `secure` + `sameSite=lax` cookie; only a SHA-256 digest is stored; sessions revocable and slid forward on use |
| User enumeration | identical failure message and identical work for unknown accounts (dummy hash) |
| Brute force | per-IP limiter on login; per-client limiter on orders and lookups |
| **Price tampering** | prices are never accepted from the client — resolved server-side from the catalog in one shared code path |
| Path traversal | media route resolves and verifies the target stays inside the storage root; keys are server-generated, never client-supplied |
| Open redirect | post-login destination restricted to same-origin `/admin` paths |
| Content-type attacks | server picks the storage key and enforces an image MIME allow-list |
| Error leakage | unexpected errors become a generic 500 with a digest; details go to structured logs only |
| Soft-404 indexing | missing resources render with `noindex` |
| CSRF | same-origin cookies, `sameSite=lax`, and Server Actions carry Next's built-in origin checks |
| Security headers | `nosniff`, `X-Frame-Options`, `Referrer-Policy` set globally in `next.config.ts` |

Not yet done, deliberately: no CSP (needs the font/image origins pinned first),
no MFA on the admin panel (a two-person team; the login limiter covers the
realistic threat).

---

## 10. Testing strategy

| Layer | Tool | What it proves |
| --- | --- | --- |
| Unit (`tests/unit`) | Vitest | money cannot drift; slugs, phones, cursors, idempotency keys, rate limiting, password hashing |
| Integration (`tests/integration`) | Vitest + real Postgres | pricing is server-side, lead time enforced, stock honoured, idempotency real, outbox written transactionally |
| HTTP smoke | Node script | the deployed app: pages, headers, auth gating, media, the whole order flow |

Integration tests run against a real database on purpose: the property that
matters most — *a client cannot dictate a price* — is only meaningful when the
catalog is actually being read. A mocked repository would happily prove the wrong
thing.

Measured coverage of the critical path: **106 tests**, including a regression
test for a clock bug found by the smoke suite (reading `Date.now()` twice made
orders without an explicit date fail intermittently).
