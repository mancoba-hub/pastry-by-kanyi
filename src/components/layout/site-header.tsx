import { Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import logo from "@/images/logo.png";
import { ActiveNavLinks, NavLinks } from "./nav-links";
import { MobileNav } from "./mobile-nav";
import { CartBadge } from "./cart-badge";

/**
 * Site header.
 *
 * Sticky and translucent, because the dominant mobile gesture is scrolling a
 * photo grid and the basket must stay within thumb reach.
 *
 * A Server Component: only the two interactive pieces (active-link highlight and
 * the mobile disclosure) are client components, so the header — which appears on
 * every page — adds almost nothing to the JavaScript bundle.
 */
export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-[var(--color-border)] bg-[color-mix(in_srgb,var(--color-background)_88%,transparent)] backdrop-blur-md">
      <div className="relative mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-3 px-4">
        <Link href="/" className="flex min-w-0 items-center gap-2">
          {/* The mark is very fine-lined (7px strokes in a 1054px canvas), so at
              header size it reads as a flourish rather than legible lettering.
              The name beside it is what actually carries the brand, and the empty
              alt keeps screen readers from announcing it twice. */}
          <Image
            src={logo}
            alt=""
            priority
            sizes="(min-width: 640px) 68px, 48px"
            className="h-7 w-auto shrink-0 sm:h-10"
          />
          <span className="font-[family-name:var(--font-display)] text-base leading-none font-semibold tracking-tight whitespace-nowrap sm:text-xl">
            Pastry
            <span className="text-[var(--color-primary)]"> by Kanyi</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex" aria-label="Main">
          {/* Fallback is the same markup without `aria-current`, so streaming in
              the highlight causes no visible shift. */}
          <Suspense fallback={<NavLinks active={null} />}>
            <ActiveNavLinks />
          </Suspense>
        </nav>

        <div className="flex items-center gap-1">
          <Link
            href="/cart"
            className="relative flex h-11 w-11 items-center justify-center rounded-xl hover:bg-[var(--color-surface-muted)]"
            aria-label="Basket"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M6 7h12l-1.2 10.2a2 2 0 0 1-2 1.8H9.2a2 2 0 0 1-2-1.8L6 7Z"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinejoin="round"
              />
              <path d="M9 7a3 3 0 1 1 6 0" stroke="currentColor" strokeWidth="1.7" />
            </svg>
            <CartBadge />
          </Link>

          <MobileNav />
        </div>
      </div>
    </header>
  );
}
