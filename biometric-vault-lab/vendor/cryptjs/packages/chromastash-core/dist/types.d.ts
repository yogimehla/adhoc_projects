/** Codec version embedded in every slide set. Decoders check this for compat. */
export declare const CODEC_VERSION = 3;
/** JSON metadata stored in the first pixel-row of slide 0. */
export interface ChromaMetadata {
    kind: 'pixel-grid-meta';
    version: number;
    fileId: string;
    /** Original file name (e.g. "project-backup.ccbk") */
    name: string;
    /** MIME type of the original file */
    type: string;
    /** Original file size in bytes (before encryption) */
    size: number;
    /** SHA-256 hex digest of the *original* (pre-encryption) file */
    fileHash: string;
    slideResolution: number;
    pixelBlockSize: number;
    totalSlides: number;
    createdAt: string;
    encryptionMethod?: EncryptionMethod;
    isScrambled?: boolean;
    hasCornerMarkers?: boolean;
}
export type EncryptionMethod = 'none' | 'xor' | 'aes-256-gcm';
export type SlidePattern = 'None' | 'Invert' | 'Horizontal Flip' | 'Vertical Flip' | 'Rotate 90° CW';
export declare const AVAILABLE_PATTERNS: SlidePattern[];
export interface EncodeOptions {
    /** Encryption method applied to the raw bytes before pixel encoding.
     *  @default 'aes-256-gcm' */
    encryption?: EncryptionMethod;
    /** Secret key / passphrase. Required when encryption !== 'none'. */
    secretKey?: string;
    /** Square slide resolution in pixels. @default 384 */
    resolution?: number;
    /** Each logical pixel is drawn as a NxN block for robustness.
     *  1 = maximum density, 2-4 = camera-capture friendly. @default 1 */
    pixelBlockSize?: number;
    /** Per-slide scrambling patterns applied after pixel writing. */
    slidePatterns?: SlidePattern[];
    /** Paint 16px black corner markers for perspective correction. @default true */
    cornerMarkers?: boolean;
    /** Add a white border around each slide image. @default false */
    addBorder?: boolean;
    /** Original file name to store in metadata (shown on decode). */
    fileName?: string;
    /** MIME type of the source data. @default 'application/octet-stream' */
    mimeType?: string;
}
export interface EncodeResult {
    /** PNG blobs — one per slide, in order. */
    slides: Blob[];
    /** The metadata object embedded in slide 0. */
    metadata: ChromaMetadata;
}
export interface DecodeOptions {
    /** Encryption method. If omitted the decoder reads it from slide metadata. */
    encryption?: EncryptionMethod;
    /** Secret key. Required if the slides were encrypted. */
    secretKey?: string;
    /** Per-slide scrambling patterns. Required if slides were scrambled. */
    slidePatterns?: SlidePattern[];
    /** Override the pixel block size from metadata. 'auto' reads from slide. @default 'auto' */
    pixelBlockSize?: 'auto' | 1 | 2 | 3 | 4 | 8;
}
export interface DecodeResult {
    /** The original file name from metadata. */
    name: string;
    /** The original MIME type from metadata. */
    type: string;
    /** The original file size from metadata. */
    size: number;
    /** The reconstructed file as a Blob (trimmed to exact size). */
    blob: Blob;
    /** The decoded metadata from slide 0. */
    metadata: ChromaMetadata;
    /** SHA-256 hex of the decoded blob. Compare with metadata.fileHash. */
    decodedHash: string;
    /** true if decodedHash === metadata.fileHash */
    integrityOk: boolean;
}
/**
 * Called during encode/decode to report progress.
 * @param percent  0-100
 * @param message  Human-readable status string
 */
export type ProgressCallback = (percent: number, message: string) => void;
/** Optional structured logger the consumer can inject. Falls back to console. */
export type Logger = (message: string, data?: unknown) => void;
export interface CornerPoints {
    tl: {
        x: number;
        y: number;
    };
    tr: {
        x: number;
        y: number;
    };
    bl: {
        x: number;
        y: number;
    };
    br: {
        x: number;
        y: number;
    };
}
/** Persisted configuration options exposed to end-users via a settings panel. */
export interface ChromaConfig {
    encryption: EncryptionMethod;
    resolution: number;
    pixelBlockSize: number;
    cornerMarkers: boolean;
    addBorder: boolean;
    slidePatterns: SlidePattern[];
}
export declare const DEFAULT_CONFIG: ChromaConfig;
export declare const DEFAULTS: {
    readonly RESOLUTION: 384;
    readonly PIXEL_BLOCK_SIZE: 1;
    readonly ENCRYPTION: EncryptionMethod;
    readonly CORNER_MARKERS: true;
    readonly ADD_BORDER: false;
    readonly MIME_TYPE: "application/octet-stream";
    readonly MAX_FILE_SIZE_BYTES: number;
    readonly CORNER_MARKER_SIZE: 16;
    readonly BYTES_PER_PIXEL: 3;
    readonly SLIDE_RESOLUTIONS: readonly number[];
};
//# sourceMappingURL=types.d.ts.map