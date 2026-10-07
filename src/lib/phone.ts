/**
 * South African phone number handling.
 *
 * Numbers are written many ways ("082 123 4567", "+27 82 123 4567",
 * "27821234567", "0821234567"). Orders are confirmed on WhatsApp, so we
 * normalise to E.164 (`+27821234567`) for storage and keep a digits-only form
 * for wa.me links.
 */

const ZA_COUNTRY_CODE = "27";

/**
 * Normalises a South African number to E.164.
 * Returns null when the number cannot be trusted to be a reachable mobile.
 *
 * Mobile prefixes are 06x, 07x and 08x. Landlines (01x–05x) are rejected on
 * purpose: they cannot receive a WhatsApp message, which is how every order on
 * this site is confirmed. Accepting one would mean promising a confirmation the
 * customer can never receive.
 */
export function normaliseSouthAfricanPhone(input: string): string | null {
  let digits = input.replace(/\D/g, "");

  // "0027…" is the international access prefix written out in full.
  if (digits.startsWith(`00${ZA_COUNTRY_CODE}`)) {
    digits = digits.slice(2);
  }

  let national: string;

  if (digits.startsWith(ZA_COUNTRY_CODE) && digits.length === 11) {
    national = digits.slice(2);
  } else if (digits.startsWith("0") && digits.length === 10) {
    national = digits.slice(1);
  } else if (digits.length === 9) {
    national = digits;
  } else {
    return null;
  }

  // 9 digits starting 6/7/8 is a South African mobile.
  if (!/^[678]\d{8}$/.test(national)) return null;

  return `+${ZA_COUNTRY_CODE}${national}`;
}

/** Digits-only MSISDN for wa.me links ("27821234567"). */
export function toWhatsAppMsisdn(e164: string): string {
  return e164.replace(/\D/g, "");
}

/** Human-friendly display: "+27 82 123 4567". */
export function formatPhoneDisplay(e164: string): string {
  const digits = e164.replace(/\D/g, "");
  if (digits.length !== 11) return e164;

  return `+${digits.slice(0, 2)} ${digits.slice(2, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`;
}

export const isValidSouthAfricanPhone = (input: string): boolean =>
  normaliseSouthAfricanPhone(input) !== null;
