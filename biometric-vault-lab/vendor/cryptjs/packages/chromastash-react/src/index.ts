// ---------------------------------------------------------------------------
// @muulorigin/chromastash-react  —  Public API
// ---------------------------------------------------------------------------

// ── Hooks ───────────────────────────────────────────────────────────────────
export { useChromaEncode } from './hooks/useChromaEncode.js';
export type { UseChromaEncodeReturn } from './hooks/useChromaEncode.js';

export { useChromaDecode } from './hooks/useChromaDecode.js';
export type { UseChromaDecodeReturn } from './hooks/useChromaDecode.js';

export { useChromaConfig } from './hooks/useChromaConfig.js';
export type {
  UseChromaConfigReturn,
  UseChromaConfigOptions,
  ChromaConfigStorage,
} from './hooks/useChromaConfig.js';

// ── Components ──────────────────────────────────────────────────────────────
export { ChromaBackupButton } from './components/ChromaBackupButton.js';
export type { ChromaBackupButtonProps } from './components/ChromaBackupButton.js';

export { ChromaRestoreButton } from './components/ChromaRestoreButton.js';
export type { ChromaRestoreButtonProps } from './components/ChromaRestoreButton.js';

export { EncodeProgress } from './components/EncodeProgress.js';
export type { EncodeProgressProps } from './components/EncodeProgress.js';

export { ChromaConfigPanel } from './components/ChromaConfigPanel.js';
export type { ChromaConfigPanelProps } from './components/ChromaConfigPanel.js';

// ── Re-export core types for convenience ────────────────────────────────────
export type {
  EncodeOptions,
  EncodeResult,
  DecodeOptions,
  DecodeResult,
  ChromaMetadata,
  EncryptionMethod,
  SlidePattern,
  ProgressCallback,
  Logger,
  ChromaConfig,
} from '@muulorigin/chromastash-core';

export { DEFAULTS, AVAILABLE_PATTERNS, CODEC_VERSION, DEFAULT_CONFIG, estimateSlides } from '@muulorigin/chromastash-core';
