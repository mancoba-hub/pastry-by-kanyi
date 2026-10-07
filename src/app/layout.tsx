import type { Metadata, Viewport } from "next";
import { Inter, Playfair_Display } from "next/font/google";
import "./globals.css";
import { publicEnv } from "@/lib/env";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { WhatsAppFab } from "@/components/layout/whatsapp-fab";

/**
 * Fonts are self-hosted by next/font and subset to latin, so there is no
 * render-blocking request to Google and no layout shift from a late webfont.
 */
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-playfair",
  display: "swap",
  weight: ["500", "600", "700"],
});

/**
 * `metadataBase` is essential, not cosmetic: without it, relative OG image URLs
 * are not resolved to absolute ones, and WhatsApp/Instagram scrapers — the main
 * distribution channel for this business — show a bare link with no preview.
 */
export const metadata: Metadata = {
  metadataBase: new URL(publicEnv.siteUrl),
  title: {
    default: `${publicEnv.siteName} — Cakes baked to order`,
    template: `%s · ${publicEnv.siteName}`,
  },
  description:
    "Browse cakes baked for real customers, and order small-batch scones. Baked fresh to order in South Africa.",
  applicationName: publicEnv.siteName,
  openGraph: {
    type: "website",
    siteName: publicEnv.siteName,
    locale: "en_ZA",
    url: publicEnv.siteUrl,
  },
  twitter: { card: "summary_large_image" },
  // No global `robots` directive: it would conflict with the `noindex` that
  // Next.js adds to 404 responses, and the default (index, follow) is what we
  // want anyway. Per-page directives now govern unambiguously.
  formatDetection: { telephone: true, address: false, email: true },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#fffaf5",
  colorScheme: "light",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en-ZA" className={`${inter.variable} ${playfair.variable}`}>
      <body className="flex min-h-dvh flex-col antialiased">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-lg focus:bg-[var(--color-primary)] focus:px-4 focus:py-2 focus:text-[var(--color-primary-foreground)]"
        >
          Skip to content
        </a>

        <SiteHeader />

        <main id="main" className="flex-1">
          {children}
        </main>

        <SiteFooter />
        {/* Keeps the FAB from covering footer links on small screens. */}
        <div className="h-20 sm:h-0" aria-hidden="true" />
        <WhatsAppFab />
      </body>
    </html>
  );
}
