import { clsx } from "clsx";
import { cn } from "@/lib/cn";

/**
 * UI primitives.
 *
 * Small, dependency-free, and server-renderable by default. Anything needing
 * state lives in its own `"use client"` component instead of turning these into
 * client components, which keeps the shipped JS bundle tiny on mobile.
 */

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "whatsapp";
type ButtonSize = "sm" | "md" | "lg";

const BUTTON_BASE =
  "inline-flex items-center justify-center gap-2 font-medium transition-colors " +
  "disabled:cursor-not-allowed disabled:opacity-60 select-none whitespace-nowrap";

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary:
    "bg-[var(--color-primary)] text-[var(--color-primary-foreground)] hover:bg-[var(--color-primary-hover)]",
  secondary:
    "bg-[var(--color-surface)] text-[var(--color-foreground)] border border-[var(--color-border-strong)] hover:bg-[var(--color-surface-muted)]",
  ghost: "text-[var(--color-foreground)] hover:bg-[var(--color-surface-muted)]",
  danger: "bg-[var(--color-danger)] text-white hover:opacity-90",
  whatsapp: "bg-[#25D366] text-[#0b3d20] hover:bg-[#1fbe5a]",
};

const BUTTON_SIZES: Record<ButtonSize, string> = {
  // 44px minimum hit target: the accessibility floor for touch.
  sm: "h-9 px-3 text-sm rounded-lg",
  md: "h-11 px-4 text-[0.95rem] rounded-xl",
  lg: "h-13 px-6 text-base rounded-xl",
};

export function buttonClasses(opts?: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
}): string {
  return cn(
    BUTTON_BASE,
    BUTTON_VARIANTS[opts?.variant ?? "primary"],
    BUTTON_SIZES[opts?.size ?? "md"],
    opts?.className,
  );
}

export function Card({
  className,
  children,
  as: Tag = "div",
}: {
  className?: string;
  children: React.ReactNode;
  as?: "div" | "article" | "section" | "li";
}) {
  return (
    <Tag
      className={cn(
        "rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)]",
        className,
      )}
    >
      {children}
    </Tag>
  );
}

type BadgeTone = "neutral" | "accent" | "success" | "warning" | "danger" | "primary";

const BADGE_TONES: Record<BadgeTone, string> = {
  neutral: "bg-[var(--color-surface-muted)] text-[var(--color-muted-foreground)]",
  accent: "bg-[var(--color-accent-soft)] text-[#7a5314]",
  success: "bg-[#e6f2ea] text-[var(--color-success)]",
  warning: "bg-[#fdf0dc] text-[var(--color-warning)]",
  danger: "bg-[#fdeceb] text-[var(--color-danger)]",
  primary: "bg-[#fae8ed] text-[var(--color-primary)]",
};

export function Badge({
  children,
  tone = "neutral",
  className,
}: {
  children: React.ReactNode;
  tone?: BadgeTone;
  className?: string;
}) {
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium",
        BADGE_TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function FieldError({ messages }: { messages?: string[] }) {
  if (!messages || messages.length === 0) return null;

  return (
    <p className="mt-1 text-sm text-[var(--color-danger)]" role="alert">
      {messages[0]}
    </p>
  );
}

export function Label({
  htmlFor,
  children,
  hint,
}: {
  htmlFor: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <label htmlFor={htmlFor} className="mb-1 block text-sm font-medium">
      {children}
      {hint ? <span className="ml-1 font-normal text-[var(--color-muted-foreground)]">{hint}</span> : null}
    </label>
  );
}

/** Shared input styling. Use with `FieldError` and `Label`. */
export const inputClasses =
  "w-full rounded-xl border border-[var(--color-border-strong)] bg-[var(--color-surface)] " +
  "px-3 py-2.5 text-base text-[var(--color-foreground)] placeholder:text-[#a89684] " +
  "focus:border-[var(--color-primary)] focus:outline-none";

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="rounded-[var(--radius-card)] border border-dashed border-[var(--color-border-strong)] bg-[var(--color-surface)] px-6 py-12 text-center">
      <h3 className="text-lg font-semibold">{title}</h3>
      {description ? (
        <p className="mx-auto mt-2 max-w-md text-sm text-[var(--color-muted-foreground)]">{description}</p>
      ) : null}
      {action ? <div className="mt-5 flex justify-center">{action}</div> : null}
    </div>
  );
}

/** Section heading with an optional right-aligned action. */
export function SectionHeading({
  title,
  subtitle,
  action,
  className,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-5 flex items-end justify-between gap-4", className)}>
      <div>
        <h2 className="text-2xl font-semibold sm:text-3xl">{title}</h2>
        {subtitle ? (
          <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">{subtitle}</p>
        ) : null}
      </div>
      {action}
    </div>
  );
}
