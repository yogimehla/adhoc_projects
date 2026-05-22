/**
 * <BiometricUnlockButton> — drop-in unlock button. Mirrors ChromaStash's
 * drop-in component pattern (onX callback + label + buttonClassName).
 */

import type { BiometricVault } from '@muulorigin/biometric-vault-core';
import { useVaultUnlock } from './useVaultUnlock.js';

export interface BiometricUnlockButtonProps {
  vault: BiometricVault;
  onUnlocked: () => void;
  onError?: (error: Error) => void;
  label?: string;
  buttonClassName?: string;
  disabled?: boolean;
}

export function BiometricUnlockButton(props: BiometricUnlockButtonProps) {
  const { vault, onUnlocked, onError, label = 'Unlock with biometric', buttonClassName, disabled } = props;
  const { unlockBiometric, isUnlocking, error } = useVaultUnlock(vault);

  const onClick = async () => {
    const ok = await unlockBiometric();
    if (ok) {
      onUnlocked();
    } else if (error && onError) {
      onError(error);
    }
  };

  return (
    <button
      type="button"
      className={buttonClassName}
      disabled={disabled || isUnlocking}
      onClick={onClick}
    >
      {isUnlocking ? 'Verifying…' : label}
    </button>
  );
}
