export { encode, decode, estimateSlides } from './codec/pixelGridCodec.js';
export type { ChromaMetadata, EncryptionMethod, SlidePattern, EncodeOptions, EncodeResult, DecodeOptions, DecodeResult, ProgressCallback, Logger, CornerPoints, ChromaConfig, } from './types.js';
export { CODEC_VERSION, DEFAULTS, AVAILABLE_PATTERNS, DEFAULT_CONFIG, } from './types.js';
export { encrypt, decrypt } from './crypto/index.js';
export { AES_GCM_OVERHEAD_BYTES } from './crypto/aesGcm.js';
export { sha256 } from './utils/hash.js';
export { detectCorners, perspectiveCorrect } from './transforms/perspective.js';
export { scramble, unscramble } from './transforms/scramble.js';
//# sourceMappingURL=index.d.ts.map