/**
 * Map typed VaultErrors to short, user-facing messages. Keeps error UX
 * consistent across all screens.
 */

import { VaultError } from '@muulorigin/biometric-vault-core';

export function errorMessage(err: Error | null): string {
  if (!err) return '';
  if (!(err instanceof VaultError)) return err.message;
  switch (err.code) {
    case 'USER_CANCELLED':
      return 'Biometric prompt cancelled. Try again.';
    case 'INSECURE_CONTEXT':
      return 'This page must be served over HTTPS (or localhost).';
    case 'WEBAUTHN_UNSUPPORTED':
      return 'This browser doesn’t support WebAuthn.';
    case 'PLATFORM_AUTHENTICATOR_UNAVAILABLE':
      return 'No platform biometric (Face ID, Touch ID, Windows Hello, fingerprint) found.';
    case 'PRF_UNAVAILABLE':
      return 'PRF extension not available on this device — set up in GATE_ONLY or use a different device.';
    case 'VAULT_NOT_INITIALIZED':
      return 'No vault on this device yet — run Set up.';
    case 'VAULT_ALREADY_INITIALIZED':
      return 'A vault already exists for this origin — Reset before setting up again.';
    case 'VAULT_LOCKED':
      return 'Vault is locked — unlock first.';
    case 'WRONG_RECOVERY_KEY':
      return 'Wrong recovery key — checksum did not match.';
    case 'INVALID_RECOVERY_KEY_FORMAT':
      return `Recovery key is malformed: ${err.message.replace(/^.*: /, '')}`;
    case 'DECRYPTION_FAILED':
      return 'Wrong key or corrupted data.';
    case 'STORAGE_ERROR':
      return `Storage error: ${err.message.replace(/^.*: /, '')}`;
    default:
      return err.message;
  }
}
