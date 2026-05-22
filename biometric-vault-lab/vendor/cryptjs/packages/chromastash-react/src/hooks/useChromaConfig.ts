import { useState, useEffect, useCallback, useRef } from 'react';
import type { ChromaConfig } from '@muulorigin/chromastash-core';
import { DEFAULT_CONFIG } from '@muulorigin/chromastash-core';

// ── Storage adapter interface ──────────────────────────────────────────────

export interface ChromaConfigStorage {
  get: (key: string) => Promise<string | null>;
  set: (key: string, value: string) => Promise<void>;
}

// ── Default: localStorage adapter ──────────────────────────────────────────

const localStorageAdapter: ChromaConfigStorage = {
  get: async (key) => {
    try { return localStorage.getItem(key); }
    catch { return null; }
  },
  set: async (key, value) => {
    try { localStorage.setItem(key, value); }
    catch { /* quota exceeded or private mode — ignore */ }
  },
};

// ── Hook ───────────────────────────────────────────────────────────────────

export interface UseChromaConfigOptions {
  /** Storage key prefix. @default 'chromastash' */
  storageKey?: string;
  /** Custom storage adapter. @default localStorage */
  storage?: ChromaConfigStorage;
}

export interface UseChromaConfigReturn {
  config: ChromaConfig;
  updateConfig: (partial: Partial<ChromaConfig>) => void;
  resetToDefaults: () => void;
  /** false until config is loaded from storage */
  isLoaded: boolean;
}

export function useChromaConfig(
  options?: UseChromaConfigOptions,
): UseChromaConfigReturn {
  const storageKey = (options?.storageKey ?? 'chromastash') + ':config';
  const storage = options?.storage ?? localStorageAdapter;

  const [config, setConfig] = useState<ChromaConfig>(DEFAULT_CONFIG);
  const [isLoaded, setIsLoaded] = useState(false);

  // Avoid re-running effect on every render — capture stable ref
  const storageRef = useRef(storage);
  storageRef.current = storage;
  const keyRef = useRef(storageKey);
  keyRef.current = storageKey;

  // Load from storage on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const raw = await storageRef.current.get(keyRef.current);
        if (raw && !cancelled) {
          const parsed = JSON.parse(raw) as Partial<ChromaConfig>;
          setConfig((prev) => ({ ...prev, ...parsed }));
        }
      } catch {
        // corrupt data — keep defaults
      }
      if (!cancelled) setIsLoaded(true);
    })();
    return () => { cancelled = true; };
  }, []);

  const persist = useCallback((next: ChromaConfig) => {
    storageRef.current.set(keyRef.current, JSON.stringify(next)).catch(() => {});
  }, []);

  const updateConfig = useCallback((partial: Partial<ChromaConfig>) => {
    setConfig((prev) => {
      const next = { ...prev, ...partial };
      persist(next);
      return next;
    });
  }, [persist]);

  const resetToDefaults = useCallback(() => {
    setConfig(DEFAULT_CONFIG);
    persist(DEFAULT_CONFIG);
  }, [persist]);

  return { config, updateConfig, resetToDefaults, isLoaded };
}
