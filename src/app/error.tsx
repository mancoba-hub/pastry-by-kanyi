"use client";

import { useEffect } from "react";
import Link from "next/link";
import { buttonClasses } from "@/components/ui";

/**
 * Route-level error boundary.
 *
 * Must be a Client Component. The raw error message is never rendered — a
 * database error string can leak schema details — but it is logged to the
 * console for whoever is debugging, and `digest` ties the user's report to the
 * server-side log entry.
 */
export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("route error", { message: error.message, digest: error.digest });
  }, [error]);

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col items-center px-4 py-20 text-center">
      <h1 className="text-3xl font-semibold">Something went wrong</h1>
      <p className="mt-3 text-[var(--color-muted-foreground)]">
        This one is on us, not you. Try again — and if it keeps happening, message us on WhatsApp and
        we&apos;ll take your order there.
      </p>

      {error.digest ? (
        <p className="mt-3 text-xs text-[var(--color-muted-foreground)]">
          Reference: <span className="font-mono">{error.digest}</span>
        </p>
      ) : null}

      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <button type="button" onClick={reset} className={buttonClasses()}>
          Try again
        </button>
        <Link href="/" className={buttonClasses({ variant: "secondary" })}>
          Go home
        </Link>
      </div>
    </div>
  );
}
