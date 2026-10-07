"use client";

import { useState } from "react";
import Link from "next/link";
import { NAV_LINKS } from "./nav-links";

/**
 * Mobile navigation.
 *
 * A plain disclosure rather than a modal: it is a short list of links, so it
 * needs no focus trap, and it closes on navigation so a tap never lands on a
 * link hidden behind an open panel.
 *
 * Includes the cart entry as well, since on mobile the menu is the natural
 * place for a second navigation affordance.
 */
export function MobileNav() {
  const [open, setOpen] = useState(false);

  return (
    <div className="md:hidden">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex h-11 w-11 items-center justify-center rounded-xl hover:bg-[var(--color-surface-muted)]"
        aria-expanded={open}
        aria-controls="mobile-nav"
        aria-label={open ? "Close menu" : "Open menu"}
      >
        {open ? (
          <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="M6 6l12 12M18 6L6 18"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
          </svg>
        ) : (
          <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="M4 7h16M4 12h16M4 17h16"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
          </svg>
        )}
      </button>

      {open ? (
        <nav
          id="mobile-nav"
          className="absolute inset-x-0 top-full border-b border-[var(--color-border)] bg-[var(--color-surface)] shadow-lg"
          aria-label="Mobile"
        >
          <ul className="mx-auto max-w-6xl px-2 py-2">
            {NAV_LINKS.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className="block rounded-lg px-3 py-3 text-base font-medium hover:bg-[var(--color-surface-muted)]"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      ) : null}
    </div>
  );
}
