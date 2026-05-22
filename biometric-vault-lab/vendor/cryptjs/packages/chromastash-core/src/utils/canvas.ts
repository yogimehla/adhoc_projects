// ---------------------------------------------------------------------------
// Canvas abstraction
// ---------------------------------------------------------------------------
// IMPORTANT: PNG encode/decode now uses the pure-JS pngCodec to bypass
// browser canvas color management entirely.  The canvas utilities below are
// kept only for perspective correction (detectCorners / perspectiveCorrect)
// which still needs a real canvas for image compositing.
// ---------------------------------------------------------------------------

import { rgbaToPngBlob, pngBlobToRgba } from './pngCodec.js';

export interface CanvasHandle {
  canvas: OffscreenCanvas | HTMLCanvasElement;
  ctx: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D;
  width: number;
  height: number;
}

const CTX_OPTS: any = { willReadFrequently: true, colorSpace: 'srgb' };

/**
 * Create a 2D canvas (still used internally for perspective correction).
 */
export function createCanvas(width: number, height: number): CanvasHandle {
  if (typeof OffscreenCanvas !== 'undefined') {
    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext('2d', CTX_OPTS) as OffscreenCanvasRenderingContext2D | null;
    if (!ctx) throw new Error('Could not get OffscreenCanvas 2D context');
    return { canvas, ctx, width, height };
  }
  if (typeof document !== 'undefined') {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d', CTX_OPTS) as CanvasRenderingContext2D | null;
    if (!ctx) throw new Error('Could not get canvas 2D context');
    return { canvas, ctx, width, height };
  }
  throw new Error('No canvas implementation available in this environment.');
}

/**
 * Convert raw RGBA pixel data to a PNG Blob.
 * Uses the pure-JS PNG encoder — NO canvas involved.
 */
export async function canvasToBlob(
  _canvas: OffscreenCanvas | HTMLCanvasElement,
  imageData?: ImageData,
): Promise<Blob> {
  if (imageData) {
    // Fast path: encode directly from ImageData without touching canvas
    return rgbaToPngBlob(imageData.data, imageData.width, imageData.height);
  }

  // Legacy fallback: read pixels from canvas, then encode via pure-JS PNG
  const canvas = _canvas;
  let ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
  if (canvas instanceof OffscreenCanvas) {
    ctx = canvas.getContext('2d', CTX_OPTS) as OffscreenCanvasRenderingContext2D;
  } else {
    ctx = (canvas as HTMLCanvasElement).getContext('2d', CTX_OPTS) as CanvasRenderingContext2D;
  }
  const w = canvas.width;
  const h = canvas.height;
  const imgData = ctx.getImageData(0, 0, w, h);
  return rgbaToPngBlob(imgData.data, w, h);
}

/**
 * Load a PNG Blob/File into an ImageData.
 * Uses the pure-JS PNG decoder — NO canvas color management involved.
 */
export async function blobToImageData(blob: Blob): Promise<ImageData> {
  const { width, height, data } = await pngBlobToRgba(blob);
  // Construct a real ImageData so the rest of the codec can use it normally
  const imgData = new ImageData(width, height);
  imgData.data.set(data);
  return imgData;
}
