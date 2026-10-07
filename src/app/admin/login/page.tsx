import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/admin/login-form";
import { getCurrentUser } from "@/server/auth/session";
import { safeRedirectTarget } from "@/features/auth/schema";

export const metadata: Metadata = {
  title: "Sign in",
  robots: { index: false, follow: false },
};

/**
 * Admin login.
 *
 * Sits outside the `(shell)` route group so the authenticated navigation is not
 * rendered around it.
 */

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

async function LoginPane({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  // Someone already signed in should not see a login form.
  const user = await getCurrentUser();
  const sp = await searchParams;

  if (user) {
    redirect(safeRedirectTarget(firstValue(sp.next)));
  }

  return (
    <div className="w-full max-w-sm">
      <h1 className="text-2xl font-semibold">Sign in</h1>
      <p className="mt-2 mb-7 text-sm text-[var(--color-muted-foreground)]">
        Staff area — manage the gallery, products and orders.
      </p>

      <LoginForm next={firstValue(sp.next)} />

      <p className="mt-8 text-center text-xs text-[var(--color-muted-foreground)]">
        <Link href="/" className="hover:text-[var(--color-foreground)]">
          ← Back to the shop
        </Link>
      </p>
    </div>
  );
}

export default function AdminLoginPage(props: PageProps<"/admin/login">) {
  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4 py-14">
      <Suspense
        fallback={<div className="h-80 w-full max-w-sm animate-pbk-pulse rounded-[var(--radius-card)] bg-[var(--color-surface-muted)]" />}
      >
        <LoginPane searchParams={props.searchParams} />
      </Suspense>
    </div>
  );
}
