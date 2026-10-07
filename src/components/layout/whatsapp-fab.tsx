import { publicEnv } from "@/lib/env";
import { whatsappLink } from "@/lib/whatsapp";

/**
 * Floating WhatsApp button.
 *
 * Pinned to the bottom-right, above the safe-area inset so it clears the iOS
 * home indicator. This is the highest-intent control on the site for a South African
 * bakery — most orders start here rather than in the basket.
 */
export function WhatsAppFab({ message }: { message?: string }) {
  if (!publicEnv.whatsappNumber) return null;

  return (
    <a
      href={whatsappLink(message ?? `Hi ${publicEnv.siteName}! I'd like to order.`)}
      target="_blank"
      rel="noopener noreferrer"
      className="fixed right-4 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] shadow-lg transition-transform hover:scale-105 active:scale-95"
      style={{ bottom: "calc(1rem + env(safe-area-inset-bottom, 0px))" }}
      aria-label="Chat with us on WhatsApp"
    >
      <svg width="28" height="28" viewBox="0 0 24 24" fill="#0b3d20" aria-hidden="true">
        <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38a9.9 9.9 0 0 0 4.79 1.22h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2Zm0 18.15h-.01a8.23 8.23 0 0 1-4.19-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.22 8.22 0 0 1-1.26-4.38c0-4.54 3.7-8.23 8.25-8.23a8.19 8.19 0 0 1 5.83 2.42 8.18 8.18 0 0 1 2.41 5.82c0 4.54-3.7 8.23-8.24 8.23Zm4.52-6.16c-.25-.12-1.47-.72-1.69-.81-.23-.08-.39-.12-.56.13-.16.25-.64.81-.79.97-.14.17-.29.19-.54.06-.25-.12-1.05-.39-2-1.23-.74-.66-1.24-1.47-1.38-1.72-.15-.25-.02-.38.11-.51.11-.11.25-.29.37-.44.13-.14.17-.25.25-.41.08-.17.04-.31-.02-.44-.06-.12-.56-1.35-.77-1.85-.2-.48-.41-.42-.56-.43h-.48c-.17 0-.43.06-.66.31-.22.25-.86.85-.86 2.07 0 1.22.89 2.4 1.01 2.56.12.17 1.75 2.67 4.24 3.74.59.26 1.05.41 1.41.52.6.19 1.14.16 1.57.1.48-.07 1.47-.6 1.68-1.18.21-.58.21-1.07.14-1.18-.06-.11-.22-.17-.47-.29Z" />
      </svg>
    </a>
  );
}
