/**
 * Platform capability detection. Phase 1 deliverable — real, not a stub.
 *
 * Reports what the platform plausibly supports BEFORE setup. The
 * authoritative determination of PRF support happens at setup() time when
 * we inspect `getClientExtensionResults().prf` from a real WebAuthn call.
 * `prfMaybeSupported` here is a UA-based optimistic heuristic.
 */

import type { Capabilities } from './types.js';

/**
 * Detect what this platform supports for a biometric-only vault.
 *
 * Safe to call repeatedly. Does NOT prompt the user or invoke WebAuthn —
 * `isUVPAA()` is silent. The Diagnostics screen calls this on mount and on
 * a "refresh" button.
 *
 * @returns a snapshot of the current platform's vault-relevant capabilities.
 */
export async function detectCapabilities(): Promise<Capabilities> {
  const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  const secureContext =
    typeof window !== 'undefined' && (window.isSecureContext ?? false);
  const webauthnSupported =
    typeof window !== 'undefined' &&
    typeof window.PublicKeyCredential !== 'undefined';

  let platformAuthenticatorAvailable = false;
  if (
    webauthnSupported &&
    typeof window.PublicKeyCredential
      .isUserVerifyingPlatformAuthenticatorAvailable === 'function'
  ) {
    try {
      platformAuthenticatorAvailable =
        await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    } catch {
      platformAuthenticatorAvailable = false;
    }
  }

  const { isIOS, iosVersion } = detectIOS(userAgent);
  const prfMaybeSupported = guessPrfSupport(userAgent, isIOS, iosVersion);

  let storagePersisted = false;
  if (typeof navigator !== 'undefined' && navigator.storage?.persisted) {
    try {
      storagePersisted = await navigator.storage.persisted();
    } catch {
      storagePersisted = false;
    }
  }

  const installed = detectInstalled();

  return {
    secureContext,
    webauthnSupported,
    platformAuthenticatorAvailable,
    prfMaybeSupported,
    storagePersisted,
    installed,
    isIOS,
    iosVersion,
    userAgent,
  };
}

/**
 * Request that the storage be persisted. Surface the result in Diagnostics.
 * On iOS this is the single most important thing to call after setup —
 * without it the vault may be evicted after ~7 days of no interaction.
 *
 * @returns true if persistent storage was granted.
 */
export async function requestPersistentStorage(): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.storage?.persist) {
    try {
      return await navigator.storage.persist();
    } catch {
      return false;
    }
  }
  return false;
}

/* ──────────────── helpers ──────────────── */

interface IOSDetection {
  isIOS: boolean;
  iosVersion: number | null;
}

/**
 * iPadOS 13+ reports a Mac UA string by default. We detect it by combining
 * the UA token with a multi-touch indicator — desktop Macs do not have
 * `maxTouchPoints > 1`.
 */
function detectIOS(ua: string): IOSDetection {
  if (typeof navigator === 'undefined') return { isIOS: false, iosVersion: null };

  const iPadAsMac =
    /Macintosh/.test(ua) && (navigator.maxTouchPoints ?? 0) > 1;
  const classicIOS = /iPhone|iPad|iPod/.test(ua);
  const isIOS = iPadAsMac || classicIOS;
  if (!isIOS) return { isIOS: false, iosVersion: null };

  const m = ua.match(/OS (\d+)[_.](\d+)(?:[_.](\d+))?/);
  if (m && m[1]) {
    const major = parseInt(m[1], 10);
    const minor = m[2] ? parseInt(m[2], 10) : 0;
    return { isIOS: true, iosVersion: major + minor / 100 };
  }
  return { isIOS: true, iosVersion: null };
}

/**
 * Best-effort guess at PRF support BEFORE running WebAuthn. Authoritative
 * answer comes from `getClientExtensionResults().prf` at setup().
 *
 * Known landscape (as of Jan 2026):
 *  - Chromium 116+ on desktop / Android: PRF supported.
 *  - Safari / WebKit 18+ on iOS / macOS: PRF supported.
 *  - Older Safari / iOS < 18: PRF not supported → GATE_ONLY fallback.
 */
function guessPrfSupport(
  ua: string,
  isIOS: boolean,
  iosVersion: number | null,
): boolean {
  if (isIOS) {
    return iosVersion !== null && iosVersion >= 18;
  }
  const chromeMatch = ua.match(/Chrome\/(\d+)/);
  if (chromeMatch && chromeMatch[1]) {
    return parseInt(chromeMatch[1], 10) >= 116;
  }
  const safariMatch = ua.match(/Version\/(\d+)\.\d+ Safari/);
  if (safariMatch && safariMatch[1]) {
    return parseInt(safariMatch[1], 10) >= 18;
  }
  const firefoxMatch = ua.match(/Firefox\/(\d+)/);
  if (firefoxMatch) {
    // PRF support in Firefox is still rolling out — best-effort guess true so
    // the setup() call can authoritatively decide.
    return true;
  }
  // Unknown UA: optimistic guess, setup() will tell the truth.
  return true;
}

function detectInstalled(): boolean {
  if (typeof window === 'undefined') return false;
  const standalone =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(display-mode: standalone)').matches;
  const iosStandalone =
    typeof navigator !== 'undefined' &&
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return standalone || iosStandalone;
}
