/**
 * useVaultSetup — wraps `vault.setup()` with pending/error state.
 *
 * Hook return shape mirrors ChromaStash's `useChromaEncode()`:
 *   { encode, isEncoding, error }
 * Here:
 *   { setup, isSettingUp, error }
 *
 * `setup` accepts a SetupOptions object so the host can force GATE_ONLY
 * mode for testing without touching the vault directly.
 */

import type {
  BiometricVault,
  SetupOptions,
  VaultMode,
} from '@muulorigin/biometric-vault-core';
import { useCallback, useState } from 'react';

export interface UseVaultSetupReturn {
  setup: (
    opts?: SetupOptions,
  ) => Promise<{ mode: VaultMode; recoveryKey: string } | null>;
  isSettingUp: boolean;
  error: Error | null;
  /** Clear the error and let the host retry. */
  clearError: () => void;
}

export function useVaultSetup(vault: BiometricVault): UseVaultSetupReturn {
  const [isSettingUp, setIsSettingUp] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const setup = useCallback(
    async (opts?: SetupOptions) => {
      setIsSettingUp(true);
      setError(null);
      try {
        return await vault.setup(opts);
      } catch (err) {
        setError(err instanceof Error ? err : new Error(String(err)));
        return null;
      } finally {
        setIsSettingUp(false);
      }
    },
    [vault],
  );

  const clearError = useCallback(() => setError(null), []);

  return { setup, isSettingUp, error, clearError };
}
