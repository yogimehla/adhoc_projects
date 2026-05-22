import type { EncryptionMethod } from '../types.js';
export { AES_GCM_OVERHEAD_BYTES } from './aesGcm.js';
export declare function encrypt(data: Uint8Array, method: EncryptionMethod, secretKey?: string): Promise<Uint8Array>;
export declare function decrypt(data: Uint8Array, method: EncryptionMethod, secretKey?: string): Promise<Uint8Array>;
//# sourceMappingURL=index.d.ts.map