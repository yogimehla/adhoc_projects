import type { SlidePattern } from '../types.js';
/** Apply a scrambling pattern to slide image data. Mutates or returns new. */
export declare function scramble(img: ImageData, pattern: SlidePattern): ImageData;
/** Reverse a scrambling pattern on slide image data. */
export declare function unscramble(img: ImageData, pattern: SlidePattern): ImageData;
/** Clone ImageData so mutations don't affect the original. */
export declare function cloneImageData(img: ImageData): ImageData;
//# sourceMappingURL=scramble.d.ts.map