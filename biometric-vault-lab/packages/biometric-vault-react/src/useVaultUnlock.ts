/**
 * useVaultUnlock — wraps both unlock paths with shared pending/error state.
 *
 * Mirrors ChromaStash's hook return shape:
 *   { unlockBiometric, unlockRecovery, isUnlocking, error, clearError }
 */

import type { BiometricVault } from '@muulorigin/biometric-vault-core';
import { useCallback, useState } from 'react';

export interface UseVaultUnlockReturn {
  unlockBiometric: () => Promise<boolean>;
  unlockRecovery: (recoveryKey: string) => Promise<boolean>;
  isUnlocking: boolean;
  error: Error | null;
  clearError: () => void;
}

export function useVaultUnlock(vault: BiometricVault): UseVaultUnlockReturn {
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const unlockBiometric = useCallback(async () => {
    setIsUnlocking(true);
    setError(null);
    try {
      await vault.unlockWithBiometric();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
      return false;
    } finally {
      setIsUnlocking(false);
    }
  }, [vault]);

  const unlockRecovery = useCallback(
    async (recoveryKey: string) => {
      setIsUnlocking(true);
      setError(null);
      try {
        await vault.unlockWithRecovery(recoveryKey);
        return true;
      } catch (err) {
        setError(err instanceof Error ? err : new Error(String(err)));
        return false;
      } finally {
        setIsUnlocking(false);
      }
    },
    [vault],
  );

  const clearError = useCallback(() => setError(null), []);

  return { unlockBiometric, unlockRecovery, isUnlocking, error, clearError };
}
