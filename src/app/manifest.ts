import type { MetadataRoute } from "next";
import { publicEnv } from "@/lib/env";

/**
 * Web app manifest. Enables "Add to Home Screen" on Android and iOS, which
 * matters for a bakery whose repeat customers order every few weeks.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: publicEnv.siteName,
    short_name: "Pastry by Kanyi",
    description: "Cakes baked to order and small-batch scones.",
    start_url: "/",
    display: "standalone",
    background_color: "#fffaf5",
    theme_color: "#9c2b47",
    orientation: "portrait",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
    ],
  };
}
