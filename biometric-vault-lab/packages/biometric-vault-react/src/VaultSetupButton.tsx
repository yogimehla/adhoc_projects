/**
 * <VaultSetupButton> — drop-in setup button. Surface mirrors ChromaStash's
 * <ChromaBackupButton> pattern: onX callback + label + buttonClassName.
 *
 * Renders a single button; on click, runs vault.setup() and fires
 * `onReady(recoveryKey, mode)` exactly once when setup succeeds. The host
 * is responsible for displaying the recovery key (this component does not
 * render the secret).
 */

import type { BiometricVault, VaultMode } from '@muulorigin/biometric-vault-core';
import { useVaultSetup } from './useVaultSetup.js';

export interface VaultSetupButtonProps {
  vault: BiometricVault;
  onReady: (recoveryKey: string, mode: VaultMode) => void;
  onError?: (error: Error) => void;
  label?: string;
  buttonClassName?: string;
  disabled?: boolean;
}

export function VaultSetupButton(props: VaultSetupButtonProps) {
  const { vault, onReady, onError, label = 'Set up vault', buttonClassName, disabled } = props;
  const { setup, isSettingUp, error } = useVaultSetup(vault);

  const onClick = async () => {
    const result = await setup();
    if (result) {
      onReady(result.recoveryKey, result.mode);
    } else if (error && onError) {
      onError(error);
    }
  };

  return (
    <button
      type="button"
      className={buttonClassName}
      disabled={disabled || isSettingUp}
      onClick={onClick}
    >
      {isSettingUp ? 'Setting up…' : label}
    </button>
  );
}
