/**
 * Install-prompt plumbing. Phase 1 just exposes a tiny hook that:
 *  - Captures the platform's `beforeinstallprompt` (Chromium / Edge / Android).
 *  - Reports iOS-specific add-to-Home-Screen state (no programmatic prompt).
 *
 * Phase 4 wires this into the Setup / Diagnostics flow proper.
 */

import { useEffect, useState } from 'react';

type DeferredPrompt = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

export interface UseInstallPromptReturn {
  canPrompt: boolean;
  showInstructions: boolean;
  triggerPrompt: () => Promise<'accepted' | 'dismissed' | 'unavailable'>;
}

export function useInstallPrompt(): UseInstallPromptReturn {
  const [deferred, setDeferred] = useState<DeferredPrompt | null>(null);
  const [showInstructions, setShowInstructions] = useState(false);

  useEffect(() => {
    const onBefore = (e: Event) => {
      e.preventDefault();
      setDeferred(e as DeferredPrompt);
    };
    window.addEventListener('beforeinstallprompt', onBefore);

    const ua = navigator.userAgent;
    const iOSLike =
      /iPhone|iPad|iPod/.test(ua) ||
      (/Macintosh/.test(ua) && (navigator.maxTouchPoints ?? 0) > 1);
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    if (iOSLike && !standalone) setShowInstructions(true);

    return () => window.removeEventListener('beforeinstallprompt', onBefore);
  }, []);

  const triggerPrompt = async () => {
    if (!deferred) return 'unavailable';
    await deferred.prompt();
    const choice = await deferred.userChoice;
    setDeferred(null);
    return choice.outcome;
  };

  return { canPrompt: deferred !== null, showInstructions, triggerPrompt };
}
