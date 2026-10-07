"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

/**
 * Desktop navigation links.
 *
 * `usePathname()` is request-time data, so under Cache Components it cannot be
 * read during prerendering — a route whose pathname is unknown at build time
 * (any dynamic route without `generateStaticParams`) would fail the build.
 *
 * The fix is not to remove the highlight but to stream it: the server renders
 * `NavLinks` with no active state as the Suspense fallback, and this component
 * streams in and adds `aria-current` after hydration. The markup is identical,
 * so there is no layout shift — the highlight simply appears.
 */

export const NAV_LINKS = [
  { href: "/gallery", label: "Bakes" },
  { href: "/shop", label: "Shop" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
] as const;

export function NavLinks({ active }: { active: string | null }) {
  return (
    <>
      {NAV_LINKS.map((link) => {
        const isActive = active === link.href || (active?.startsWith(`${link.href}/`) ?? false);

        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              isActive
                ? "bg-[var(--color-surface-muted)] text-[var(--color-foreground)]"
                : "text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]",
            )}
          >
            {link.label}
          </Link>
        );
      })}
    </>
  );
}

export function ActiveNavLinks() {
  const pathname = usePathname();

  return <NavLinks active={pathname} />;
}
