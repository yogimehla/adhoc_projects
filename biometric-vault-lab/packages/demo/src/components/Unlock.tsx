/**
 * Unlock screen — LOCKED state on an initialized vault.
 *
 * Default action: biometric. Fallback: paste recovery key. The recovery
 * path validates the displayed checksum first (typo fails fast) and then
 * VaultMeta.recoveryCheck before any GCM unwrap — neither path runs an
 * AES-GCM auth check on a doomed input.
 */

import { type BiometricVault, VaultMode } from '@muulorigin/biometric-vault-core';
import { useVaultUnlock } from '@muulorigin/biometric-vault-react';
import { useState } from 'react';
import { errorMessage } from './errorMessage.js';

interface UnlockProps {
  vault: BiometricVault;
  mode: VaultMode | null;
}

export function Unlock({ vault, mode }: UnlockProps) {
  const { unlockBiometric, unlockRecovery, isUnlocking, error, clearError } = useVaultUnlock(vault);
  const [showRecovery, setShowRecovery] = useState(false);
  const [recoveryInput, setRecoveryInput] = useState('');

  const onBiometric = () => {
    clearError();
    void unlockBiometric();
  };

  const onRecovery = () => {
    clearError();
    void unlockRecovery(recoveryInput);
  };

  return (
    <div className="card">
      <h2>Unlock your vault</h2>
      <p className="dim">
        {mode === VaultMode.PRF_SECURE
          ? 'PRF_SECURE — the AES key is materialized from your biometric. Nothing usable on disk.'
          : mode === VaultMode.GATE_ONLY
            ? 'GATE_ONLY — convenience lock only. The KEK lives on this device.'
            : 'Authenticate with the device biometric you set up.'}
      </p>

      <div className="row">
        <button type="button" className="primary" onClick={onBiometric} disabled={isUnlocking}>
          {isUnlocking ? 'Verifying…' : 'Unlock with biometric'}
        </button>
        <button
          type="button"
          className="secondary"
          onClick={() => { setShowRecovery((s) => !s); clearError(); }}
        >
          {showRecovery ? 'Hide recovery key' : 'Use recovery key instead'}
        </button>
      </div>

      {showRecovery && (
        <div style={{ marginTop: 12 }}>
          <label className="dim small" htmlFor="recovery-input">Recovery key</label>
          <textarea
            id="recovery-input"
            value={recoveryInput}
            onChange={(e) => setRecoveryInput(e.target.value)}
            placeholder="ABCD1-EFGH2-JKMN3-..."
            spellCheck={false}
            autoCorrect="off"
            autoCapitalize="characters"
            rows={3}
            style={{
              width: '100%',
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
              fontSize: 13,
              padding: 8,
              border: '1px solid var(--border)',
              borderRadius: 6,
              background: 'var(--bg)',
              color: 'var(--text)',
              marginTop: 6,
              resize: 'vertical',
            }}
          />
          <div className="row" style={{ marginTop: 8 }}>
            <button
              type="button"
              className="primary"
              onClick={onRecovery}
              disabled={isUnlocking || recoveryInput.trim().length === 0}
            >
              {isUnlocking ? 'Verifying…' : 'Unlock with recovery key'}
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="warning">
          <strong>Unlock failed.</strong> {errorMessage(error)}
        </div>
      )}
    </div>
  );
}
