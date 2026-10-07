import { describe, expect, it } from "vitest";
import {
  formatPhoneDisplay,
  normaliseSouthAfricanPhone,
  toWhatsAppMsisdn,
} from "@/lib/phone";

/**
 * Orders are confirmed on WhatsApp, so an unreachable number is a lost sale.
 * South African numbers get written every possible way.
 *
 * Note that landlines are rejected on purpose: a landline cannot receive a
 * WhatsApp message, which is how every order on this site is confirmed.
 */
describe("phone", () => {
  describe("normaliseSouthAfricanPhone", () => {
    it("accepts the local 08… form", () => {
      expect(normaliseSouthAfricanPhone("082 123 4567")).toBe("+27821234567");
    });

    it("accepts the local 07… form", () => {
      expect(normaliseSouthAfricanPhone("072 123 4567")).toBe("+27721234567");
    });

    it("accepts the local 06… form", () => {
      expect(normaliseSouthAfricanPhone("060 123 4567")).toBe("+27601234567");
    });

    it("accepts the international +27 form", () => {
      expect(normaliseSouthAfricanPhone("+27 82 123 4567")).toBe("+27821234567");
    });

    it("accepts the bare 27 form", () => {
      expect(normaliseSouthAfricanPhone("27821234567")).toBe("+27821234567");
    });

    it("accepts the written-out 0027 access prefix", () => {
      expect(normaliseSouthAfricanPhone("0027821234567")).toBe("+27821234567");
    });

    it("accepts a bare 9-digit national number", () => {
      expect(normaliseSouthAfricanPhone("821234567")).toBe("+27821234567");
    });

    it("ignores spaces, dashes and brackets", () => {
      expect(normaliseSouthAfricanPhone("(082) 123-4567")).toBe("+27821234567");
    });

    it("rejects landline numbers (Cape Town 021, Johannesburg 011)", () => {
      // Area codes 021 and 011 are landlines, and a landline cannot receive the
      // WhatsApp confirmation — the same reason every other landline is refused.
      expect(normaliseSouthAfricanPhone("021 123 4567")).toBeNull();
      expect(normaliseSouthAfricanPhone("011 123 4567")).toBeNull();
    });

    it("rejects the 09… range", () => {
      expect(normaliseSouthAfricanPhone("098 123 4567")).toBeNull();
    });

    it("rejects numbers that are too short or too long", () => {
      expect(normaliseSouthAfricanPhone("08212345")).toBeNull();
      expect(normaliseSouthAfricanPhone("08212345678")).toBeNull();
      expect(normaliseSouthAfricanPhone("+2782123456")).toBeNull();
    });

    it("rejects empty input", () => {
      expect(normaliseSouthAfricanPhone("")).toBeNull();
    });
  });

  it("produces a digits-only MSISDN for wa.me links", () => {
    expect(toWhatsAppMsisdn("+27821234567")).toBe("27821234567");
  });

  it("formats a number for display", () => {
    expect(formatPhoneDisplay("+27821234567")).toBe("+27 82 123 4567");
  });

  it("returns the input unchanged when it is not a recognised length", () => {
    expect(formatPhoneDisplay("+1234567")).toBe("+1234567");
  });
});
