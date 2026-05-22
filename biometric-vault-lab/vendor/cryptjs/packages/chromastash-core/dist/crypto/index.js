// ---------------------------------------------------------------------------
// Crypto dispatcher — routes to the right engine based on EncryptionMethod
// ---------------------------------------------------------------------------
import { applyXor } from './xor.js';
import { aesEncrypt, aesDecrypt } from './aesGcm.js';
export { AES_GCM_OVERHEAD_BYTES } from './aesGcm.js';
export async function encrypt(data, method, secretKey) {
    switch (method) {
        case 'aes-256-gcm': {
            if (!secretKey)
                throw new Error('AES-256-GCM encryption requires a secret key.');
            return aesEncrypt(data, secretKey);
        }
        case 'xor': {
            return applyXor(data, secretKey ?? '');
        }
        case 'none':
        default:
            return data;
    }
}
export async function decrypt(data, method, secretKey) {
    switch (method) {
        case 'aes-256-gcm': {
            if (!secretKey)
                throw new Error('AES-256-GCM decryption requires a secret key.');
            try {
                return await aesDecrypt(data, secretKey);
            }
            catch {
                throw new Error('Decryption failed — the secret key is likely incorrect or the data is corrupt.');
            }
        }
        case 'xor': {
            return applyXor(data, secretKey ?? '');
        }
        case 'none':
        default:
            return data;
    }
}
//# sourceMappingURL=index.js.map