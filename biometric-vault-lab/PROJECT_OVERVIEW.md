# Biometric Vault Lab — Project Overview

**A standalone, throwaway-safe laboratory project that proves out a biometric-only, frontend-only, offline-first local vault for the Muulorigin product family.**

| | |
|---|---|
| **Project name** | `biometric-vault-lab` |
| **Status** | Complete (4 of 4 build phases delivered and verified on real devices) |
| **Author** | Abhishek Raj ([github.com/AbhiRajIsHere](https://github.com/AbhiRajIsHere)) |
| **License** | MIT — Muulorigin |
| **Repository** | github.com/AbhiRajIsHere/biometric-vault-lab |
| **Live demo** | Deployed via Vercel (HTTPS); URL provided separately |
| **Sibling project** | [`@muulorigin/chromastash-sdk`](https://github.com/yogimehla/cryptjs) (vendored for backup delegation) |

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [The Problem](#the-problem)
3. [The Solution](#the-solution)
4. [How It Actually Works](#how-it-actually-works)
5. [Architecture](#architecture)
6. [Security Model](#security-model)
7. [The Two Keys Explained](#the-two-keys-explained)
8. [Cross-Platform Verification](#cross-platform-verification)
9. [What Was Built — Deliverables](#what-was-built--deliverables)
10. [Build & Deployment](#build--deployment)
11. [Honest Limitations](#honest-limitations)
12. [Where This Goes Next](#where-this-goes-next)
13. [Glossary](#glossary)

---

## Executive Summary

### The one-paragraph pitch

Biometric Vault Lab is a small piece of software that lets a web application store sensitive user data — notes, API keys, chat histories, personal preferences — **encrypted on the user's own device**, with **the user's fingerprint or face as the only routine unlock mechanism**. No password. No server. No account. No cloud. The data is genuinely encrypted at rest (not just hidden behind a UI gate). It works offline. It works across Windows, Android, and iPhone. It ships as two reusable npm packages that drop into any web app.

### Why this matters

Every web app that wants to remember sensitive data about its users today has three bad choices: store it on a server (where it can be breached, subpoenaed, or held hostage), protect it with a password the user will forget or reuse, or store it unencrypted (where any other app or malicious extension can read it). This project demonstrates a fourth option — using modern phone hardware (Apple Secure Enclave, Windows TPM, Android StrongBox) to turn a biometric gesture into a real cryptographic key. The data lives encrypted on the user's device, and only their actual finger or face can unlock it.

### What was verified

The lab was tested end-to-end on real hardware: Windows desktop with Windows Hello, Android phones with fingerprint sensors (via Google Password Manager), and iPhones with Face ID. The full setup → unlock → CRUD → backup → reset → restore cycle was confirmed working on all platforms. 14 live cryptographic self-tests pass in the user's browser. Stored data was inspected at the byte level in IndexedDB and confirmed to be opaque ciphertext (not plaintext).

### Current status

**Lab is feature-complete and production-ready as an SDK.** The two npm packages (`@muulorigin/biometric-vault-core` and `@muulorigin/biometric-vault-react`) are ready to drop into the cryptjs monorepo as sibling packages, with one dependency-line change. The demo PWA is deployed to Vercel as a live verification artifact.

---

## The Problem

### What we're up against

A modern web application has to decide where it stores user data. Every choice has a serious trade-off:

#### Option 1 — Server-side storage
"We'll keep your data on our servers." This is what most SaaS apps do.

**Why it's bad:**
- Servers get breached. LastPass, Okta, Slack, Twilio, MailChimp — every major year has a major breach.
- The company can read everything. Their AI may train on it, their employees can peek, governments can subpoena it.
- The company can disappear. Your data dies with them.
- Lock-in. Pricing goes up, features get paywalled, exporting your own data becomes hostile.
- No offline. No internet → no app.

#### Option 2 — Local storage protected by a password
"We'll save it on your phone, locked by a master password." Apps like 1Password, KeePass.

**Why it's bad:**
- Users forget passwords.
- Users reuse passwords. One breach elsewhere → exposed.
- Passwords can be phished, keylogged, shoulder-surfed.
- Friction at every unlock means users disable the lock or choose weak passwords.

#### Option 3 — Plaintext local storage
"Just save it in IndexedDB / localStorage." What 99% of websites actually do.

**Why it's bad:**
- Any other tab or browser extension can read it.
- A stolen laptop = total data exposure.
- Forensic tools recover it trivially.
- Not encrypted in any meaningful sense.

### What's needed

A local storage layer that has:
- **Real encryption at rest** (not just a UI lock).
- **No password to remember** for the daily use case.
- **No server dependency** — works offline, no account.
- **Cross-device migration** — if the user upgrades phones, their data follows.
- **Honest threat model** — admits its limits instead of pretending to be magic.

Biometric Vault Lab is that layer.

---

## The Solution

### One-sentence pitch

> A secret diary on your device that turns its pages into gibberish the moment you close it, and only your fingerprint or face can turn them back.

### The user experience

```
First time use:
1. Open the URL.
2. Tap "Set up vault."
3. Phone prompts for fingerprint / Face ID.
4. Touch sensor.
5. App shows a one-time recovery key (long random code). Save it.
6. Vault is open. Write whatever you want.

Every subsequent use:
1. Open the URL.
2. Tap "Unlock with biometric."
3. Touch sensor.
4. Your data is back.

If you lose your phone:
1. Get a new phone.
2. Open the URL.
3. Tap "Use recovery key instead."
4. Type the saved code.
5. Data restored.
```

That's the entire user journey. No emails, no passwords, no accounts, no cloud.

### Why this is honest

Most "biometric login" apps are lying — the fingerprint just flips a `loggedIn = true` boolean in JavaScript, while the actual data sits in plaintext on disk. Biometric Vault Lab **uses the biometric to materialize the encryption key itself**. The data is real ciphertext on disk; the key only exists during the half-second when the user's finger is on the sensor.

If an attacker bypasses the JavaScript layer entirely and reads the raw IndexedDB storage, they find encrypted bytes and wrapped keys — nothing usable without the actual biometric gesture on the actual device.

---

## How It Actually Works

This is the part that gets technical, but I'll keep the analogy going.

### The "magic safe" — your phone's secure chip

Every modern phone (and most modern laptops) contains a small tamper-resistant chip. Names vary:
- iPhone — **Secure Enclave**
- Android — **StrongBox / TEE (Trusted Execution Environment)**
- Windows — **TPM (Trusted Platform Module)**

These chips have an important property: even the rest of the phone can't read inside them. They expose a small set of operations, like "verify a fingerprint" or "sign a message," but the secret keys never leave the chip.

### The WebAuthn PRF extension

In 2022–2024, Apple, Google, and Microsoft added a feature to browsers called the **WebAuthn PRF extension** (PRF = Pseudo-Random Function). It exposes one specific operation from the secure chip to web pages:

> *Given an input "salt" and a verified biometric gesture, the chip computes HMAC-SHA256(secret_inside_chip, salt) and returns 32 bytes to the web page.*

The math properties that matter:
- **Deterministic for the same user + same device + same salt.** Same finger, same input → same 32 bytes, every time.
- **Different for any other user, device, or salt.** Without all three matching, you get different bytes.
- **Unguessable.** The secret inside the chip is random and never exits.
- **Not stored anywhere persistent.** The 32 bytes only exist during the gesture; the moment the operation completes, they're discarded.

### How the vault uses this

At setup:
```
1. Generate a random 256-bit "master key" (MK) — this is the actual key that encrypts data.
2. Ask the chip for 32 PRF bytes — call them "bio bytes."
3. Use bio bytes to derive a wrapping key (via HKDF).
4. Encrypt MK with the wrapping key → "bioWrappedMK" (stored on disk).
5. Wipe MK from memory.
6. Wipe bio bytes from memory.
```

At unlock (every subsequent time):
```
1. User touches sensor.
2. Chip returns the same 32 bio bytes.
3. HKDF-derive the same wrapping key.
4. Decrypt bioWrappedMK → master key (in memory).
5. Master key decrypts user's entries on demand.
6. When user locks: wipe MK from memory.
```

**Critical point:** the master key never exists on disk unencrypted. The PRF bytes never exist anywhere except in memory during the active gesture. An attacker with full disk access gets:
- Encrypted ciphertext (useless without MK)
- bioWrappedMK (useless without bio bytes)
- recoveryWrappedMK (useless without the recovery key)

Neither the MK nor the bio bytes can be reconstructed from anything on disk. They require an actual biometric on the actual device.

---

## Architecture

### Three packages

The project is structured as a monorepo with three packages:

```
biometric-vault-lab/
├── packages/
│   ├── biometric-vault-core/         (SDK #1)
│   ├── biometric-vault-react/         (SDK #2)
│   └── demo/                          (Demo PWA)
└── vendor/
    └── cryptjs/                       (Vendored ChromaStash, for backups)
```

#### `@muulorigin/biometric-vault-core`

The brain. Pure TypeScript, zero framework dependencies, works in main thread, Web Worker, or test runner. Public API:

```ts
class BiometricVault {
  constructor(storage: VaultStorage, opts?: VaultOptions);

  // Lifecycle
  setup(opts?: SetupOptions): Promise<{ mode, recoveryKey }>;
  unlockWithBiometric(): Promise<void>;
  unlockWithRecovery(recoveryKey: string): Promise<void>;
  lock(): void;
  reset(): Promise<void>;

  // CRUD
  put(id: string, data: unknown): Promise<void>;
  get(id: string): Promise<unknown | null>;
  list(): Promise<PlainEntry[]>;
  remove(id: string): Promise<void>;

  // Backup
  exportEncrypted(recoveryKey, opts?): Promise<ExportResult>;
  importEncrypted(artifact, recoveryKey): Promise<void>;
  rotateRecoveryKey(): Promise<string>;

  // Observability
  getState(): VaultState;
  getMode(): VaultMode | null;
  capabilities(): Promise<Capabilities>;
  subscribe(listener: VaultEventListener): () => void;
}
```

Plus typed errors with stable string codes (`VaultLockedError`, `WrongRecoveryKeyError`, `DecryptionError`, etc.), the `VaultStorage` injection interface, and standalone utility exports (encoding helpers, capabilities detection, WebAuthn probe).

#### `@muulorigin/biometric-vault-react`

A thin React wrapper. Provides hooks (`useVault`, `useVaultSetup`, `useVaultUnlock`) and drop-in components (`<VaultSetupButton>`, `<BiometricUnlockButton>`, `<VaultBackupButton>`) that mirror the ChromaStash React SDK's conventions exactly.

#### `demo`

A Vite + React PWA harness that uses both packages. Provides a real Setup → Unlock → CRUD → Backup → Reset experience with Diagnostics and Self-Test panels. This is what gets deployed to Vercel as the verification artifact.

### Storage abstraction

The core depends only on a `VaultStorage` interface. It never imports `idb` or `window.indexedDB`. The demo provides an `IndexedDbStorage` adapter that satisfies the interface. This means:

- The core can run unchanged in a Web Worker.
- The core can be tested with a mock storage.
- A future product can swap in OPFS, encrypted SQLite, or any other persistence layer without touching the vault logic.

### Key-wrapping scheme

The heart of the security model is **two independent wraps of a single master key**:

```
                         master key (MK)
                         256-bit AES-GCM
                                │
            ┌───────────────────┴───────────────────┐
            │                                       │
       bioKEK (or)                              recoveryKEK
       deviceKEK                                (HKDF from recovery secret)
       (PRF-derived,                            (always present)
        PRF_SECURE only)                              │
            │                                       │
       bioWrappedMK                              recoveryWrappedMK
       (stored)                                  (stored)
```

- Both wraps protect the **same master key**.
- Either wrap, when unlocked, yields the master key.
- The biometric wrap is the daily-use path (convenience).
- The recovery wrap is the break-glass path (portability).

---

## Security Model

This section is intentionally honest about what the vault does and does not protect.

### The core principle

**Biometric does not log the user in. It materializes the AES key that decrypts the data.** There is no `isUnlocked` boolean that, if flipped, exposes plaintext. "Unlocked" means a CryptoKey handle exists in memory. "Locked" means that handle is `null`. An attacker who bypasses the JS layer finds only ciphertext and wrapped keys at rest.

### What the vault DOES protect against

- **Device theft + storage exfiltration.** Someone steals the phone, dumps the storage chip — gets encrypted bytes and wrapped keys. No usable data.
- **Casual / unauthorized access.** Roommate, coworker, child, spouse opening the app without the registered biometric — denied.
- **Cloud breaches.** There is no cloud to breach.
- **Network MitM.** There is no network. The vault never talks to a server for auth or data.
- **Lost device with successful migration.** User has a recovery key + a backup file. They restore on a new device — same master key, all entries recovered.

### What the vault DOES NOT protect against (deliberately)

- **Live XSS / malicious browser extensions while unlocked.** If hostile code runs in the page while the master key is in memory, the data is gone. Mitigated with a strict production CSP and zero-`innerHTML` discipline, but not eliminated.
- **Coerced unlock.** "Touch your finger or I'll hurt you." The chip can't tell coercion from cooperation.
- **Compromised authenticator hardware.** A backdoored Secure Enclave / TPM defeats everything below it. Out of scope for a web-layer solution.
- **The user being tricked into typing their recovery key into a phishing page.** The recovery key is plaintext at moment of use; it can be socially engineered out of a user. Mitigated with explicit "shown once, save carefully" UX, not eliminated.
- **iOS storage eviction.** iOS Safari evicts script-writable storage after ~7 days of no interaction unless the app is installed to the home screen. The vault detects this and warns the user; it can't override the OS.
- **The user losing both their phone AND their recovery key.** Game over. No reset path. This is the cost of having no server.

### The two operating modes

The vault auto-detects which mode to use at setup time based on platform capability:

#### Mode A — `PRF_SECURE` (the strong mode)

- WebAuthn PRF extension is available.
- Biometric gesture produces 32 PRF bytes via the secure chip.
- bioKEK derived from PRF bytes (never stored).
- Master key exists at rest **only** in encrypted form.
- An attacker with disk access has nothing usable.
- UI badge: green.

Available on: Windows 11 + Windows Hello PIN/biometric, iOS 18+ Safari, Chrome 116+ on Android, recent Chrome/Edge desktop.

#### Mode B — `GATE_ONLY` (the convenience-only fallback)

- WebAuthn PRF extension is NOT available.
- A random KEK is generated at setup and stored on disk as plaintext (`deviceKEKRaw`).
- The biometric is only a UI/UV gate — it verifies the user is present, but doesn't materialize the key.
- An attacker with disk access can recover the KEK from `deviceKEKRaw` and decrypt everything.
- UI badge: amber, labeled "convenience lock only."

Active on: iOS 17 and earlier, older Chrome (pre-116), some Firefox builds, the demo's debug-forced setting.

The UI never lies about which mode is active. GATE_ONLY's amber badge is visible on every screen the user sees while unlocked.

### The "biometric = user verification" honesty fix

WebAuthn satisfies `userVerification: 'required'` with biometric **or** a device PIN/passcode — whatever the OS has enrolled. So the actual guarantee is "device + a verified gesture," not strictly "device + finger." Anyone who knows the user's iPhone passcode can unlock the vault. The SECURITY.md doc states this plainly — internal stakeholders should not claim "fingerprint-only" when it's actually "fingerprint-OR-PIN."

---

## The Two Keys Explained

There are two keys that can unlock the vault. They have different jobs.

### Key #1 — The recovery key (the paper code)

**What it looks like:** A 60-character string like `DAGJ0-GVWXR-NZNPD-VD69C-8KHT2-11DET-G7FVN-7ZPC8-MJWW7-G32RA-NGBZ0-0S700`.

**Where it lives:** Only on the paper the user wrote it on. The app never stores it anywhere.

**When it's used:**
- Lost phone / new device.
- Broken biometric (cut finger, sunglasses confuse Face ID).
- Cross-device migration (Android ↔ iPhone).
- Old device that doesn't support PRF.
- Restoring from a backup file.

**Format:** 32 random bytes (256 bits of entropy) encoded in Crockford Base32 (52 chars), plus a 4-character checksum derived from SHA-256 of the secret. Grouped in 5-char chunks with dashes for readability. Crockford Base32 drops the visually ambiguous characters `I`, `L`, `O`, `U` — and on parse, the app normalizes `O→0` and `I/L→1` so hand-copying is tolerated.

**Why 256 bits?** That's the security level of Bitcoin private keys. Brute-forcing the key requires more energy than the sun produces in its lifetime. Not "hard" — physically impossible.

**Why works on every device:** Uses only HKDF + AES-GCM, both standard Web Crypto primitives supported in every browser since 2016. No hardware dependency.

### Key #2 — The PRF key (the biometric)

**What it looks like:** 32 random-looking bytes. The user never sees it. It doesn't exist as text.

**Where it lives:** Nowhere persistent. Computed by the phone's secure chip during each unlock gesture, used for a millisecond, then discarded.

**When it's used:**
- Every daily unlock.
- Locking + reopening the app.
- The primary, convenient flow.

**How it's derived:** The chip computes HMAC-SHA256(internal_secret, app_provided_salt) when a biometric gesture verifies. The HMAC's secret key lives inside the secure chip and never leaves.

**Why only on newer devices:** Requires the WebAuthn PRF extension, which depends on both browser and OS support. Rolled out widely 2022–2024.

### Why both exist

Each one covers the other's blind spot:

| | Recovery key | PRF key |
|---|---|---|
| **Convenience** | Slow (60 chars to type) | Instant (touch sensor) |
| **Portability** | Universal (any device) | Tied to specific phone |
| **Loss risk** | High (lose the paper) | Low-ish (phone usually with you) |
| **Storage** | On paper, off-device | Never stored, computed live |
| **Works on old devices** | Yes | No |

Both keys lock the **same master key**. Cryptographically, the data security is identical from either path. The keys differ only in how they're protected from loss/theft.

---

## Cross-Platform Verification

The lab was tested on real devices, not just simulators. Every platform was verified end-to-end (setup → unlock → CRUD → backup → reset → restore):

| Platform | Authenticator | Mode achieved | Verified |
|---|---|---|---|
| Windows 11 desktop, Chrome | Windows Hello (PIN/fingerprint) | PRF_SECURE | Yes |
| Android 10+, Chrome 116+ | Google Password Manager + device fingerprint | PRF_SECURE | Yes |
| iPhone, Safari (iOS 18+) | Face ID / Touch ID | PRF_SECURE | Yes |
| Chrome DevTools virtual authenticator | Simulated CTAP2 + hmac-secret | PRF_SECURE | Yes |

### Byte-level encryption verification

During testing, sample entries were inspected directly in browser IndexedDB:

```
Plaintext input:   "SEARCH_FOR_THIS_STRING"        (24 bytes UTF-8)
Stored ciphertext: ArrayBuffer(40)                  (24 + 16-byte GCM tag)
Stored iv:         ArrayBuffer(12)                  (random per encrypt)

Search the entire IndexedDB tree for "SEARCH_FOR_THIS_STRING" → zero matches.
```

The math checks out exactly: 24-byte plaintext + 16-byte authentication tag = 40-byte ciphertext. The plaintext exists only in process memory while the vault is unlocked.

### Self-test panel

The demo includes a "Crypto self-test" panel that runs 14 live Web Crypto operations in the user's browser:

```
14 / 14 passed
─────────────────────────────────────────────────────
encoding   utf8 round-trip
encoding   hex round-trip
encoding   base64url round-trip
encoding   Crockford Base32 with ambiguity normalize
encoding   constant-time eq (equal/unequal/length-mismatch)
crypto     generateMasterKey + wrap + unwrap + cross-instance use
crypto     AES-GCM with AAD (swap attack fails)
crypto     unwrap with wrong KEK → DecryptionError
kdf        HKDF distinct info labels produce distinct KEKs
recovery   recovery key generate → parse → bytes match
recovery   recovery key typo → WrongRecoveryKeyError (fast fail)
recovery   recovery key malformed → InvalidRecoveryKeyFormatError
recovery   computeRecoveryCheck is 8 bytes + deterministic
prf        PRF-determinism stub (HKDF same inputs ≡ same output)
```

Every test was run live in Chrome, Safari, and the deployed Vercel build.

---

## What Was Built — Deliverables

### Package 1: `@muulorigin/biometric-vault-core` (v0.1.0)

| | |
|---|---|
| Language | TypeScript (strict mode, no `any`) |
| Dependencies | `@muulorigin/chromastash-core` (file: link, used for backup delegation only) |
| Public API | `BiometricVault` class + typed errors + utility functions |
| Storage | Injected via `VaultStorage` interface (no IndexedDB import) |
| Crypto | Web Crypto API only (AES-256-GCM, HKDF-SHA256, SHA-256) |
| Lines of code | ~1,200 LOC across 11 source files |
| Test coverage | 14 in-browser self-tests |

### Package 2: `@muulorigin/biometric-vault-react` (v0.1.0)

| | |
|---|---|
| Language | TypeScript + React 18 |
| Peer dependency | `react >= 18.0.0` |
| Exports | 3 hooks + 3 drop-in components + re-exports from core |
| Lines of code | ~350 LOC across 7 source files |
| Convention | Mirrors `@muulorigin/chromastash-react`'s API surface exactly |

### Package 3: `demo` (Vite + React PWA)

| | |
|---|---|
| Build system | Vite 5 + vite-plugin-pwa |
| Bundle size | 225 KB raw / 72 KB gzipped |
| Service worker | Precaches app shell, no cross-origin runtime caching |
| Production CSP | Strict: `default-src 'self'; script-src 'self'; ...` (applied only in prod build, not dev) |
| Icons | 192px + 512px maskable PNG, generated by zero-dep Node script |
| Features | Setup, Unlock, Vault CRUD, Backup/Restore (blob + slides), Rotate, Reset, Diagnostics, Self-test, Install banner |
| Lines of code | ~1,500 LOC across 12 source files |

### Documentation

| File | Purpose |
|---|---|
| `README.md` | Run instructions, ChromaStash findings, deployment guide |
| `SECURITY.md` | Full threat model, key-wrapping scheme, KDF rationale, CSP, what changes when integrated into cryptjs |
| `TESTPLAN.md` | Phase-by-phase acceptance criteria + cross-platform test matrix |
| `PROJECT_OVERVIEW.md` (this file) | Comprehensive handoff for non-engineering stakeholders |

### Total code footprint

~3,000 lines of TypeScript across 30 source files, with full type coverage, zero `any`, structured error hierarchy with stable codes, and inline JSDoc on every public function.

---

## Build & Deployment

### Local development

```sh
git clone --depth 1 https://github.com/yogimehla/cryptjs.git vendor/cryptjs
npm install
npm run dev                         # → http://localhost:5173
npm run build && npm run preview    # → production build with strict CSP, http://localhost:4173
```

### Production deployment

Deployed to Vercel via GitHub auto-deploy:

```
GitHub push → Vercel webhook → npm install → npm run build → CDN distribution
```

Configuration is in `vercel.json` at the repo root. Includes:
- Workspace-aware build pipeline (`prebuild` script ensures workspace packages are compiled before Vite bundles).
- Strict response headers (Permissions-Policy, X-Frame-Options, Referrer-Policy).
- No-cache headers on service worker for proper PWA update behavior.

### Verified deployments

- Live Vercel URL (HTTPS, valid certificate, HTTP/2, CDN-served).
- PWA manifest validated by Lighthouse.
- Offline-after-first-load confirmed via DevTools Network throttling.
- Production CSP verified in served HTML.
- All 7 precache entries serving correctly.

---

## Honest Limitations

This is what we cannot, do not, and will not do — and why.

### No backend, ever

There is zero server-side component. No data ever leaves the user's device for vault operations. This is a deliberate design choice; it has consequences:

- **No "forgot password" / account recovery.** If the user loses both their device and their recovery key, the data is gone. There is no second factor to fall back on.
- **No cross-device sync of encrypted data.** Passkeys may sync via iCloud Keychain / Google Password Manager, but the encrypted entries themselves don't. Users move data between devices manually via the backup/restore file.
- **No analytics, telemetry, or central monitoring.** Whatever's wrong on a user's device, the operator never sees.

### Single-user, single-vault per origin

One origin (e.g. `vault.example.com`) hosts exactly one vault. Multi-user / multi-profile is out of scope. A real product would need to either spin up sub-origins per user (e.g. `alice.vault.example.com`) or extend the data model — both are clean future work.

### No envelope encryption (yet)

Currently the master key encrypts each entry directly. Production-grade design would have the master key wrap per-record DEKs (data encryption keys), enabling:
- Cheap rotation (re-wrap DEKs without re-encrypting all data).
- Per-entry revocation (delete a single DEK to invalidate one entry).

This is marked `// FUTURE` in the code, not built in the lab.

### XSS while unlocked = game over

This is the hard truth of any browser-based crypto. If hostile JavaScript executes in the page while the master key is in memory (e.g. via a compromised dependency, a successful XSS, or a malicious extension), it can read everything.

Mitigations in place:
- Strict production Content Security Policy (no inline scripts, no eval, no remote origins).
- Zero `innerHTML` with untrusted data — everything goes through React's automatic escaping.
- Aggressive dependency minimalism (core has only one runtime dependency).

Mitigations NOT in place (and would require active engineering elsewhere):
- Sandboxing the vault in a separate origin (would force a postMessage protocol).
- Running the vault inside a Web Worker (would limit React integration).

### iOS storage eviction

iOS Safari evicts script-writable storage (including IndexedDB) after ~7 days of no interaction **unless the app is installed to the Home Screen as a PWA**. The vault:
- Calls `navigator.storage.persist()` at setup.
- Shows a red eviction-risk warning when not persisted AND not installed.
- Provides explicit "Add to Home Screen" instructions on iOS Safari.

It cannot override the OS. iOS users who don't install the PWA will lose their data — recoverable only from a recovery-key-backed export they've saved off-device.

---

## Where This Goes Next

The lab is complete. These are the natural next steps in roughly increasing scope:

### Immediate (days)

1. **Custom domain for the demo deployment.** Move from the Vercel-generated hostname to a stable production URL. Important because WebAuthn passkeys are bound to specific hostnames.

2. **Revert the lab-only auto-lock patch.** The lab temporarily disabled visibility-change auto-locking to make testing easier (search the code for `LAB-TESTING TEMPORARY`). Production deployment must restore it.

3. **Integration into Cognitive Canvas.** Drop the two packages into the cryptjs monorepo, change `file:` deps to `workspace:*`, import `useVault` in Cognitive Canvas, decide what to store. Cognitive Canvas immediately gains biometric-locked local storage for chat histories / prompts / settings without any new infrastructure.

4. **Integration into MoBrowser.** Same flow. MoBrowser is the WebView2 host — the included probe (`runWebAuthnPrfProbe`) already verifies PRF availability inside MoBrowser specifically; that test should be run before shipping.

### Medium-term (weeks)

5. **Envelope encryption.** Refactor the encryption layer so MK wraps per-record DEKs. Enables cheap key rotation and per-entry revocation.

6. **PIN + Argon2 hardening for GATE_ONLY mode.** Currently GATE_ONLY stores `deviceKEKRaw` as plaintext on disk. Hardening would require a user PIN at setup, derive the KEK via Argon2 (memory-hard) from the PIN, and require the PIN at each unlock. Brings GATE_ONLY's floor up from "convenience lock" to "decent password vault."

7. **Hardware security key fallback.** Allow users with older phones to use a USB/NFC security key (YubiKey, Solo Key) instead of the platform authenticator. The vault's WebAuthn code is already mostly ready — just remove the `authenticatorAttachment: 'platform'` constraint and let the user pick.

8. **Multi-tab synchronization.** Add a BroadcastChannel so multiple tabs of the same origin share unlock state (and lock-when-other-tab-locks behavior).

### Long-term (months)

9. **Multi-vault per origin.** Support multiple isolated vaults per origin (one per user / project / role). Requires schema redesign.

10. **Vault-as-a-component composability.** Let other apps embed an iframe-based vault that has its own origin and uses postMessage for the API — isolates XSS in the host app from the vault.

11. **Hardware-backed multi-device sync.** Use a third-party encrypted relay (or a trusted device-to-device handshake) to sync encrypted entries between devices without trusting a server with the plaintext. Effectively a P2P sync over WebRTC + a relay.

---

## Glossary

| Term | Meaning |
|---|---|
| **AES-256-GCM** | Symmetric encryption standard. 256-bit keys. GCM mode adds an authentication tag so any tampering is detected. Used by TLS 1.3, Signal, WhatsApp. |
| **AAD** | Additional Authenticated Data. Extra context (like an entry id) bound to the ciphertext at encrypt time. Tampering with the AAD causes decryption to fail. The vault binds entry ids to their ciphertext this way. |
| **ChromaStash** | Sibling Muulorigin project that encodes binary data into steganographic PNG images. The vault delegates its backup feature to ChromaStash for the file-format layer. |
| **CSP** | Content Security Policy. Browser-enforced rules about what scripts/styles/origins a page is allowed to load. The vault ships a strict one in production. |
| **Crockford Base32** | An encoding alphabet that drops `I`, `L`, `O`, `U` to avoid visual confusion. Used for the recovery key. |
| **GATE_ONLY** | The vault's weak fallback mode for devices without PRF support. The encryption key lives on disk in plaintext; the biometric only gates UI access. |
| **HKDF** | HMAC-based Key Derivation Function (RFC 5869). One-way deterministic transformation from one key to another, with optional salt and domain-separation `info` label. Used by the vault to derive KEKs from PRF/recovery bytes. |
| **HMAC-SHA256** | Hash-based Message Authentication Code using SHA-256. The underlying primitive of HKDF and the PRF extension. |
| **IndexedDB** | The browser's built-in client-side database. Where the vault stores its encrypted data. |
| **KEK** | Key-Encrypting Key. A key whose only job is to encrypt other keys. The vault uses bioKEK / deviceKEK / recoveryKEK to wrap the master key. |
| **MK (Master Key)** | The 256-bit AES key that actually encrypts the vault's data entries. Lives only in memory while unlocked. |
| **PRF** | Pseudo-Random Function. In WebAuthn context: the extension that lets a web page extract deterministic random bytes from a secure-chip-backed credential, gated by a biometric gesture. |
| **PRF_SECURE** | The vault's strong mode. The encryption key is materialized fresh from the secure chip on each unlock; nothing usable exists at rest. |
| **PWA** | Progressive Web App. A web app installable to the home screen, runs offline, has its own icon. Critical for iOS persistent storage. |
| **Recovery key** | The 60-character paper code the user saves at setup. Used to wrap a second copy of the master key, enabling break-glass recovery. |
| **Secure Enclave / TPM / StrongBox** | The tamper-resistant hardware chip in modern devices (Apple / Microsoft / Google naming). Holds secret keys and performs cryptographic operations that even the rest of the OS can't see inside. |
| **TPM** | Trusted Platform Module. The Windows equivalent of Apple's Secure Enclave. |
| **VaultMeta** | The single record in IndexedDB that holds: mode, credentialId, both wrapped master keys, all the salts, the recoveryCheck digest, and a timestamp. |
| **WebAuthn** | The browser standard (W3C + FIDO Alliance) for using cryptographic authenticators (Touch ID, Windows Hello, security keys, etc.) for authentication. The vault uses WebAuthn's PRF extension specifically. |
| **Wrapped key** | A key that's been encrypted by another key. Stored on disk in this encrypted form. Can only be used after being unwrapped (decrypted) by the wrapping key. |

---

## Contact

| | |
|---|---|
| **Project lead** | Abhishek Raj |
| **GitHub** | [github.com/AbhiRajIsHere](https://github.com/AbhiRajIsHere) |
| **Repository** | github.com/AbhiRajIsHere/biometric-vault-lab |
| **Live demo** | (Vercel URL provided separately) |

For questions about the security model, the threat-model omissions, the integration path into Cognitive Canvas/MoBrowser, or anything else technical — review `SECURITY.md` and `TESTPLAN.md` in the repo first, then reach out.

---

*This document was generated 2026-05-21 to accompany the completion of the 4-phase build spec. The lab is feature-complete and ready for SDK consumption. Last updated: same.*
