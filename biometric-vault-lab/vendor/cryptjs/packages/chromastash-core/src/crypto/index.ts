// ---------------------------------------------------------------------------
// Crypto dispatcher — routes to the right engine based on EncryptionMethod
// ---------------------------------------------------------------------------

import type { EncryptionMethod } from '../types.js';
import { applyXor } from './xor.js';
import { aesEncrypt, aesDecrypt, AES_GCM_OVERHEAD_BYTES } from './aesGcm.js';

export { AES_GCM_OVERHEAD_BYTES } from './aesGcm.js';

export async function encrypt(
  data: Uint8Array,
  method: EncryptionMethod,
  secretKey?: string,
): Promise<Uint8Array> {
  switch (method) {
    case 'aes-256-gcm': {
      if (!secretKey) throw new Error('AES-256-GCM encryption requires a secret key.');
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

export async function decrypt(
  data: Uint8Array,
  method: EncryptionMethod,
  secretKey?: string,
): Promise<Uint8Array> {
  switch (method) {
    case 'aes-256-gcm': {
      if (!secretKey) throw new Error('AES-256-GCM decryption requires a secret key.');
      try {
        return await aesDecrypt(data, secretKey);
      } catch {
        throw new Error(
          'Decryption failed — the secret key is likely incorrect or the data is corrupt.',
        );
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
