// ---------------------------------------------------------------------------
// Image scrambling transforms
// ---------------------------------------------------------------------------
// Each transform operates on raw ImageData and returns a new ImageData.
// Scramble and unscramble are inverses — for most ops they're the same
// function, except Rotate 90° CW whose inverse is Rotate 90° CCW.
// ---------------------------------------------------------------------------
const idx = (x, y, w) => (y * w + x) * 4;
// ── Individual transforms ───────────────────────────────────────────────────
function invert(img) {
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
        d[i] = 255 - d[i];
        d[i + 1] = 255 - d[i + 1];
        d[i + 2] = 255 - d[i + 2];
    }
    return img;
}
function horizontalFlip(img) {
    const { width, height, data } = img;
    const out = new Uint8ClampedArray(data.length);
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const src = idx(x, y, width);
            const dst = idx(width - 1 - x, y, width);
            out[dst] = data[src];
            out[dst + 1] = data[src + 1];
            out[dst + 2] = data[src + 2];
            out[dst + 3] = data[src + 3];
        }
    }
    return new ImageData(out, width, height);
}
function verticalFlip(img) {
    const { width, height, data } = img;
    const out = new Uint8ClampedArray(data.length);
    for (let x = 0; x < width; x++) {
        for (let y = 0; y < height; y++) {
            const src = idx(x, y, width);
            const dst = idx(x, height - 1 - y, width);
            out[dst] = data[src];
            out[dst + 1] = data[src + 1];
            out[dst + 2] = data[src + 2];
            out[dst + 3] = data[src + 3];
        }
    }
    return new ImageData(out, width, height);
}
function rotate90CW(img) {
    const { width, height, data } = img;
    const out = new Uint8ClampedArray(data.length);
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const src = idx(x, y, width);
            const dstX = height - 1 - y;
            const dstY = x;
            const dst = idx(dstX, dstY, width); // square: width === height
            out[dst] = data[src];
            out[dst + 1] = data[src + 1];
            out[dst + 2] = data[src + 2];
            out[dst + 3] = data[src + 3];
        }
    }
    return new ImageData(out, width, height);
}
function rotate90CCW(img) {
    const { width, height, data } = img;
    const out = new Uint8ClampedArray(data.length);
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const src = idx(x, y, width);
            const dstX = y;
            const dstY = width - 1 - x;
            const dst = idx(dstX, dstY, width);
            out[dst] = data[src];
            out[dst + 1] = data[src + 1];
            out[dst + 2] = data[src + 2];
            out[dst + 3] = data[src + 3];
        }
    }
    return new ImageData(out, width, height);
}
// ── Dispatch tables ─────────────────────────────────────────────────────────
const scrambleOps = {
    Invert: invert,
    'Horizontal Flip': horizontalFlip,
    'Vertical Flip': verticalFlip,
    'Rotate 90° CW': rotate90CW,
};
const unscrambleOps = {
    Invert: invert,
    'Horizontal Flip': horizontalFlip,
    'Vertical Flip': verticalFlip,
    'Rotate 90° CW': rotate90CCW, // inverse
};
// ── Public API ──────────────────────────────────────────────────────────────
/** Apply a scrambling pattern to slide image data. Mutates or returns new. */
export function scramble(img, pattern) {
    if (!pattern || pattern === 'None')
        return img;
    const op = scrambleOps[pattern];
    return op ? op(img) : img;
}
/** Reverse a scrambling pattern on slide image data. */
export function unscramble(img, pattern) {
    if (!pattern || pattern === 'None')
        return img;
    const op = unscrambleOps[pattern];
    return op ? op(img) : img;
}
/** Clone ImageData so mutations don't affect the original. */
export function cloneImageData(img) {
    return new ImageData(new Uint8ClampedArray(img.data), img.width, img.height);
}
//# sourceMappingURL=scramble.js.map