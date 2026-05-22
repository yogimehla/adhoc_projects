/**
 * Encoding helpers: base64url, UTF-8, Crockford Base32, hex, and a
 * constant-time byte comparison.
 *
 * Implemented locally because @muulorigin/chromastash-core does not export
 * these primitives — only `sha256` (hex digest) and passphrase-based
 * `aesEncrypt`/`aesDecrypt`. Naming style follows ChromaStash conventions.
 */

const HEX_TABLE = '0123456789abcdef';

export function toHex(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let out = '';
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i]!;
    out += HEX_TABLE[(b >>> 4) & 0xf];
    out += HEX_TABLE[b & 0xf];
  }
  return out;
}

export function fromHex(hex: string): ArrayBuffer {
  const clean = hex.trim().toLowerCase();
  if (clean.length % 2 !== 0) {
    throw new Error('fromHex: input length must be even');
  }
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) {
    const byte = parseInt(clean.substring(i * 2, i * 2 + 2), 16);
    if (Number.isNaN(byte)) throw new Error('fromHex: non-hex character');
    out[i] = byte;
  }
  return out.buffer;
}

const UTF8_ENCODER = new TextEncoder();
const UTF8_DECODER = new TextDecoder('utf-8', { fatal: true });

export function utf8Encode(text: string): ArrayBuffer {
  return UTF8_ENCODER.encode(text).buffer as ArrayBuffer;
}

export function utf8Decode(buffer: ArrayBuffer | Uint8Array): string {
  return UTF8_DECODER.decode(buffer);
}

export function toBase64Url(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  const b64 = btoa(binary);
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function fromBase64Url(input: string): ArrayBuffer {
  const padded = input.replace(/-/g, '+').replace(/_/g, '/');
  const pad = padded.length % 4 === 0 ? '' : '='.repeat(4 - (padded.length % 4));
  const binary = atob(padded + pad);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out.buffer;
}

/**
 * Constant-time byte comparison. Returns true iff the two inputs are equal
 * length and equal content. Compares all bytes regardless of mismatch
 * position to avoid timing side channels on the recoveryCheck.
 */
export function bytesEqualConstantTime(
  a: ArrayBuffer | Uint8Array,
  b: ArrayBuffer | Uint8Array,
): boolean {
  const aa = a instanceof Uint8Array ? a : new Uint8Array(a);
  const bb = b instanceof Uint8Array ? b : new Uint8Array(b);
  if (aa.length !== bb.length) return false;
  let diff = 0;
  for (let i = 0; i < aa.length; i++) {
    diff |= aa[i]! ^ bb[i]!;
  }
  return diff === 0;
}

/* ──────────────── Crockford Base32 ────────────────
 * Crockford's alphabet drops the visually ambiguous characters I, L, O, U.
 * On parse we normalize 'O'→'0' and 'I'/'L'→'1' so a user squinting at a
 * handwritten copy of the recovery key still gets through.
 */

const CROCKFORD_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const CROCKFORD_DECODE = new Map<string, number>();
for (let i = 0; i < CROCKFORD_ALPHABET.length; i++) {
  CROCKFORD_DECODE.set(CROCKFORD_ALPHABET[i]!, i);
}

export function toCrockfordBase32(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let bits = 0;
  let value = 0;
  let out = '';
  for (let i = 0; i < bytes.length; i++) {
    value = (value << 8) | bytes[i]!;
    bits += 8;
    while (bits >= 5) {
      bits -= 5;
      out += CROCKFORD_ALPHABET[(value >>> bits) & 0x1f]!;
    }
  }
  if (bits > 0) {
    out += CROCKFORD_ALPHABET[(value << (5 - bits)) & 0x1f]!;
  }
  return out;
}

export function fromCrockfordBase32(input: string): ArrayBuffer {
  const normalized = input
    .toUpperCase()
    .replace(/O/g, '0')
    .replace(/[IL]/g, '1')
    .replace(/[^0-9A-Z]/g, '');

  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (let i = 0; i < normalized.length; i++) {
    const ch = normalized[i]!;
    const v = CROCKFORD_DECODE.get(ch);
    if (v === undefined) {
      throw new Error(`fromCrockfordBase32: invalid character "${ch}" at position ${i}`);
    }
    value = (value << 5) | v;
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      out.push((value >>> bits) & 0xff);
    }
  }
  return new Uint8Array(out).buffer;
}
