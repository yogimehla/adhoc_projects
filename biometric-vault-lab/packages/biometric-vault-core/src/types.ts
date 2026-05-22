/**
 * Public type definitions for @muulorigin/biometric-vault-core.
 *
 * These types are the contract the React wrapper and any host app consume.
 * They are deliberately framework-agnostic — no React, no DOM-specific
 * structures beyond ArrayBuffer (which is part of the JS standard).
 */

/**
 * The security mode chosen at setup based on platform capability.
 *
 * - PRF_SECURE: Real local encryption. Biometric gates the WebAuthn PRF
 *   output, which derives the KEK that wraps the master key. No usable key
 *   material exists at rest.
 * - GATE_ONLY: Convenience lock only. Biometric is a UI gate; the device
 *   KEK is stored on-device, so the master key is effectively recoverable
 *   from storage by anyone with device-level access. Surfaced in the UI
 *   with a warning. Never present this as secure.
 */
export enum VaultMode {
  PRF_SECURE = 'PRF_SECURE',
  GATE_ONLY = 'GATE_ONLY',
}

/**
 * The vault lifecycle state, observed by the React layer.
 */
export enum VaultState {
  UNINITIALIZED = 'UNINITIALIZED',
  LOCKED = 'LOCKED',
  UNLOCKED = 'UNLOCKED',
}

/**
 * Platform capability snapshot, computed by detectCapabilities().
 *
 * `prfMaybeSupported` is best-effort pre-registration (UA sniff + heuristics).
 * Authoritative determination happens during setup() via
 * `getClientExtensionResults().prf`.
 */
export interface Capabilities {
  secureContext: boolean;
  webauthnSupported: boolean;
  platformAuthenticatorAvailable: boolean;
  prfMaybeSupported: boolean;
  storagePersisted: boolean;
  installed: boolean;
  isIOS: boolean;
  iosVersion: number | null;
  userAgent: string;
}

/**
 * A master-key wrapped under some KEK. iv + ciphertext are stored side by
 * side; unwrap requires the matching KEK.
 */
export interface WrappedKey {
  wrapped: ArrayBuffer;
  iv: ArrayBuffer;
}

/**
 * Vault metadata persisted in the storage adapter under a single key.
 *
 * Contains only non-secret material in PRF_SECURE mode. In GATE_ONLY mode it
 * additionally contains `deviceKEKRaw` — plaintext KEK bytes. That field is
 * a deliberate weakness flagged in the UI; do not store it in PRF_SECURE.
 */
export interface VaultMeta {
  version: 1;
  mode: VaultMode;
  credentialId?: ArrayBuffer;
  prfSalt: ArrayBuffer;
  bioHkdfSalt: ArrayBuffer;
  recoveryHkdfSalt: ArrayBuffer;
  bioWrappedMK?: WrappedKey;
  deviceWrappedMK?: WrappedKey;
  deviceKEKRaw?: ArrayBuffer;
  recoveryWrappedMK: WrappedKey;
  recoveryCheck: ArrayBuffer;
  createdAt: number;
}

/**
 * A vault entry as stored — ciphertext only, plus a per-entry IV and the
 * last-modified timestamp. The entry id is used as additional authenticated
 * data (AAD) on encrypt/decrypt to bind ciphertext to its id slot.
 */
export interface VaultEntry {
  id: string;
  iv: ArrayBuffer;
  ciphertext: ArrayBuffer;
  updatedAt: number;
}

/**
 * An entry returned in plaintext to the caller after decryption.
 */
export interface PlainEntry {
  id: string;
  data: unknown;
  updatedAt: number;
}

/**
 * Off-device backup format. `blob` is a single .bvbk AES-GCM file (default);
 * `slides` is ChromaStash PNG slides. Both round-trip via ChromaStash
 * encode/decode in Phase 4 — the recovery key is the passphrase.
 */
export type ExportFormat = 'blob' | 'slides';

export interface ExportResult {
  format: ExportFormat;
  artifact: Blob | Blob[];
  integrityOk: true;
}

/**
 * Progress callback used by long-running operations (export/import).
 * Exact shape match with ChromaStash's ProgressCallback so a host that
 * already has a progress UI for ChromaStash can reuse it directly.
 */
export type ProgressCallback = (percent: number, message: string) => void;

/**
 * Logger function — exact shape match with ChromaStash's Logger.
 * The vault core never logs secrets; this hook is for non-sensitive
 * operational logs (timings, counts).
 */
export type Logger = (message: string, data?: unknown) => void;
