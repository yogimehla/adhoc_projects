/**
 * @muulorigin/biometric-vault-react
 *
 * React hooks + drop-in components for @muulorigin/biometric-vault-core.
 * Conventions mirror @muulorigin/chromastash-react exactly:
 *  - Hook returns: { action, isPending-style flag, error }
 *  - Drop-in props: onX callbacks + label + buttonClassName
 */

export { useVault, type UseVaultReturn } from './useVault.js';
export { useVaultSetup, type UseVaultSetupReturn } from './useVaultSetup.js';
export { useVaultUnlock, type UseVaultUnlockReturn } from './useVaultUnlock.js';

export {
  VaultSetupButton,
  type VaultSetupButtonProps,
} from './VaultSetupButton.js';
export {
  BiometricUnlockButton,
  type BiometricUnlockButtonProps,
} from './BiometricUnlockButton.js';
export {
  VaultBackupButton,
  type VaultBackupButtonProps,
} from './VaultBackupButton.js';

// Re-export the core's types/values so consumers only need one import path.
export {
  BiometricVault,
  VaultMode,
  VaultState,
  type Capabilities,
  type VaultEntry,
  type VaultMeta,
  type VaultStorage,
  type PlainEntry,
  type ExportFormat,
  type ExportResult,
  type VaultOptions,
} from '@muulorigin/biometric-vault-core';
