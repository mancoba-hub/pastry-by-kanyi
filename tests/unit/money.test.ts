import { describe, expect, it } from "vitest";
import { formatMoney, parseMoneyToCents, roundToWholeRand, sumCents } from "@/lib/money";

/**
 * Money is stored as integer cents. These tests exist because the failure mode
 * of getting it wrong is silent: a float rounding error in a bakery's books is
 * a few rand that nobody notices until an audit does.
 */

/** Collapses any whitespace variant so assertions do not depend on ICU spacing. */
const norm = (value: string) => value.replace(/[\s\u00a0\u202f]+/g, " ");

describe("money", () => {
  describe("parseMoneyToCents", () => {
    it("parses plain rand", () => {
      expect(parseMoneyToCents("7800")).toBe(780_000);
    });

    it("parses the currency symbol and spaces South Africans write", () => {
      expect(parseMoneyToCents("R 7 800")).toBe(780_000);
      expect(parseMoneyToCents("R780")).toBe(78_000);
    });

    it("treats a comma before three digits as thousands grouping", () => {
      // The international-keyboard way of writing "R 7 800".
      expect(parseMoneyToCents("7,800")).toBe(780_000);
      expect(parseMoneyToCents("1,500")).toBe(150_000);
    });

    it("parses two-decimal amounts with either separator", () => {
      expect(parseMoneyToCents("450.50")).toBe(45_050);
      expect(parseMoneyToCents("R 450,50")).toBe(45_050);
    });

    it("handles both separators present", () => {
      expect(parseMoneyToCents("R 1,500.50")).toBe(150_050);
    });

    it("rounds rather than truncating, so floats do not leak", () => {
      // 0.29 * 100 === 28.999999999999996 in IEEE 754.
      expect(parseMoneyToCents("0.29")).toBe(29);
      expect(parseMoneyToCents("8.29")).toBe(829);
      expect(Number.isInteger(parseMoneyToCents("8.29"))).toBe(true);
    });

    it("returns null for values that are not numbers", () => {
      expect(parseMoneyToCents("")).toBeNull();
      expect(parseMoneyToCents("abc")).toBeNull();
      expect(parseMoneyToCents("-")).toBeNull();
    });
  });

  describe("formatMoney", () => {
    it("renders whole rand without decimals, in South African style", () => {
      // en-ZA gives an "R" prefix and a space for thousands grouping.
      expect(norm(formatMoney(78_000))).toBe("R 780");
      expect(norm(formatMoney(780_000))).toBe("R 7 800");
      expect(norm(formatMoney(2_850_000))).toBe("R 28 500");
      expect(norm(formatMoney(150_000))).toBe("R 1 500");
    });

    it("shows cents only when the amount has them", () => {
      // en-ZA uses a comma as the decimal separator.
      expect(norm(formatMoney(45_050))).toBe("R 450,50");
      expect(norm(formatMoney(78_000))).toBe("R 780");
    });

    it("formats zero", () => {
      expect(norm(formatMoney(0))).toBe("R 0");
    });
  });

  describe("sumCents", () => {
    it("sums exactly, without floating point drift", () => {
      // 0.1 + 0.2 === 0.30000000000000004 in floats; in cents it is exact.
      expect(sumCents([10, 20])).toBe(30);
      expect(sumCents([100, 250, 33])).toBe(383);
    });

    it("returns 0 for an empty basket", () => {
      expect(sumCents([])).toBe(0);
    });
  });

  describe("roundToWholeRand", () => {
    it("rounds to the nearest 100 cents", () => {
      expect(roundToWholeRand(45_049)).toBe(45_000);
      expect(roundToWholeRand(45_050)).toBe(45_100);
    });
  });
});
