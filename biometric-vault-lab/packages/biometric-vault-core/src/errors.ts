/**
 * Typed error classes for @muulorigin/biometric-vault-core.
 *
 * Each error carries a stable string `code`. The React layer / host app
 * maps those codes to user-facing messages. Error messages here are for
 * developers — never include key material, recovery keys, or plaintext.
 */

export type VaultErrorCode =
  | 'INSECURE_CONTEXT'
  | 'WEBAUTHN_UNSUPPORTED'
  | 'PLATFORM_AUTHENTICATOR_UNAVAILABLE'
  | 'PRF_UNAVAILABLE'
  | 'USER_CANCELLED'
  | 'VAULT_NOT_INITIALIZED'
  | 'VAULT_LOCKED'
  | 'VAULT_ALREADY_INITIALIZED'
  | 'WRONG_RECOVERY_KEY'
  | 'INVALID_RECOVERY_KEY_FORMAT'
  | 'DECRYPTION_FAILED'
  | 'STORAGE_ERROR'
  | 'NOT_IMPLEMENTED';

export class VaultError extends Error {
  readonly code: VaultErrorCode;
  override readonly cause?: unknown;

  constructor(code: VaultErrorCode, message: string, cause?: unknown) {
    super(message);
    this.name = 'VaultError';
    this.code = code;
    if (cause !== undefined) {
      this.cause = cause;
    }
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class InsecureContextError extends VaultError {
  constructor() {
    super(
      'INSECURE_CONTEXT',
      'WebAuthn and Web Crypto require a secure context (HTTPS or localhost).',
    );
    this.name = 'InsecureContextError';
  }
}

export class WebAuthnUnsupportedError extends VaultError {
  constructor() {
    super(
      'WEBAUTHN_UNSUPPORTED',
      'window.PublicKeyCredential is unavailable in this browser.',
    );
    this.name = 'WebAuthnUnsupportedError';
  }
}

export class PlatformAuthenticatorUnavailableError extends VaultError {
  constructor() {
    super(
      'PLATFORM_AUTHENTICATOR_UNAVAILABLE',
      'No platform authenticator (Face ID / Touch ID / Windows Hello / fingerprint) is available.',
    );
    this.name = 'PlatformAuthenticatorUnavailableError';
  }
}

export class PrfUnavailableError extends VaultError {
  constructor(detail?: string) {
    super(
      'PRF_UNAVAILABLE',
      `WebAuthn PRF extension is not available on this platform${detail ? `: ${detail}` : ''}.`,
    );
    this.name = 'PrfUnavailableError';
  }
}

/**
 * The user cancelled the platform authenticator UI (or it timed out).
 * Mapped from NotAllowedError / AbortError / TimeoutError on WebAuthn calls.
 */
export class UserCancelledError extends VaultError {
  constructor(cause?: unknown) {
    super('USER_CANCELLED', 'The biometric prompt was cancelled or timed out.', cause);
    this.name = 'UserCancelledError';
  }
}

export class VaultNotInitializedError extends VaultError {
  constructor() {
    super(
      'VAULT_NOT_INITIALIZED',
      'No vault has been set up on this device — call setup() first.',
    );
    this.name = 'VaultNotInitializedError';
  }
}

export class VaultLockedError extends VaultError {
  constructor() {
    super('VAULT_LOCKED', 'The vault is locked — unlock with biometric or recovery key.');
    this.name = 'VaultLockedError';
  }
}

export class VaultAlreadyInitializedError extends VaultError {
  constructor() {
    super(
      'VAULT_ALREADY_INITIALIZED',
      'A vault already exists for this origin — call reset() before setup().',
    );
    this.name = 'VaultAlreadyInitializedError';
  }
}

export class WrongRecoveryKeyError extends VaultError {
  constructor() {
    super('WRONG_RECOVERY_KEY', 'The recovery key did not validate against the stored check digest.');
    this.name = 'WrongRecoveryKeyError';
  }
}

export class InvalidRecoveryKeyFormatError extends VaultError {
  constructor(reason: string) {
    super('INVALID_RECOVERY_KEY_FORMAT', `Recovery key is not a valid Crockford Base32 string: ${reason}`);
    this.name = 'InvalidRecoveryKeyFormatError';
  }
}

/**
 * GCM authentication tag failure or any unwrap failure. Surface to users as
 * "wrong key / corrupted data" — never as a raw exception.
 */
export class DecryptionError extends VaultError {
  constructor(cause?: unknown) {
    super('DECRYPTION_FAILED', 'Decryption failed — wrong key or corrupted data.', cause);
    this.name = 'DecryptionError';
  }
}

export class StorageError extends VaultError {
  constructor(message: string, cause?: unknown) {
    super('STORAGE_ERROR', `Storage adapter error: ${message}`, cause);
    this.name = 'StorageError';
  }
}

export class NotImplementedError extends VaultError {
  constructor(what: string) {
    super('NOT_IMPLEMENTED', `${what} — implemented in a later phase.`);
    this.name = 'NotImplementedError';
  }
}

/**
 * Best-effort mapping from a raw DOMException / unknown error thrown by the
 * platform authenticator to a typed VaultError. Anything we don't recognize
 * passes through unchanged so the caller can decide.
 */
export function mapWebAuthnError(err: unknown): VaultError | unknown {
  if (err instanceof VaultError) return err;
  if (err && typeof err === 'object' && 'name' in err) {
    const name = (err as { name?: string }).name;
    if (name === 'NotAllowedError' || name === 'AbortError' || name === 'TimeoutError') {
      return new UserCancelledError(err);
    }
    if (name === 'NotSupportedError') {
      return new PrfUnavailableError('NotSupportedError from authenticator');
    }
    if (name === 'SecurityError') {
      return new InsecureContextError();
    }
  }
  return err;
}
