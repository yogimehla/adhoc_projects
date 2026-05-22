// ---------------------------------------------------------------------------
// XOR symmetric cipher
// ---------------------------------------------------------------------------

const textEncoder = new TextEncoder();

/**
 * XOR every byte of `data` with a cycling key derived from `passphrase`.
 * Applying twice with the same key restores the original data.
 */
export function applyXor(data: Uint8Array, passphrase: string): Uint8Array {
  if (!passphrase) return data;
  const keyBytes = textEncoder.encode(passphrase);
  if (keyBytes.length === 0) return data;

  const result = new Uint8Array(data.length);
  for (let i = 0; i < data.length; i++) {
    result[i] = data[i] ^ keyBytes[i % keyBytes.length];
  }
  return result;
}
