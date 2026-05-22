/**
 * HKDF-SHA256 → AES-GCM 256 KEK derivation.
 *
 * Why HKDF (not PBKDF2): both inputs (32-byte PRF output; 32-byte random
 * recovery secret) are full-entropy key material. PBKDF2's iteration
 * stretching exists for low-entropy human passwords — using it here would
 * add cost for no benefit. PBKDF2-100k is used ONLY on the ChromaStash
 * export path (`exportEncrypted` / `importEncrypted`), where the recovery
 * key is intentionally treated as a passphrase for ecosystem interop.
 *
 * Versioned `info` labels lock the derivation to a vault version so a
 * future migration can switch them by bumping VaultMeta.version.
 */

import { utf8Encode } from './encoding.js';

/** HKDF info label for the biometric-PRF → KEK derivation (v1). */
export const BIO_KEK_INFO = 'mv:bio-kek:v1';

/** HKDF info label for the recovery-secret → KEK derivation (v1). */
export const RECOVERY_KEK_INFO = 'mv:recovery-kek:v1';

/**
 * HKDF-SHA256 → 256-bit AES-GCM KEK.
 *
 * The returned key is **non-extractable** and limited to `wrapKey` +
 * `unwrapKey`. It cannot be used to encrypt arbitrary data — only to
 * wrap/unwrap the master key. This is a defence-in-depth choice: even an
 * XSS that grabs the KEK CryptoKey reference can only manipulate wrapped
 * MK blobs, not exfiltrate the KEK itself or use it as an encrypt oracle.
 *
 * @param ikm   input keying material (32 bytes — PRF output or recovery secret bytes)
 * @param salt  HKDF salt (16+ bytes, stored alongside VaultMeta)
 * @param info  domain-separation label (BIO_KEK_INFO or RECOVERY_KEK_INFO)
 * @returns     a non-extractable AES-GCM 256 CryptoKey with wrap/unwrap usages
 */
export async function deriveKEK(
  ikm: ArrayBuffer | Uint8Array,
  salt: ArrayBuffer | Uint8Array,
  info: string,
): Promise<CryptoKey> {
  const baseKey = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, [
    'deriveKey',
  ]);
  return crypto.subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt,
      info: utf8Encode(info),
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['wrapKey', 'unwrapKey'],
  );
}
