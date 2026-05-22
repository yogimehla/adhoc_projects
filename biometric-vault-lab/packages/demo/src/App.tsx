/**
 * Demo app shell. Phase 3: full state machine.
 *
 *   getMeta() === null            → Setup
 *   initialized && LOCKED         → Unlock
 *   UNLOCKED                      → Vault (CRUD)
 *
 * Diagnostics + SelfTest sit below the primary screen, collapsible so
 * they don't dominate the page on the happy path.
 */

import { useVault } from '@muulorigin/biometric-vault-react';
import { useMemo, useState } from 'react';
import { IndexedDbStorage } from './adapters/idbStorage.js';
import { Backup } from './components/Backup.js';
import { Diagnostics } from './components/Diagnostics.js';
import { InstallBanner } from './components/InstallBanner.js';
import { Reset } from './components/Reset.js';
import { SelfTest } from './components/SelfTest.js';
import { Setup } from './components/Setup.js';
import { Unlock } from './components/Unlock.js';
import { VaultView } from './components/Vault.js';
import { VaultMode, VaultState } from '@muulorigin/biometric-vault-core';

export function App() {
  const storage = useMemo(() => new IndexedDbStorage(), []);
  // Stable opts identity — otherwise every render produces a fresh object
  // literal, which would invalidate useVault's useMemo and tear down the
  // BiometricVault instance (and its in-memory master key) on every render.
  const vaultOpts = useMemo(() => ({ autoLockMs: 5 * 60 * 1000 }), []);
  const { vault, state, mode, initialized, capabilities, refresh } = useVault(storage, vaultOpts);
  const [diagOpen, setDiagOpen] = useState(false);
  const [selfTestOpen, setSelfTestOpen] = useState(false);
  const [backupOpen, setBackupOpen] = useState(false);

  let primary: JSX.Element;
  if (!initialized) {
    primary = <Setup vault={vault} capabilities={capabilities} onComplete={refresh} />;
  } else if (state === VaultState.LOCKED) {
    primary = <Unlock vault={vault} mode={mode} />;
  } else {
    primary = <VaultView vault={vault} mode={mode} />;
  }

  return (
    <main>
      <header className="top">
        <div>
          <h1>Biometric Vault Lab</h1>
          <p className="tagline">
            Biometric-only, frontend-only, offline-first local vault.
          </p>
        </div>
        <ModeBadge mode={mode} initialized={initialized} state={state} />
      </header>

      <InstallBanner />

      <div className="phase-banner">
        <strong>All four phases complete.</strong> WebAuthn + vault orchestrator + CRUD +
        auto-lock + ChromaStash-delegated backup/restore + rotate + PWA + WebView2 probe are
        live. The lab is ready to drop into the cryptjs monorepo.
      </div>

      {primary}

      <div className="collapsible">
        <button
          type="button"
          className="collapse-toggle"
          onClick={() => setBackupOpen((o) => !o)}
          aria-expanded={backupOpen}
        >
          <span className="chevron">{backupOpen ? '▾' : '▸'}</span>
          <span>Backup, restore & rotate</span>
        </button>
        {backupOpen && <Backup vault={vault} state={state} initialized={initialized} />}
      </div>

      <div className="collapsible">
        <button
          type="button"
          className="collapse-toggle"
          onClick={() => setDiagOpen((o) => !o)}
          aria-expanded={diagOpen}
        >
          <span className="chevron">{diagOpen ? '▾' : '▸'}</span>
          <span>Diagnostics</span>
        </button>
        {diagOpen && <Diagnostics storage={storage} />}
      </div>

      <div className="collapsible">
        <button
          type="button"
          className="collapse-toggle"
          onClick={() => setSelfTestOpen((o) => !o)}
          aria-expanded={selfTestOpen}
        >
          <span className="chevron">{selfTestOpen ? '▾' : '▸'}</span>
          <span>Crypto self-test</span>
        </button>
        {selfTestOpen && <SelfTest />}
      </div>

      {initialized && <Reset vault={vault} onReset={refresh} />}

      <footer>
        Build complete (4 of 4 phases) — see <code>README.md</code>, <code>SECURITY.md</code>, <code>TESTPLAN.md</code>.
      </footer>
    </main>
  );
}

function ModeBadge({
  mode,
  initialized,
  state,
}: {
  mode: VaultMode | null;
  initialized: boolean;
  state: VaultState;
}) {
  if (!initialized) return <span className="badge muted">no vault</span>;
  if (state === VaultState.LOCKED) return <span className="badge muted">locked</span>;
  if (mode === VaultMode.PRF_SECURE) return <span className="badge ok">PRF_SECURE · unlocked</span>;
  if (mode === VaultMode.GATE_ONLY) return <span className="badge warn">GATE_ONLY · unlocked</span>;
  return <span className="badge muted">{state}</span>;
}
