/**
 * IndexedDB-backed implementation of VaultStorage.
 *
 * Lives in the demo (NOT in core) so the core stays storage-agnostic and
 * usable in main thread / Worker / Node tests. Stores ArrayBuffers
 * directly — IndexedDB has native structured-clone support for them.
 *
 * DB layout:
 *  - db: 'bvl', version 1
 *  - 'meta' store, key='meta' → VaultMeta
 *  - 'entries' store, keyPath='id' → VaultEntry
 *
 * Storage contents (PRF_SECURE): only wrapped keys, salts, recoveryCheck,
 * credentialId, and ciphertext. GATE_ONLY additionally stores deviceKEKRaw
 * (plaintext KEK bytes — insecure by design, flagged in the UI).
 */

import {
  StorageError,
  type VaultEntry,
  type VaultMeta,
  type VaultStorage,
} from '@muulorigin/biometric-vault-core';
import { openDB, type IDBPDatabase } from 'idb';

const DB_NAME = 'bvl';
const DB_VERSION = 1;
const STORE_META = 'meta';
const STORE_ENTRIES = 'entries';
const META_KEY = 'meta';

interface BvlSchema {
  meta: {
    key: string;
    value: VaultMeta;
  };
  entries: {
    key: string;
    value: VaultEntry;
  };
}

export class IndexedDbStorage implements VaultStorage {
  #dbPromise: Promise<IDBPDatabase<BvlSchema>> | null = null;

  #db(): Promise<IDBPDatabase<BvlSchema>> {
    if (!this.#dbPromise) {
      this.#dbPromise = openDB<BvlSchema>(DB_NAME, DB_VERSION, {
        upgrade(db) {
          if (!db.objectStoreNames.contains(STORE_META)) {
            db.createObjectStore(STORE_META);
          }
          if (!db.objectStoreNames.contains(STORE_ENTRIES)) {
            db.createObjectStore(STORE_ENTRIES, { keyPath: 'id' });
          }
        },
        blocked() {
          // Another tab is holding an older version open — refresh that tab.
        },
        blocking() {
          // We're holding an older version open while another tab wants to
          // upgrade — close our handle to let it through.
        },
      });
    }
    return this.#dbPromise;
  }

  async getMeta(): Promise<VaultMeta | null> {
    try {
      const db = await this.#db();
      const value = await db.get(STORE_META, META_KEY);
      return value ?? null;
    } catch (err) {
      throw new StorageError('getMeta failed', err);
    }
  }

  async putMeta(meta: VaultMeta): Promise<void> {
    try {
      const db = await this.#db();
      await db.put(STORE_META, meta, META_KEY);
    } catch (err) {
      throw new StorageError('putMeta failed', err);
    }
  }

  async listEntries(): Promise<VaultEntry[]> {
    try {
      const db = await this.#db();
      return await db.getAll(STORE_ENTRIES);
    } catch (err) {
      throw new StorageError('listEntries failed', err);
    }
  }

  async getEntry(id: string): Promise<VaultEntry | null> {
    try {
      const db = await this.#db();
      const value = await db.get(STORE_ENTRIES, id);
      return value ?? null;
    } catch (err) {
      throw new StorageError(`getEntry(${id}) failed`, err);
    }
  }

  async putEntry(entry: VaultEntry): Promise<void> {
    try {
      const db = await this.#db();
      await db.put(STORE_ENTRIES, entry);
    } catch (err) {
      throw new StorageError(`putEntry(${entry.id}) failed`, err);
    }
  }

  async deleteEntry(id: string): Promise<void> {
    try {
      const db = await this.#db();
      await db.delete(STORE_ENTRIES, id);
    } catch (err) {
      throw new StorageError(`deleteEntry(${id}) failed`, err);
    }
  }

  async clearAll(): Promise<void> {
    try {
      const db = await this.#db();
      const tx = db.transaction([STORE_META, STORE_ENTRIES], 'readwrite');
      await Promise.all([tx.objectStore(STORE_META).clear(), tx.objectStore(STORE_ENTRIES).clear()]);
      await tx.done;
    } catch (err) {
      throw new StorageError('clearAll failed', err);
    }
  }

  /**
   * Phase-1 smoke helper: write & read a throwaway ciphertext-shaped record
   * to confirm the adapter round-trips ArrayBuffers correctly. Used by the
   * Diagnostics screen to prove "storage is wired" before crypto exists.
   *
   * NOTE: writes to the real `entries` store under a sentinel id then
   * deletes the record. Safe — does not touch `meta`.
   */
  async smokeTestRoundTrip(): Promise<{ ok: boolean; bytes: number; detail?: string }> {
    const id = '__bvl_smoketest__';
    try {
      const iv = crypto.getRandomValues(new Uint8Array(12)).buffer;
      const ciphertext = crypto.getRandomValues(new Uint8Array(32)).buffer;
      await this.putEntry({ id, iv, ciphertext, updatedAt: Date.now() });
      const back = await this.getEntry(id);
      const ok =
        back !== null &&
        back.id === id &&
        back.iv.byteLength === 12 &&
        back.ciphertext.byteLength === 32;
      await this.deleteEntry(id);
      return { ok, bytes: back?.ciphertext.byteLength ?? 0 };
    } catch (err) {
      return { ok: false, bytes: 0, detail: err instanceof Error ? err.message : String(err) };
    }
  }
}
