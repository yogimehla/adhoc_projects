// ---------------------------------------------------------------------------
// AES-256-GCM  —  password-based encryption using Web Crypto API
// ---------------------------------------------------------------------------
// Wire format:  [ 16-byte salt | 12-byte IV | ciphertext+tag ]
// The 16-byte GCM authentication tag is appended by the browser automatically.
// ---------------------------------------------------------------------------
const textEncoder = new TextEncoder();
const SALT_SIZE = 16;
const IV_SIZE = 12;
const GCM_TAG_BITS = 128; // 16 bytes
const KEY_LENGTH = 256;
const PBKDF2_ITERATIONS = 100_000;
/** Total overhead added to plaintext length during encryption. */
export const AES_GCM_OVERHEAD_BYTES = SALT_SIZE + IV_SIZE + 16; // +16 for tag
// ── Key derivation ──────────────────────────────────────────────────────────
async function deriveKey(password, salt) {
    const passwordKey = await crypto.subtle.importKey('raw', textEncoder.encode(password), { name: 'PBKDF2' }, false, ['deriveKey']);
    return crypto.subtle.deriveKey({
        name: 'PBKDF2',
        salt,
        iterations: PBKDF2_ITERATIONS,
        hash: 'SHA-256',
    }, passwordKey, { name: 'AES-GCM', length: KEY_LENGTH }, false, ['encrypt', 'decrypt']);
}
// ── Public API ──────────────────────────────────────────────────────────────
export async function aesEncrypt(plaintext, passphrase) {
    const salt = crypto.getRandomValues(new Uint8Array(SALT_SIZE));
    const iv = crypto.getRandomValues(new Uint8Array(IV_SIZE));
    const key = await deriveKey(passphrase, salt);
    const cipherBuf = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, tagLength: GCM_TAG_BITS }, key, plaintext);
    const cipher = new Uint8Array(cipherBuf);
    const result = new Uint8Array(SALT_SIZE + IV_SIZE + cipher.length);
    result.set(salt, 0);
    result.set(iv, SALT_SIZE);
    result.set(cipher, SALT_SIZE + IV_SIZE);
    return result;
}
export async function aesDecrypt(encrypted, passphrase) {
    if (encrypted.length < SALT_SIZE + IV_SIZE) {
        throw new Error('Encrypted data too short — missing salt/IV.');
    }
    const salt = encrypted.slice(0, SALT_SIZE);
    const iv = encrypted.slice(SALT_SIZE, SALT_SIZE + IV_SIZE);
    const data = encrypted.slice(SALT_SIZE + IV_SIZE);
    const key = await deriveKey(passphrase, salt);
    const plainBuf = await crypto.subtle.decrypt({ name: 'AES-GCM', iv, tagLength: GCM_TAG_BITS }, key, data);
    return new Uint8Array(plainBuf);
}
//# sourceMappingURL=aesGcm.js.map