/**
 * <VaultBackupButton> — drop-in ChromaStash-delegated backup button.
 *
 * Phase 1 ships the surface; the underlying `vault.exportEncrypted()` is
 * NotImplementedError until Phase 4. The component will already render and
 * surface the error cleanly so the Diagnostics screen can show the wiring.
 */

import type {
  BiometricVault,
  ExportFormat,
  ExportResult,
} from '@muulorigin/biometric-vault-core';
import { useCallback, useState } from 'react';

export interface VaultBackupButtonProps {
  vault: BiometricVault;
  recoveryKey: string;
  format?: ExportFormat;
  onArtifactReady: (result: ExportResult) => void;
  onError?: (error: Error) => void;
  label?: string;
  buttonClassName?: string;
  disabled?: boolean;
}

export function VaultBackupButton(props: VaultBackupButtonProps) {
  const {
    vault,
    recoveryKey,
    format = 'blob',
    onArtifactReady,
    onError,
    label = 'Export encrypted backup',
    buttonClassName,
    disabled,
  } = props;
  const [isExporting, setIsExporting] = useState(false);

  const onClick = useCallback(async () => {
    setIsExporting(true);
    try {
      const result = await vault.exportEncrypted(recoveryKey, { format });
      onArtifactReady(result);
    } catch (err) {
      if (onError) onError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setIsExporting(false);
    }
  }, [vault, recoveryKey, format, onArtifactReady, onError]);

  return (
    <button
      type="button"
      className={buttonClassName}
      disabled={disabled || isExporting}
      onClick={onClick}
    >
      {isExporting ? 'Exporting…' : label}
    </button>
  );
}
