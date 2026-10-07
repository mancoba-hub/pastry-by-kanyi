"use client";

import { useActionState } from "react";
import { loginAction } from "@/features/auth/actions";
import { EMPTY_LOGIN_STATE } from "@/features/auth/schema";
import { buttonClasses, FieldError, inputClasses, Label } from "@/components/ui";

/**
 * Login form.
 *
 * `useActionState` gives inline field errors and a pending state without any
 * client-side auth logic — the credential check happens entirely on the server.
 */
export function LoginForm({ next }: { next?: string }) {
  const [state, formAction, pending] = useActionState(loginAction, EMPTY_LOGIN_STATE);

  return (
    <form action={formAction} className="space-y-5">
      {next ? <input type="hidden" name="next" value={next} /> : null}

      {state.message ? (
        <div
          className="rounded-xl border border-[var(--color-danger)] bg-[#fdeceb] px-4 py-3 text-sm text-[var(--color-danger)]"
          role="alert"
        >
          {state.message}
        </div>
      ) : null}

      <div>
        <Label htmlFor="email">Email</Label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoFocus
          autoComplete="username"
          className={inputClasses}
          aria-invalid={Boolean(state.fields?.email)}
        />
        <FieldError messages={state.fields?.email} />
      </div>

      <div>
        <Label htmlFor="password">Password</Label>
        <input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className={inputClasses}
          aria-invalid={Boolean(state.fields?.password)}
        />
        <FieldError messages={state.fields?.password} />
      </div>

      <button
        type="submit"
        disabled={pending}
        className={buttonClasses({ size: "lg", className: "w-full" })}
      >
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
