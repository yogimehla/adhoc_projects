/**
 * Encode raw RGBA pixel data into a PNG Blob without using canvas.
 * @param rgba  Flat RGBA array (length = width * height * 4)
 * @param width  Image width in pixels
 * @param height Image height in pixels
 */
export declare function rgbaToPngBlob(rgba: Uint8Array | Uint8ClampedArray, width: number, height: number): Promise<Blob>;
export interface RawImageData {
    width: number;
    height: number;
    data: Uint8Array;
}
/**
 * Decode a PNG Blob into raw RGBA pixel data without using canvas.
 */
export declare function pngBlobToRgba(blob: Blob): Promise<RawImageData>;
//# sourceMappingURL=pngCodec.d.ts.map