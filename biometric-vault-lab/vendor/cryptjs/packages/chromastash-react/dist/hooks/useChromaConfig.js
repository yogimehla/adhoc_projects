import { useState, useEffect, useCallback, useRef } from 'react';
import { DEFAULT_CONFIG } from '@muulorigin/chromastash-core';
// ── Default: localStorage adapter ──────────────────────────────────────────
const localStorageAdapter = {
    get: async (key) => {
        try {
            return localStorage.getItem(key);
        }
        catch {
            return null;
        }
    },
    set: async (key, value) => {
        try {
            localStorage.setItem(key, value);
        }
        catch { /* quota exceeded or private mode — ignore */ }
    },
};
export function useChromaConfig(options) {
    const storageKey = (options?.storageKey ?? 'chromastash') + ':config';
    const storage = options?.storage ?? localStorageAdapter;
    const [config, setConfig] = useState(DEFAULT_CONFIG);
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
                    const parsed = JSON.parse(raw);
                    setConfig((prev) => ({ ...prev, ...parsed }));
                }
            }
            catch {
                // corrupt data — keep defaults
            }
            if (!cancelled)
                setIsLoaded(true);
        })();
        return () => { cancelled = true; };
    }, []);
    const persist = useCallback((next) => {
        storageRef.current.set(keyRef.current, JSON.stringify(next)).catch(() => { });
    }, []);
    const updateConfig = useCallback((partial) => {
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
//# sourceMappingURL=useChromaConfig.js.map