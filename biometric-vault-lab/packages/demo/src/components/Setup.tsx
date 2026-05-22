/**
 * Setup screen — UNINITIALIZED state.
 *
 * Three sub-states:
 *   "intro"     — explain biometric + recovery key, optional GATE_ONLY checkbox.
 *   "reveal"    — show recovery key ONCE; require acknowledgment.
 *   "done"      — hand off back to App, which transitions to Vault screen.
 */

import {
  type BiometricVault,
  type Capabilities,
  VaultMode,
} from '@muulorigin/biometric-vault-core';
import { useVaultSetup } from '@muulorigin/biometric-vault-react';
import { useState } from 'react';
import { errorMessage } from './errorMessage.js';

interface SetupProps {
  vault: BiometricVault;
  capabilities: Capabilities | null;
  /** Notify the App that storage state may have changed. */
  onComplete: () => void;
}

export function Setup({ vault, capabilities, onComplete }: SetupProps) {
  const { setup, isSettingUp, error } = useVaultSetup(vault);
  const [phase, setPhase] = useState<'intro' | 'reveal' | 'done'>('intro');
  const [forceGateOnly, setForceGateOnly] = useState(false);
  const [gateAck, setGateAck] = useState(false);
  const [revealKey, setRevealKey] = useState('');
  const [revealMode, setRevealMode] = useState<VaultMode | null>(null);
  const [savedAck, setSavedAck] = useState(false);
  const [copied, setCopied] = useState(false);

  const prfLikely = capabilities?.prfMaybeSupported ?? true;
  const willBeGateOnly = forceGateOnly || !prfLikely;

  const onSetup = async () => {
    const result = await setup({ forceGateOnly });
    if (result) {
      setRevealKey(result.recoveryKey);
      setRevealMode(result.mode);
      setPhase('reveal');
    }
  };

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(revealKey);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // Some browsers block clipboard in non-secure / non-user-gesture
      // contexts. The key text is still selectable manually.
    }
  };

  const onContinue = () => {
    if (!savedAck) return;
    setPhase('done');
    onComplete();
  };

  if (phase === 'reveal') {
    return (
      <div className="card">
        <h2>Save your recovery key — shown once</h2>
        <p>
          This is your <strong>only</strong> way back into the vault if you lose your device or
          re-install the app. Write it down, save it in a password manager, or store it somewhere
          off-device. Anyone with this key can decrypt your vault.
        </p>
        <div className="recovery-key" role="text" aria-label="Recovery key">{revealKey}</div>
        <div className="row" style={{ marginTop: 12 }}>
          <button type="button" className="primary" onClick={onCopy}>
            {copied ? 'Copied ✓' : 'Copy to clipboard'}
          </button>
          <span className={`badge ${revealMode === VaultMode.PRF_SECURE ? 'ok' : 'warn'}`}>
            {revealMode === VaultMode.PRF_SECURE ? 'PRF_SECURE' : 'GATE_ONLY'}
          </span>
        </div>
        <label className="ack">
          <input
            type="checkbox"
            checked={savedAck}
            onChange={(e) => setSavedAck(e.target.checked)}
          />
          &nbsp;I have saved this recovery key in a safe place.
        </label>
        <div className="row" style={{ marginTop: 12 }}>
          <button type="button" className="primary" onClick={onContinue} disabled={!savedAck}>
            Continue to vault
          </button>
        </div>
        {revealMode === VaultMode.GATE_ONLY && (
          <div className="warning">
            <strong>GATE_ONLY mode active.</strong> Encryption key is recoverable from local storage
            — treat as a convenience lock, not a security boundary.
          </div>
        )}
      </div>
    );
  }

  if (phase === 'done') {
    return null;
  }

  return (
    <div className="card">
      <h2>Set up your vault</h2>
      <p>
        Your <strong>device biometric</strong> (Face ID, Touch ID, Windows Hello, fingerprint) will
        materialize the AES key that decrypts entries. There’s no username, no password, no server
        — just your device + a one-time recovery key.
      </p>
      <ul className="dim small">
        <li>The recovery key is shown once. Save it now.</li>
        <li>Lose your device <em>and</em> the recovery key and the data is gone. There is no reset.</li>
        <li>Anyone with the recovery key can decrypt the vault and restore backups.</li>
      </ul>

      {!prfLikely && (
        <div className="warning">
          <strong>This browser likely doesn’t support WebAuthn PRF.</strong> Setup will fall back to
          GATE_ONLY mode (convenience lock only — the encryption key is recoverable from local
          storage). Recommended only for testing.
        </div>
      )}

      <label className="ack">
        <input
          type="checkbox"
          checked={forceGateOnly}
          onChange={(e) => { setForceGateOnly(e.target.checked); setGateAck(false); }}
        />
        &nbsp;<span className="dim">Debug: force GATE_ONLY even if PRF is available.</span>
      </label>

      {willBeGateOnly && (
        <label className="ack">
          <input
            type="checkbox"
            checked={gateAck}
            onChange={(e) => setGateAck(e.target.checked)}
          />
          &nbsp;I understand <strong>GATE_ONLY is a convenience lock only</strong> — the KEK lives
          on this device in plaintext and isn’t a security boundary.
        </label>
      )}

      <div className="row" style={{ marginTop: 12 }}>
        <button
          type="button"
          className="primary"
          onClick={onSetup}
          disabled={isSettingUp || (willBeGateOnly && !gateAck)}
        >
          {isSettingUp ? 'Setting up…' : 'Set up vault'}
        </button>
      </div>

      {error && (
        <div className="warning">
          <strong>Setup failed.</strong> {errorMessage(error)}
        </div>
      )}
    </div>
  );
}
