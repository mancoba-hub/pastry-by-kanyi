import Link from "next/link";
import { Badge, Card } from "@/components/ui";
import { cn } from "@/lib/cn";

/**
 * Admin presentation helpers.
 *
 * Server-renderable, no state — the admin panel is used on a phone in a kitchen,
 * so it stays lean and legible at a glance.
 */

export function AdminHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold sm:text-3xl">{title}</h1>
        {subtitle ? (
          <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">{subtitle}</p>
        ) : null}
      </div>
      {action}
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
  href,
}: {
  label: string;
  value: number | string;
  hint?: string;
  href?: string;
}) {
  const body = (
    <Card className="p-4 transition-shadow hover:shadow-sm">
      <p className="text-sm text-[var(--color-muted-foreground)]">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
      {hint ? <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">{hint}</p> : null}
    </Card>
  );

  return href ? (
    <Link href={href} className="block">
      {body}
    </Link>
  ) : (
    body
  );
}

const ORDER_TONES: Record<string, "neutral" | "accent" | "success" | "warning" | "danger" | "primary"> = {
  PENDING: "warning",
  CONFIRMED: "primary",
  BAKING: "accent",
  READY: "accent",
  OUT_FOR_DELIVERY: "accent",
  COMPLETED: "success",
  CANCELLED: "danger",
  DRAFT: "neutral",
  PUBLISHED: "success",
  ARCHIVED: "neutral",
  ACTIVE: "success",
  SOLD_OUT: "danger",
  UNPAID: "warning",
  PARTIALLY_PAID: "warning",
  PAID: "success",
  REFUNDED: "neutral",
};

export function StatusBadge({ status, label }: { status: string; label?: string }) {
  return (
    <Badge tone={ORDER_TONES[status] ?? "neutral"}>
      {label ?? status.replaceAll("_", " ").toLowerCase()}
    </Badge>
  );
}

/** Inline banner for action feedback passed through the URL. */
export function NoticeBanner({ notice, tone = "success" }: { notice?: string; tone?: "success" | "warning" }) {
  if (!notice) return null;

  return (
    <div
      className={cn(
        "mb-5 rounded-xl border px-4 py-3 text-sm",
        tone === "success"
          ? "border-[var(--color-success)] bg-[#e6f2ea] text-[var(--color-success)]"
          : "border-[var(--color-warning)] bg-[#fdf0dc] text-[var(--color-warning)]",
      )}
      role="status"
    >
      {notice}
    </div>
  );
}

/** Responsive table wrapper: scrolls horizontally instead of squashing columns. */
export function TableWrap({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)]">
      <table className="w-full min-w-[40rem] text-sm">{children}</table>
    </div>
  );
}

export function Th({ children, className }: { children?: React.ReactNode; className?: string }) {
  return (
    <th
      scope="col"
      className={cn(
        "border-b border-[var(--color-border)] px-4 py-3 text-left text-xs font-medium tracking-wide text-[var(--color-muted-foreground)] uppercase",
        className,
      )}
    >
      {children}
    </th>
  );
}

export function Td({ children, className }: { children?: React.ReactNode; className?: string }) {
  return (
    <td className={cn("border-b border-[var(--color-border)] px-4 py-3 align-middle", className)}>
      {children}
    </td>
  );
}
