import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email("Enter a valid email address.")),
  password: z.string().min(1, "Enter your password.").max(200),
  /** Where to go after signing in. Validated before use — see the action. */
  next: z.string().max(200).optional(),
});

export type LoginInput = z.infer<typeof loginSchema>;

/** State shape returned to `useActionState`. */
export type LoginState = {
  message?: string;
  fields?: Record<string, string[]>;
};

export const EMPTY_LOGIN_STATE: LoginState = {};

/**
 * Only same-origin, admin-area paths are accepted as a post-login destination.
 * An open redirect here would turn the login page into a phishing hop.
 */
export function safeRedirectTarget(candidate: string | undefined): string {
  if (!candidate) return "/admin";
  if (!candidate.startsWith("/admin")) return "/admin";
  // Reject protocol-relative and absolute URLs (e.g. "//evil.com").
  if (candidate.startsWith("//")) return "/admin";

  return candidate;
}
