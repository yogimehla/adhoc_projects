export interface CanvasHandle {
    canvas: OffscreenCanvas | HTMLCanvasElement;
    ctx: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D;
    width: number;
    height: number;
}
/**
 * Create a 2D canvas (still used internally for perspective correction).
 */
export declare function createCanvas(width: number, height: number): CanvasHandle;
/**
 * Convert raw RGBA pixel data to a PNG Blob.
 * Uses the pure-JS PNG encoder — NO canvas involved.
 */
export declare function canvasToBlob(_canvas: OffscreenCanvas | HTMLCanvasElement, imageData?: ImageData): Promise<Blob>;
/**
 * Load a PNG Blob/File into an ImageData.
 * Uses the pure-JS PNG decoder — NO canvas color management involved.
 */
export declare function blobToImageData(blob: Blob): Promise<ImageData>;
//# sourceMappingURL=canvas.d.ts.map