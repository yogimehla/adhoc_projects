import type { EncodeOptions, EncodeResult, DecodeOptions, DecodeResult, ProgressCallback, Logger, EncryptionMethod } from '../types.js';
/**
 * Estimate how many slides a given data size will produce without encoding.
 * Useful for showing the user a preview before they start encoding.
 */
export declare function estimateSlides(dataSize: number, options?: {
    encryption?: EncryptionMethod;
    resolution?: number;
    pixelBlockSize?: number;
    cornerMarkers?: boolean;
}): {
    totalSlides: number;
    bytesPerSlide: number;
};
export declare function encode(data: ArrayBuffer | Blob, options?: EncodeOptions, onProgress?: ProgressCallback, log?: Logger): Promise<EncodeResult>;
export declare function decode(slideBlobs: (Blob | File)[], options?: DecodeOptions, onProgress?: ProgressCallback, log?: Logger): Promise<DecodeResult>;
//# sourceMappingURL=pixelGridCodec.d.ts.map