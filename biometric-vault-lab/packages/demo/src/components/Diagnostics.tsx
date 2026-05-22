/**
 * <Diagnostics> — Phase 1 deliverable.
 *
 * Renders the real output of `detectCapabilities()`, the storage adapter
 * smoke test, the WebAuthn PRF probe (stub verdict in Phase 1, live in
 * Phase 4), and a persist() trigger. This is the screen the user opens
 * inside MoBrowser / WebView2 to decide PRF_SECURE vs GATE_ONLY.
 */

import {
  type Capabilities,
  type WebAuthnPrfProbeResult,
  requestPersistentStorage,
  runWebAuthnPrfProbe,
  detectCapabilities,
} from '@muulorigin/biometric-vault-core';
import { useEffect, useState } from 'react';
import type { IndexedDbStorage } from '../adapters/idbStorage.js';
import { useInstallPrompt } from '../pwa/install.js';

interface DiagnosticsProps {
  storage: IndexedDbStorage;
}

interface SmokeResult {
  ok: boolean;
  bytes: number;
  detail?: string;
}

function YesNo({ value }: { value: boolean }) {
  return (
    <span className={`badge ${value ? 'ok' : 'bad'}`}>
      {value ? '✔ yes' : '✘ no'}
    </span>
  );
}

function MaybeBadge({ value }: { value: boolean | null }) {
  if (value === null) return <span className="badge muted">unknown</span>;
  return <YesNo value={value} />;
}

export function Diagnostics({ storage }: DiagnosticsProps) {
  const [caps, setCaps] = useState<Capabilities | null>(null);
  const [probe, setProbe] = useState<WebAuthnPrfProbeResult | null>(null);
  const [probeRunning, setProbeRunning] = useState(false);
  const [smoke, setSmoke] = useState<SmokeResult | null>(null);
  const [smokeRunning, setSmokeRunning] = useState(false);
  const [persistResult, setPersistResult] = useState<boolean | null>(null);
  const install = useInstallPrompt();

  const refresh = async () => {
    const c = await detectCapabilities();
    setCaps(c);
  };

  useEffect(() => {
    void refresh();
  }, []);

  const runSmoke = async () => {
    setSmokeRunning(true);
    const r = await storage.smokeTestRoundTrip();
    setSmoke(r);
    setSmokeRunning(false);
  };

  const runProbe = async () => {
    setProbeRunning(true);
    const r = await runWebAuthnPrfProbe();
    setProbe(r);
    setProbeRunning(false);
  };

  const requestPersist = async () => {
    const ok = await requestPersistentStorage();
    setPersistResult(ok);
    await refresh();
  };

  const evictionRisk = caps && !caps.storagePersisted && !caps.installed;

  return (
    <>
      <div className="card">
        <h2>Platform capabilities</h2>
        {caps ? (
          <dl className="kv">
            <dt>Secure context</dt>
            <dd><YesNo value={caps.secureContext} /></dd>

            <dt>WebAuthn supported</dt>
            <dd><YesNo value={caps.webauthnSupported} /></dd>

            <dt>Platform authenticator (isUVPAA)</dt>
            <dd><YesNo value={caps.platformAuthenticatorAvailable} /></dd>

            <dt>PRF (best-effort guess)</dt>
            <dd>
              <YesNo value={caps.prfMaybeSupported} />
              <span className="dim"> &nbsp;authoritative answer comes from setup() in Phase 3</span>
            </dd>

            <dt>Storage persisted</dt>
            <dd><YesNo value={caps.storagePersisted} /></dd>

            <dt>Installed (standalone)</dt>
            <dd><YesNo value={caps.installed} /></dd>

            <dt>iOS</dt>
            <dd>
              <YesNo value={caps.isIOS} />
              {caps.isIOS && caps.iosVersion ? (
                <span className="dim"> &nbsp;v{caps.iosVersion.toFixed(2)}</span>
              ) : null}
            </dd>

            <dt>User agent</dt>
            <dd>{caps.userAgent}</dd>
          </dl>
        ) : (
          <p className="dim">Detecting…</p>
        )}

        <div className="row" style={{ marginTop: 12 }}>
          <button type="button" className="secondary" onClick={refresh}>Refresh</button>
          <button type="button" className="primary" onClick={requestPersist}>
            Request persistent storage
          </button>
          {persistResult !== null && (
            <span className={`badge ${persistResult ? 'ok' : 'bad'}`}>
              {persistResult ? 'persist() granted' : 'persist() denied'}
            </span>
          )}
        </div>

        {evictionRisk && (
          <div className="warning">
            <strong>Eviction risk.</strong> Storage is not persisted and the app is not installed.
            On iOS, IndexedDB may be evicted after ~7 days of no interaction.
            Install to Home Screen and keep your recovery key + an encrypted export.
          </div>
        )}

        {install.showInstructions && (
          <div className="notice">
            <strong>Add to Home Screen (iOS).</strong> Open the Share menu → “Add to Home Screen.”
            This is the only way to get persistent storage on iOS Safari.
          </div>
        )}
        {install.canPrompt && (
          <div className="notice">
            <strong>Install app available.</strong>{' '}
            <button type="button" className="secondary" onClick={install.triggerPrompt}>
              Install
            </button>
          </div>
        )}
      </div>

      <div className="card">
        <h2>Storage adapter smoke test</h2>
        <p className="dim">
          Round-trips a throwaway ciphertext-shaped record through the IndexedDB adapter to confirm
          the storage interface is wired. Touches only a sentinel id, then deletes it.
        </p>
        <div className="row">
          <button type="button" className="primary" onClick={runSmoke} disabled={smokeRunning}>
            {smokeRunning ? 'Running…' : 'Run smoke test'}
          </button>
          {smoke && (
            <span className={`badge ${smoke.ok ? 'ok' : 'bad'}`}>
              {smoke.ok ? `OK — round-trip ${smoke.bytes} bytes` : `Failed — ${smoke.detail ?? 'unknown'}`}
            </span>
          )}
        </div>
      </div>

      <div className="card">
        <h2>WebAuthn / PRF probe</h2>
        <p className="dim">
          Inside MoBrowser / WebView2: open this and run the probe to decide PRF_SECURE vs GATE_ONLY.
          Phase 1 prints a stub verdict; Phase 4 will run a live create()/get() round-trip with a
          throwaway credential.
        </p>
        <div className="row">
          <button type="button" className="primary" onClick={runProbe} disabled={probeRunning}>
            {probeRunning ? 'Probing…' : 'Run probe'}
          </button>
          {probe && (
            <span className={`badge ${probe.ok ? 'ok' : 'warn'}`}>
              {probe.ok ? 'PRF available' : 'verdict pending (stub)'}
            </span>
          )}
        </div>
        {probe && <pre className="json">{JSON.stringify(probe, null, 2)}</pre>}
      </div>
    </>
  );
}
