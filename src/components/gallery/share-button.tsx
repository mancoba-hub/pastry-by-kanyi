"use client";

import { useState } from "react";
import { buttonClasses } from "@/components/ui";

/**
 * Share control.
 *
 * Uses the native share sheet when available — on a phone that means the
 * customer can send the cake straight into WhatsApp, which is exactly the loop
 * this business grows on. Falls back to clipboard + an explicit copy on desktop.
 *
 * The absolute URL is resolved inside the handler rather than in an effect: the
 * server cannot know the origin reliably behind a proxy, and computing it on
 * demand avoids a mount-time state update entirely.
 */
export function ShareButton({
  slug,
  title,
  className,
}: {
  slug: string;
  title: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  const resolveUrl = () => `${window.location.origin}/gallery/${slug}`;

  const handleShare = async () => {
    const shareUrl = resolveUrl();

    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title, url: shareUrl, text: `${title} — Pastry by Kanyi` });
        return;
      } catch {
        // The user dismissed the sheet; fall through to the copy path.
      }
    }

    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      window.prompt("Copy this link:", shareUrl);
    }
  };

  return (
    <button
      type="button"
      onClick={handleShare}
      className={buttonClasses({ variant: "secondary", size: "md", className })}
    >
      {copied ? "Link copied ✓" : "Share"}
    </button>
  );
}
