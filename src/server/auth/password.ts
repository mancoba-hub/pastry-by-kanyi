import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback) as (
  password: string | Buffer,
  salt: string | Buffer,
  keylen: number,
  options: { N: number; r: number; p: number; maxmem: number },
) => Promise<Buffer>;

/**
 * Password hashing with scrypt from Node's standard library.
 *
 * Why scrypt and not bcrypt/argon2: it is memory-hard, ships with Node (no
 * native build step, which matters on Windows CI and serverless images), and is
 * a NIST/IETF recommendation. Argon2id would be marginally better; the
 * operational simplicity wins for a two-user admin panel.
 *
 * Parameters are stored in the hash string, so they can be raised later without
 * invalidating existing passwords — `needsRehash()` tells you when to upgrade.
 */

/**
 * scrypt cost parameters.
 *
 * `maxmem` must be strictly *greater* than the 128·N·r working-set requirement
 * (128 × 32768 × 8 = 32 MiB here), so it is set to double that rather than to
 * the exact figure — an exact value fails with ERR_CRYPTO_INVALID_SCRYPT_PARAMS.
 */
const PARAMS = { N: 2 ** 15, r: 8, p: 1, maxmem: 128 * 2 ** 15 * 8 * 2 } as const;
const KEY_LENGTH = 64;
const SALT_LENGTH = 16;
const PREFIX = "scrypt";

function encode(salt: Buffer, hash: Buffer, params: typeof PARAMS): string {
  return [PREFIX, params.N, params.r, params.p, salt.toString("base64"), hash.toString("base64")].join(
    "$",
  );
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_LENGTH);
  const hash = await scrypt(password.normalize("NFKC"), salt, KEY_LENGTH, PARAMS);

  return encode(salt, hash, PARAMS);
}

/** Verifies a password against a stored hash. Never throws on malformed input. */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== PREFIX) return false;

  const [, nRaw, rRaw, pRaw, saltB64, hashB64] = parts;
  const N = Number.parseInt(nRaw, 10);
  const r = Number.parseInt(rRaw, 10);
  const p = Number.parseInt(pRaw, 10);

  if (!Number.isFinite(N) || !Number.isFinite(r) || !Number.isFinite(p)) return false;

  try {
    const salt = Buffer.from(saltB64, "base64");
    const expected = Buffer.from(hashB64, "base64");

    const actual = await scrypt(password.normalize("NFKC"), salt, expected.length, {
      N,
      r,
      p,
      // Headroom above the 128·N·r requirement, same reasoning as PARAMS above.
      maxmem: 128 * N * r * 2,
    });

    return timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

/** True when a stored hash was produced with weaker parameters than current. */
export function needsRehash(stored: string): boolean {
  const parts = stored.split("$");
  if (parts.length !== 6) return true;

  return Number.parseInt(parts[1], 10) < PARAMS.N;
}

/**
 * Password policy. Length is the dominant factor in resisting offline cracking,
 * so the rule is length plus a refusal of the obvious guesses — not a
 * character-class maze that pushes people towards "Password1!".
 */
export function validatePasswordStrength(password: string): string[] {
  const problems: string[] = [];

  if (password.length < 12) problems.push("Use at least 12 characters.");
  if (password.length > 200) problems.push("Use fewer than 200 characters.");

  const normalised = password.toLowerCase();
  const banned = ["password", "123456", "qwerty", "pastrybykanyi", "letmein", "admin"];
  if (banned.some((word) => normalised.includes(word))) {
    problems.push("Avoid common words and the business name.");
  }

  if (/^(.)\1+$/.test(password)) problems.push("Avoid repeating a single character.");

  return problems;
}
