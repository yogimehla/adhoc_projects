/**
 * Recovery secret: generation, encoding, parsing, checksumming.
 *
 * Format: 32 random bytes (= 256 bits) encoded in Crockford Base32,
 * uppercase, grouped in 5-char chunks separated by `-`, followed by a
 * 4-char checksum group derived from the first 2 bytes of SHA-256(secret).
 *
 * Two distinct check digests live in this module — do not confuse them:
 *
 *  1. **Display checksum** (4 chars, the trailing group on the printed
 *     string). Catches typos at parse() time BEFORE the user submits.
 *  2. **VaultMeta.recoveryCheck** (8 bytes stored in IndexedDB).
 *     Validates that a typed key matches THIS vault, BEFORE attempting any
 *     GCM unwrap. Used by Phase 3's `unlockWithRecovery`.
 *
 * The recovery key itself has 256 bits of entropy, so neither check
 * meaningfully reduces brute-force resistance.
 */

import { sha256Bytes, randomBytes } from './crypto.js';
import {
  bytesEqualConstantTime,
  fromCrockfordBase32,
  toCrockfordBase32,
} from './encoding.js';
import {
  InvalidRecoveryKeyFormatError,
  WrongRecoveryKeyError,
} from './errors.js';

const SECRET_BYTES = 32; // 256-bit entropy
const DISPLAY_GROUP_SIZE = 5;
const DISPLAY_CHECKSUM_BYTES = 2; // → 4 Crockford Base32 chars
const STORED_CHECK_BYTES = 8; // recoveryCheck in VaultMeta

/** Number of Crockford Base32 chars produced by encoding 32 bytes (ceil(32*8/5) = 52). */
const BODY_CHAR_COUNT = Math.ceil((SECRET_BYTES * 8) / 5);
/** Crockford Base32 chars produced by the display checksum (2 bytes → 4 chars). */
const CHECKSUM_CHAR_COUNT = Math.ceil((DISPLAY_CHECKSUM_BYTES * 8) / 5);

export interface RecoverySecret {
  /** Raw secret bytes (32). Caller must NOT persist these or log them. */
  bytes: ArrayBuffer;
  /** Human-readable Crockford Base32 string, grouped + checksummed. */
  display: string;
}

/**
 * Generate a fresh 32-byte recovery secret. Returns both the raw bytes and
 * the human-display form.
 *
 * Caller MUST show `display` exactly once and discard the secret from
 * memory as soon as the user has acknowledged.
 */
export async function generateRecoverySecret(): Promise<RecoverySecret> {
  const bytes = randomBytes(SECRET_BYTES);
  const display = await encodeRecoveryDisplay(bytes);
  return { bytes, display };
}

/**
 * Parse a user-typed recovery key.
 *
 * Normalizes case + visual ambiguity (O→0, I/L→1), strips whitespace and
 * separators, validates the trailing display checksum, and returns the 32
 * raw bytes.
 *
 * Throws `InvalidRecoveryKeyFormatError` for length / character errors;
 * throws `WrongRecoveryKeyError` when the displayed checksum doesn't match.
 *
 * NOTE: this validates the key is *well-formed and self-consistent*. It
 * does NOT validate that the key matches a particular vault — that's
 * `VaultMeta.recoveryCheck`'s job at unlock time.
 */
export async function parseRecoveryKey(input: string): Promise<ArrayBuffer> {
  if (typeof input !== 'string' || input.length === 0) {
    throw new InvalidRecoveryKeyFormatError('empty input');
  }

  // Normalize: strip whitespace + dashes, upper-case, fix visual ambiguity.
  const cleaned = input
    .replace(/[\s-]/g, '')
    .toUpperCase()
    .replace(/O/g, '0')
    .replace(/[IL]/g, '1');

  if (cleaned.length !== BODY_CHAR_COUNT + CHECKSUM_CHAR_COUNT) {
    throw new InvalidRecoveryKeyFormatError(
      `expected ${BODY_CHAR_COUNT + CHECKSUM_CHAR_COUNT} Crockford chars, got ${cleaned.length}`,
    );
  }

  const bodyChars = cleaned.slice(0, BODY_CHAR_COUNT);
  const checkChars = cleaned.slice(BODY_CHAR_COUNT);

  let decoded: ArrayBuffer;
  try {
    decoded = fromCrockfordBase32(bodyChars);
  } catch (err) {
    throw new InvalidRecoveryKeyFormatError(
      err instanceof Error ? err.message : 'invalid Crockford Base32',
    );
  }

  // Crockford Base32 of 52 chars decodes to ceil(52*5/8) = 33 bytes, with
  // the last byte holding only 4 bits of payload (low 4 bits are padding).
  // Trim back to the 32 secret bytes.
  if (decoded.byteLength < SECRET_BYTES) {
    throw new InvalidRecoveryKeyFormatError(
      `decoded ${decoded.byteLength} bytes, expected at least ${SECRET_BYTES}`,
    );
  }
  const secretBytes = decoded.slice(0, SECRET_BYTES);

  const expectedCheck = await displayChecksumChars(secretBytes);
  // Constant-time string compare via the byte helper.
  const enc = new TextEncoder();
  const ok = bytesEqualConstantTime(enc.encode(checkChars), enc.encode(expectedCheck));
  if (!ok) {
    throw new WrongRecoveryKeyError();
  }

  return secretBytes;
}

/**
 * Compute the short check digest stored in VaultMeta.recoveryCheck.
 *
 * Phase 3's `unlockWithRecovery` runs this against the typed key BEFORE
 * deriving the recovery KEK or attempting GCM unwrap, so a wrong key fails
 * cheaply rather than going through HKDF + a doomed GCM auth check.
 *
 * @returns 8 bytes: SHA-256(secret)[0..7]
 */
export async function computeRecoveryCheck(
  secret: ArrayBuffer | Uint8Array,
): Promise<ArrayBuffer> {
  const digest = await sha256Bytes(secret);
  return digest.slice(0, STORED_CHECK_BYTES);
}

/* ──────────────── helpers ──────────────── */

async function encodeRecoveryDisplay(secret: ArrayBuffer): Promise<string> {
  const body = toCrockfordBase32(secret).slice(0, BODY_CHAR_COUNT);
  const check = await displayChecksumChars(secret);
  return formatGroups(body + check);
}

async function displayChecksumChars(secret: ArrayBuffer | Uint8Array): Promise<string> {
  const digest = await sha256Bytes(secret);
  const prefix = digest.slice(0, DISPLAY_CHECKSUM_BYTES);
  return toCrockfordBase32(prefix).slice(0, CHECKSUM_CHAR_COUNT);
}

function formatGroups(chars: string): string {
  const out: string[] = [];
  for (let i = 0; i < chars.length; i += DISPLAY_GROUP_SIZE) {
    out.push(chars.slice(i, i + DISPLAY_GROUP_SIZE));
  }
  return out.join('-');
}
