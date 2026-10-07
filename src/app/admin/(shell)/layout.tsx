import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { requireUser } from "@/server/auth/guard";
import { logoutAction } from "@/features/auth/actions";

export const metadata: Metadata = {
  title: "Admin",
  robots: { index: false, follow: false },
};

const NAV = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/cakes", label: "Bakes" },
  { href: "/admin/products", label: "Shop" },
  { href: "/admin/orders", label: "Orders" },
] as const;

/**
 * Authenticated admin shell.
 *
 * Lives in the `(shell)` route group so `/admin/login` renders outside it.
 *
 * The user lookup reads cookies, which is request-time data, so it sits behind
 * `<Suspense>` — that is what lets the shell itself be part of the static
 * response under Cache Components.
 *
 * Note this is a *convenience* guard. Each page and every Server Action also
 * calls `requireUser()` / `requireUserOrThrow()`; a layout is not a security
 * boundary, because a layout does not re-run for every nested navigation.
 */
async function AdminNav() {
  const user = await requireUser();

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <nav aria-label="Admin" className="flex flex-wrap gap-1">
        {NAV.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="rounded-lg px-3 py-2 text-sm font-medium text-[var(--color-muted-foreground)] transition-colors hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-foreground)]"
          >
            {item.label}
          </Link>
        ))}
      </nav>

      <div className="flex items-center gap-3">
        <div className="hidden text-right sm:block">
          <p className="text-sm font-medium">{user.name}</p>
          <p className="text-xs text-[var(--color-muted-foreground)]">
            {user.role.toLowerCase()} · {user.email}
          </p>
        </div>

        <form action={logoutAction}>
          <button
            type="submit"
            className="rounded-lg border border-[var(--color-border-strong)] px-3 py-2 text-sm hover:bg-[var(--color-surface-muted)]"
          >
            Sign out
          </button>
        </form>
      </div>
    </div>
  );
}

function AdminNavSkeleton() {
  return (
    <div className="flex items-center justify-between">
      <div className="h-9 w-64 animate-pbk-pulse rounded-lg bg-[var(--color-surface-muted)]" />
      <div className="h-9 w-24 animate-pbk-pulse rounded-lg bg-[var(--color-surface-muted)]" />
    </div>
  );
}

export default function AdminShellLayout({ children }: LayoutProps<"/admin">) {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8">
      <div className="mb-7 border-b border-[var(--color-border)] pb-4">
        <Suspense fallback={<AdminNavSkeleton />}>
          <AdminNav />
        </Suspense>
      </div>

      {children}
    </div>
  );
}
