import { describe, expect, it } from "vitest";
import { slugify, uniqueSlug, tagSlug } from "@/lib/slug";

/**
 * Slugs end up in links shared on WhatsApp, so they must be readable,
 * copy-pasteable and stable.
 */
describe("slug", () => {
  describe("slugify", () => {
    it("lowercases and hyphenates", () => {
      expect(slugify("Raspberry & Rose Celebration Cake")).toBe("raspberry-rose-celebration-cake");
    });

    it("strips accents rather than percent-encoding them", () => {
      expect(slugify("Crème Brûlée")).toBe("creme-brulee");
    });

    it("removes apostrophes without leaving a gap", () => {
      expect(slugify("Kanyi's Best")).toBe("kanyis-best");
    });

    it("collapses repeated separators", () => {
      expect(slugify("Cake --- with   spaces")).toBe("cake-with-spaces");
    });

    it("trims leading and trailing hyphens", () => {
      expect(slugify("  !!Chocolate!!  ")).toBe("chocolate");
    });

    it("never exceeds 80 characters", () => {
      expect(slugify("a".repeat(200)).length).toBeLessThanOrEqual(80);
    });

    it("handles an empty string", () => {
      expect(slugify("")).toBe("");
    });
  });

  describe("uniqueSlug", () => {
    it("keeps the clean slug when nothing has taken it", () => {
      expect(uniqueSlug("Chocolate Drip", () => false)).toBe("chocolate-drip");
    });

    it("suffixes only on a collision", () => {
      const taken = new Set(["chocolate-drip", "chocolate-drip-2"]);
      expect(uniqueSlug("Chocolate Drip", (candidate) => taken.has(candidate))).toBe("chocolate-drip-3");
    });

    it("falls back to 'untitled' for input that slugifies to nothing", () => {
      expect(uniqueSlug("!!!", () => false)).toBe("untitled");
    });
  });

  it("produces a stable tag slug from a label", () => {
    expect(tagSlug("Baby Shower")).toBe("baby-shower");
    expect(tagSlug("Baby Shower")).toBe(tagSlug("baby shower"));
  });
});
