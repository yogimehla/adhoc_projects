/**
 * <SelfTest> — Phase 2 deliverable.
 *
 * In-app crypto self-test panel. Round-trips every public crypto / kdf /
 * recovery / encoding primitive. Each green row = real Web Crypto call in
 * the user's browser, not a unit test against a mock.
 *
 * Also includes a PRF-determinism stub: WebAuthn PRF is by definition a
 * keyed PRF (the same input must produce the same output every call), and
 * we demonstrate the same property using HKDF-SHA256 over the same inputs
 * — the property we'll verify against the real authenticator in Phase 3.
 */

import {
  BIO_KEK_INFO,
  RECOVERY_KEK_INFO,
  bytesEqualConstantTime,
  computeRecoveryCheck,
  decryptData,
  deriveKEK,
  encryptData,
  fromBase64Url,
  fromCrockfordBase32,
  fromHex,
  generateMasterKey,
  generateRecoverySecret,
  parseRecoveryKey,
  randomBytes,
  toBase64Url,
  toCrockfordBase32,
  toHex,
  unwrapMasterKey,
  utf8Decode,
  utf8Encode,
  wrapMasterKey,
  WrongRecoveryKeyError,
  InvalidRecoveryKeyFormatError,
  DecryptionError,
} from '@muulorigin/biometric-vault-core';
import { useCallback, useState } from 'react';

interface TestRow {
  name: string;
  ok: boolean;
  detail: string;
  category: 'encoding' | 'crypto' | 'kdf' | 'recovery' | 'prf';
}

type Status = 'idle' | 'running' | 'done';

export function SelfTest() {
  const [status, setStatus] = useState<Status>('idle');
  const [rows, setRows] = useState<TestRow[]>([]);

  const run = useCallback(async () => {
    setStatus('running');
    setRows([]);
    const results: TestRow[] = [];
    for (const test of allTests) {
      try {
        const detail = await test.fn();
        results.push({ name: test.name, ok: true, detail, category: test.category });
      } catch (err) {
        results.push({
          name: test.name,
          ok: false,
          detail: err instanceof Error ? `${err.name}: ${err.message}` : String(err),
          category: test.category,
        });
      }
      setRows([...results]);
    }
    setStatus('done');
  }, []);

  const totalPassed = rows.filter((r) => r.ok).length;
  const totalRun = rows.length;
  const allGreen = status === 'done' && rows.length > 0 && rows.every((r) => r.ok);

  return (
    <div className="card">
      <h2>Crypto self-test</h2>
      <p className="dim">
        Live round-trip of every Phase 2 primitive: encoding, AES-GCM wrap/unwrap,
        HKDF-SHA256 KEK derivation, recovery key encode/parse/checksum, and a
        PRF-determinism demonstration. Real Web Crypto calls in your browser — no mocks.
      </p>
      <div className="row" style={{ marginBottom: 8 }}>
        <button type="button" className="primary" onClick={run} disabled={status === 'running'}>
          {status === 'running' ? 'Running…' : 'Run self-test'}
        </button>
        {status === 'done' && (
          <span className={`badge ${allGreen ? 'ok' : 'bad'}`}>
            {totalPassed} / {totalRun} passed
          </span>
        )}
      </div>

      {rows.length > 0 && (
        <table className="testtable">
          <thead>
            <tr>
              <th>Test</th>
              <th>Result</th>
              <th>Detail</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.name} className={r.ok ? '' : 'fail'}>
                <td><span className={`badge muted cat-${r.category}`}>{r.category}</span> {r.name}</td>
                <td>
                  <span className={`badge ${r.ok ? 'ok' : 'bad'}`}>{r.ok ? 'PASS' : 'FAIL'}</span>
                </td>
                <td className="dim">{r.detail}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

/* ──────────────── tests ──────────────── */

interface TestDef {
  name: string;
  category: TestRow['category'];
  fn: () => Promise<string>;
}

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(msg);
}

const allTests: TestDef[] = [
  /* encoding */
  {
    name: 'utf8 encode/decode round-trip',
    category: 'encoding',
    fn: async () => {
      const sample = 'biometric → vault — ✓';
      const decoded = utf8Decode(utf8Encode(sample));
      assert(decoded === sample, `round-trip mismatch: "${decoded}"`);
      return `${sample.length} chars → ${utf8Encode(sample).byteLength} bytes`;
    },
  },
  {
    name: 'hex encode/decode round-trip',
    category: 'encoding',
    fn: async () => {
      const buf = randomBytes(32);
      const round = fromHex(toHex(buf));
      assert(
        bytesEqualConstantTime(buf, round),
        'hex round-trip produced different bytes',
      );
      return `32 random bytes → ${toHex(buf).length} hex chars → 32 bytes`;
    },
  },
  {
    name: 'base64url encode/decode round-trip',
    category: 'encoding',
    fn: async () => {
      const buf = randomBytes(33); // odd length triggers padding logic
      const encoded = toBase64Url(buf);
      assert(!encoded.includes('='), 'base64url must not contain "="');
      assert(!encoded.includes('+'), 'base64url must not contain "+"');
      assert(!encoded.includes('/'), 'base64url must not contain "/"');
      const round = fromBase64Url(encoded);
      assert(bytesEqualConstantTime(buf, round), 'base64url round-trip differs');
      return `33 bytes → ${encoded.length} chars (no padding) → 33 bytes`;
    },
  },
  {
    name: 'Crockford Base32 round-trip + ambiguity normalize',
    category: 'encoding',
    fn: async () => {
      const buf = randomBytes(32);
      const encoded = toCrockfordBase32(buf);
      // Inject visually ambiguous characters that should normalize.
      const sloppy = encoded
        .replace(/0/, 'O') // O → 0 on parse
        .replace(/1/, 'l') // l → 1 on parse
        .toLowerCase(); // case-insensitive
      const round = fromCrockfordBase32(sloppy);
      assert(
        bytesEqualConstantTime(buf.slice(0, 32), round.slice(0, 32)),
        'Crockford round-trip differs after ambiguity injection',
      );
      return `32 bytes → ${encoded.length} chars (O→0, l→1, lowercase tolerated)`;
    },
  },
  {
    name: 'constant-time eq: equal & unequal',
    category: 'encoding',
    fn: async () => {
      const a = new Uint8Array([1, 2, 3, 4]);
      const b = new Uint8Array([1, 2, 3, 4]);
      const c = new Uint8Array([1, 2, 3, 5]);
      const d = new Uint8Array([1, 2, 3]);
      assert(bytesEqualConstantTime(a, b), 'equal arrays returned false');
      assert(!bytesEqualConstantTime(a, c), 'unequal arrays returned true');
      assert(!bytesEqualConstantTime(a, d), 'different-length returned true');
      return 'equal=true, unequal=false, length-mismatch=false';
    },
  },

  /* crypto: master key wrap/unwrap */
  {
    name: 'generateMasterKey + wrap + unwrap + reuse',
    category: 'crypto',
    fn: async () => {
      const mk = await generateMasterKey();
      const kek = await deriveKEK(randomBytes(32), randomBytes(16), BIO_KEK_INFO);
      const wrapped = await wrapMasterKey(mk, kek);
      assert(wrapped.iv.byteLength === 12, `wrap IV length ${wrapped.iv.byteLength}`);
      // Unwrap and prove both MK handles produce interoperable ciphertext.
      const mk2 = await unwrapMasterKey(wrapped, kek);
      const plaintext = utf8Encode('hello from the vault');
      const { iv, ciphertext } = await encryptData(mk, plaintext);
      const back = utf8Decode(await decryptData(mk2, iv, ciphertext));
      assert(back === 'hello from the vault', `round-trip text: "${back}"`);
      return `wrapped ${wrapped.wrapped.byteLength}B, unwrap→encrypt→decrypt OK`;
    },
  },
  {
    name: 'AES-GCM encrypt/decrypt with AAD (entry id binding)',
    category: 'crypto',
    fn: async () => {
      const mk = await generateMasterKey();
      const aadA = utf8Encode('entry/notes-a');
      const aadB = utf8Encode('entry/notes-b');
      const plaintext = utf8Encode('secret note');
      const { iv, ciphertext } = await encryptData(mk, plaintext, aadA);
      // Right AAD: decrypts.
      const ok = utf8Decode(await decryptData(mk, iv, ciphertext, aadA));
      assert(ok === 'secret note', `AAD-bound decrypt: "${ok}"`);
      // Wrong AAD: GCM auth tag fails → DecryptionError.
      let threw: unknown = null;
      try {
        await decryptData(mk, iv, ciphertext, aadB);
      } catch (err) {
        threw = err;
      }
      assert(threw instanceof DecryptionError, 'swap-AAD attack must throw DecryptionError');
      return 'right AAD → plaintext; wrong AAD → DecryptionError ✓';
    },
  },
  {
    name: 'unwrap with wrong KEK → DecryptionError',
    category: 'crypto',
    fn: async () => {
      const mk = await generateMasterKey();
      const kek1 = await deriveKEK(randomBytes(32), randomBytes(16), BIO_KEK_INFO);
      const kek2 = await deriveKEK(randomBytes(32), randomBytes(16), BIO_KEK_INFO);
      const wrapped = await wrapMasterKey(mk, kek1);
      let threw: unknown = null;
      try {
        await unwrapMasterKey(wrapped, kek2);
      } catch (err) {
        threw = err;
      }
      assert(threw instanceof DecryptionError, 'unwrap with wrong KEK must throw DecryptionError');
      return 'wrong-KEK unwrap surfaces as DecryptionError, never raw exception';
    },
  },

  /* kdf */
  {
    name: 'HKDF distinct info labels produce distinct KEKs',
    category: 'kdf',
    fn: async () => {
      const ikm = randomBytes(32);
      const salt = randomBytes(16);
      const kekBio = await deriveKEK(ikm, salt, BIO_KEK_INFO);
      const kekRec = await deriveKEK(ikm, salt, RECOVERY_KEK_INFO);
      // Wrap the same MK under both, then try to cross-unwrap.
      const mk = await generateMasterKey();
      const wrappedByBio = await wrapMasterKey(mk, kekBio);
      let threw: unknown = null;
      try {
        await unwrapMasterKey(wrappedByBio, kekRec);
      } catch (err) {
        threw = err;
      }
      assert(threw instanceof DecryptionError, 'domain separation failed — labels must produce different keys');
      return `${BIO_KEK_INFO} ≠ ${RECOVERY_KEK_INFO} (cross-unwrap fails as expected)`;
    },
  },

  /* recovery */
  {
    name: 'recovery key generate → parse → bytes match',
    category: 'recovery',
    fn: async () => {
      const { bytes, display } = await generateRecoverySecret();
      const parsed = await parseRecoveryKey(display);
      assert(bytesEqualConstantTime(bytes, parsed), 'parsed bytes differ from generated bytes');
      // Sanity-check formatting: groups of 5 separated by `-`.
      const groups = display.split('-');
      assert(groups.every((g, i) => i < groups.length - 1 ? g.length === 5 : g.length <= 5), 'unexpected group sizes');
      return `${display} (${groups.length} groups, ${bytes.byteLength}B secret)`;
    },
  },
  {
    name: 'recovery key typo → WrongRecoveryKeyError (fast fail)',
    category: 'recovery',
    fn: async () => {
      const { display } = await generateRecoverySecret();
      // Mutate one character in the body (not the dashes, not the checksum).
      const chars = display.split('');
      const idx = chars.findIndex((c, i) => c !== '-' && i < display.length - 5);
      const original = chars[idx]!;
      const replacement = original === 'A' ? 'B' : 'A';
      chars[idx] = replacement;
      const mutated = chars.join('');
      let threw: unknown = null;
      try {
        await parseRecoveryKey(mutated);
      } catch (err) {
        threw = err;
      }
      assert(
        threw instanceof WrongRecoveryKeyError,
        'single-char typo must throw WrongRecoveryKeyError before GCM attempt',
      );
      return `flipped char [${idx}] "${original}"→"${replacement}" caught by checksum`;
    },
  },
  {
    name: 'recovery key malformed length → InvalidRecoveryKeyFormatError',
    category: 'recovery',
    fn: async () => {
      let threw: unknown = null;
      try {
        await parseRecoveryKey('TOO-SHORT');
      } catch (err) {
        threw = err;
      }
      assert(
        threw instanceof InvalidRecoveryKeyFormatError,
        'too-short input must throw InvalidRecoveryKeyFormatError',
      );
      return '"TOO-SHORT" rejected on length before checksum check';
    },
  },
  {
    name: 'computeRecoveryCheck is 8 bytes & deterministic',
    category: 'recovery',
    fn: async () => {
      const { bytes } = await generateRecoverySecret();
      const c1 = await computeRecoveryCheck(bytes);
      const c2 = await computeRecoveryCheck(bytes);
      assert(c1.byteLength === 8, `check is ${c1.byteLength}B not 8`);
      assert(bytesEqualConstantTime(c1, c2), 'check digest is non-deterministic');
      // Different secret → different check (sanity).
      const { bytes: other } = await generateRecoverySecret();
      const c3 = await computeRecoveryCheck(other);
      assert(!bytesEqualConstantTime(c1, c3), 'different secrets produced same 8-byte check');
      return `8-byte SHA-256 prefix, deterministic, collision-resistant on this trial`;
    },
  },

  /* prf-determinism stub */
  {
    name: 'PRF-determinism stub (HKDF same inputs ≡ same output)',
    category: 'prf',
    fn: async () => {
      // WebAuthn PRF is by definition deterministic: get() with the same
      // prf.eval.first salt MUST return identical bytes. Until Phase 3
      // exercises the real authenticator, demonstrate the property with
      // HKDF-SHA256, which is the same family of construction.
      const ikm = randomBytes(32);
      const salt = randomBytes(16);
      // Derive raw bits twice via HKDF (deriveBits, not deriveKey — bits
      // are extractable and comparable directly).
      const baseKey = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
      const enc = new TextEncoder();
      const bits1 = await crypto.subtle.deriveBits(
        { name: 'HKDF', hash: 'SHA-256', salt, info: enc.encode('prf-determinism-stub:v1') },
        baseKey,
        256,
      );
      const bits2 = await crypto.subtle.deriveBits(
        { name: 'HKDF', hash: 'SHA-256', salt, info: enc.encode('prf-determinism-stub:v1') },
        baseKey,
        256,
      );
      assert(
        bytesEqualConstantTime(bits1, bits2),
        'HKDF returned different output for identical inputs — host crypto broken',
      );
      // And different salt MUST give different output.
      const bits3 = await crypto.subtle.deriveBits(
        { name: 'HKDF', hash: 'SHA-256', salt: randomBytes(16), info: enc.encode('prf-determinism-stub:v1') },
        baseKey,
        256,
      );
      assert(
        !bytesEqualConstantTime(bits1, bits3),
        'HKDF with different salt produced identical output',
      );
      return 'same inputs ≡ same output; different salt ≠ same output. Phase 3 repeats this against the real authenticator.';
    },
  },
];
