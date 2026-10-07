import { Suspense } from "react";
import { requireUser } from "@/server/auth/guard";
import { CakeForm } from "@/components/admin/cake-form";
import { AdminHeader } from "@/components/admin/ui";
import { createCakeAction } from "@/features/cakes/admin-actions";

export const metadata = { title: "New bake", robots: { index: false } };

/**
 * Log a new bake.
 *
 * Designed for one-handed use on a phone in a kitchen: the minimum viable set is
 * title, description and photos. Everything else is optional, and `DRAFT` is the
 * default status so nothing goes live before the baker has looked at it.
 */
async function NewCakeContent() {
  await requireUser();

  return (
    <>
      <AdminHeader
        title="Log a new bake"
        subtitle="Save as a draft first, then publish when the photos look right."
      />

      <CakeForm mode="create" action={createCakeAction} values={{ status: "DRAFT" }} />
    </>
  );
}

export default function NewCakePage() {
  return (
    <Suspense fallback={<div className="h-96 animate-pbk-pulse rounded-[var(--radius-card)] bg-[var(--color-surface-muted)]" />}>
      <NewCakeContent />
    </Suspense>
  );
}
