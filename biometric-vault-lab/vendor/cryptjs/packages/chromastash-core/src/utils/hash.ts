// ---------------------------------------------------------------------------
// SHA-256 hashing via Web Crypto API
// ---------------------------------------------------------------------------

/** Returns the hex-encoded SHA-256 digest of `buffer`. */
export async function sha256(buffer: ArrayBuffer): Promise<string> {
  const hashBuf = await crypto.subtle.digest('SHA-256', buffer);
  const bytes = new Uint8Array(hashBuf);
  let hex = '';
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, '0');
  }
  return hex;
}
