// ---------------------------------------------------------------------------
// @muulorigin/chromastash-core  —  Public API
// ---------------------------------------------------------------------------

// ── Main codec ──────────────────────────────────────────────────────────────
export { encode, decode, estimateSlides } from './codec/pixelGridCodec.js';

// ── Types ───────────────────────────────────────────────────────────────────
export type {
  ChromaMetadata,
  EncryptionMethod,
  SlidePattern,
  EncodeOptions,
  EncodeResult,
  DecodeOptions,
  DecodeResult,
  ProgressCallback,
  Logger,
  CornerPoints,
  ChromaConfig,
} from './types.js';

export {
  CODEC_VERSION,
  DEFAULTS,
  AVAILABLE_PATTERNS,
  DEFAULT_CONFIG,
} from './types.js';

// ── Crypto (for advanced consumers who want standalone encrypt/decrypt) ─────
export { encrypt, decrypt } from './crypto/index.js';
export { AES_GCM_OVERHEAD_BYTES } from './crypto/aesGcm.js';

// ── Utilities ───────────────────────────────────────────────────────────────
export { sha256 } from './utils/hash.js';
export { detectCorners, perspectiveCorrect } from './transforms/perspective.js';
export { scramble, unscramble } from './transforms/scramble.js';
