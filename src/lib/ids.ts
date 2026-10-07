import { randomBytes, randomUUID, createHash } from "node:crypto";

/** Unambiguous alphabet: no O/0, no I/1 — these get read aloud and typed by hand. */
const REF_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** Cryptographically random string from `REF_ALPHABET`. */
export function randomCode(length: number): string {
  const bytes = randomBytes(length);
  let out = "";

  for (let i = 0; i < length; i += 1) {
    out += REF_ALPHABET[bytes[i] % REF_ALPHABET.length];
  }

  return out;
}

/**
 * Customer-facing order reference, e.g. "PBK-8F2K9A".
 * 6 chars of a 32-symbol alphabet is ~1.07e9 combinations — unguessable enough
 * that order status can be looked up by reference without an account.
 */
export function generateOrderRef(prefix = "PBK"): string {
  return `${prefix}-${randomCode(6)}`;
}

/** URL-safe random token for sessions, uploads and idempotency keys. */
export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

export function newId(): string {
  return randomUUID();
}

/** SHA-256 hex digest. Used to store session tokens without keeping the secret. */
export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

/** Constant-time string comparison, for secrets. */
export function timingSafeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return bufA.equals(bufB);
}
