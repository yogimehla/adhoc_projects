/**
 * Top-of-app install / A2HS banner. Shows when:
 *  - the platform fired `beforeinstallprompt` and we're not installed, OR
 *  - we're on iOS in Safari and not installed (manual A2HS instructions).
 *
 * Dismissable via a close button; the dismissal is sessionStorage-scoped
 * so the user sees it again next visit if they still haven't installed.
 */

import { useEffect, useState } from 'react';
import { useInstallPrompt } from '../pwa/install.js';

const DISMISS_KEY = 'bvl:install-banner-dismissed';

export function InstallBanner() {
  const { canPrompt, showInstructions, triggerPrompt } = useInstallPrompt();
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    try {
      setDismissed(sessionStorage.getItem(DISMISS_KEY) === '1');
    } catch {
      // sessionStorage can throw in private modes / strict CSP — fail open.
    }
  }, []);

  const dismiss = () => {
    setDismissed(true);
    try { sessionStorage.setItem(DISMISS_KEY, '1'); } catch { /* fine */ }
  };

  if (dismissed) return null;
  if (!canPrompt && !showInstructions) return null;

  return (
    <div className="install-banner">
      {canPrompt && (
        <>
          <strong>Install this app</strong> for persistent storage and a faster relaunch.{' '}
          <button
            type="button"
            className="secondary small"
            onClick={() => { void triggerPrompt().then(() => dismiss()); }}
          >
            Install
          </button>
        </>
      )}
      {!canPrompt && showInstructions && (
        <>
          <strong>Add to Home Screen (iOS).</strong>{' '}
          Tap the Share icon in Safari, then <em>“Add to Home Screen.”</em> This is the only way
          to get persistent storage on iOS — otherwise the vault may be evicted after ~7 days of
          no use.
        </>
      )}
      <button
        type="button"
        className="banner-close"
        aria-label="Dismiss"
        onClick={dismiss}
      >
        ×
      </button>
    </div>
  );
}
