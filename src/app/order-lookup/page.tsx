"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { buttonClasses, FieldError, inputClasses, Label } from "@/components/ui";

/**
 * Order lookup.
 *
 * There are no customer accounts, so "track my order" is: type the reference we
 * gave you. The reference is short and unguessable, and the lookup endpoint is
 * rate limited, which is the same trade-off couriers make.
 */
export default function OrderLookupPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setChecking(true);

    const formData = new FormData(event.currentTarget);
    const ref = String(formData.get("ref") ?? "")
      .trim()
      .toUpperCase();

    if (!ref) {
      setChecking(false);
      setError("Enter the reference we gave you, e.g. PBK-8F2K9A.");
      return;
    }

    try {
      const response = await fetch(`/api/v1/orders/${encodeURIComponent(ref)}`);

      if (response.status === 404) {
        setError("We couldn't find an order with that reference. Check it and try again.");
        return;
      }

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        setError(payload?.error?.message ?? "Something went wrong. Please try again.");
        return;
      }

      router.push(`/order/${ref}`);
    } catch {
      setError("We couldn't reach the kitchen. Check your connection and try again.");
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-md px-4 py-14">
      <h1 className="text-3xl font-semibold">Track your order</h1>
      <p className="mt-3 text-sm text-[var(--color-muted-foreground)]">
        Enter the reference from your order confirmation. It looks like{" "}
        <span className="font-medium text-[var(--color-foreground)]">PBK-8F2K9A</span>.
      </p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-4">
        <div>
          <Label htmlFor="ref">Order reference</Label>
          <input
            id="ref"
            name="ref"
            required
            autoFocus
            autoCapitalize="characters"
            spellCheck={false}
            placeholder="PBK-8F2K9A"
            className={`${inputClasses} tracking-wider uppercase`}
            aria-invalid={Boolean(error)}
          />
          <FieldError messages={error ? [error] : undefined} />
        </div>

        <button
          type="submit"
          disabled={checking}
          className={buttonClasses({ size: "lg", className: "w-full" })}
        >
          {checking ? "Looking…" : "Find my order"}
        </button>
      </form>
    </div>
  );
}
