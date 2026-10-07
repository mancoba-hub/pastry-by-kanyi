import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { BUSINESS_TIME_ZONE } from "@/lib/datetime";
import { publicEnv } from "@/lib/env";

const ROOT = fileURLToPath(new URL("../..", import.meta.url));

/**
 * Localisation is a cross-cutting concern that is easy to half-finish: the
 * pricing and phone logic can be moved to a new country while a stray locale
 * literal, timezone or area code stays behind and only shows up in production.
 * These tests pin the invariant so a partial change fails loudly.
 */

/** Kenyan markers that must not survive anywhere in our own source. */
const FOREIGN_LOCALE_MARKERS: Array<[string, RegExp]> = [
  ["locale", /en[_-]KE/],
  ["timezone", /Africa\/Nairobi/],
  ["country", /\bKenya\b|\bKenyan\b/],
  ["city", /\bNairobi\b/],
  ["currency", /\bKSh\b|\bKES\b/],
  ["dialling code", /\+254\b|\b2547\d/],
];

const TEXT_FILE = /\.(ts|tsx|css|json)$/;

/**
 * This file has to spell out every pattern it forbids, so it would match
 * itself. Everything else under `src` and `tests` is in scope.
 */
const SELF = "localisation.test.ts";

function workspaceFiles(): string[] {
  const files: string[] = [];

  const walk = (relativeDir: string): void => {
    for (const entry of readdirSync(join(ROOT, relativeDir), { withFileTypes: true })) {
      const relativePath = join(relativeDir, entry.name);

      if (entry.isDirectory()) {
        // Generated code mirrors the schema and would only add noise.
        if (entry.name === "generated" || entry.name === "node_modules") continue;
        walk(relativePath);
      } else if (TEXT_FILE.test(entry.name) && entry.name !== SELF) {
        files.push(relativePath);
      }
    }
  };

  walk("src");
  walk("tests");
  files.push(join("prisma", "schema.prisma"), ".env.example");

  return files;
}

function source(relativePath: string): string {
  return readFileSync(join(ROOT, relativePath), "utf8");
}

describe("localisation", () => {
  it("leaves no trace of a previously supported region", () => {
    const offenders = workspaceFiles().flatMap((file) =>
      source(file)
        .split(/\r?\n/)
        .flatMap((line, index) =>
          FOREIGN_LOCALE_MARKERS.filter(([, pattern]) => pattern.test(line)).map(
            ([kind, pattern]) => `${file}:${index + 1} [${kind}] ${pattern} → ${line.trim()}`,
          ),
        ),
    );

    expect(offenders).toEqual([]);
  });

  it("prices in South African rand", () => {
    expect(publicEnv.currency).toBe("ZAR");
    expect(source("src/lib/money.ts")).toContain("en-ZA");
  });

  it("resolves business dates in a valid South African time zone", () => {
    // Semantic rather than textual, deliberately: a find-and-replace can happily
    // rewrite an assertion that only greps for a string, but it cannot make
    // `Intl` accept a zone that does not exist.
    expect(() => new Intl.DateTimeFormat("en-ZA", { timeZone: BUSINESS_TIME_ZONE })).not.toThrow();
    expect(BUSINESS_TIME_ZONE).toBe("Africa/Johannesburg");

    // South Africa has no daylight saving, so the offset never moves.
    const offset = new Intl.DateTimeFormat("en-ZA", {
      timeZone: BUSINESS_TIME_ZONE,
      timeZoneName: "longOffset",
    })
      .formatToParts(new Date())
      .find((part) => part.type === "timeZoneName")?.value;

    expect(offset).toBe("GMT+02:00");
  });

  it("names the business time zone in exactly one module", () => {
    // A zone identifier cannot be validated by grep, so instead pin the fact
    // that there is a single source of truth for it. Anywhere else that needs a
    // wall-clock time imports this module rather than re-declaring a zone —
    // which is how an invalid identifier gets introduced in the first place.
    const naming = workspaceFiles().filter((file) => /Africa\/[A-Za-z_]+/.test(source(file)));

    expect(naming).toEqual([join("src", "lib", "datetime.ts")]);
  });

  it("contactable numbers use the South African country code", () => {
    expect(source("src/lib/phone.ts")).toContain('"27"');
  });

  it("declares the page locale as en_ZA so link previews are tagged correctly", () => {
    // Open Graph locales use an underscore, so a stale "en_KE" is invisible to
    // any check that only looks for the IETF hyphenated form.
    expect(source("src/app/layout.tsx")).toContain('locale: "en_ZA"');
  });
});
