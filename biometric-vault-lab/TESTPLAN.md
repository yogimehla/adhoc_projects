# TESTPLAN.md — biometric-vault-lab

Comprehensive acceptance criteria and platform matrix. Filled in incrementally as phases land.

> Status: **All four phases complete.** Verify each Phase 3/4 acceptance row in a real browser.

## Phase 1 acceptance (now)

- [x] Monorepo installs cleanly with `npm install` from root.
- [x] `npm run typecheck` passes across all three packages.
- [x] `npm run dev` starts the demo and serves `http://localhost:5173`.
- [x] Diagnostics screen renders and shows real values from `detectCapabilities()`:
  - `isSecureContext` reflects the actual context.
  - `webauthnSupported` matches `!!window.PublicKeyCredential`.
  - `platformAuthenticatorAvailable` runs `isUVPAA()` and reports true on host platforms that support it.
  - `prfMaybeSupported` returns a best-effort guess (note that authoritative determination requires Phase 3 `setup()`).
  - `storagePersisted` reflects `navigator.storage.persisted()`.
  - `installed` reflects `display-mode: standalone` / `navigator.standalone`.
  - `isIOS` + `iosVersion` parsed from UA, with iPadOS-as-Mac detection via `maxTouchPoints`.
- [x] `IndexedDbStorage` adapter satisfies the `VaultStorage` interface; the demo can put/get a smoke record (bytes round-trip).
- [x] Core package has zero React / `idb` / `window.indexedDB` imports.

## Phase 2 acceptance (now)

- [x] In-app self-test panel runs and is green: generate MK → wrap/unwrap with random KEK → encrypt/decrypt sample data → recovery secret generate/encode/parse round-trips → checksum rejects single-character typos.
- [x] **PRF-determinism stub test:** HKDF-SHA256 with identical (IKM, salt, info) produces identical 256 bits; different salt → different bits. Same construction the real authenticator must satisfy in Phase 3.
- [x] All `crypto.ts` helpers use Web Crypto exclusively; no library crypto.
- [x] AAD binding works: swap-the-AAD attack fails GCM auth tag → surfaces as `DecryptionError`, never raw exception.
- [x] Wrong-KEK unwrap surfaces as `DecryptionError`.
- [x] HKDF domain separation works: `mv:bio-kek:v1` and `mv:recovery-kek:v1` produce different KEKs from the same IKM+salt.
- [x] Recovery-key typo (single char flip in body) is caught by the displayed checksum BEFORE any unwrap is attempted.
- [x] Malformed recovery input throws `InvalidRecoveryKeyFormatError` (separate from `WrongRecoveryKeyError`).
- [x] `computeRecoveryCheck()` is 8 bytes of SHA-256(secret) and deterministic.

## Phase 3 acceptance (verify in browser)

Code in place; verify each by exercising the demo on desktop Chrome / Edge.

- [ ] **Setup happy path (desktop Chrome / Edge / Hello):** one-or-two-prompt setup completes; recovery key shown once; vault transitions UNINITIALIZED → UNLOCKED.
- [ ] Recovery key reveal requires explicit acknowledgement checkbox before continuing.
- [ ] Biometric unlock decrypts entries.
- [ ] Recovery unlock decrypts the same entries (both paths yield the same MK).
- [ ] Typo recovery key fails on the display checksum BEFORE `recoveryCheck` is even consulted.
- [ ] Well-formed but wrong-vault recovery key fails on `recoveryCheck` BEFORE any GCM unwrap is attempted.
- [ ] CRUD works while unlocked (put / get / list / remove). Each entry decrypts with its id as AAD.
- [ ] `lock()` wipes MK from memory; subsequent `get()` throws `VaultLockedError` and surfaces as "Vault is locked".
- [ ] Auto-lock fires on inactivity timeout (default 5 min) AND on `visibilitychange: hidden` AND on `pagehide`.
- [ ] User cancellation of the WebAuthn prompt surfaces as `UserCancelledError` ("Biometric prompt cancelled. Try again.")
- [ ] Forced `GATE_ONLY` (debug checkbox in Setup) shows amber warning and gates on acknowledgement.
- [ ] DevTools confirms IndexedDB holds only wrapped keys + ciphertext in `PRF_SECURE` (no `deviceKEKRaw` field).
- [ ] DevTools confirms IndexedDB DOES contain `deviceKEKRaw` (plaintext bytes) in `GATE_ONLY` mode.
- [ ] Reset wipes both stores; UI returns to Setup.

## Phase 4 acceptance (verify in browser)

Code in place; verify each by exercising the demo.

- [ ] PWA manifest valid; installable on supported browsers (Chrome / Edge / Android Chrome).
- [ ] Install banner appears when `beforeinstallprompt` fires; iOS Safari shows manual A2HS instructions.
- [ ] Offline-after-first-load works (precache shell, no cross-origin runtime caching).
- [ ] Production build has the strict CSP meta tag in `<head>`; dev build does NOT (HMR-friendly).
- [ ] `navigator.storage.persist()` granted after setup; result surfaced in Diagnostics.
- [ ] Red eviction-risk warning shows when *not persisted AND not installed*.
- [ ] **ChromaStash export → reset → import** round-trips with `integrityOk` true and identical entries:
  - [ ] `format: 'blob'` (default, single `.bvbk` AES file).
  - [ ] `format: 'slides'` (ChromaStash PNG slides — download all PNGs, then select all to restore).
- [ ] Export with wrong recovery key fails on stored `recoveryCheck` BEFORE encrypting anything.
- [ ] Import with wrong recovery key fails on either AES-GCM auth (blob path) or ChromaStash decode (slides path), surfaced as `DecryptionError`.
- [ ] Import wipes the existing local vault before restoring (verified by adding a distinct entry, exporting, adding a different entry, importing — only the exported one survives).
- [ ] `rotateRecoveryKey` requires UNLOCKED, returns a fresh key shown once, invalidates the previous key (old key fails import / unlock).
- [ ] WebView2/MoBrowser probe in Diagnostics outputs copy-pasteable JSON with `prfOnCreate`, `prfOnGet`, `prfDeterministic` true, and `prfOutputLength > 0`.
- [ ] `reset()` clears IndexedDB and drops in-memory MK; UI returns to Setup screen automatically.
- [ ] Maskable PWA icons render in the install dialog (192x192 + 512x512 PNG present at the manifest paths).

## Mode / security verifications (Phase 3+)

- [ ] PRF platform → green `PRF_SECURE` badge, PRF length > 0.
- [ ] Forced GATE_ONLY → amber "convenience lock only" badge with acknowledgement gate.
- [ ] **PRF-determinism live test:** two `get()`s with the same salt return identical bytes.
- [ ] No plaintext key material visible in IndexedDB Application tab.
- [ ] No plaintext key material in logs, console, or error messages.

## Platform matrix (one row per device under test)

| Platform | UV gesture | PRF? | Mode | Persisted? | Installed? | Survives relaunch? | Notes |
|---|---|---|---|---|---|---|---|
| Desktop Chrome (Windows Hello) | | | | | | | |
| Desktop Edge (Windows Hello) | | | | | | | |
| Desktop Chrome (Touch ID) | | | | | | | |
| Android Chrome (fingerprint) | | | | | | | |
| iOS 18+ Safari (in-browser) | | | | | | | eviction warning visible? |
| iOS 18+ Safari (Home Screen) | | | | | | | persist() returns true? |
| WebView2 (probe only) | | | | | | | record probe JSON |

## Known gotchas (verify they bite as expected)

- [ ] HTTP via LAN IP on iOS — WebAuthn silently fails. (Confirm error UX is clear.)
- [ ] Changing the deployment origin invalidates existing passkeys. (Documented; not auto-tested.)
- [ ] Two biometric prompts at setup only when the platform omits PRF on `create()` (Chromium); explained in Setup UI.
- [ ] GCM auth-tag failures show "wrong key / corrupted data," never a raw exception.

## Out of scope for tests (deliberately)

- Penetration testing of platform authenticators.
- Cross-device sync of ciphertext (passkeys sync on iCloud; ciphertext does not).
- Multi-user behavior — single vault per origin.
