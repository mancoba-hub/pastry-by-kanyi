import { describe, expect, it } from "vitest";
import {
  hashPassword,
  needsRehash,
  validatePasswordStrength,
  verifyPassword,
} from "@/server/auth/password";

/**
 * Password hashing is the one place where a subtle mistake is unrecoverable —
 * either nobody can log in, or everyone can.
 */
describe("password", () => {
  it("verifies a correct password", async () => {
    const hash = await hashPassword("correct horse battery staple");
    await expect(verifyPassword("correct horse battery staple", hash)).resolves.toBe(true);
  });

  it("rejects a wrong password", async () => {
    const hash = await hashPassword("correct horse battery staple");
    await expect(verifyPassword("Correct horse battery staple", hash)).resolves.toBe(false);
  });

  it("produces a different hash each time (salted)", async () => {
    const a = await hashPassword("same-password-value");
    const b = await hashPassword("same-password-value");

    expect(a).not.toBe(b);
    // Both still verify — the salt is stored inside the hash string.
    await expect(verifyPassword("same-password-value", a)).resolves.toBe(true);
    await expect(verifyPassword("same-password-value", b)).resolves.toBe(true);
  });

  it("encodes the algorithm and cost parameters in the hash", async () => {
    const hash = await hashPassword("another-long-password");

    expect(hash.startsWith("scrypt$")).toBe(true);
    expect(hash.split("$")).toHaveLength(6);
  });

  it("returns false rather than throwing on a malformed hash", async () => {
    await expect(verifyPassword("whatever", "not-a-hash")).resolves.toBe(false);
    await expect(verifyPassword("whatever", "")).resolves.toBe(false);
    await expect(verifyPassword("whatever", "scrypt$1$2$3$4")).resolves.toBe(false);
  });

  it("normalises unicode so the same typed password matches", async () => {
    // "é" composed vs decomposed — a phone keyboard may produce either.
    const composed = "caf\u00e9-password-123";
    const decomposed = "cafe\u0301-password-123";

    const hash = await hashPassword(composed);
    await expect(verifyPassword(decomposed, hash)).resolves.toBe(true);
  });

  describe("needsRehash", () => {
    it("is false for a hash produced with current parameters", async () => {
      expect(needsRehash(await hashPassword("a-long-enough-password"))).toBe(false);
    });

    it("is true for weaker parameters or a malformed hash", () => {
      // Cost of 1024 is well below the current 2^15.
      expect(needsRehash("scrypt$1024$8$1$c2FsdA==$aGFzaA==")).toBe(true);
      expect(needsRehash("garbage")).toBe(true);
    });
  });

  describe("validatePasswordStrength", () => {
    it("accepts a long passphrase", () => {
      expect(validatePasswordStrength("kanyi-bakes-2026!")).toEqual([]);
    });

    it("requires at least 12 characters", () => {
      expect(validatePasswordStrength("short1!")).toContain("Use at least 12 characters.");
    });

    it("rejects common words and the business name", () => {
      expect(validatePasswordStrength("password1234")).not.toEqual([]);
      expect(validatePasswordStrength("pastrybykanyi")).not.toEqual([]);
    });

    it("rejects a single repeated character", () => {
      expect(validatePasswordStrength("aaaaaaaaaaaaaa")).not.toEqual([]);
    });
  });
});
