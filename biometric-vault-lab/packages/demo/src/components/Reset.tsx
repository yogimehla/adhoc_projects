/**
 * Reset screen — wipes IndexedDB and drops the in-memory MK. Typed-confirm
 * gate prevents accidental clicks. Accessible from any state.
 */

import type { BiometricVault } from '@muulorigin/biometric-vault-core';
import { useState } from 'react';
import { errorMessage } from './errorMessage.js';

const CONFIRM_PHRASE = 'RESET';

interface ResetProps {
  vault: BiometricVault;
  /** Notify the App that storage state may have changed. */
  onReset: () => void;
}

export function Reset({ vault, onReset }: ResetProps) {
  const [expanded, setExpanded] = useState(false);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<Error | null>(null);

  const doReset = async () => {
    setBusy(true);
    setErr(null);
    try {
      await vault.reset();
      setText('');
      setExpanded(false);
      onReset();
    } catch (e) {
      setErr(e instanceof Error ? e : new Error(String(e)));
    } finally {
      setBusy(false);
    }
  };

  if (!expanded) {
    return (
      <div className="card danger-card">
        <h2>Reset vault</h2>
        <p className="dim small">
          Wipes the local vault: all encrypted entries, the master key wraps, and the recovery
          check. This is irrecoverable without a recovery-key export (Phase 4 ships export/import).
        </p>
        <button type="button" className="secondary danger" onClick={() => setExpanded(true)}>
          Reset…
        </button>
      </div>
    );
  }

  return (
    <div className="card danger-card">
      <h2>Reset vault</h2>
      <p>
        Type <code>{CONFIRM_PHRASE}</code> to confirm. This will delete every entry and unbind the
        registered passkey from this vault (the platform may still retain the credential — there’s
        no API to delete it from the page).
      </p>
      <input
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        autoCapitalize="characters"
        autoComplete="off"
        spellCheck={false}
        placeholder={CONFIRM_PHRASE}
        style={{
          width: 200,
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
          padding: 8,
          border: '1px solid var(--border)',
          borderRadius: 6,
          background: 'var(--bg)',
          color: 'var(--text)',
        }}
      />
      <div className="row" style={{ marginTop: 8 }}>
        <button
          type="button"
          className="secondary danger"
          onClick={doReset}
          disabled={busy || text !== CONFIRM_PHRASE}
        >
          {busy ? 'Resetting…' : 'Reset vault'}
        </button>
        <button
          type="button"
          className="secondary"
          onClick={() => { setExpanded(false); setText(''); setErr(null); }}
          disabled={busy}
        >
          Cancel
        </button>
      </div>
      {err && (
        <div className="warning">
          <strong>Reset failed.</strong> {errorMessage(err)}
        </div>
      )}
    </div>
  );
}
