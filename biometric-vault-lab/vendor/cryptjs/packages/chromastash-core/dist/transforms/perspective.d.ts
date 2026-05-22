import type { CornerPoints } from '../types.js';
/**
 * Detect four black corner-marker blobs in an image.
 * Returns their centre points or `null` if fewer than 4 candidates are found.
 */
export declare function detectCorners(imageData: ImageData): CornerPoints | null;
/**
 * Perspective-correct an image using four corner points and output a
 * square image of `outputRes × outputRes`.
 */
export declare function perspectiveCorrect(src: ImageData, corners: CornerPoints, outputRes: number): ImageData;
//# sourceMappingURL=perspective.d.ts.map