/**
 * Vault screen — UNLOCKED state.
 *
 * Minimal CRUD interface over encrypted entries: list, add, view, remove,
 * lock. Each entry's id is bound to its ciphertext via AAD, so swapping a
 * ciphertext into a different id will fail the GCM auth tag at decrypt.
 *
 * Entry "data" is whatever JSON the user types. We round-trip via JSON,
 * so any structured-clonable value works.
 */

import type {
  BiometricVault,
  PlainEntry,
  VaultMode,
} from '@muulorigin/biometric-vault-core';
import { useCallback, useEffect, useState } from 'react';
import { errorMessage } from './errorMessage.js';

interface VaultViewProps {
  vault: BiometricVault;
  mode: VaultMode | null;
}

export function VaultView({ vault, mode }: VaultViewProps) {
  const [entries, setEntries] = useState<PlainEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<Error | null>(null);

  const [newId, setNewId] = useState('');
  const [newData, setNewData] = useState('');

  const [viewId, setViewId] = useState<string | null>(null);
  const [viewData, setViewData] = useState<string>('');

  const refresh = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const list = await vault.list();
      setEntries(list.sort((a, b) => b.updatedAt - a.updatedAt));
    } catch (e) {
      setErr(e instanceof Error ? e : new Error(String(e)));
    } finally {
      setLoading(false);
    }
  }, [vault]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const onAdd = async () => {
    setErr(null);
    if (!newId.trim()) return;
    let parsed: unknown;
    try {
      parsed = newData.trim().length === 0 ? null : JSON.parse(newData);
    } catch {
      // If it isn't JSON, store as a string.
      parsed = newData;
    }
    try {
      await vault.put(newId.trim(), parsed);
      setNewId('');
      setNewData('');
      await refresh();
    } catch (e) {
      setErr(e instanceof Error ? e : new Error(String(e)));
    }
  };

  const onView = async (id: string) => {
    setErr(null);
    try {
      const value = await vault.get(id);
      setViewId(id);
      setViewData(JSON.stringify(value, null, 2));
    } catch (e) {
      setErr(e instanceof Error ? e : new Error(String(e)));
    }
  };

  const onRemove = async (id: string) => {
    setErr(null);
    try {
      await vault.remove(id);
      if (viewId === id) {
        setViewId(null);
        setViewData('');
      }
      await refresh();
    } catch (e) {
      setErr(e instanceof Error ? e : new Error(String(e)));
    }
  };

  const onLock = () => {
    vault.lock();
  };

  return (
    <div className="card">
      <div className="row spread">
        <h2 style={{ margin: 0 }}>
          Vault{' '}
          <span
            className={`badge ${mode === 'PRF_SECURE' ? 'ok' : mode === 'GATE_ONLY' ? 'warn' : 'muted'}`}
            style={{ marginLeft: 6 }}
          >
            {mode ?? '—'}
          </span>
        </h2>
        <button type="button" className="secondary" onClick={onLock}>Lock</button>
      </div>

      <h3 style={{ marginTop: 16 }}>Add an entry</h3>
      <div className="form-grid">
        <label htmlFor="new-id" className="dim small">Entry id</label>
        <input
          id="new-id"
          type="text"
          value={newId}
          onChange={(e) => setNewId(e.target.value)}
          placeholder="notes/today"
          autoComplete="off"
          spellCheck={false}
        />
        <label htmlFor="new-data" className="dim small">Data (JSON or plain text)</label>
        <textarea
          id="new-data"
          value={newData}
          onChange={(e) => setNewData(e.target.value)}
          placeholder='{ "title": "...", "body": "..." }'
          rows={4}
        />
      </div>
      <div className="row" style={{ marginTop: 8 }}>
        <button
          type="button"
          className="primary"
          onClick={onAdd}
          disabled={!newId.trim()}
        >
          Save encrypted
        </button>
      </div>

      <h3 style={{ marginTop: 20 }}>Entries ({entries.length})</h3>
      {loading && <p className="dim">Decrypting…</p>}
      {!loading && entries.length === 0 && (
        <p className="dim">No entries yet. Add one above.</p>
      )}
      {!loading && entries.length > 0 && (
        <table className="entrytable">
          <thead>
            <tr>
              <th>Id</th>
              <th>Updated</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => (
              <tr key={e.id}>
                <td className="mono">{e.id}</td>
                <td className="dim small">{new Date(e.updatedAt).toLocaleString()}</td>
                <td className="row" style={{ justifyContent: 'flex-end' }}>
                  <button type="button" className="secondary small" onClick={() => onView(e.id)}>
                    View
                  </button>
                  <button type="button" className="secondary small danger" onClick={() => onRemove(e.id)}>
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {viewId !== null && (
        <div style={{ marginTop: 12 }}>
          <h3 style={{ marginBottom: 4 }}>
            {viewId}{' '}
            <button
              type="button"
              className="secondary small"
              onClick={() => { setViewId(null); setViewData(''); }}
            >
              Close
            </button>
          </h3>
          <pre className="json">{viewData}</pre>
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
