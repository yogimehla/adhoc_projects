/**
 * XOR every byte of `data` with a cycling key derived from `passphrase`.
 * Applying twice with the same key restores the original data.
 */
export declare function applyXor(data: Uint8Array, passphrase: string): Uint8Array;
//# sourceMappingURL=xor.d.ts.map