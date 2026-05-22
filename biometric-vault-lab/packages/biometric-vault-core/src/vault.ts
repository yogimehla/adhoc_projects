/**
 * BiometricVault — public orchestrator.
 *
 * The design point: there is no `isUnlocked` boolean that, if flipped,
 * exposes plaintext. "Unlocked" means `#masterKey !== null` — and
 * `#masterKey` is the live AES-GCM CryptoKey handle. Locking is
 * `#masterKey = null`. If an attacker bypasses the JS guard, all they
 * find in storage is ciphertext and wrapped keys.
 */

import {
  decrypt as chromaDecrypt,
  decode as chromaDecode,
  encrypt as chromaEncrypt,
  encode as chromaEncode,
} from '@muulorigin/chromastash-core';
import { detectCapabilities, requestPersistentStorage } from './capabilities.js';
import {
  decryptData,
  encryptData,
  generateMasterKey,
  randomBytes,
  unwrapMasterKey,
  wrapMasterKey,
} from './crypto.js';
import {
  bytesEqualConstantTime,
  fromBase64Url,
  toBase64Url,
  utf8Decode,
  utf8Encode,
} from './encoding.js';
import {
  DecryptionError,
  InsecureContextError,
  PlatformAuthenticatorUnavailableError,
  PrfUnavailableError,
  VaultAlreadyInitializedError,
  VaultError,
  VaultLockedError,
  VaultNotInitializedError,
  WebAuthnUnsupportedError,
  WrongRecoveryKeyError,
} from './errors.js';
import {
  BIO_KEK_INFO,
  RECOVERY_KEK_INFO,
  deriveKEK,
} from './kdf.js';
import {
  computeRecoveryCheck,
  generateRecoverySecret,
  parseRecoveryKey,
} from './recovery.js';
import type { VaultStorage } from './storage.js';
import {
  type Capabilities,
  type ExportFormat,
  type ExportResult,
  type Logger,
  type PlainEntry,
  type ProgressCallback,
  type VaultEntry,
  type VaultMeta,
  VaultMode,
  VaultState,
  type WrappedKey,
} from './types.js';
import {
  assertPresence,
  getPrfOutput,
  register,
} from './webauthn.js';

const BACKUP_KIND = 'biometric-vault-backup';
const BACKUP_VERSION = 1;
const BACKUP_FILENAME = 'vault.bvbk';
const BACKUP_MIME = 'application/x-biometric-vault-backup';

export interface VaultOptions {
  /** Auto-lock inactivity timeout in milliseconds. Default 5 minutes. */
  autoLockMs?: number;
}

export interface SetupOptions {
  /**
   * Force GATE_ONLY mode even if the platform would have returned PRF.
   * Debug-only — used by Phase 3 acceptance to exercise the GATE_ONLY
   * code path on a PRF-capable host.
   */
  forceGateOnly?: boolean;
}

export type VaultEventType = 'unlock' | 'lock' | 'reset' | 'auto-lock' | 'change';

/**
 * Minimal event subscription contract. Replaces the React layer needing to
 * poll vault.getState() — the hook subscribes and re-renders when state
 * changes (e.g. when auto-lock fires while the user is on the Vault
 * screen).
 */
export type VaultEventListener = (type: VaultEventType) => void;

export class BiometricVault {
  readonly #storage: VaultStorage;
  readonly #autoLockMs: number;

  /**
   * Live unlocked master key. `null` ⇔ vault is locked or uninitialized.
   * The presence of this handle IS the unlock state — no separate boolean.
   */
  #masterKey: CryptoKey | null = null;
  #mode: VaultMode | null = null;

  #autoLockTimer: ReturnType<typeof setTimeout> | null = null;
  #autoLockTeardown: Array<() => void> = [];
  #listeners = new Set<VaultEventListener>();

  constructor(storage: VaultStorage, opts: VaultOptions = {}) {
    this.#storage = storage;
    this.#autoLockMs = opts.autoLockMs ?? 5 * 60 * 1000;
  }

  /* ──────────────── observability ──────────────── */

  getState(): VaultState {
    if (this.#masterKey !== null) return VaultState.UNLOCKED;
    return VaultState.LOCKED;
  }

  getMode(): VaultMode | null {
    return this.#mode;
  }

  async isInitialized(): Promise<boolean> {
    const meta = await this.#storage.getMeta();
    if (meta) this.#mode = meta.mode;
    return meta !== null;
  }

  capabilities(): Promise<Capabilities> {
    return detectCapabilities();
  }

  /**
   * Subscribe to vault state-change events. Returns an unsubscribe.
   * React hooks use this to re-render on auto-lock without polling.
   */
  subscribe(listener: VaultEventListener): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  /* ──────────────── lifecycle ──────────────── */

  /**
   * One-time setup. Detects capabilities, registers a discoverable
   * platform passkey with PRF extension, generates a fresh master key,
   * wraps it under both a biometric (or device) KEK AND a recovery KEK,
   * persists VaultMeta, requests persistent storage, returns the recovery
   * key ONCE. The recovery key is never persisted.
   *
   * One-prompt PRF optimization: PRF bytes returned on create() are used
   * directly; only fall back to a follow-up get() when create() didn't
   * surface PRF (Chromium today).
   */
  async setup(opts: SetupOptions = {}): Promise<{ mode: VaultMode; recoveryKey: string }> {
    if (typeof window === 'undefined' || !window.isSecureContext) throw new InsecureContextError();
    if (typeof window.PublicKeyCredential === 'undefined') throw new WebAuthnUnsupportedError();

    const isUVPAA =
      typeof window.PublicKeyCredential
        .isUserVerifyingPlatformAuthenticatorAvailable === 'function' &&
      (await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable());
    if (!isUVPAA) throw new PlatformAuthenticatorUnavailableError();

    if (await this.isInitialized()) throw new VaultAlreadyInitializedError();

    const prfSalt = randomBytes(32);
    const bioHkdfSalt = randomBytes(16);
    const recoveryHkdfSalt = randomBytes(16);

    const { credentialId, prfBytes: prfFromCreate } = await register(prfSalt);

    // One-prompt PRF read: prefer PRF from create() (Safari path).
    let prfBytes: ArrayBuffer | undefined = prfFromCreate;
    if (!prfBytes && !opts.forceGateOnly) {
      // Chromium path: PRF not on create — do a follow-up get().
      prfBytes = await getPrfOutput(credentialId, prfSalt);
    }

    const mk = await generateMasterKey();

    let mode: VaultMode;
    let bioWrappedMK: WrappedKey | undefined;
    let deviceWrappedMK: WrappedKey | undefined;
    let deviceKEKRaw: ArrayBuffer | undefined;

    if (prfBytes && !opts.forceGateOnly) {
      mode = VaultMode.PRF_SECURE;
      const bioKEK = await deriveKEK(prfBytes, bioHkdfSalt, BIO_KEK_INFO);
      bioWrappedMK = await wrapMasterKey(mk, bioKEK);
    } else {
      // No PRF on this platform (or debug-forced) → GATE_ONLY.
      // The KEK lives in IndexedDB as plaintext bytes. Insecure by design,
      // flagged in the UI.
      mode = VaultMode.GATE_ONLY;
      deviceKEKRaw = randomBytes(32);
      const deviceKEK = await deriveKEK(deviceKEKRaw, bioHkdfSalt, BIO_KEK_INFO);
      deviceWrappedMK = await wrapMasterKey(mk, deviceKEK);
    }

    // Recovery copy — always.
    const { bytes: recoverySecret, display: recoveryKey } = await generateRecoverySecret();
    const recoveryKEK = await deriveKEK(recoverySecret, recoveryHkdfSalt, RECOVERY_KEK_INFO);
    const recoveryWrappedMK = await wrapMasterKey(mk, recoveryKEK);
    const recoveryCheck = await computeRecoveryCheck(recoverySecret);

    const meta: VaultMeta = {
      version: 1,
      mode,
      credentialId,
      prfSalt,
      bioHkdfSalt,
      recoveryHkdfSalt,
      bioWrappedMK,
      deviceWrappedMK,
      deviceKEKRaw,
      recoveryWrappedMK,
      recoveryCheck,
      createdAt: Date.now(),
    };
    await this.#storage.putMeta(meta);

    // Best-effort: request persistent storage so iOS / browser eviction
    // doesn't wipe the only copy. Surface the result via capabilities()
    // — UI shows the warning if false.
    await requestPersistentStorage();

    this.#masterKey = mk;
    this.#mode = mode;
    this.#armAutoLock();
    this.#emit('unlock');
    this.#emit('change');

    return { mode, recoveryKey };
  }

  /**
   * Unlock by biometric / UV gesture. Branches on the stored vault mode:
   *  - PRF_SECURE: do a PRF get(), derive bioKEK, unwrap MK.
   *  - GATE_ONLY:  do a UV-only assert, derive deviceKEK from the locally
   *                stored deviceKEKRaw, unwrap MK.
   */
  async unlockWithBiometric(): Promise<void> {
    const meta = await this.#storage.getMeta();
    if (!meta) throw new VaultNotInitializedError();
    if (!meta.credentialId) {
      throw new VaultError('VAULT_NOT_INITIALIZED', 'VaultMeta has no credentialId');
    }

    let mk: CryptoKey;
    if (meta.mode === VaultMode.PRF_SECURE) {
      if (!meta.bioWrappedMK) {
        throw new VaultError('VAULT_NOT_INITIALIZED', 'PRF_SECURE meta has no bioWrappedMK');
      }
      const prfBytes = await getPrfOutput(meta.credentialId, meta.prfSalt);
      if (!prfBytes) {
        throw new PrfUnavailableError('PRF output was empty at unlock');
      }
      const bioKEK = await deriveKEK(prfBytes, meta.bioHkdfSalt, BIO_KEK_INFO);
      mk = await unwrapMasterKey(meta.bioWrappedMK, bioKEK);
    } else {
      if (!meta.deviceWrappedMK || !meta.deviceKEKRaw) {
        throw new VaultError(
          'VAULT_NOT_INITIALIZED',
          'GATE_ONLY meta missing deviceWrappedMK or deviceKEKRaw',
        );
      }
      await assertPresence(meta.credentialId);
      const deviceKEK = await deriveKEK(meta.deviceKEKRaw, meta.bioHkdfSalt, BIO_KEK_INFO);
      mk = await unwrapMasterKey(meta.deviceWrappedMK, deviceKEK);
    }

    this.#masterKey = mk;
    this.#mode = meta.mode;
    this.#armAutoLock();
    this.#emit('unlock');
    this.#emit('change');
  }

  /**
   * Unlock by recovery key. Validates the typed key via VaultMeta's stored
   * `recoveryCheck` BEFORE deriving the KEK or attempting any GCM unwrap —
   * wrong-key path is fast-fail and never touches the AES-GCM auth tag.
   *
   * `parseRecoveryKey()` itself validates the display checksum; mismatches
   * (typos) throw before this method runs. The check here catches the
   * narrow case where the typed key is well-formed but for a different
   * vault.
   */
  async unlockWithRecovery(recoveryKey: string): Promise<void> {
    const meta = await this.#storage.getMeta();
    if (!meta) throw new VaultNotInitializedError();

    // 1) Format + display-checksum validation (throws on typo).
    const secret = await parseRecoveryKey(recoveryKey);

    // 2) Vault-binding check before any KDF / GCM work.
    const computed = await computeRecoveryCheck(secret);
    if (!bytesEqualConstantTime(computed, meta.recoveryCheck)) {
      throw new WrongRecoveryKeyError();
    }

    const recoveryKEK = await deriveKEK(secret, meta.recoveryHkdfSalt, RECOVERY_KEK_INFO);
    const mk = await unwrapMasterKey(meta.recoveryWrappedMK, recoveryKEK);

    this.#masterKey = mk;
    this.#mode = meta.mode;
    this.#armAutoLock();
    this.#emit('unlock');
    this.#emit('change');
  }

  /**
   * Lock: drop the in-memory master key + tear down auto-lock listeners.
   * Synchronous and cheap. After this, all CRUD throws VaultLockedError.
   */
  lock(): void {
    if (this.#masterKey === null) return;
    this.#masterKey = null;
    this.#disarmAutoLock();
    this.#emit('lock');
    this.#emit('change');
  }

  /* ──────────────── CRUD ──────────────── */

  async put(id: string, data: unknown): Promise<void> {
    const mk = this.#requireUnlocked();
    const plaintext = utf8Encode(JSON.stringify(data));
    const aad = utf8Encode(`entry/${id}`);
    const { iv, ciphertext } = await encryptData(mk, plaintext, aad);
    await this.#storage.putEntry({ id, iv, ciphertext, updatedAt: Date.now() });
    this.#touch();
  }

  async get(id: string): Promise<unknown | null> {
    const mk = this.#requireUnlocked();
    const entry = await this.#storage.getEntry(id);
    if (!entry) return null;
    const aad = utf8Encode(`entry/${id}`);
    let plain: ArrayBuffer;
    try {
      plain = await decryptData(mk, entry.iv, entry.ciphertext, aad);
    } catch (err) {
      if (err instanceof DecryptionError) throw err;
      throw new DecryptionError(err);
    }
    this.#touch();
    return JSON.parse(utf8Decode(plain));
  }

  async list(): Promise<PlainEntry[]> {
    const mk = this.#requireUnlocked();
    const entries = await this.#storage.listEntries();
    const out: PlainEntry[] = [];
    for (const e of entries) {
      const aad = utf8Encode(`entry/${e.id}`);
      const plain = await decryptData(mk, e.iv, e.ciphertext, aad);
      out.push({
        id: e.id,
        data: JSON.parse(utf8Decode(plain)),
        updatedAt: e.updatedAt,
      });
    }
    this.#touch();
    return out;
  }

  async remove(id: string): Promise<void> {
    this.#requireUnlocked();
    await this.#storage.deleteEntry(id);
    this.#touch();
  }

  /* ──────────────── backup (delegates to ChromaStash) ──────────────── */

  /**
   * Snapshot the vault into a portable encrypted artifact. The artifact is
   * keyed by the recovery key (treated here as a passphrase, intentionally
   * — this is the PBKDF2-100k ecosystem-interop path the spec earmarks).
   *
   * Payload contents: VaultMeta (excluding the GATE_ONLY plaintext KEK and
   * the device-local credentialId/deviceWrappedMK) + every encrypted
   * entry. Anyone with the recovery key can decode this artifact and
   * reconstitute the master key — so it inherits the recovery key's risk
   * profile: lose it and the backup is useless; share it and the vault is
   * compromised.
   *
   * Format choices:
   *  - 'blob'   (default) — single .bvbk file. ChromaStash `encrypt()`
   *    wraps the payload bytes in PBKDF2 + AES-256-GCM (16B salt | 12B IV |
   *    ct+tag), suitable for upload to any storage.
   *  - 'slides' — ChromaStash steganographic PNG slides. Same encryption,
   *    additionally pixel-encoded so the artifact looks like a set of
   *    abstract image tiles.
   */
  async exportEncrypted(
    recoveryKey: string,
    opts?: { format?: ExportFormat },
    onProgress?: ProgressCallback,
    logger?: Logger,
  ): Promise<ExportResult> {
    const format: ExportFormat = opts?.format ?? 'blob';
    const meta = await this.#storage.getMeta();
    if (!meta) throw new VaultNotInitializedError();

    // 1) Validate the recovery key against the stored check digest BEFORE
    //    spending any time encrypting megabytes. Same fast-fail as unlock.
    const secret = await parseRecoveryKey(recoveryKey);
    const computedCheck = await computeRecoveryCheck(secret);
    if (!bytesEqualConstantTime(computedCheck, meta.recoveryCheck)) {
      throw new WrongRecoveryKeyError();
    }

    onProgress?.(2, 'Snapshotting vault…');
    const entries = await this.#storage.listEntries();
    onProgress?.(10, `Serialising ${entries.length} entries…`);

    const payload = serializeBackup(meta, entries);
    const payloadBytes = utf8Encode(JSON.stringify(payload));
    const payloadView = new Uint8Array(payloadBytes);

    onProgress?.(20, `Encrypting (${format})…`);

    if (format === 'blob') {
      const enc = await chromaEncrypt(payloadView, 'aes-256-gcm', recoveryKey);
      onProgress?.(100, 'Done');
      logger?.('exportEncrypted: blob format ready', { bytes: enc.byteLength });
      return {
        format: 'blob',
        artifact: new Blob([enc as Uint8Array<ArrayBuffer>], { type: BACKUP_MIME }),
        integrityOk: true,
      };
    }

    // 'slides' — full ChromaStash steganographic encode.
    const result = await chromaEncode(
      payloadView.buffer.slice(payloadView.byteOffset, payloadView.byteOffset + payloadView.byteLength),
      {
        encryption: 'aes-256-gcm',
        secretKey: recoveryKey,
        fileName: BACKUP_FILENAME,
        mimeType: BACKUP_MIME,
      },
      onProgress,
      logger,
    );
    return { format: 'slides', artifact: result.slides, integrityOk: true };
  }

  /**
   * Restore from a ChromaStash artifact. Accepts both formats — auto-
   * detects blob vs slides on the input type. Verifies the payload is a
   * v1 vault backup, restores VaultMeta + entries, then unlocks using the
   * recovery key (yields the same MK that produced the backup).
   *
   * After this completes the vault is UNLOCKED and `getState() === UNLOCKED`.
   * The biometric path may or may not work on the new device: if the
   * original credentialId is still valid (e.g. iCloud Keychain synced
   * passkey) it will; otherwise the user should reset + setup to register
   * a fresh passkey, which re-wraps MK under a new bioKEK.
   */
  async importEncrypted(
    artifact: Blob | Blob[],
    recoveryKey: string,
    onProgress?: ProgressCallback,
    logger?: Logger,
  ): Promise<void> {
    onProgress?.(5, 'Decrypting artifact…');

    let payloadBytes: Uint8Array;
    let integrityFromCodec: boolean | null = null;

    if (Array.isArray(artifact)) {
      // 'slides' path — full ChromaStash decode.
      const result = await chromaDecode(
        artifact,
        { encryption: 'aes-256-gcm', secretKey: recoveryKey },
        onProgress,
        logger,
      );
      integrityFromCodec = result.integrityOk;
      const buf = await result.blob.arrayBuffer();
      payloadBytes = new Uint8Array(buf);
    } else {
      // 'blob' path — simple ChromaStash AES-GCM decrypt.
      const encBytes = new Uint8Array(await artifact.arrayBuffer());
      try {
        payloadBytes = await chromaDecrypt(encBytes, 'aes-256-gcm', recoveryKey);
      } catch (err) {
        // ChromaStash throws a generic Error; surface as DecryptionError so
        // the UI shows "wrong key / corrupted data" instead of the raw msg.
        throw new DecryptionError(err);
      }
    }

    onProgress?.(70, 'Parsing payload…');

    let payload: BackupPayloadV1;
    try {
      payload = JSON.parse(utf8Decode(payloadBytes)) as BackupPayloadV1;
    } catch (err) {
      throw new VaultError('DECRYPTION_FAILED', 'Backup payload is not valid JSON', err);
    }

    if (payload.kind !== BACKUP_KIND) {
      throw new VaultError(
        'DECRYPTION_FAILED',
        `Not a vault backup (kind="${String(payload.kind)}")`,
      );
    }
    if (payload.version !== BACKUP_VERSION) {
      throw new VaultError(
        'DECRYPTION_FAILED',
        `Unsupported backup version: ${String(payload.version)}`,
      );
    }

    onProgress?.(80, 'Validating recovery key…');

    // 2) Reconstruct VaultMeta and validate recovery key against the
    //    backup's stored recoveryCheck — defense in depth even though the
    //    chromastash decrypt already auth-checked under the same key.
    const restoredMeta = deserializeMeta(payload);
    const secret = await parseRecoveryKey(recoveryKey);
    const computedCheck = await computeRecoveryCheck(secret);
    if (!bytesEqualConstantTime(computedCheck, restoredMeta.recoveryCheck)) {
      throw new WrongRecoveryKeyError();
    }

    onProgress?.(88, 'Unwrapping master key…');

    const recoveryKEK = await deriveKEK(secret, restoredMeta.recoveryHkdfSalt, RECOVERY_KEK_INFO);
    const mk = await unwrapMasterKey(restoredMeta.recoveryWrappedMK, recoveryKEK);

    onProgress?.(92, 'Writing storage…');

    // Wipe any pre-existing vault on this origin before restoring. Mixing
    // restored entries with a different existing vault would be ambiguous;
    // the safer behaviour is "import replaces, period."
    await this.#storage.clearAll();
    await this.#storage.putMeta(restoredMeta);
    for (const e of payload.entries) {
      await this.#storage.putEntry(deserializeEntry(e));
    }

    this.#masterKey = mk;
    this.#mode = restoredMeta.mode;
    this.#armAutoLock();
    this.#emit('unlock');
    this.#emit('change');

    onProgress?.(100, 'Restore complete');
    logger?.('importEncrypted: restore complete', {
      entries: payload.entries.length,
      mode: restoredMeta.mode,
      codecIntegrityOk: integrityFromCodec,
    });
  }

  /**
   * Generate a fresh recovery key and re-wrap the master key under it.
   * Requires UNLOCKED. The old recovery key is invalidated as soon as the
   * new VaultMeta is persisted — the old `recoveryWrappedMK` is gone.
   *
   * Uses a FRESH HKDF salt so even if the user picks a similar-looking
   * recovery secret (vanishingly unlikely with 256 bits of entropy, but
   * defence-in-depth), the derived KEK is unrelated to the old one.
   */
  async rotateRecoveryKey(): Promise<string> {
    const mk = this.#requireUnlocked();
    const meta = await this.#storage.getMeta();
    if (!meta) throw new VaultNotInitializedError();

    const { bytes: recoverySecret, display: newRecoveryKey } = await generateRecoverySecret();
    const newSalt = randomBytes(16);
    const newKEK = await deriveKEK(recoverySecret, newSalt, RECOVERY_KEK_INFO);
    const newWrappedMK = await wrapMasterKey(mk, newKEK);
    const newCheck = await computeRecoveryCheck(recoverySecret);

    const updated: VaultMeta = {
      ...meta,
      recoveryHkdfSalt: newSalt,
      recoveryWrappedMK: newWrappedMK,
      recoveryCheck: newCheck,
    };
    await this.#storage.putMeta(updated);
    this.#emit('change');

    return newRecoveryKey;
  }

  /**
   * Wipe storage and drop in-memory MK. After this, isInitialized() = false
   * and getState() = LOCKED until setup() runs again.
   */
  async reset(): Promise<void> {
    await this.#storage.clearAll();
    const wasUnlocked = this.#masterKey !== null;
    this.#masterKey = null;
    this.#mode = null;
    this.#disarmAutoLock();
    if (wasUnlocked) this.#emit('lock');
    this.#emit('reset');
    this.#emit('change');
  }

  /* ──────────────── persist helper ──────────────── */

  requestPersistentStorage(): Promise<boolean> {
    return requestPersistentStorage();
  }

  /* ──────────────── internal ──────────────── */

  #requireUnlocked(): CryptoKey {
    if (this.#masterKey === null) throw new VaultLockedError();
    return this.#masterKey;
  }

  #emit(type: VaultEventType): void {
    // Snapshot to avoid mutation-during-iteration when a listener
    // unsubscribes inside its callback.
    for (const listener of [...this.#listeners]) {
      try {
        listener(type);
      } catch {
        // Listener errors are non-fatal — never let a buggy UI hook
        // break vault state transitions.
      }
    }
  }

  /**
   * Start the auto-lock countdown and wire activity listeners. Idempotent
   * — calling it again resets the timer.
   */
  #armAutoLock(): void {
    this.#disarmAutoLock();
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      // Non-DOM environment (Worker, SSR) — just the timer.
      this.#scheduleLock();
      return;
    }

    const onActivity = () => this.#touch();
    // ⚠ LAB-TESTING TEMPORARY ⚠
    // Visibility-change and pagehide auto-locks are disabled so the user
    // can switch to Notepad / DevTools / another tab without losing
    // their unlocked session. The 5-minute inactivity timer still fires.
    // REVERT BEFORE ANY PRODUCTION USE — `visibilitychange→lock` is a real
    // security control (master key must not sit decrypted while the user
    // has left the page).
    const onVis = () => { /* no-op (lab) */ };
    const onHide = () => { /* no-op (lab) */ };

    window.addEventListener('click', onActivity, { passive: true });
    window.addEventListener('keydown', onActivity, { passive: true });
    window.addEventListener('pointermove', onActivity, { passive: true });
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('pagehide', onHide);

    this.#autoLockTeardown = [
      () => window.removeEventListener('click', onActivity),
      () => window.removeEventListener('keydown', onActivity),
      () => window.removeEventListener('pointermove', onActivity),
      () => document.removeEventListener('visibilitychange', onVis),
      () => window.removeEventListener('pagehide', onHide),
    ];

    this.#scheduleLock();
  }

  #disarmAutoLock(): void {
    if (this.#autoLockTimer !== null) {
      clearTimeout(this.#autoLockTimer);
      this.#autoLockTimer = null;
    }
    for (const off of this.#autoLockTeardown) off();
    this.#autoLockTeardown = [];
  }

  #scheduleLock(): void {
    if (this.#autoLockTimer !== null) clearTimeout(this.#autoLockTimer);
    this.#autoLockTimer = setTimeout(() => this.#autoLock(), this.#autoLockMs);
  }

  #autoLock(): void {
    if (this.#masterKey === null) return;
    this.#masterKey = null;
    this.#disarmAutoLock();
    this.#emit('auto-lock');
    this.#emit('lock');
    this.#emit('change');
  }

  /** Reset the inactivity timer on any vault operation. */
  #touch(): void {
    if (this.#masterKey === null) return;
    this.#scheduleLock();
  }
}

/* ──────────────── backup serialization (v1) ──────────────── */

interface WrappedKeyB64 {
  wrapped: string;
  iv: string;
}

interface BackupMetaV1 {
  version: 1;
  mode: VaultMode;
  prfSalt: string;
  bioHkdfSalt: string;
  recoveryHkdfSalt: string;
  bioWrappedMK?: WrappedKeyB64;
  recoveryWrappedMK: WrappedKeyB64;
  recoveryCheck: string;
  createdAt: number;
  /**
   * The platform-authenticator credential id, if any. May fail to bind on
   * a fresh device (passkey not synced) — that case is handled at unlock
   * time by falling back to recovery. Persisted as base64url for portability.
   */
  credentialId?: string;
}

interface BackupEntryV1 {
  id: string;
  iv: string;
  ciphertext: string;
  updatedAt: number;
}

interface BackupPayloadV1 {
  kind: typeof BACKUP_KIND;
  version: typeof BACKUP_VERSION;
  createdAt: number;
  meta: BackupMetaV1;
  entries: BackupEntryV1[];
}

function serializeBackup(meta: VaultMeta, entries: VaultEntry[]): BackupPayloadV1 {
  return {
    kind: BACKUP_KIND,
    version: BACKUP_VERSION,
    createdAt: Date.now(),
    meta: {
      version: 1,
      mode: meta.mode,
      prfSalt: toBase64Url(meta.prfSalt),
      bioHkdfSalt: toBase64Url(meta.bioHkdfSalt),
      recoveryHkdfSalt: toBase64Url(meta.recoveryHkdfSalt),
      bioWrappedMK: meta.bioWrappedMK
        ? {
            wrapped: toBase64Url(meta.bioWrappedMK.wrapped),
            iv: toBase64Url(meta.bioWrappedMK.iv),
          }
        : undefined,
      // NOTE: deviceWrappedMK and deviceKEKRaw are intentionally excluded.
      // GATE_ONLY's device-local plaintext KEK never travels off-device —
      // backups are recovery-key gated only. After restore the user must
      // do a fresh setup() to re-establish a biometric path.
      recoveryWrappedMK: {
        wrapped: toBase64Url(meta.recoveryWrappedMK.wrapped),
        iv: toBase64Url(meta.recoveryWrappedMK.iv),
      },
      recoveryCheck: toBase64Url(meta.recoveryCheck),
      createdAt: meta.createdAt,
      credentialId: meta.credentialId ? toBase64Url(meta.credentialId) : undefined,
    },
    entries: entries.map((e) => ({
      id: e.id,
      iv: toBase64Url(e.iv),
      ciphertext: toBase64Url(e.ciphertext),
      updatedAt: e.updatedAt,
    })),
  };
}

function deserializeMeta(payload: BackupPayloadV1): VaultMeta {
  const m = payload.meta;
  return {
    version: 1,
    mode: m.mode,
    credentialId: m.credentialId ? fromBase64Url(m.credentialId) : undefined,
    prfSalt: fromBase64Url(m.prfSalt),
    bioHkdfSalt: fromBase64Url(m.bioHkdfSalt),
    recoveryHkdfSalt: fromBase64Url(m.recoveryHkdfSalt),
    bioWrappedMK: m.bioWrappedMK
      ? {
          wrapped: fromBase64Url(m.bioWrappedMK.wrapped),
          iv: fromBase64Url(m.bioWrappedMK.iv),
        }
      : undefined,
    // deviceWrappedMK + deviceKEKRaw deliberately absent on restore.
    recoveryWrappedMK: {
      wrapped: fromBase64Url(m.recoveryWrappedMK.wrapped),
      iv: fromBase64Url(m.recoveryWrappedMK.iv),
    },
    recoveryCheck: fromBase64Url(m.recoveryCheck),
    createdAt: m.createdAt,
  };
}

function deserializeEntry(e: BackupEntryV1): VaultEntry {
  return {
    id: e.id,
    iv: fromBase64Url(e.iv),
    ciphertext: fromBase64Url(e.ciphertext),
    updatedAt: e.updatedAt,
  };
}
