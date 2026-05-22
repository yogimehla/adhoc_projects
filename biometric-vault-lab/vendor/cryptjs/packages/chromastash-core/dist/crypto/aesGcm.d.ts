/** Total overhead added to plaintext length during encryption. */
export declare const AES_GCM_OVERHEAD_BYTES: number;
export declare function aesEncrypt(plaintext: Uint8Array, passphrase: string): Promise<Uint8Array>;
export declare function aesDecrypt(encrypted: Uint8Array, passphrase: string): Promise<Uint8Array>;
//# sourceMappingURL=aesGcm.d.ts.map