import Link from "next/link";
import { buttonClasses } from "@/components/ui";

export default function NotFound() {
  return (
    <div className="mx-auto flex w-full max-w-lg flex-col items-center px-4 py-20 text-center">
      <p className="text-sm font-medium tracking-wide text-[var(--color-primary)] uppercase">
        404
      </p>
      <h1 className="mt-2 text-3xl font-semibold">We couldn&apos;t find that</h1>
      <p className="mt-3 text-[var(--color-muted-foreground)]">
        The page may have moved, or the bake may have been taken out of the gallery.
      </p>

      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link href="/gallery" className={buttonClasses()}>
          Browse the gallery
        </Link>
        <Link href="/" className={buttonClasses({ variant: "secondary" })}>
          Go home
        </Link>
      </div>
    </div>
  );
}
