/**
 * Storage abstraction. The core depends ONLY on this interface — it never
 * imports `idb`, `window.indexedDB`, or any persistence library. The demo
 * provides an IndexedDB-backed implementation in
 * `packages/demo/src/adapters/idbStorage.ts`.
 *
 * Why this exists:
 *  - Lets the core run unchanged in main thread, Web Worker, or test runner.
 *  - Lets a host app swap in OPFS / Filesystem Access API / encrypted SQLite
 *    later without touching the vault logic.
 *  - Keeps the cryptographic boundary explicit: storage sees only wrapped
 *    keys + ciphertext, never plaintext or KEKs (in PRF_SECURE mode).
 */

import type { VaultEntry, VaultMeta } from './types.js';

export interface VaultStorage {
  /** Returns the single VaultMeta record, or null if no vault is initialized. */
  getMeta(): Promise<VaultMeta | null>;

  /** Persist (or replace) the VaultMeta record. */
  putMeta(meta: VaultMeta): Promise<void>;

  /** List all encrypted entries. Each entry is ciphertext + iv + id + updatedAt. */
  listEntries(): Promise<VaultEntry[]>;

  /** Fetch a single encrypted entry by id, or null if missing. */
  getEntry(id: string): Promise<VaultEntry | null>;

  /** Persist (or replace) an encrypted entry. */
  putEntry(entry: VaultEntry): Promise<void>;

  /** Remove an entry by id. No-op if missing. */
  deleteEntry(id: string): Promise<void>;

  /** Wipe both the meta record and all entries — used by reset(). */
  clearAll(): Promise<void>;
}
