/**
 * @muulorigin/biometric-vault-core
 *
 * Pure-TypeScript core for a biometric-only, frontend-only, offline-first
 * local vault. Web Crypto only. Storage injected via VaultStorage.
 *
 * Sibling to @muulorigin/chromastash-core — designed to drop into the
 * cryptjs monorepo as a third workspace package.
 */

// Public types
export {
  VaultMode,
  VaultState,
  type Capabilities,
  type WrappedKey,
  type VaultMeta,
  type VaultEntry,
  type PlainEntry,
  type ExportFormat,
  type ExportResult,
  type ProgressCallback,
  type Logger,
} from './types.js';

// Errors
export {
  VaultError,
  type VaultErrorCode,
  InsecureContextError,
  WebAuthnUnsupportedError,
  PlatformAuthenticatorUnavailableError,
  PrfUnavailableError,
  UserCancelledError,
  VaultNotInitializedError,
  VaultLockedError,
  VaultAlreadyInitializedError,
  WrongRecoveryKeyError,
  InvalidRecoveryKeyFormatError,
  DecryptionError,
  StorageError,
  NotImplementedError,
  mapWebAuthnError,
} from './errors.js';

// Storage contract
export type { VaultStorage } from './storage.js';

// Capabilities (Phase 1: real)
export { detectCapabilities, requestPersistentStorage } from './capabilities.js';

// Encoding helpers (Phase 1: real)
export {
  toHex,
  fromHex,
  utf8Encode,
  utf8Decode,
  toBase64Url,
  fromBase64Url,
  toCrockfordBase32,
  fromCrockfordBase32,
  bytesEqualConstantTime,
} from './encoding.js';

// Crypto primitives
export {
  randomBytes,
  generateMasterKey,
  wrapMasterKey,
  unwrapMasterKey,
  encryptData,
  decryptData,
  sha256Bytes,
  zeroize,
} from './crypto.js';

// KDF
export { deriveKEK, BIO_KEK_INFO, RECOVERY_KEK_INFO } from './kdf.js';

// Recovery
export {
  generateRecoverySecret,
  parseRecoveryKey,
  computeRecoveryCheck,
  type RecoverySecret,
} from './recovery.js';

// WebAuthn (Phase 1: stubs + probe; Phase 3: full)
export {
  register,
  getPrfOutput,
  assertPresence,
  getPrfOutputDiscoverable,
  runWebAuthnPrfProbe,
  type RegisterResult,
  type WebAuthnPrfProbeResult,
} from './webauthn.js';

// Orchestrator
export {
  BiometricVault,
  type VaultOptions,
  type SetupOptions,
  type VaultEventType,
  type VaultEventListener,
} from './vault.js';
