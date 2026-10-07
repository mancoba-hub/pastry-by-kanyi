import { describe, expect, it } from "vitest";
import { err, failure, isErr, isOk, ok, unwrap, zodToFieldErrors } from "@/lib/result";
import { z } from "zod";

describe("result", () => {
  it("discriminates on the ok flag", () => {
    expect(isOk(ok(1))).toBe(true);
    expect(isErr(ok(1))).toBe(false);
    expect(isErr(err("boom"))).toBe(true);
  });

  it("builds a failed Result from failure()", () => {
    const result = failure("CONFLICT", "Already exists.");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("CONFLICT");
      expect(result.error.message).toBe("Already exists.");
    }
  });

  it("carries field errors through failure()", () => {
    const result = failure("VALIDATION", "Check the form.", { title: ["Too short."] });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.fields?.title).toEqual(["Too short."]);
    }
  });

  it("unwrap returns the value or throws", () => {
    expect(unwrap(ok("value"))).toBe("value");
    expect(() => unwrap(err({ code: "INTERNAL", message: "nope" }))).toThrow();
  });
});

describe("zodToFieldErrors", () => {
  it("keys messages by field path", () => {
    const schema = z.object({
      title: z.string().min(5),
      contact: z.object({ phone: z.string().min(3) }),
    });

    const parsed = schema.safeParse({ title: "ab", contact: { phone: "" } });
    expect(parsed.success).toBe(false);

    if (!parsed.success) {
      const fields = zodToFieldErrors(parsed.error);

      expect(fields.title).toHaveLength(1);
      // Nested paths are flattened with dots so a form can address them.
      expect(fields["contact.phone"]).toHaveLength(1);
    }
  });

  it("uses _form for issues with no path", () => {
    expect(zodToFieldErrors({ issues: [{ path: [], message: "Bad." }] })).toEqual({
      _form: ["Bad."],
    });
  });
});
