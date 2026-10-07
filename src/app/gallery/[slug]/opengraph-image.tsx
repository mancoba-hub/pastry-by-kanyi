import { ImageResponse } from "next/og";
import { getCakeBySlug } from "@/server/services/cake-service";
import { publicEnv } from "@/lib/env";
import { formatMoney } from "@/lib/money";

/**
 * Social preview card for a single bake.
 *
 * Written for WhatsApp first: that is where these links get pasted, and a card
 * with the cake's name, occasion and price is what makes someone tap. 1200×630
 * is the size every major scraper expects.
 *
 * The card is typographic rather than photographic. Compositing the real photo
 * would mean fetching the image inside the render, which fails in environments
 * where the server cannot call itself (and during prerender, where there is no
 * server at all). A card that always renders beats one that is prettier when it
 * works — a broken preview shows as a bare link in the family WhatsApp group.
 *
 * Note the Next 16 change: `params` arrives as a Promise here.
 */

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "A cake from the Pastry by Kanyi gallery";

export default async function OpenGraphImage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const cake = await getCakeBySlug(slug);

  const title = cake?.title ?? "Pastry by Kanyi";
  const occasion = cake?.occasion ?? "Baked to order";
  const flavour = cake?.flavour ?? "Freshly baked in Cape Town";
  const price = cake?.priceCents != null ? formatMoney(cake.priceCents) : "Priced on request";

  return new ImageResponse(
    (
      <div
        style={{
          // ImageResponse supports flexbox only — no grid, no external CSS.
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          width: "100%",
          height: "100%",
          padding: 64,
          backgroundColor: "#fffaf5",
          backgroundImage: "linear-gradient(135deg, #fffaf5 0%, #f8efe6 55%, #f6e0e6 100%)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", fontSize: 30, color: "#9c2b47", fontWeight: 700 }}>
            Pastry by Kanyi
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 24,
              color: "#7a6555",
              border: "2px solid #ddcbb8",
              borderRadius: 999,
              padding: "6px 22px",
            }}
          >
            {occasion}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              display: "flex",
              fontSize: 76,
              lineHeight: 1.1,
              color: "#2b1b12",
              fontWeight: 700,
              letterSpacing: -1.5,
            }}
          >
            {title.length > 56 ? `${title.slice(0, 53)}…` : title}
          </div>
          <div style={{ display: "flex", marginTop: 20, fontSize: 32, color: "#7a6555" }}>{flavour}</div>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            borderTop: "3px solid #ece0d3",
            paddingTop: 26,
          }}
        >
          <div style={{ display: "flex", fontSize: 40, color: "#9c2b47", fontWeight: 700 }}>{price}</div>
          <div style={{ display: "flex", fontSize: 26, color: "#7a6555" }}>
            {publicEnv.siteUrl.replace(/^https?:\/\//, "")}/gallery
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
