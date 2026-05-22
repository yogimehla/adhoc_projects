/**
 * useVault — primary hook. Owns a single BiometricVault instance, tracks
 * VaultState + VaultMode + Capabilities, and re-renders on any vault
 * event (including the auto-lock that fires while the user is mid-CRUD).
 *
 * Subscribes to the vault's event stream rather than polling. The
 * `notify()` callback exists for hosts that mutate state through
 * non-vault APIs (e.g. an external IDE adapter) and need to force a sync.
 */

import {
  BiometricVault,
  type Capabilities,
  type VaultMode,
  type VaultOptions,
  type VaultStorage,
  VaultState,
  detectCapabilities,
} from '@muulorigin/biometric-vault-core';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

export interface UseVaultReturn {
  vault: BiometricVault;
  state: VaultState;
  mode: VaultMode | null;
  initialized: boolean;
  capabilities: Capabilities | null;
  refresh: () => Promise<void>;
  notify: () => void;
}

export function useVault(
  storage: VaultStorage,
  opts: VaultOptions = {},
): UseVaultReturn {
  // The vault must NOT be re-instantiated when `opts` is a fresh object on
  // each render — that would wipe the in-memory master key. We snapshot
  // opts on first use and ignore changes thereafter; callers who want to
  // change opts should remount the host component.
  const optsRef = useRef(opts);
  const vault = useMemo(
    () => new BiometricVault(storage, optsRef.current),
    [storage],
  );

  const [state, setState] = useState<VaultState>(VaultState.LOCKED);
  const [mode, setMode] = useState<VaultMode | null>(null);
  const [initialized, setInitialized] = useState(false);
  const [capabilities, setCapabilities] = useState<Capabilities | null>(null);
  const mountedRef = useRef(true);

  const syncFromVault = useCallback(() => {
    if (!mountedRef.current) return;
    setState(vault.getState());
    setMode(vault.getMode());
  }, [vault]);

  const refresh = useCallback(async () => {
    const [caps, isInit] = await Promise.all([
      detectCapabilities(),
      vault.isInitialized(),
    ]);
    if (!mountedRef.current) return;
    setCapabilities(caps);
    setInitialized(isInit);
    syncFromVault();
  }, [vault, syncFromVault]);

  const notify = useCallback(() => {
    syncFromVault();
    void vault.isInitialized().then((isInit) => {
      if (mountedRef.current) setInitialized(isInit);
    });
  }, [vault, syncFromVault]);

  useEffect(() => {
    mountedRef.current = true;
    void refresh();

    // Subscribe to vault events. Re-syncing initialized on 'reset' is
    // critical so the UI returns to the Setup screen.
    const unsubscribe = vault.subscribe((evt) => {
      syncFromVault();
      if (evt === 'reset' || evt === 'unlock') {
        void vault.isInitialized().then((isInit) => {
          if (mountedRef.current) setInitialized(isInit);
        });
      }
    });

    return () => {
      mountedRef.current = false;
      unsubscribe();
    };
  }, [vault, refresh, syncFromVault]);

  return { vault, state, mode, initialized, capabilities, refresh, notify };
}
