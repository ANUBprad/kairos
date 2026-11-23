import crypto from "crypto";

/** Constant-time comparison for lowercase/uppercase hex MACs with length checks. */
export function timingSafeEqualHex(
  expectedHex: string,
  providedHex: string,
): boolean {
  if (
    typeof expectedHex !== "string" ||
    typeof providedHex !== "string" ||
    expectedHex.length !== providedHex.length ||
    expectedHex.length % 2 !== 0 ||
    !/^[0-9a-f]+$/i.test(expectedHex) ||
    !/^[0-9a-f]+$/i.test(providedHex)
  ) {
    return false;
  }

  return crypto.timingSafeEqual(
    Buffer.from(expectedHex, "hex"),
    Buffer.from(providedHex, "hex"),
  );
}

/** Constant-time comparison for arbitrary strings (e.g. OAuth state tokens). */
export function timingSafeEqualString(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}
