// ---------------------------------------------------------------------------
// @muulorigin/chromastash-core  —  Type definitions
// ---------------------------------------------------------------------------
/** Codec version embedded in every slide set. Decoders check this for compat. */
export const CODEC_VERSION = 3;
export const AVAILABLE_PATTERNS = [
    'None',
    'Invert',
    'Horizontal Flip',
    'Vertical Flip',
    'Rotate 90° CW',
];
export const DEFAULT_CONFIG = {
    encryption: 'aes-256-gcm',
    resolution: 512,
    pixelBlockSize: 1,
    cornerMarkers: true,
    addBorder: false,
    slidePatterns: [],
};
// ── Constants ───────────────────────────────────────────────────────────────
export const DEFAULTS = {
    RESOLUTION: 384,
    PIXEL_BLOCK_SIZE: 1,
    ENCRYPTION: 'aes-256-gcm',
    CORNER_MARKERS: true,
    ADD_BORDER: false,
    MIME_TYPE: 'application/octet-stream',
    MAX_FILE_SIZE_BYTES: 100 * 1024 * 1024,
    CORNER_MARKER_SIZE: 16,
    BYTES_PER_PIXEL: 3,
    SLIDE_RESOLUTIONS: [256, 384, 512, 768, 1024],
};
//# sourceMappingURL=types.js.map