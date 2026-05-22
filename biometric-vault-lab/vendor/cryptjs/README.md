# @muulorigin/chromastash-sdk

Steganographic secure backup SDK — encode any binary data into pixel-grid PNG slides that no one can read without the decryption key.

## Architecture

```
┌─────────────────────────────────────────────────────┐
│  Your App (Cognitive Canvas, POS, SQL Studio, etc)  │
│                    imports                           │
├─────────────────────────────────────────────────────┤
│  @muulorigin/chromastash-react                      │
│  ├── useChromaEncode()     — hook: blob → slides    │
│  ├── useChromaDecode()     — hook: slides → blob    │
│  ├── ChromaBackupButton    — drop-in encode UI      │
│  └── ChromaRestoreButton   — drop-in decode UI      │
│                    wraps                             │
├─────────────────────────────────────────────────────┤
│  @muulorigin/chromastash-core                       │
│  ├── encode()              — pure TS, zero deps     │
│  ├── decode()              — OffscreenCanvas ready   │
│  ├── AES-256-GCM / XOR    — Web Crypto API          │
│  └── Perspective correction — camera-capture decode  │
└─────────────────────────────────────────────────────┘
```

**Two packages, one purpose:**

- **`@muulorigin/chromastash-core`** — Pure TypeScript, zero framework dependency. Works in main thread or Web Worker. Uses `OffscreenCanvas` + `Web Crypto API`.
- **`@muulorigin/chromastash-react`** — Thin React wrapper with hooks and drop-in UI components.

## Installation

```bash
# In a monorepo (npm workspaces)
npm install

# Or install individually
npm install @muulorigin/chromastash-core
npm install @muulorigin/chromastash-react
```

## Quick Start

### Option A: Drop-in Components (zero config)

```tsx
import { ChromaBackupButton, ChromaRestoreButton } from '@muulorigin/chromastash-react';

function BackupPanel({ projectId }) {
  return (
    <>
      <ChromaBackupButton
        onGetData={async () => {
          const blob = await backupCore.exportProject(projectId);
          return { data: blob, fileName: `project-${projectId}.ccbk` };
        }}
        onSlidesReady={async (slides, { fileName }) => {
          // Package as ZIP and download
          const zip = new JSZip();
          slides.forEach((s, i) => zip.file(`slide-${String(i).padStart(3, '0')}.png`, s));
          const zipBlob = await zip.generateAsync({ type: 'blob' });
          saveAs(zipBlob, `${fileName}.chromastash.zip`);
        }}
        encodeOptions={{
          encryption: 'aes-256-gcm',
          secretKey: userPassword,
        }}
        label="🔒 Secure Backup"
        buttonClassName="btn btn-primary"
      />

      <ChromaRestoreButton
        onRestored={async (result) => {
          if (!result.integrityOk) {
            alert('Warning: file integrity check failed!');
          }
          await backupCore.importProject(result.blob);
        }}
        decodeOptions={{
          encryption: 'aes-256-gcm',
          secretKey: userPassword,
        }}
        label="📂 Restore from Slides"
        buttonClassName="btn btn-secondary"
      />
    </>
  );
}
```

### Option B: Hooks (full control)

```tsx
import { useChromaEncode, useChromaDecode } from '@muulorigin/chromastash-react';

function BackupPanel() {
  const { encode, progress, isEncoding, error } = useChromaEncode();
  const { decode, progress: decProgress, isDecoding, result } = useChromaDecode();

  const handleBackup = async () => {
    const ccbkBlob = await backupCore.exportProject(projectId);
    const { slides, metadata } = await encode(ccbkBlob, {
      encryption: 'aes-256-gcm',
      secretKey: password,
      fileName: 'my-project.ccbk',
      resolution: 512,
    });
    // slides is Blob[] — do whatever you want with them
  };

  const handleRestore = async (files: File[]) => {
    const { blob, integrityOk, name } = await decode(files, {
      encryption: 'aes-256-gcm',
      secretKey: password,
    });
    // blob is the original .ccbk file
  };

  return (
    <div>
      <button onClick={handleBackup} disabled={isEncoding}>
        {isEncoding ? `Encoding ${progress}%` : 'Backup'}
      </button>
      {error && <p className="error">{error}</p>}
    </div>
  );
}
```

### Option C: Core Only (no React)

```typescript
import { encode, decode } from '@muulorigin/chromastash-core';

// Encode any ArrayBuffer or Blob
const zipBuffer = await fetch('/backup.zip').then(r => r.arrayBuffer());
const { slides, metadata } = await encode(zipBuffer, {
  encryption: 'aes-256-gcm',
  secretKey: 'my-strong-passphrase',
  fileName: 'backup.zip',
  mimeType: 'application/zip',
  resolution: 384,
  cornerMarkers: true,
});

// Decode slides back
const { blob, integrityOk } = await decode(slideBlobs, {
  encryption: 'aes-256-gcm',
  secretKey: 'my-strong-passphrase',
});
```

---

## Cognitive Canvas Integration Example

The `.ccbk` backup flow stays exactly as-is. ChromaStash wraps around it:

**Export:** `backupCore.export()` → `.ccbk` Blob → `encode()` → PNG slides → ZIP download

**Import:** ZIP upload → unpack PNGs → `decode()` → `.ccbk` Blob → `backupCore.import()`

```tsx
// In Cognitive Canvas ProjectSelectionScreen.tsx

import { ChromaBackupButton, ChromaRestoreButton } from '@muulorigin/chromastash-react';

// Inside the backup section of your project settings:
<ChromaBackupButton
  onGetData={async () => {
    // Your existing .ccbk export
    const ccbkBlob = await backupCore.exportToBlob(currentProject.id);
    return {
      data: ccbkBlob,
      fileName: `${currentProject.name}.ccbk`,
      mimeType: 'application/x-ccbk',
    };
  }}
  onSlidesReady={async (slides, { fileName }) => {
    // Reuse your existing JSZip + saveAs pattern
    const zip = new JSZip();
    slides.forEach((blob, i) =>
      zip.file(`${fileName}_slide_${String(i).padStart(3, '0')}.png`, blob)
    );
    const zipBlob = await zip.generateAsync({ type: 'blob' });
    saveAs(zipBlob, `${fileName}.secure.zip`);
  }}
  encodeOptions={{
    encryption: 'aes-256-gcm',
    secretKey: backupPassword,
    resolution: 512,       // higher res for larger .ccbk files
    cornerMarkers: true,   // camera-capture friendly
  }}
  buttonClassName={styles.backupBtn}
  label="Secure Visual Backup"
/>
```

---

## API Reference

### `encode(data, options?, onProgress?, logger?)`

| Param | Type | Description |
|---|---|---|
| `data` | `ArrayBuffer \| Blob` | The raw binary data to encode |
| `options.encryption` | `'none' \| 'xor' \| 'aes-256-gcm'` | Encryption method (default: `'aes-256-gcm'`) |
| `options.secretKey` | `string` | Passphrase for encryption |
| `options.resolution` | `number` | Slide size in px (default: 384) |
| `options.pixelBlockSize` | `number` | Logical pixel size 1-8 (default: 1) |
| `options.slidePatterns` | `SlidePattern[]` | Per-slide scrambling transforms |
| `options.cornerMarkers` | `boolean` | Black corner markers (default: true) |
| `options.fileName` | `string` | Original filename stored in metadata |
| `options.mimeType` | `string` | MIME type stored in metadata |

**Returns:** `{ slides: Blob[], metadata: ChromaMetadata }`

### `decode(slides, options?, onProgress?, logger?)`

| Param | Type | Description |
|---|---|---|
| `slides` | `(Blob \| File)[]` | PNG slide images to decode |
| `options.encryption` | `EncryptionMethod` | Override auto-detected encryption |
| `options.secretKey` | `string` | Decryption passphrase |
| `options.slidePatterns` | `SlidePattern[]` | Pattern sequence for unscrambling |
| `options.pixelBlockSize` | `'auto' \| 1-8` | Override auto-detected block size |

**Returns:** `{ blob, name, type, size, metadata, decodedHash, integrityOk }`

---

## How It Works

1. **Source data** (ZIP, .ccbk, any binary) is optionally encrypted (AES-256-GCM with PBKDF2 key derivation, 100k iterations).
2. **Metadata** (filename, size, hash, encryption method, layout params) is JSON-encoded into the first few pixels of slide 0.
3. **File bytes** are written into RGB channels — 3 bytes per pixel. Each slide is a square PNG image.
4. **Optional scrambling** (invert, flip, rotate) is applied per-slide as an additional obfuscation layer.
5. **Corner markers** (16px black squares) enable perspective correction when decoding from camera photos.
6. **SHA-256 integrity check** verifies the decoded data matches the original.

---

## License

MIT — Muulorigin
