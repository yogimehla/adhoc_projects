/**
 * WebAuthn integration: discoverable platform passkey + PRF extension.
 *
 * Three operations the vault needs:
 *  - register() — first-time platform-authenticator registration; returns
 *    credentialId and (if the platform returned PRF on create()) PRF bytes.
 *  - getPrfOutput() — PRF assert against an existing credentialId.
 *  - assertPresence() — UV-only gate for GATE_ONLY mode (no PRF requested).
 *  - getPrfOutputDiscoverable() — empty allowCredentials variant, used when
 *    credentialId has been lost but the passkey is still synced.
 *
 * One-prompt PRF optimization: at setup() we first inspect the result of
 * create(). Safari/WebKit return PRF bytes on create when the extension
 * was requested in `eval`. Chromium typically does NOT — it requires a
 * follow-up get(). The orchestrator (vault.ts) reads `prfBytes` here, and
 * only calls getPrfOutput() if it's undefined. Saves one UV prompt on
 * Safari/Touch ID and iOS Home-Screen vault setup.
 */

import {
  InsecureContextError,
  PlatformAuthenticatorUnavailableError,
  VaultError,
  WebAuthnUnsupportedError,
  mapWebAuthnError,
} from './errors.js';
import { randomBytes } from './crypto.js';

const RP_NAME = 'Biometric Vault Lab';
const VAULT_USER_NAME = 'vault-user';
const VAULT_USER_DISPLAY = 'Vault User';
const WEBAUTHN_TIMEOUT_MS = 60_000;

export interface RegisterResult {
  credentialId: ArrayBuffer;
  /** Present when the platform returned PRF on create() (Safari/WebKit). */
  prfBytes?: ArrayBuffer;
}

/**
 * Preflight: throws a typed VaultError if WebAuthn cannot be used here.
 * Cheap, idempotent, never prompts the user.
 */
async function preflight(): Promise<void> {
  if (typeof window === 'undefined' || !window.isSecureContext) {
    throw new InsecureContextError();
  }
  if (typeof window.PublicKeyCredential === 'undefined') {
    throw new WebAuthnUnsupportedError();
  }
  const available =
    typeof window.PublicKeyCredential
      .isUserVerifyingPlatformAuthenticatorAvailable === 'function' &&
    (await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable());
  if (!available) {
    throw new PlatformAuthenticatorUnavailableError();
  }
}

/**
 * Register a new discoverable platform passkey with PRF extension requested.
 *
 * `prfSalt` is the input to the authenticator's PRF — the same salt MUST be
 * passed to getPrfOutput() at every subsequent unlock or the PRF output
 * will differ and the master key won't unwrap. It is non-secret; persist
 * alongside VaultMeta.
 *
 * Discoverable (resident) credential: the user never types a username.
 * The internal user.id handle is random and not shown anywhere.
 */
export async function register(prfSalt: ArrayBuffer): Promise<RegisterResult> {
  await preflight();
  const challenge = randomBytes(32);
  const userHandle = randomBytes(16);

  const options: CredentialCreationOptions = {
    publicKey: {
      challenge,
      rp: { name: RP_NAME }, // rp.id defaults to current origin
      user: {
        id: userHandle,
        name: VAULT_USER_NAME,
        displayName: VAULT_USER_DISPLAY,
      },
      pubKeyCredParams: [
        { type: 'public-key', alg: -7 }, // ES256
        { type: 'public-key', alg: -257 }, // RS256
      ],
      authenticatorSelection: {
        authenticatorAttachment: 'platform',
        residentKey: 'required',
        requireResidentKey: true,
        userVerification: 'required',
      },
      timeout: WEBAUTHN_TIMEOUT_MS,
      attestation: 'none',
      extensions: {
        // The TS lib types lag spec-level PRF; cast through `any` once at the boundary.
        prf: { eval: { first: prfSalt } },
      } as AuthenticationExtensionsClientInputs & {
        prf: { eval: { first: ArrayBuffer } };
      },
    },
  };

  let credential: PublicKeyCredential | null;
  try {
    credential = (await navigator.credentials.create(options)) as PublicKeyCredential | null;
  } catch (err) {
    throw mapWebAuthnError(err);
  }
  if (!credential) {
    throw new VaultError('USER_CANCELLED', 'navigator.credentials.create() returned null');
  }

  const credentialId = credential.rawId;

  // One-prompt PRF read: Safari typically returns PRF on create() when
  // requested in `eval`. Chromium typically does not.
  const prfBytes = readPrfFirst(credential);

  return prfBytes ? { credentialId, prfBytes } : { credentialId };
}

/**
 * Assert against an existing credential AND extract PRF output. Returns
 * `undefined` if the platform did not return PRF this time (treat as
 * PRF unavailable for this device → GATE_ONLY).
 */
export async function getPrfOutput(
  credentialId: ArrayBuffer,
  prfSalt: ArrayBuffer,
): Promise<ArrayBuffer | undefined> {
  await preflight();
  const challenge = randomBytes(32);

  const options: CredentialRequestOptions = {
    publicKey: {
      challenge,
      allowCredentials: [{ id: credentialId, type: 'public-key' }],
      userVerification: 'required',
      timeout: WEBAUTHN_TIMEOUT_MS,
      extensions: {
        prf: { eval: { first: prfSalt } },
      } as AuthenticationExtensionsClientInputs & {
        prf: { eval: { first: ArrayBuffer } };
      },
    },
  };

  let assertion: PublicKeyCredential | null;
  try {
    assertion = (await navigator.credentials.get(options)) as PublicKeyCredential | null;
  } catch (err) {
    throw mapWebAuthnError(err);
  }
  if (!assertion) {
    throw new VaultError('USER_CANCELLED', 'navigator.credentials.get() returned null');
  }

  return readPrfFirst(assertion);
}

/**
 * UV-only gate for GATE_ONLY mode. Verifies the user passed the platform
 * authenticator's user-verification check (biometric or device PIN). Does
 * NOT request PRF and does NOT return key material — the caller still
 * needs the locally-stored `deviceKEKRaw` to derive the KEK.
 *
 * Throws UserCancelledError on cancellation/timeout, never silently
 * succeeds without UV.
 */
export async function assertPresence(credentialId: ArrayBuffer): Promise<void> {
  await preflight();
  const challenge = randomBytes(32);

  const options: CredentialRequestOptions = {
    publicKey: {
      challenge,
      allowCredentials: [{ id: credentialId, type: 'public-key' }],
      userVerification: 'required',
      timeout: WEBAUTHN_TIMEOUT_MS,
    },
  };

  let assertion: PublicKeyCredential | null;
  try {
    assertion = (await navigator.credentials.get(options)) as PublicKeyCredential | null;
  } catch (err) {
    throw mapWebAuthnError(err);
  }
  if (!assertion) {
    throw new VaultError('USER_CANCELLED', 'navigator.credentials.get() returned null');
  }
}

/**
 * Discoverable assert (empty allowCredentials). Used for recovery when the
 * stored credentialId is gone (IndexedDB partially wiped or restored from
 * a different device) but the passkey is still synced via iCloud Keychain
 * or Google Password Manager. The browser shows a passkey picker.
 */
export async function getPrfOutputDiscoverable(prfSalt: ArrayBuffer): Promise<{
  credentialId: ArrayBuffer;
  prfBytes?: ArrayBuffer;
}> {
  await preflight();
  const challenge = randomBytes(32);

  const options: CredentialRequestOptions = {
    publicKey: {
      challenge,
      allowCredentials: [],
      userVerification: 'required',
      timeout: WEBAUTHN_TIMEOUT_MS,
      extensions: {
        prf: { eval: { first: prfSalt } },
      } as AuthenticationExtensionsClientInputs & {
        prf: { eval: { first: ArrayBuffer } };
      },
    },
  };

  let assertion: PublicKeyCredential | null;
  try {
    assertion = (await navigator.credentials.get(options)) as PublicKeyCredential | null;
  } catch (err) {
    throw mapWebAuthnError(err);
  }
  if (!assertion) {
    throw new VaultError('USER_CANCELLED', 'navigator.credentials.get() returned null');
  }

  const prfBytes = readPrfFirst(assertion);
  return prfBytes
    ? { credentialId: assertion.rawId, prfBytes }
    : { credentialId: assertion.rawId };
}

export interface WebAuthnPrfProbeResult {
  ok: boolean;
  isSecureContext: boolean;
  hasPublicKeyCredential: boolean;
  isUVPlatformAuthenticatorAvailable: boolean;
  prfOnCreate: boolean;
  prfOnGet: boolean;
  prfOutputLength: number | null;
  prfDeterministic: boolean | null;
  userAgent: string;
  errors: string[];
  timestampISO: string;
}

/**
 * Live WebAuthn + PRF probe: creates a throwaway credential, attempts PRF
 * on both create() and get(), verifies determinism (two get()s with the
 * same salt return identical bytes), and reports a JSON verdict.
 *
 * Cost to the user: one or two biometric prompts. The credential is left
 * orphaned (the platform retains it but the vault never references it
 * again). Hosts that want to delete it can — there's no API to do so from
 * the page in any browser, the platform manages credential storage.
 *
 * This is the verdict MoBrowser / WebView2 needs to decide PRF_SECURE vs
 * GATE_ONLY before shipping a real vault.
 */
export async function runWebAuthnPrfProbe(): Promise<WebAuthnPrfProbeResult> {
  const errors: string[] = [];
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  const isSecureContext =
    typeof window !== 'undefined' && (window.isSecureContext ?? false);
  const hasPublicKeyCredential =
    typeof window !== 'undefined' &&
    typeof window.PublicKeyCredential !== 'undefined';

  let isUVPlatformAuthenticatorAvailable = false;
  if (
    hasPublicKeyCredential &&
    typeof window.PublicKeyCredential
      .isUserVerifyingPlatformAuthenticatorAvailable === 'function'
  ) {
    try {
      isUVPlatformAuthenticatorAvailable =
        await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    } catch (err) {
      errors.push(`isUVPAA threw: ${stringifyErr(err)}`);
    }
  }

  if (!isSecureContext || !hasPublicKeyCredential || !isUVPlatformAuthenticatorAvailable) {
    return {
      ok: false,
      isSecureContext,
      hasPublicKeyCredential,
      isUVPlatformAuthenticatorAvailable,
      prfOnCreate: false,
      prfOnGet: false,
      prfOutputLength: null,
      prfDeterministic: null,
      userAgent: ua,
      errors,
      timestampISO: new Date().toISOString(),
    };
  }

  const prfSalt = randomBytes(32);

  let credentialId: ArrayBuffer | null = null;
  let prfBytesCreate: ArrayBuffer | undefined;
  try {
    const reg = await register(prfSalt);
    credentialId = reg.credentialId;
    prfBytesCreate = reg.prfBytes;
  } catch (err) {
    errors.push(`register failed: ${stringifyErr(err)}`);
    return {
      ok: false,
      isSecureContext,
      hasPublicKeyCredential,
      isUVPlatformAuthenticatorAvailable,
      prfOnCreate: false,
      prfOnGet: false,
      prfOutputLength: null,
      prfDeterministic: null,
      userAgent: ua,
      errors,
      timestampISO: new Date().toISOString(),
    };
  }

  let prfBytesGet1: ArrayBuffer | undefined;
  let prfBytesGet2: ArrayBuffer | undefined;
  try {
    prfBytesGet1 = await getPrfOutput(credentialId, prfSalt);
  } catch (err) {
    errors.push(`get#1 failed: ${stringifyErr(err)}`);
  }
  try {
    prfBytesGet2 = await getPrfOutput(credentialId, prfSalt);
  } catch (err) {
    errors.push(`get#2 failed: ${stringifyErr(err)}`);
  }

  const prfOnCreate = !!prfBytesCreate;
  const prfOnGet = !!prfBytesGet1;
  const sample = prfBytesCreate ?? prfBytesGet1;
  const prfOutputLength = sample ? sample.byteLength : null;

  let prfDeterministic: boolean | null = null;
  if (prfBytesGet1 && prfBytesGet2) {
    prfDeterministic = bufferEq(prfBytesGet1, prfBytesGet2);
    if (!prfDeterministic) {
      errors.push('CRITICAL: two PRF get()s with identical salt returned different bytes');
    }
  }

  const ok = (prfOnCreate || prfOnGet) && prfDeterministic !== false;

  return {
    ok,
    isSecureContext,
    hasPublicKeyCredential,
    isUVPlatformAuthenticatorAvailable,
    prfOnCreate,
    prfOnGet,
    prfOutputLength,
    prfDeterministic,
    userAgent: ua,
    errors,
    timestampISO: new Date().toISOString(),
  };
}

/* ──────────────── internal helpers ──────────────── */

/**
 * Read the PRF `eval.first` output from a credential's client extension
 * results. Tolerant of (a) lib.dom.d.ts versions that pre-date the PRF
 * type and (b) shape drift between browsers: PRF output may come back as
 * an ArrayBuffer, a TypedArray view, or be absent entirely.
 *
 * Returns a freshly-copied ArrayBuffer so the caller doesn't hold a view
 * into the credential extension object.
 */
function readPrfFirst(credential: PublicKeyCredential): ArrayBuffer | undefined {
  const ext = credential.getClientExtensionResults() as {
    prf?: { results?: { first?: BufferSource } };
  };
  const first = ext.prf?.results?.first;
  if (!first) return undefined;
  if (first instanceof ArrayBuffer) return first.slice(0);
  // TypedArray / DataView fallback.
  const view = first as ArrayBufferView;
  return view.buffer.slice(view.byteOffset, view.byteOffset + view.byteLength);
}

function stringifyErr(err: unknown): string {
  if (err instanceof Error) return `${err.name}: ${err.message}`;
  return String(err);
}

function bufferEq(a: ArrayBuffer, b: ArrayBuffer): boolean {
  if (a.byteLength !== b.byteLength) return false;
  const av = new Uint8Array(a);
  const bv = new Uint8Array(b);
  let diff = 0;
  for (let i = 0; i < av.length; i++) diff |= av[i]! ^ bv[i]!;
  return diff === 0;
}
