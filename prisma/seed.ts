import "dotenv/config";
import sharp from "sharp";
import { db } from "../src/lib/db";
import { hashPassword } from "../src/server/auth/password";
import { tagSlug } from "../src/lib/slug";
import { buildStorageKey } from "../src/server/storage/images";
import { storage } from "../src/server/storage";

/**
 * Seed script.
 *
 * Beyond creating the admin user, this deliberately drives the *real* image
 * pipeline: it renders placeholder photos with sharp, pushes them through the
 * configured storage driver, and records the resulting rows. That means a
 * successful seed proves uploads, resizing, blur placeholders and storage
 * wiring all work — the parts most likely to break in a new environment.
 *
 * Idempotent: re-running updates catalog rows in place and leaves existing
 * images alone. Run with `npm run db:seed`.
 *
 * `--if-empty` (`npm run db:seed-if-empty`) skips whichever collection already
 * has rows. A build step wants exactly that: it only ever fills a fresh
 * database — without it, every deploy would reset the demo rows to their seed
 * values. Next 16's Cache Components also require `generateStaticParams` to
 * return at least one result, so a database with no cakes or no products fails
 * `next build`; this flag is what makes a first deploy work.
 */

type SeedCake = {
  slug: string;
  title: string;
  description: string;
  flavour: string;
  occasion: string;
  servings: number;
  priceCents: number;
  isFeatured: boolean;
  tags: string[];
  /** Two-stop gradient used to render the placeholder photo. */
  palette: [string, string];
  daysAgo: number;
};

const SEED_CAKES: SeedCake[] = [
  {
    slug: "melktert-cinnamon-celebration-cake",
    title: "Melktert & Cinnamon Celebration Cake",
    description:
      "Our take on melktert, rebuilt as a layer cake: cinnamon sponge, silky milk-custard filling and a dusting of cinnamon sugar. Baked for a 40th in Bryanston.",
    flavour: "Cinnamon, vanilla custard",
    occasion: "Birthday",
    servings: 24,
    priceCents: 78000,
    isFeatured: true,
    tags: ["Birthday", "Melktert", "Cinnamon"],
    palette: ["#f6e7cf", "#b8804a"],
    daysAgo: 2,
  },
  {
    slug: "peppermint-crisp-fridge-tart-cake",
    title: "Peppermint Crisp Fridge Tart Cake",
    description:
      "Caramel, whipped cream and crushed Peppermint Crisp layered over a dark chocolate base. The one everybody asks for after a braai.",
    flavour: "Caramel, mint, dark chocolate",
    occasion: "Birthday",
    servings: 18,
    priceCents: 65000,
    isFeatured: true,
    tags: ["Chocolate", "Caramel", "No-bake"],
    palette: ["#e9dfd2", "#3f4a2f"],
    daysAgo: 5,
  },
  {
    slug: "lemon-naartjie-wedding-tier",
    title: "Lemon & Naartjie Wedding Tier",
    description:
      "A two-tier lemon sponge with naartjie curd and mascarpone cream, dressed with fresh citrus and proteas. Made for a wedding in Stellenbosch.",
    flavour: "Lemon, naartjie, mascarpone",
    occasion: "Wedding",
    servings: 80,
    priceCents: 285000,
    isFeatured: true,
    tags: ["Wedding", "Citrus", "Floral"],
    palette: ["#fdf6e3", "#c9a227"],
    daysAgo: 9,
  },
  {
    slug: "amarula-chocolate-drip-cake",
    title: "Amarula Chocolate Drip Cake",
    description:
      "Dark chocolate sponge soaked with Amarula, salted caramel filling and a glossy ganache drip. Ordered for an anniversary in Constantia.",
    flavour: "Dark chocolate, Amarula, salted caramel",
    occasion: "Anniversary",
    servings: 20,
    priceCents: 89000,
    isFeatured: false,
    tags: ["Chocolate", "Anniversary", "Caramel"],
    palette: ["#e8d6c3", "#4a2318"],
    daysAgo: 13,
  },
  {
    slug: "rooibos-honey-yoghurt-loaf",
    title: "Rooibos, Honey & Yoghurt Loaf",
    description:
      "A homely loaf steeped with rooibos, sweetened with local honey and layered with yoghurt cream and toasted pecan. Baked for a baby shower in Durbanville.",
    flavour: "Rooibos, honey, pecan",
    occasion: "Baby shower",
    servings: 16,
    priceCents: 52000,
    isFeatured: false,
    tags: ["Baby shower", "Rooibos", "Honey"],
    palette: ["#f7e6c4", "#a8763e"],
    daysAgo: 20,
  },
  {
    slug: "granadilla-cheesecake",
    title: "Granadilla Cheesecake",
    description:
      "Baked vanilla cheesecake under a granadilla curd, on a tennis biscuit base. Made for a graduation lunch in Umhlanga.",
    flavour: "Granadilla, vanilla",
    occasion: "Graduation",
    servings: 14,
    priceCents: 56000,
    isFeatured: false,
    tags: ["Cheesecake", "Granadilla"],
    palette: ["#fdf1cf", "#d98324"],
    daysAgo: 27,
  },
];

const SEED_PRODUCTS = [
  {
    slug: "classic-buttermilk-scones-pack-of-6",
    name: "Classic Buttermilk Scones",
    description: "Flaky, lightly sweet and baked the same morning. Best with tea, obviously.",
    priceCents: 7500,
    unitLabel: "pack of 6",
    isFeatured: true,
    maxPerOrder: 10,
    palette: ["#f9ecd7", "#c08a2e"] as [string, string],
  },
  {
    slug: "cheese-and-chive-scones-pack-of-6",
    name: "Cheese & Chive Scones",
    description: "Mature cheddar and fresh chives. Excellent warm, split and buttered.",
    priceCents: 8500,
    unitLabel: "pack of 6",
    isFeatured: true,
    maxPerOrder: 10,
    palette: ["#f3e7cf", "#b06a1f"] as [string, string],
  },
  {
    slug: "bran-and-raisin-scones-pack-of-6",
    name: "Bran & Raisin Scones",
    description: "The bran-muffin classic in scone form: soaked raisins and a demerara crust.",
    priceCents: 8000,
    unitLabel: "pack of 6",
    isFeatured: false,
    maxPerOrder: 10,
    palette: ["#efdfc4", "#8c5a2b"] as [string, string],
  },
  {
    slug: "scone-selection-box",
    name: "Scone Selection Box",
    description: "Twelve scones across all three flavours. The office-order favourite.",
    priceCents: 15000,
    unitLabel: "box of 12",
    isFeatured: true,
    maxPerOrder: 5,
    palette: ["#f7ecd9", "#a8641f"] as [string, string],
  },
];

/**
 * Renders a warm two-tone gradient placeholder.
 *
 * Intentionally text-free: SVG text rendering depends on fonts available to
 * librsvg, which differ across machines. A gradient always renders identically.
 */
async function renderPlaceholder(
  [from, to]: [string, string],
  width = 1600,
  height = 2000,
): Promise<Buffer> {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="${from}"/>
        <stop offset="100%" stop-color="${to}"/>
      </linearGradient>
      <radialGradient id="v" cx="50%" cy="38%" r="72%">
        <stop offset="0%" stop-color="#ffffff" stop-opacity="0.55"/>
        <stop offset="100%" stop-color="#000000" stop-opacity="0.12"/>
      </radialGradient>
    </defs>
    <rect width="100%" height="100%" fill="url(#g)"/>
    <rect width="100%" height="100%" fill="url(#v)"/>
  </svg>`;

  return sharp(Buffer.from(svg)).webp({ quality: 82 }).toBuffer();
}

async function attachImage(args: {
  prefix: "cakes" | "products";
  entityId: string;
  palette: [string, string];
  alt: string;
}): Promise<void> {
  const raw = await renderPlaceholder(args.palette);
  const meta = await sharp(raw).metadata();

  const blur = await sharp(raw).resize({ width: 16 }).blur(1.2).jpeg({ quality: 45 }).toBuffer();

  const key = buildStorageKey(args.prefix, args.entityId);
  const stored = await storage().put(key, raw, "image/webp");

  const data = {
    storageKey: stored.key,
    url: stored.url,
    width: meta.width ?? 1600,
    height: meta.height ?? 2000,
    blurDataUrl: `data:image/jpeg;base64,${blur.toString("base64")}`,
    alt: args.alt,
    isCover: true,
    position: 0,
    byteSize: raw.byteLength,
  };

  if (args.prefix === "cakes") {
    await db.cakeImage.create({ data: { ...data, cakeId: args.entityId } });
  } else {
    await db.productImage.create({ data: { ...data, productId: args.entityId } });
  }
}

async function main() {
  const onlyIfEmpty = process.argv.includes("--if-empty");

  const adminEmail = (process.env.SEED_ADMIN_EMAIL ?? "kanyi@example.com").toLowerCase();
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? "change-me-before-deploying";
  const adminName = process.env.SEED_ADMIN_NAME ?? "Kanyi";

  console.log("→ seeding admin user");
  const existingAdmin = await db.user.findUnique({ where: { email: adminEmail } });

  // Never silently reset a password that has already been changed in production.
  const passwordHash = existingAdmin?.passwordHash ?? (await hashPassword(adminPassword));

  await db.user.upsert({
    where: { email: adminEmail },
    create: { email: adminEmail, name: adminName, passwordHash, role: "OWNER" },
    update: { name: adminName, role: "OWNER", isActive: true },
  });

  if (!existingAdmin) {
    console.log(`   created owner account: ${adminEmail}`);
    console.log("   ⚠  change the password after your first login");
  } else {
    console.log("   owner account already existed — password left unchanged");
  }

  const cakesExist = onlyIfEmpty && (await db.cake.count()) > 0;
  console.log(cakesExist ? "→ cakes already present — skipped (--if-empty)" : "→ seeding cakes");
  for (const cake of cakesExist ? [] : SEED_CAKES) {
    const bakedAt = new Date(Date.now() - cake.daysAgo * 24 * 60 * 60 * 1000);

    const row = await db.cake.upsert({
      where: { slug: cake.slug },
      create: {
        slug: cake.slug,
        title: cake.title,
        description: cake.description,
        flavour: cake.flavour,
        occasion: cake.occasion,
        servings: cake.servings,
        priceCents: cake.priceCents,
        status: "PUBLISHED",
        isFeatured: cake.isFeatured,
        bakedAt,
        publishedAt: bakedAt,
        tags: { create: cake.tags.map((label) => ({ label, slug: tagSlug(label) })) },
      },
      update: {
        title: cake.title,
        description: cake.description,
        flavour: cake.flavour,
        occasion: cake.occasion,
        servings: cake.servings,
        priceCents: cake.priceCents,
        status: "PUBLISHED",
        isFeatured: cake.isFeatured,
        bakedAt,
      },
      select: { id: true, slug: true },
    });

    const imageCount = await db.cakeImage.count({ where: { cakeId: row.id } });
    if (imageCount === 0) {
      await attachImage({
        prefix: "cakes",
        entityId: row.id,
        palette: cake.palette,
        alt: `${cake.title} · ${cake.flavour}`,
      });
    }

    console.log(`   ${cake.slug}`);
  }

  const productsExist = onlyIfEmpty && (await db.product.count()) > 0;
  console.log(productsExist ? "→ products already present — skipped (--if-empty)" : "→ seeding products");
  for (const product of productsExist ? [] : SEED_PRODUCTS) {
    const row = await db.product.upsert({
      where: { slug: product.slug },
      create: {
        slug: product.slug,
        name: product.name,
        description: product.description,
        priceCents: product.priceCents,
        unitLabel: product.unitLabel,
        status: "ACTIVE",
        isFeatured: product.isFeatured,
        stockQty: null,
        maxPerOrder: product.maxPerOrder,
      },
      update: {
        name: product.name,
        description: product.description,
        priceCents: product.priceCents,
        unitLabel: product.unitLabel,
        status: "ACTIVE",
        isFeatured: product.isFeatured,
      },
      select: { id: true, slug: true },
    });

    const imageCount = await db.productImage.count({ where: { productId: row.id } });
    if (imageCount === 0) {
      await attachImage({
        prefix: "products",
        entityId: row.id,
        palette: product.palette,
        alt: product.name,
      });
    }

    console.log(`   ${product.slug}`);
  }

  console.log("\n✔ seed complete");
}

main()
  .catch((error: unknown) => {
    console.error("\n✖ seed failed");
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
