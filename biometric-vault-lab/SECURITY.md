# SECURITY.md — biometric-vault-lab

> This is a **laboratory project**. It exists to prove out the model before any of it touches production. Read this whole file before drawing conclusions from the demo.

## Core principle

**Biometric does not "log the user in" — it materializes the AES key that makes encrypted local data readable.** There is no boolean `isUnlocked` flag that, if flipped, exposes plaintext. If an attacker bypasses the JS layer, all they find in storage is ciphertext plus wrapped keys with no usable plaintext key material at rest (in `PRF_SECURE` mode).

## Two operating modes

The vault runs in one of two modes, decided at setup based on platform capability.

### Mode A — `PRF_SECURE` (WebAuthn PRF extension available)

Biometric gates the authenticator's PRF output → HKDF derives a key-encryption-key (`bioKEK`) → the master key (MK) is unwrapped into memory only after a successful UV gesture. The master key never exists at rest.

**Protects against:**
- Device theft (passkey can't be exercised without a biometric/UV gesture).
- Casual access by a roommate/coworker/spouse.
- Storage inspection (IndexedDB exfiltration yields only wrapped keys + ciphertext).

**Does not protect against:**
- Live XSS in the unlocked page (the MK lives in memory; XSS sees plaintext).
- A compromised platform authenticator (e.g. malicious Secure Enclave firmware).
- A coerced user (rubber-hose attack).
- Memory inspection / debugger attached while unlocked.

### Mode B — `GATE_ONLY` (no PRF, e.g. iOS < 18)

Biometric is **only a UI/authorization gate**. The key-encryption-key (`deviceKEK`) must be stored on-device in IndexedDB, so the master key is effectively recoverable from storage by anyone with device-level access.

**This is a convenience lock, not a security boundary.**

The mode badge in Diagnostics is **amber** with that exact phrase. Setup gates on user acknowledgement before completing. Never present `GATE_ONLY` as secure.

## Critical honesty fix — "biometric" is really "user verification"

Platform authenticators satisfy `userVerification: 'required'` with biometric **or** a device PIN/passcode. So the real guarantee the OS makes is "device + a UV gesture," not strictly "device + finger." If a teammate has the device PIN they can unlock the vault on iOS / Windows Hello / Android even without ever scanning the registered user's fingerprint or face. This changes how the guarantee is sold internally.

## XSS is game over (both modes, while unlocked)

Mitigations baked in:
- **Strict CSP in production** (no `unsafe-inline` script, no `unsafe-eval`, no remote origins). Dev build relaxes this for Vite HMR — see §12 of the build spec.
- No `innerHTML` with untrusted data. Component output is always React-escaped.
- No `eval`, no `new Function`.
- Aggressive dependency minimalism: core has zero dependencies beyond `@muulorigin/chromastash-core` (Phase 4+); demo adds only `react`, `react-dom`, `idb`, `vite-plugin-pwa`.

## Recovery key — single point of catastrophe (both directions)

The recovery key is a 32-byte random secret presented once as a Crockford Base32 string with a built-in checksum.

- **Lose it + lose device → data is permanently unrecoverable.** No backend means no reset path.
- **Anyone with it can decrypt the vault and restore an off-device backup.** Treat it like a hardware wallet seed phrase: write it down, don't photograph it, don't paste it into a notes app that syncs.
- Shown **once** at setup. Never persisted in plaintext. Never logged. Not retrievable later.
- Stored in vault metadata only as a short hash (`recoveryCheck`) so typed input can be validated before any AES-GCM unwrap attempt.

## iOS storage eviction (the silent killer)

iOS evicts script-writable storage (IndexedDB included) after ~7 days of no interaction **unless the app is installed to the Home Screen**.

Without a backend, eviction = permanent data loss. The app must:
1. Call `navigator.storage.persist()` at setup and again on demand.
2. Strongly drive Home-Screen install (iOS has no `beforeinstallprompt` — the UI must show share-icon steps).
3. Surface both states in Diagnostics, with a red warning when *not persisted AND not installed*: "data may be evicted in ~7 days — install to Home Screen and keep your recovery key + an encrypted export."

## Key-wrapping scheme

```
                       master key (MK)  — 256-bit random, AES-GCM
                       │
        ┌──────────────┼───────────────────┐
        │              │                   │
   bioKEK            (or)              recoveryKEK
   (PRF→HKDF)        deviceKEK         (secret→HKDF)
   PRF_SECURE only   GATE_ONLY only    always
        │              │                   │
   bioWrappedMK    deviceWrappedMK    recoveryWrappedMK
   (stored)        (stored)            (stored)
```

- Two **independent** wrapped copies of MK live side by side. Daily-use path (biometric/device) and break-glass path (recovery) yield the *same* MK.
- The biometric path goes away on PRF_SECURE devices if the user loses their passkey; the recovery copy survives. Recovery alone cannot resurrect a totally evicted IndexedDB — that's what the ChromaStash export is for.

**Envelope-encryption upgrade for production (deliberately not built in the lab):** MK should wrap per-record DEKs rather than encrypting entries directly, enabling cheap key rotation and per-entry revocation. Marked `// FUTURE` in code.

## KDF choices and why

- **HKDF-SHA256** for PRF→KEK and recovery→KEK. Both inputs are full-entropy key material (32-byte PRF output; 32-byte random recovery secret). PBKDF2's iteration stretching exists for low-entropy human passwords and would add cost for no benefit.
- **PBKDF2-100k** appears **only** on the ChromaStash export path (`exportEncrypted` / `importEncrypted`), where the recovery key is intentionally treated as a passphrase for ecosystem interop with ChromaStash artifacts.

## Single-user, single-vault per origin

Multi-profile is explicitly out of scope for this lab. The vault state is keyed by the origin's IndexedDB database — one origin, one vault.

## What goes in storage (and what does not)

In IndexedDB the vault stores ONLY:
- Wrapped master keys (`bioWrappedMK`, `recoveryWrappedMK`, optionally `deviceWrappedMK`).
- HKDF salts (`bioHkdfSalt`, `recoveryHkdfSalt`, `prfSalt`) — non-secret by design.
- `recoveryCheck` — short hash of the recovery secret for typo validation.
- `credentialId` — non-secret WebAuthn handle.
- (`GATE_ONLY` only) `deviceKEKRaw` — plaintext KEK bytes. Insecure by design; flagged in the UI.
- Per-entry ciphertext + IV + `updatedAt`.

The following are **never** stored or logged:
- Plaintext master key.
- PRF output bytes.
- Recovery key in any form except its short hash (`recoveryCheck`).
- User entry plaintext outside the in-memory unlocked session.

## Out of scope (deliberately)

- Backend, cloud, server-side anything.
- Multi-user / multi-profile per origin.
- Cross-origin data sharing.
- Cross-device sync of *encrypted entries* (passkeys sync on iCloud Keychain, ciphertext does not — see ChromaStash export for cross-device continuity).
- Side-channel hardening (timing, power, EM).
- Defence against compromised platform authenticators.

## Threat-model rating

Use the same prose every time in user-facing docs:

> **PRF_SECURE** — real local encryption. Resists device theft and storage exfiltration; does not resist live XSS or a coerced user. ✅ green badge.
>
> **GATE_ONLY** — convenience lock only. Encryption key is recoverable from storage; treat as on par with an unencrypted note app behind a screen lock. ⚠️ amber badge.

## Backup artifact threat model (Phase 4)

The off-device backup is **recovery-key gated** and inherits that key's risk profile.

What goes into a `.bvbk` blob (or set of PNG slides):

- `VaultMeta`, minus `deviceKEKRaw` and `deviceWrappedMK`. The plaintext device KEK never leaves the device under any circumstance — it's a convenience-mode artifact, not a portable secret.
- Every encrypted entry (id, iv, ciphertext, updatedAt). The entries are already at-rest ciphertext; the backup wraps them under PBKDF2-100k + AES-256-GCM via ChromaStash, keyed by the recovery key.
- The non-secret salts and `recoveryCheck`. Anyone with the recovery key can verify a backup is theirs without decrypting it.

What does NOT go in:

- The biometric authenticator's private key (the platform owns this).
- `deviceKEKRaw` (GATE_ONLY mode's plaintext KEK).
- The recovery key itself.
- Anything from the unlocked session (the master key is materialized in memory only).

**Anyone with the recovery key + the backup can fully reconstitute the vault.** Treat the two together the way you'd treat a hardware-wallet seed phrase + an offline backup of the wallet file. Storing them in the same cloud location undoes the threat-model split.

**After import the vault is UNLOCKED** — the recovery key has just produced a working master key. The biometric path may or may not work on the new device (the original `credentialId` only resolves if the passkey is synced via iCloud Keychain or Google Password Manager). If not, the user should `reset()` and `setup()` to register a fresh passkey, which re-wraps MK under a new `bioKEK`.

## CSP (production)

Applied only to the production bundle (`vite build`):

```
default-src 'self';
script-src 'self';
style-src 'self' 'unsafe-inline';
img-src 'self' data:;
font-src 'self';
connect-src 'self';
object-src 'none';
base-uri 'none';
frame-ancestors 'none';
form-action 'none';
```

To remove `style-src 'unsafe-inline'`, move every remaining inline `style={...}` prop in the demo into `styles.css`. None of the inline styles in the current code carry user input — they're static layout — so the risk is small, but the hardening is straightforward.

## What changes when dropped into the cryptjs monorepo

- Change `@muulorigin/biometric-vault-core`'s dep on `@muulorigin/chromastash-core` from `file:../../vendor/cryptjs/...` to `workspace:*`.
- Delete `vendor/cryptjs`.
- The two packages (`biometric-vault-core` and `biometric-vault-react`) drop into `packages/` alongside `chromastash-core` and `chromastash-react`. The demo package stays here as the lab harness.

Everything else — the SECURITY model, the key-wrapping scheme, the backup format — is unchanged.
