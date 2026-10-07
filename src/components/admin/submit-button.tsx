"use client";

import { useFormStatus } from "react-dom";
import { buttonClasses } from "@/components/ui";

/**
 * Submit button that reflects the enclosing form's pending state.
 *
 * `useFormStatus` must be called from a component rendered *inside* the form,
 * which is why this is a separate component rather than a prop on the form.
 * Disabling while pending is what prevents a double-tap on a slow connection
 * from creating two cakes.
 */
export function SubmitButton({
  children,
  pendingLabel = "Saving…",
  variant = "primary",
  size = "md",
  className,
  confirm,
}: {
  children: React.ReactNode;
  pendingLabel?: string;
  variant?: "primary" | "secondary" | "danger" | "ghost";
  size?: "sm" | "md" | "lg";
  className?: string;
  /** Shows a native confirm() before submitting — for destructive actions. */
  confirm?: string;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      onClick={(event) => {
        if (confirm && !window.confirm(confirm)) event.preventDefault();
      }}
      className={buttonClasses({ variant, size, className })}
    >
      {pending ? pendingLabel : children}
    </button>
  );
}
