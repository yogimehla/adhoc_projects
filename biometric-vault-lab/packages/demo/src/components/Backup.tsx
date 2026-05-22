/**
 * Backup / Restore / Rotate panel — Phase 4 deliverable.
 *
 * Exposes three operations that all share the recovery-key passphrase:
 *  - Export (blob | slides)  — calls vault.exportEncrypted; downloads file(s).
 *  - Import (any artifact)   — calls vault.importEncrypted; auto-detects format.
 *  - Rotate recovery key     — requires UNLOCKED; rewraps MK under a new key.
 *
 * Recovery key entry uses a single password field; the field is cleared
 * after each operation to discourage leaving the secret in the DOM.
 */

import {
  type BiometricVault,
  type ExportFormat,
  type ExportResult,
  VaultState,
} from '@muulorigin/biometric-vault-core';
import { useCallback, useRef, useState } from 'react';
import { errorMessage } from './errorMessage.js';

interface BackupProps {
  vault: BiometricVault;
  state: VaultState;
  initialized: boolean;
}

type BusyKind = null | 'export' | 'import' | 'rotate';

export function Backup({ vault, state, initialized }: BackupProps) {
  const [recoveryKey, setRecoveryKey] = useState('');
  const [format, setFormat] = useState<ExportFormat>('blob');
  const [busy, setBusy] = useState<BusyKind>(null);
  const [progress, setProgress] = useState<{ pct: number; msg: string } | null>(null);
  const [err, setErr] = useState<Error | null>(null);
  const [newRecoveryKey, setNewRecoveryKey] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const reset = () => {
    setErr(null);
    setProgress(null);
  };

  const onProgress = useCallback((pct: number, msg: string) => {
    setProgress({ pct, msg });
  }, []);

  const doExport = async () => {
    reset();
    setBusy('export');
    try {
      const result = await vault.exportEncrypted(recoveryKey, { format }, onProgress);
      downloadArtifact(result);
    } catch (e) {
      setErr(e instanceof Error ? e : new Error(String(e)));
    } finally {
      setBusy(null);
      setProgress(null);
      setRecoveryKey('');
    }
  };

  const onPickFile = () => fileInputRef.current?.click();

  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    reset();
    const files = e.target.files ? Array.from(e.target.files) : [];
    if (files.length === 0) return;
    if (!recoveryKey.trim()) {
      setErr(new Error('Enter the recovery key first, then choose the backup file(s).'));
      return;
    }
    setBusy('import');
    try {
      // Auto-detect: single file → blob; multiple → slides.
      const artifact = files.length === 1 ? files[0]! : files;
      await vault.importEncrypted(artifact, recoveryKey, onProgress);
    } catch (err) {
      setErr(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setBusy(null);
      setProgress(null);
      setRecoveryKey('');
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const doRotate = async () => {
    reset();
    setBusy('rotate');
    try {
      const next = await vault.rotateRecoveryKey();
      setNewRecoveryKey(next);
    } catch (e) {
      setErr(e instanceof Error ? e : new Error(String(e)));
    } finally {
      setBusy(null);
    }
  };

  const unlocked = state === VaultState.UNLOCKED;

  return (
    <div className="card">
      <h2>Backup, restore & rotate</h2>
      <p className="dim small">
        Off-device backups delegate to <code>@muulorigin/chromastash-core</code> with
        AES-256-GCM and the recovery key as the passphrase (PBKDF2-100k inside ChromaStash —
        the ecosystem-interop path the spec earmarks). Anyone with the recovery key can
        decrypt these artifacts.
      </p>

      {!initialized && (
        <p className="dim small">
          The export path is unavailable until setup completes. Restore can run against an
          uninitialized vault using a backup + the matching recovery key.
        </p>
      )}

      <h3 style={{ marginTop: 12 }}>Recovery key</h3>
      <input
        type="password"
        value={recoveryKey}
        onChange={(e) => setRecoveryKey(e.target.value)}
        placeholder="ABCD1-EFGH2-JKMN3-..."
        autoComplete="off"
        spellCheck={false}
        autoCapitalize="characters"
        style={{
          width: '100%',
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
          fontSize: 13,
          padding: 8,
          border: '1px solid var(--border)',
          borderRadius: 6,
          background: 'var(--bg)',
          color: 'var(--text)',
        }}
      />

      <h3 style={{ marginTop: 16 }}>Export</h3>
      <div className="row">
        <label className="dim small">
          <input
            type="radio"
            name="format"
            value="blob"
            checked={format === 'blob'}
            onChange={() => setFormat('blob')}
            disabled={busy !== null}
          />
          &nbsp;Single .bvbk blob (default)
        </label>
        <label className="dim small">
          <input
            type="radio"
            name="format"
            value="slides"
            checked={format === 'slides'}
            onChange={() => setFormat('slides')}
            disabled={busy !== null}
          />
          &nbsp;ChromaStash PNG slides
        </label>
      </div>
      <div className="row" style={{ marginTop: 8 }}>
        <button
          type="button"
          className="primary"
          onClick={doExport}
          disabled={!initialized || busy !== null || recoveryKey.trim().length === 0}
        >
          {busy === 'export' ? 'Exporting…' : 'Export encrypted'}
        </button>
      </div>

      <h3 style={{ marginTop: 16 }}>Restore</h3>
      <p className="dim small">
        Pick a single <code>.bvbk</code> file (blob) or all the slide PNGs at once. This wipes
        the current local vault and replaces it with the imported contents — the vault is left
        unlocked.
      </p>
      <div className="row">
        <button
          type="button"
          className="secondary"
          onClick={onPickFile}
          disabled={busy !== null || recoveryKey.trim().length === 0}
        >
          {busy === 'import' ? 'Restoring…' : 'Choose backup file(s)…'}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          style={{ display: 'none' }}
          onChange={onFileChange}
        />
      </div>

      <h3 style={{ marginTop: 16 }}>Rotate recovery key</h3>
      <p className="dim small">
        Generates a fresh recovery secret and re-wraps the master key under it. The old
        recovery key stops working as soon as the new one is shown. Requires unlocked vault.
      </p>
      <div className="row">
        <button
          type="button"
          className="secondary"
          onClick={doRotate}
          disabled={!unlocked || busy !== null}
        >
          {busy === 'rotate' ? 'Rotating…' : 'Rotate'}
        </button>
        {!unlocked && initialized && (
          <span className="dim small">Unlock the vault first.</span>
        )}
      </div>

      {progress && (
        <div className="progress" style={{ marginTop: 12 }}>
          <div className="progress-fill" style={{ width: `${progress.pct}%` }} />
          <span className="dim small">{progress.msg} ({progress.pct}%)</span>
        </div>
      )}

      {newRecoveryKey && (
        <div style={{ marginTop: 12 }}>
          <h3>New recovery key — shown once</h3>
          <div className="recovery-key">{newRecoveryKey}</div>
          <button
            type="button"
            className="secondary"
            onClick={() => setNewRecoveryKey(null)}
            style={{ marginTop: 8 }}
          >
            I’ve saved it — dismiss
          </button>
        </div>
      )}

      {err && (
        <div className="warning">
          <strong>Operation failed.</strong> {errorMessage(err)}
        </div>
      )}
    </div>
  );
}

/* ──────────────── helpers ──────────────── */

function downloadArtifact(result: ExportResult): void {
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  if (result.format === 'blob') {
    triggerDownload(result.artifact as Blob, `vault-${ts}.bvbk`);
    return;
  }
  const slides = result.artifact as Blob[];
  slides.forEach((slide, i) => {
    const num = String(i + 1).padStart(2, '0');
    triggerDownload(slide, `vault-${ts}-slide-${num}.png`);
  });
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Give the browser a tick to start the download before revoking.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
