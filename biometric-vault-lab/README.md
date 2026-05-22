# biometric-vault-lab

Throwaway-safe laboratory for a **biometric-only, frontend-only, offline-first local vault**. Sibling to the [`@muulorigin/chromastash-sdk`](https://github.com/yogimehla/cryptjs) monorepo and built to drop into it cleanly.

The vault lets a user unlock and decrypt local data using **only their device biometric** (Face ID / Touch ID / Windows Hello / Android fingerprint). **No username, no password, no backend, no network calls for auth or data.** A one-time **recovery key** is the only break-glass mechanism, and it doubles as the secret for an off-device ChromaStash backup.

> **All four phases complete.** The lab is feature-complete and ready to drop into the cryptjs monorepo as a sibling pair of workspace packages.

---

## Packages

| Package | Purpose |
|---|---|
| `@muulorigin/biometric-vault-core` | Pure TypeScript core. Zero framework deps. Uses Web Crypto only. Storage injected via interface. |
| `@muulorigin/biometric-vault-react` | Thin React wrapper: hooks + drop-in components. |
| `demo` | Vite + React PWA harness with the `IndexedDbStorage` adapter. |

## ChromaStash dependency — findings (Phase 1 task)

Inspected `https://github.com/yogimehla/cryptjs` (not on the public npm registry). `@muulorigin/chromastash-core` v1.0.0 exports:

**Codec** — `encode(data, options?, onProgress?, logger?)`, `decode(slides, options?, onProgress?, logger?)`, `estimateSlides`, `CODEC_VERSION`, `DEFAULTS`, `AVAILABLE_PATTERNS`, `DEFAULT_CONFIG`.

**Crypto** — `aesEncrypt(plaintext: Uint8Array, passphrase: string): Promise<Uint8Array>` (PBKDF2-100k internally; output = 16-byte salt | 12-byte IV | ciphertext+tag), `aesDecrypt(...)`, `AES_GCM_OVERHEAD_BYTES`.

**Utils** — `sha256(buffer: ArrayBuffer): Promise<string>` (hex string), `detectCorners`, `perspectiveCorrect`, `scramble`, `unscramble`.

**Types/consts** — `EncryptionMethod`, `EncodeOptions`, `EncodeResult`, `DecodeOptions`, `DecodeResult`, `ChromaMetadata`, `SlidePattern`, `ProgressCallback`, `Logger`, `ChromaConfig`, `CornerPoints`.

### What this means for the vault
- The off-device backup (`exportEncrypted`/`importEncrypted`) **delegates to** ChromaStash `encode`/`decode` with `encryption:'aes-256-gcm'` and `secretKey = <recovery key>`. This is the PBKDF2-100k path the spec earmarks for ecosystem interop.
- ChromaStash exposes **passphrase-based** AES, not **raw-key** AES. The vault's daily-use crypto (wrap/unwrap a 256-bit master key by a 256-bit KEK, HKDF derivation, AES-GCM with externally supplied IV) is implemented locally in `biometric-vault-core/src/crypto.ts` using Web Crypto's `subtle.wrapKey`/`unwrapKey`/`deriveKey`. ChromaStash's primitives are NOT a fit for the wrap/unwrap path; this is by design.
- ChromaStash `sha256(buffer)` returns a hex string — we can reuse it for `recoveryCheck` digests and self-tests; we still implement a raw-bytes hash helper locally for IVs/AAD comparisons.

### How the vault depends on ChromaStash
`@muulorigin/biometric-vault-core` lists `"@muulorigin/chromastash-core": "file:../../vendor/cryptjs/packages/chromastash-core"`. The setup script clones `yogimehla/cryptjs` into `vendor/cryptjs` and uses its pre-built `dist/`. When these packages are copied into the cryptjs monorepo proper, change the dep to `workspace:*` and remove the `vendor/` clone — nothing else changes.

The integration touches one path: `BiometricVault.exportEncrypted` / `importEncrypted` call ChromaStash's `encode`/`decode`/`encrypt`/`decrypt` with `secretKey = <recovery key>`. Daily-use crypto (MK gen / wrap / unwrap / per-entry AES-GCM with AAD) is local to `biometric-vault-core` and does NOT go through ChromaStash — different threat model (raw-key vs passphrase) demands different primitives.

## Run

Run from the repo root. If `vendor/cryptjs` is empty, clone it first; otherwise just install:

```sh
git clone --depth 1 https://github.com/yogimehla/cryptjs.git vendor/cryptjs
npm install
```

Then choose dev or prod:

```sh
npm run dev
```

Starts the demo PWA at `http://localhost:5173` with HMR. No CSP in dev (Vite HMR uses inline scripts).

```sh
npm run build
npm run preview
```

Production build with the strict CSP injected into `index.html`, served at `http://localhost:4173`.

> **Windows cmd.exe note:** lines with inline `# comments` will be parsed as commands by `cmd.exe` and `cmd`-style shells — paste each command on its own line, without trailing comments.

For **iOS device testing** you need real HTTPS — `localhost` only covers desktop dev, and LAN-IP `http://` silently breaks WebAuthn on iOS. Serve the prod build over HTTPS (`npm run preview` behind a TLS reverse proxy) or use a tunnel.

### Deploying to Vercel

The repo includes a `vercel.json` with the build command, output directory, and a few production headers (Permissions-Policy for WebAuthn, no-cache for the service worker, frame-ancestors-style denial). To deploy:

1. Push the repo to GitHub.
2. https://vercel.com → Add New → Project → import the repo.
3. **Don't override any settings** — the `vercel.json` config supplies everything.
4. Deploy. Vercel runs `npm install` (which links `vendor/cryptjs/packages/chromastash-core` via the `file:` dep), then `npm run build` (compiles core → react → demo), then publishes `packages/demo/dist`.

**Note on passkeys:** WebAuthn passkeys are bound to the exact hostname. A passkey registered on a Vercel preview URL (e.g. `https://...-git-feature.vercel.app`) will not work on the production URL. If you intend to keep data long-term, set up your custom domain *first* and create the vault on that domain.

### Regenerating the PWA icons

```sh
npm run -w demo icons
```

Writes 192- and 512-px PNG into `packages/demo/public/icons`. The script is dependency-free (Node `zlib` + manual PNG chunks). Replace with proper branded icons before any production deployment.

## Layout

```
biometric-vault-lab/
├── package.json                   # workspaces: packages/*
├── tsconfig.base.json
├── README.md  SECURITY.md  TESTPLAN.md
└── packages/
    ├── biometric-vault-core/      # pure TS, Web Crypto only
    ├── biometric-vault-react/     # hooks + drop-in components
    └── demo/                      # Vite + React PWA harness
```

## Phased build plan

1. **Phase 1 ✅** — Monorepo scaffold, typed stubs, real `detectCapabilities()`, IndexedDB adapter, Diagnostics screen.
2. **Phase 2 ✅** — Crypto / KDF / recovery + in-app self-test panel (live AES-GCM wrap/unwrap, HKDF, recovery key encode/parse/checksum, PRF-determinism stub).
3. **Phase 3 ✅** — WebAuthn (PRF + UV-gate, one-prompt PRF optimization, discoverable recovery), `BiometricVault` orchestrator, both unlock paths, CRUD with AAD-bound entries, auto-lock with subscribe API, Setup/Unlock/Vault/Reset screens.
4. **Phase 4 ✅** — ChromaStash `exportEncrypted`/`importEncrypted` (blob + slides) keyed by recovery key, `rotateRecoveryKey`, install banner + iOS A2HS, production-only CSP, generated maskable PWA icons, live WebView2/PRF probe, final docs pass.

Each phase ends in a `STOP` point for manual review per the build spec.

## License

MIT — Muulorigin
