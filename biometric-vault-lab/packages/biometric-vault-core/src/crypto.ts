/**
 * AES-256-GCM raw-key primitives and master-key wrap/unwrap.
 *
 * Implemented locally (not via ChromaStash) because:
 *  - ChromaStash exports passphrase-based `aesEncrypt`/`aesDecrypt` (PBKDF2
 *    inside). The vault's daily path needs RAW-KEY AES-GCM where the KEK is
 *    a `CryptoKey`, not a passphrase. PBKDF2 would add cost for no benefit
 *    since PRF/recovery outputs are already full-entropy.
 *  - Phase 4's `exportEncrypted` / `importEncrypted` delegates to ChromaStash
 *    `encode`/`decode` — that is where the recovery key is intentionally
 *    treated as a passphrase.
 *
 * Versioned crypto labels — VaultMeta.version + these constants gate
 * migrations. Bump together and add migration logic in vault.ts.
 */

import { DecryptionError } from './errors.js';
import type { WrappedKey } from './types.js';

const ALGO = 'AES-GCM';
const KEY_BITS = 256;
const IV_BYTES = 12;

/**
 * Cryptographically secure random bytes via the platform RNG.
 *
 * @param byteLength how many random bytes to return
 * @returns a fresh ArrayBuffer of `byteLength` random bytes
 */
export function randomBytes(byteLength: number): ArrayBuffer {
  const out = new Uint8Array(byteLength);
  crypto.getRandomValues(out);
  return out.buffer;
}

/**
 * Generate a fresh 256-bit master key.
 *
 * Extractable so it can be wrapped by a KEK. Usages limited to encrypt and
 * decrypt of vault entries — the MK never wraps or unwraps anything itself.
 * Wrapping is done by KEKs derived from PRF or the recovery secret.
 */
export function generateMasterKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey({ name: ALGO, length: KEY_BITS }, true, [
    'encrypt',
    'decrypt',
  ]);
}

/**
 * Wrap a master key under a KEK using AES-GCM.
 *
 * Uses a fresh 12-byte random IV per wrap. Returns the wrapped bytes plus
 * the IV used (both go into VaultMeta side by side).
 *
 * @param masterKey  the AES-GCM 256 key to wrap (must be extractable)
 * @param kek        an AES-GCM 256 key with `wrapKey` usage
 * @returns          { wrapped: ArrayBuffer, iv: ArrayBuffer(12) }
 */
export async function wrapMasterKey(
  masterKey: CryptoKey,
  kek: CryptoKey,
): Promise<WrappedKey> {
  const iv = randomBytes(IV_BYTES);
  const wrapped = await crypto.subtle.wrapKey('raw', masterKey, kek, {
    name: ALGO,
    iv,
  });
  return { wrapped, iv };
}

/**
 * Unwrap a master key from `wrapped + iv` using `kek`.
 *
 * Returns an extractable AES-GCM 256 CryptoKey usable for entry encrypt /
 * decrypt. GCM auth-tag failures (wrong KEK or tampered ciphertext) surface
 * as `DecryptionError` — never a raw exception.
 *
 * The returned key is extractable so it can in turn be wrapped (e.g. by
 * `rotateRecoveryKey()` in Phase 4 which re-wraps MK under a fresh KEK).
 */
export async function unwrapMasterKey(
  wrapped: WrappedKey,
  kek: CryptoKey,
): Promise<CryptoKey> {
  try {
    return await crypto.subtle.unwrapKey(
      'raw',
      wrapped.wrapped,
      kek,
      { name: ALGO, iv: wrapped.iv },
      { name: ALGO, length: KEY_BITS },
      true,
      ['encrypt', 'decrypt'],
    );
  } catch (err) {
    throw new DecryptionError(err);
  }
}

/**
 * Encrypt arbitrary plaintext with the master key.
 *
 * AAD optional but recommended — the vault uses the entry id as AAD so a
 * swap-the-record attack (move ciphertext for `notes/a` into the row for
 * `notes/b`) fails the GCM auth tag.
 *
 * @returns { iv, ciphertext } — store both. IV is the random 12-byte one
 *          generated here; ciphertext includes the GCM tag.
 */
export async function encryptData(
  mk: CryptoKey,
  plaintext: ArrayBuffer | Uint8Array,
  aad?: ArrayBuffer | Uint8Array,
): Promise<{ iv: ArrayBuffer; ciphertext: ArrayBuffer }> {
  const iv = randomBytes(IV_BYTES);
  const params: AesGcmParams = aad !== undefined
    ? { name: ALGO, iv, additionalData: aad }
    : { name: ALGO, iv };
  const ciphertext = await crypto.subtle.encrypt(params, mk, plaintext);
  return { iv, ciphertext };
}

/**
 * Decrypt with the master key. GCM auth-tag failures surface as
 * `DecryptionError` ("wrong key / corrupted data").
 *
 * Pass the same AAD that was used at encrypt time — for vault entries that
 * is the entry id (UTF-8 encoded).
 */
export async function decryptData(
  mk: CryptoKey,
  iv: ArrayBuffer | Uint8Array,
  ciphertext: ArrayBuffer | Uint8Array,
  aad?: ArrayBuffer | Uint8Array,
): Promise<ArrayBuffer> {
  const params: AesGcmParams = aad !== undefined
    ? { name: ALGO, iv, additionalData: aad }
    : { name: ALGO, iv };
  try {
    return await crypto.subtle.decrypt(params, mk, ciphertext);
  } catch (err) {
    throw new DecryptionError(err);
  }
}

/**
 * SHA-256 digest as raw bytes. Use ChromaStash's `sha256()` for the hex
 * string form (Phase 4 imports it); this is the bytes-only helper used
 * internally by recovery.ts and the self-test panel.
 */
export async function sha256Bytes(data: ArrayBuffer | Uint8Array): Promise<ArrayBuffer> {
  return crypto.subtle.digest('SHA-256', data);
}

/**
 * Best-effort zeroization of a Uint8Array view. Note: `CryptoKey` internals
 * cannot be wiped from JS — only raw byte buffers we hold ourselves.
 */
export function zeroize(view: Uint8Array): void {
  view.fill(0);
}
