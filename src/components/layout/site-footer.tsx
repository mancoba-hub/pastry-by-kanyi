import Link from "next/link";
import Image from "next/image";
import logo from "@/images/logo.png";
import { publicEnv } from "@/lib/env";
import { whatsappLink } from "@/lib/whatsapp";
import { getCurrentYear } from "@/server/services/site-service";

export async function SiteFooter() {
  const year = await getCurrentYear();

  return (
    <footer className="mt-16 border-t border-[var(--color-border)] bg-[var(--color-surface)]">
      <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-10 sm:grid-cols-2 lg:grid-cols-4">
        <div className="sm:col-span-2">
          <Image src={logo} alt={publicEnv.siteName} sizes="160px" className="h-auto w-40" />
          <p className="mt-3 max-w-sm text-sm text-[var(--color-muted-foreground)]">
            Cakes baked to order and small-batch scones, made fresh in {publicEnv.businessLocation || "Cape Town"}.
            Every cake in the gallery was baked for a real customer.
          </p>
        </div>

        <nav aria-label="Footer">
          <h2 className="text-sm font-semibold">Explore</h2>
          <ul className="mt-3 space-y-2 text-sm text-[var(--color-muted-foreground)]">
            <li>
              <Link href="/gallery" className="hover:text-[var(--color-foreground)]">
                Cake gallery
              </Link>
            </li>
            <li>
              <Link href="/shop" className="hover:text-[var(--color-foreground)]">
                Scones &amp; shop
              </Link>
            </li>
            <li>
              <Link href="/about" className="hover:text-[var(--color-foreground)]">
                About
              </Link>
            </li>
            <li>
              <Link href="/order-lookup" className="hover:text-[var(--color-foreground)]">
                Track my order
              </Link>
            </li>
          </ul>
        </nav>

        <div>
          <h2 className="text-sm font-semibold">Get in touch</h2>
          <ul className="mt-3 space-y-2 text-sm text-[var(--color-muted-foreground)]">
            <li>
              <a
                href={whatsappLink(`Hi ${publicEnv.siteName}! I'd like to place an order.`)}
                className="hover:text-[var(--color-foreground)]"
                rel="noopener noreferrer"
                target="_blank"
              >
                WhatsApp
              </a>
            </li>
            {publicEnv.businessPhone ? <li>{publicEnv.businessPhone}</li> : null}
            {publicEnv.businessEmail ? (
              <li>
                <a href={`mailto:${publicEnv.businessEmail}`} className="hover:text-[var(--color-foreground)]">
                  {publicEnv.businessEmail}
                </a>
              </li>
            ) : null}
            {publicEnv.instagramHandle ? (
              <li>
                <a
                  href={`https://instagram.com/${publicEnv.instagramHandle}`}
                  className="hover:text-[var(--color-foreground)]"
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  @{publicEnv.instagramHandle}
                </a>
              </li>
            ) : null}
          </ul>
        </div>
      </div>

      <div className="border-t border-[var(--color-border)] py-5">
        <p className="mx-auto w-full max-w-6xl px-4 text-xs text-[var(--color-muted-foreground)]">
          © {year} {publicEnv.siteName}. Baked in South Africa. Cakes need at least 48 hours&apos; notice.
        </p>
      </div>
    </footer>
  );
}
