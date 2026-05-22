// ---------------------------------------------------------------------------
// Pixel-grid codec  —  encode binary data into PNG slides, decode back
// ---------------------------------------------------------------------------
// This is the heart of ChromaStash. Each slide is a square PNG image where
// file bytes are stored in R, G, B channels (3 bytes per pixel). Slide 0
// contains a JSON metadata header followed by file data. Subsequent slides
// contain only file data.
// ---------------------------------------------------------------------------
import { CODEC_VERSION, DEFAULTS } from '../types.js';
import { encrypt, decrypt, AES_GCM_OVERHEAD_BYTES } from '../crypto/index.js';
import { scramble, unscramble, cloneImageData } from '../transforms/scramble.js';
import { detectCorners, perspectiveCorrect } from '../transforms/perspective.js';
import { sha256 } from '../utils/hash.js';
import { createCanvas, canvasToBlob, blobToImageData } from '../utils/canvas.js';
import { isMoBrowser } from '../bridge/detector.js';
import { ipcEncode, ipcDecode } from '../bridge/ipcCodec.js';
const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();
const { BYTES_PER_PIXEL, CORNER_MARKER_SIZE } = DEFAULTS;
// ── Internal helpers ────────────────────────────────────────────────────────
function makeMetadata(fileName, mimeType, fileSize, fileHash, resolution, pixelBlockSize, encryption, hasCornerMarkers) {
    return {
        kind: 'pixel-grid-meta',
        version: CODEC_VERSION,
        fileId: `pkg-${fileHash.substring(0, 12)}`,
        name: fileName,
        type: mimeType,
        size: fileSize,
        fileHash,
        slideResolution: resolution,
        pixelBlockSize,
        totalSlides: 0,
        createdAt: new Date().toISOString(),
        encryptionMethod: encryption,
        hasCornerMarkers,
    };
}
/** Pre-compute the (x,y) coordinates available for data pixels on each slide. */
function computeDataCoords(effectiveRes, hasMarkers, pixelBlockSize) {
    const markerBlocks = hasMarkers ? Math.ceil(CORNER_MARKER_SIZE / pixelBlockSize) : 0;
    const coords = [];
    for (let y = 0; y < effectiveRes; y++) {
        for (let x = 0; x < effectiveRes; x++) {
            if (hasMarkers) {
                const top = y < markerBlocks;
                const bot = y >= effectiveRes - markerBlocks;
                const left = x < markerBlocks;
                const right = x >= effectiveRes - markerBlocks;
                if ((top && left) || (top && right) || (bot && left) || (bot && right))
                    continue;
            }
            coords.push({ x, y });
        }
    }
    return coords;
}
/** Iteratively calculate totalSlides — metadata length itself affects the count. */
function calcTotalSlides(dataLen, effectiveRes, hasMarkers, pixelBlockSize, meta) {
    const dataPixelsPerSlide = computeDataCoords(effectiveRes, hasMarkers, pixelBlockSize).length;
    const bytesPerDataSlide = dataPixelsPerSlide * BYTES_PER_PIXEL;
    let totalSlides = 1;
    let finalMetaBytes;
    for (let iter = 0; iter < 5; iter++) {
        meta.totalSlides = totalSlides;
        const metaBytes = textEncoder.encode(JSON.stringify(meta));
        const metaHeaderPixels = 1; // 3 bytes encode the meta length
        const metaBodyPixels = Math.ceil(metaBytes.length / BYTES_PER_PIXEL);
        const totalMetaPixels = metaHeaderPixels + metaBodyPixels;
        if (totalMetaPixels > dataPixelsPerSlide) {
            throw new Error('Resolution too small to fit metadata.');
        }
        const dataBytesOnSlide0 = (dataPixelsPerSlide - totalMetaPixels) * BYTES_PER_PIXEL;
        let next = 1;
        if (dataLen > dataBytesOnSlide0) {
            next += Math.ceil((dataLen - dataBytesOnSlide0) / bytesPerDataSlide);
        }
        finalMetaBytes = metaBytes;
        if (next === totalSlides)
            break;
        totalSlides = next;
    }
    return { totalSlides, finalMetaBytes };
}
// ── Public estimation helper ───────────────────────────────────────────────
/**
 * Estimate how many slides a given data size will produce without encoding.
 * Useful for showing the user a preview before they start encoding.
 */
export function estimateSlides(dataSize, options) {
    const resolution = options?.resolution ?? DEFAULTS.RESOLUTION;
    const pixelBlockSize = options?.pixelBlockSize ?? DEFAULTS.PIXEL_BLOCK_SIZE;
    const cornerMarkers = options?.cornerMarkers ?? DEFAULTS.CORNER_MARKERS;
    const encryption = options?.encryption ?? DEFAULTS.ENCRYPTION;
    const effectiveRes = Math.floor(resolution / pixelBlockSize);
    const dataPixelsPerSlide = computeDataCoords(effectiveRes, cornerMarkers, pixelBlockSize).length;
    const bytesPerSlide = dataPixelsPerSlide * BYTES_PER_PIXEL;
    // Account for encryption overhead
    let encryptedSize = dataSize;
    if (encryption === 'aes-256-gcm') {
        encryptedSize += AES_GCM_OVERHEAD_BYTES;
    }
    // Rough metadata overhead (~400 bytes for typical metadata JSON)
    const estimatedMetaPixels = 1 + Math.ceil(400 / BYTES_PER_PIXEL);
    const dataBytesOnSlide0 = (dataPixelsPerSlide - estimatedMetaPixels) * BYTES_PER_PIXEL;
    let totalSlides = 1;
    if (encryptedSize > dataBytesOnSlide0) {
        totalSlides += Math.ceil((encryptedSize - dataBytesOnSlide0) / bytesPerSlide);
    }
    return { totalSlides, bytesPerSlide };
}
// ── Read helpers (used by decode) ───────────────────────────────────────────
function readBytesFromImageData(img, pixelBlockSize, skipMarkers) {
    const { data, width } = img;
    const effectiveRes = Math.floor(width / pixelBlockSize);
    const markerBlocks = skipMarkers ? Math.ceil(CORNER_MARKER_SIZE / pixelBlockSize) : 0;
    const bytes = [];
    for (let y = 0; y < effectiveRes; y++) {
        for (let x = 0; x < effectiveRes; x++) {
            if (skipMarkers) {
                const top = y < markerBlocks;
                const bot = y >= effectiveRes - markerBlocks;
                const left = x < markerBlocks;
                const right = x >= effectiveRes - markerBlocks;
                if ((top && left) || (top && right) || (bot && left) || (bot && right))
                    continue;
            }
            const i = (y * pixelBlockSize * width + x * pixelBlockSize) * 4;
            bytes.push(data[i], data[i + 1], data[i + 2]);
        }
    }
    return bytes;
}
function tryParseMetadata(bytes, expectedPbs, log) {
    try {
        if (bytes.length < BYTES_PER_PIXEL)
            return null;
        const metaLen = (bytes[0] << 16) | (bytes[1] << 8) | bytes[2];
        if (metaLen <= 0 || metaLen > bytes.length - BYTES_PER_PIXEL)
            return null;
        const metaBytes = new Uint8Array(bytes.slice(BYTES_PER_PIXEL, BYTES_PER_PIXEL + metaLen));
        const metadata = JSON.parse(textDecoder.decode(metaBytes));
        if (metadata.kind !== 'pixel-grid-meta')
            return null;
        if (metadata.pixelBlockSize !== expectedPbs) {
            log('Warning: parsed pixelBlockSize mismatches read value', {
                read: expectedPbs, inMeta: metadata.pixelBlockSize,
            });
        }
        return metadata;
    }
    catch {
        return null;
    }
}
function readPixelBlockSize(img, log) {
    // New location: (0,0).alpha
    const alphaOrigin = img.data[3];
    if (alphaOrigin >= 247 && alphaOrigin <= 254) {
        const pbs = 255 - alphaOrigin;
        log('Read pixelBlockSize from (0,0).alpha', { pbs });
        return pbs;
    }
    // Legacy location: (0, CORNER_MARKER_SIZE).alpha
    const { width } = img;
    const legacyIdx = (CORNER_MARKER_SIZE * width) * 4 + 3;
    if (legacyIdx < img.data.length) {
        const alphaLegacy = img.data[legacyIdx];
        if (alphaLegacy >= 247 && alphaLegacy <= 254) {
            const pbs = 255 - alphaLegacy;
            log('Read pixelBlockSize from legacy location', { pbs });
            return pbs;
        }
    }
    log('Could not determine pixelBlockSize, defaulting to 1');
    return 1;
}
// ═══════════════════════════════════════════════════════════════════════════
//  ENCODE
// ═══════════════════════════════════════════════════════════════════════════
export async function encode(data, options = {}, onProgress = () => { }, log = () => { }) {
    // Check if we're in MoBrowser — route to native Rust path
    if (isMoBrowser()) {
        const hasScrambling = (options.slidePatterns ?? []).some((p) => p && p !== 'None');
        if (!hasScrambling) {
            try {
                return await ipcEncode(data, options, onProgress, log);
            }
            catch (err) {
                log('MoBrowser IPC encode failed, falling back to JS', { error: String(err) });
            }
        }
        else {
            log('Scrambling requested — using JS encoder (MoBrowser not supported yet)');
        }
    }
    // Normalise input to Uint8Array
    const rawBuffer = data instanceof Blob ? await data.arrayBuffer() : data;
    const rawBytes = new Uint8Array(rawBuffer);
    const { encryption = DEFAULTS.ENCRYPTION, secretKey, resolution = DEFAULTS.RESOLUTION, pixelBlockSize = DEFAULTS.PIXEL_BLOCK_SIZE, slidePatterns = [], cornerMarkers = DEFAULTS.CORNER_MARKERS, addBorder = DEFAULTS.ADD_BORDER, fileName = 'encoded-file', mimeType = DEFAULTS.MIME_TYPE, } = options;
    if (rawBytes.length > DEFAULTS.MAX_FILE_SIZE_BYTES) {
        throw new Error(`File exceeds maximum size of ${DEFAULTS.MAX_FILE_SIZE_BYTES / 1024 / 1024} MB.`);
    }
    // ── Step 1: Hash the original (pre-encryption) data ─────────────────
    onProgress(2, 'Hashing source data...');
    const fileHash = await sha256(rawBuffer);
    // ── Step 2: Encrypt ─────────────────────────────────────────────────
    onProgress(5, 'Encrypting...');
    const dataToWrite = await encrypt(rawBytes, encryption, secretKey);
    // ── Step 3: Calculate slide layout ──────────────────────────────────
    onProgress(8, 'Calculating encoding plan...');
    const effectiveRes = Math.floor(resolution / pixelBlockSize);
    const isScrambled = slidePatterns.some((p) => p && p !== 'None');
    const meta = makeMetadata(fileName, mimeType, rawBytes.length, fileHash, resolution, pixelBlockSize, encryption, cornerMarkers);
    meta.isScrambled = isScrambled;
    const { totalSlides, finalMetaBytes } = calcTotalSlides(dataToWrite.length, effectiveRes, cornerMarkers, pixelBlockSize, meta);
    meta.totalSlides = totalSlides;
    log('Encoding plan', { totalSlides, metaSize: finalMetaBytes.length, dataLen: dataToWrite.length });
    // ── Step 4: Compose slides ──────────────────────────────────────────
    // IMPORTANT: All pixel data is written directly into ImageData.data arrays
    // instead of using ctx.fillRect() with CSS rgb() strings. This bypasses
    // the browser's canvas color management / compositing pipeline which can
    // silently alter RGB values by ±1, corrupting the encoded byte stream.
    // ────────────────────────────────────────────────────────────────────
    const dataCoords = computeDataCoords(effectiveRes, cornerMarkers, pixelBlockSize);
    const slides = [];
    let fileCursor = 0;
    let tempRgb = [0, 0, 0];
    let tempIdx = 0;
    /** Write RGBA directly into an ImageData pixel array. */
    const setPixelDirect = (imgData, px, py, r, g, b, a = 255) => {
        const i = (py * imgData.width + px) * 4;
        imgData.data[i] = r;
        imgData.data[i + 1] = g;
        imgData.data[i + 2] = b;
        imgData.data[i + 3] = a;
    };
    /** Fill a rectangular block in an ImageData pixel array. */
    const fillRectDirect = (imgData, rx, ry, rw, rh, r, g, b, a = 255) => {
        for (let dy = 0; dy < rh; dy++) {
            for (let dx = 0; dx < rw; dx++) {
                setPixelDirect(imgData, rx + dx, ry + dy, r, g, b, a);
            }
        }
    };
    for (let s = 0; s < totalSlides; s++) {
        onProgress(10 + (s / totalSlides) * 85, `Composing slide ${s + 1}/${totalSlides}...`);
        const { canvas, ctx } = createCanvas(resolution, resolution);
        // Build the slide entirely in an ImageData buffer
        const imgData = ctx.createImageData(resolution, resolution);
        // White background (R=255, G=255, B=255, A=255)
        for (let i = 0; i < imgData.data.length; i += 4) {
            imgData.data[i] = 255;
            imgData.data[i + 1] = 255;
            imgData.data[i + 2] = 255;
            imgData.data[i + 3] = 255;
        }
        // Corner markers (black)
        if (cornerMarkers) {
            const ms = CORNER_MARKER_SIZE;
            fillRectDirect(imgData, 0, 0, ms, ms, 0, 0, 0);
            fillRectDirect(imgData, resolution - ms, 0, ms, ms, 0, 0, 0);
            fillRectDirect(imgData, 0, resolution - ms, ms, ms, 0, 0, 0);
            fillRectDirect(imgData, resolution - ms, resolution - ms, ms, ms, 0, 0, 0);
        }
        // Store pixelBlockSize in (0,0).alpha on slide 0
        if (s === 0) {
            imgData.data[3] = 255 - pixelBlockSize;
        }
        let coordCursor = 0;
        const drawPixel = (r, g, b) => {
            if (coordCursor >= dataCoords.length)
                return;
            const { x, y } = dataCoords[coordCursor];
            // Write a pixelBlockSize × pixelBlockSize block
            for (let dy = 0; dy < pixelBlockSize; dy++) {
                for (let dx = 0; dx < pixelBlockSize; dx++) {
                    setPixelDirect(imgData, x * pixelBlockSize + dx, y * pixelBlockSize + dy, r, g, b);
                }
            }
            coordCursor++;
        };
        const writeByte = (byte) => {
            tempRgb[tempIdx++] = byte;
            if (tempIdx === 3) {
                drawPixel(tempRgb[0], tempRgb[1], tempRgb[2]);
                tempRgb = [0, 0, 0];
                tempIdx = 0;
            }
        };
        // Slide 0: write metadata header, then file data
        if (s === 0) {
            // 3-byte length header
            drawPixel((finalMetaBytes.length >> 16) & 0xff, (finalMetaBytes.length >> 8) & 0xff, finalMetaBytes.length & 0xff);
            // Meta body
            let metaRgb = [0, 0, 0];
            let metaIdx = 0;
            for (const byte of finalMetaBytes) {
                metaRgb[metaIdx++] = byte;
                if (metaIdx === 3) {
                    drawPixel(metaRgb[0], metaRgb[1], metaRgb[2]);
                    metaRgb = [0, 0, 0];
                    metaIdx = 0;
                }
            }
            if (metaIdx > 0)
                drawPixel(metaRgb[0], metaRgb[1], metaRgb[2]);
        }
        // File data bytes
        const limit = dataCoords.length;
        while (coordCursor < limit && fileCursor < dataToWrite.length) {
            writeByte(dataToWrite[fileCursor++]);
        }
        // Flush partial RGB triple on last slide
        if (s === totalSlides - 1 && fileCursor >= dataToWrite.length && tempIdx > 0) {
            drawPixel(tempRgb[0], tempRgb[1], tempRgb[2]);
        }
        // Apply per-slide scrambling pattern
        let finalImgData = imgData;
        const pattern = (slidePatterns[s] ?? 'None');
        if (pattern !== 'None') {
            finalImgData = scramble(imgData, pattern);
        }
        // Optional white border — composited directly into a larger ImageData
        // (no canvas drawImage involved, preserving pixel-perfect data)
        if (addBorder) {
            const bw = Math.max(16, Math.floor(resolution * 0.1));
            const newSize = resolution + bw * 2;
            const borderedData = new ImageData(newSize, newSize);
            // Fill white background
            for (let i = 0; i < borderedData.data.length; i += 4) {
                borderedData.data[i] = 255;
                borderedData.data[i + 1] = 255;
                borderedData.data[i + 2] = 255;
                borderedData.data[i + 3] = 255;
            }
            // Copy the slide pixels into the center (offset by bw)
            const src = finalImgData.data;
            const dst = borderedData.data;
            for (let y = 0; y < resolution; y++) {
                for (let x = 0; x < resolution; x++) {
                    const si = (y * resolution + x) * 4;
                    const di = ((y + bw) * newSize + (x + bw)) * 4;
                    dst[di] = src[si];
                    dst[di + 1] = src[si + 1];
                    dst[di + 2] = src[si + 2];
                    dst[di + 3] = src[si + 3];
                }
            }
            slides.push(await canvasToBlob(canvas, borderedData));
        }
        else {
            // Fast path: pure-JS PNG encode directly from ImageData (no canvas involved)
            slides.push(await canvasToBlob(canvas, finalImgData));
        }
    }
    onProgress(100, 'Encoding complete.');
    return { slides, metadata: meta };
}
// ═══════════════════════════════════════════════════════════════════════════
//  DECODE
// ═══════════════════════════════════════════════════════════════════════════
export async function decode(slideBlobs, options = {}, onProgress = () => { }, log = () => { }) {
    if (slideBlobs.length === 0)
        throw new Error('No slide images provided.');
    // Check if we're in MoBrowser — route to native Rust path
    if (isMoBrowser()) {
        const hasScrambling = (options.slidePatterns ?? []).some((p) => p && p !== 'None');
        if (!hasScrambling) {
            try {
                return await ipcDecode(slideBlobs, options, onProgress, log);
            }
            catch (err) {
                log('MoBrowser IPC decode failed, falling back to JS', { error: String(err) });
            }
        }
        else {
            log('Scrambling requested — using JS decoder (MoBrowser not supported yet)');
        }
    }
    const { encryption: userEncryption, secretKey, slidePatterns = [], pixelBlockSize: userPbs = 'auto', } = options;
    // ── Step 1: Sort slides by name (numeric-aware) ─────────────────────
    const sorted = [...slideBlobs].sort((a, b) => {
        const nameA = a.name ?? '';
        const nameB = b.name ?? '';
        return nameA.localeCompare(nameB, undefined, { numeric: true, sensitivity: 'base' });
    });
    // ── Step 2: Load all slides as ImageData ────────────────────────────
    onProgress(5, 'Loading slide images...');
    const slidesImageData = [];
    for (let i = 0; i < sorted.length; i++) {
        onProgress(5 + (i / sorted.length) * 5, `Processing slide ${i + 1}/${sorted.length}...`);
        const img = await blobToImageData(sorted[i]);
        // Attempt corner marker detection & alignment handling.
        const corners = detectCorners(img);
        if (corners) {
            const ms = CORNER_MARKER_SIZE;
            const w = img.width;
            const h = img.height;
            const halfMs = ms / 2;
            // Check if corners are at the image edges (no border, already aligned)
            const expectedTL = { x: halfMs, y: halfMs };
            const expectedTR = { x: w - halfMs, y: halfMs };
            const expectedBL = { x: halfMs, y: h - halfMs };
            const expectedBR = { x: w - halfMs, y: h - halfMs };
            const dist = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
            const alreadyAligned = dist(corners.tl, expectedTL) < ms &&
                dist(corners.tr, expectedTR) < ms &&
                dist(corners.bl, expectedBL) < ms &&
                dist(corners.br, expectedBR) < ms;
            if (alreadyAligned) {
                log(`Slide ${i + 1}: corners at edges — no correction needed.`);
                slidesImageData.push(img);
            }
            else {
                // Corners are offset from edges (bordered image or camera photo).
                // Check if the corners form an axis-aligned rectangle (digital border)
                // vs a rotated/skewed quad (camera photo).
                const isAxisAligned = Math.abs(corners.tl.y - corners.tr.y) < 3 &&
                    Math.abs(corners.bl.y - corners.br.y) < 3 &&
                    Math.abs(corners.tl.x - corners.bl.x) < 3 &&
                    Math.abs(corners.tr.x - corners.br.x) < 3;
                if (isAxisAligned) {
                    // Digital bordered image: crop to inner region with integer coordinates
                    // (no bilinear resampling — preserves pixel-perfect data)
                    const cropX = Math.round(corners.tl.x - halfMs);
                    const cropY = Math.round(corners.tl.y - halfMs);
                    const cropW = Math.round(corners.tr.x + halfMs) - cropX;
                    const cropH = Math.round(corners.bl.y + halfMs) - cropY;
                    log(`Slide ${i + 1}: bordered image — integer crop (${cropX},${cropY}) ${cropW}x${cropH}`);
                    const cropped = new ImageData(cropW, cropH);
                    for (let cy = 0; cy < cropH; cy++) {
                        for (let cx = 0; cx < cropW; cx++) {
                            const si = ((cropY + cy) * w + (cropX + cx)) * 4;
                            const di = (cy * cropW + cx) * 4;
                            cropped.data[di] = img.data[si];
                            cropped.data[di + 1] = img.data[si + 1];
                            cropped.data[di + 2] = img.data[si + 2];
                            cropped.data[di + 3] = img.data[si + 3];
                        }
                    }
                    slidesImageData.push(cropped);
                }
                else {
                    // Camera photo with rotation/skew: use perspective correction
                    log(`Slide ${i + 1}: skewed corners — applying perspective correction.`);
                    slidesImageData.push(perspectiveCorrect(img, corners, img.width));
                }
            }
        }
        else {
            slidesImageData.push(img);
        }
    }
    // ── Step 3: Extract metadata from slide 0 ───────────────────────────
    onProgress(12, 'Reading metadata...');
    let slide0 = slidesImageData[0];
    const pattern0 = (slidePatterns[0] ?? 'None');
    if (pattern0 !== 'None') {
        slide0 = unscramble(cloneImageData(slide0), pattern0);
    }
    const pbs = userPbs !== 'auto' ? userPbs : readPixelBlockSize(slide0, log);
    // Try without markers first, then with
    let metadata = null;
    log('Attempting metadata parse (no markers)...');
    let bytes = readBytesFromImageData(slide0, pbs, false);
    metadata = tryParseMetadata(bytes, pbs, log);
    if (metadata?.hasCornerMarkers) {
        metadata = null; // wrong read — retry
    }
    if (!metadata) {
        log('Attempting metadata parse (with markers)...');
        bytes = readBytesFromImageData(slide0, pbs, true);
        metadata = tryParseMetadata(bytes, pbs, log);
    }
    if (!metadata) {
        throw new Error('Could not read metadata from slide 0. Check patterns, block size, and slide order.');
    }
    log('Decoded metadata', metadata);
    // ── Step 4: Read all byte data from all slides ──────────────────────
    onProgress(20, 'Extracting data from slides...');
    const allBytes = [];
    for (let s = 0; s < slidesImageData.length; s++) {
        let current = slidesImageData[s];
        const pat = (slidePatterns[s] ?? 'None');
        if (pat !== 'None') {
            current = unscramble(cloneImageData(current), pat);
        }
        const slideBytes = readBytesFromImageData(current, pbs, metadata.hasCornerMarkers ?? false);
        for (let i = 0; i < slideBytes.length; i++)
            allBytes.push(slideBytes[i]);
    }
    // ── Step 5: Strip metadata from byte stream ─────────────────────────
    const metaLen = (allBytes[0] << 16) | (allBytes[1] << 8) | allBytes[2];
    const metaWithHeader = BYTES_PER_PIXEL + metaLen;
    const metaPadding = (BYTES_PER_PIXEL - (metaWithHeader % BYTES_PER_PIXEL)) % BYTES_PER_PIXEL;
    const dataStart = metaWithHeader + metaPadding;
    // Calculate the exact encrypted data length so we don't include trailing
    // white-pixel padding from unused slide areas. AES-GCM's auth tag is at
    // the end of the ciphertext, so even a single extra byte causes failure.
    const effectiveEncryption = userEncryption ?? metadata.encryptionMethod ?? 'none';
    let encryptedLen = metadata.size;
    if (effectiveEncryption === 'aes-256-gcm') {
        encryptedLen += AES_GCM_OVERHEAD_BYTES; // salt(16) + iv(12) + tag(16) = 44
    }
    // XOR and 'none' have same length as original
    const rawBuffer = new Uint8Array(allBytes.slice(dataStart, dataStart + encryptedLen));
    // ── Step 6: Decrypt ─────────────────────────────────────────────────
    onProgress(90, 'Decrypting...');
    if (effectiveEncryption !== 'none' && !secretKey) {
        throw new Error(`Decryption method '${effectiveEncryption}' requires a secret key.`);
    }
    if (metadata.isScrambled && (!slidePatterns.length || slidePatterns.every((p) => p === 'None'))) {
        throw new Error('This file is scrambled — provide the pattern sequence to decode.');
    }
    const finalBuffer = await decrypt(rawBuffer, effectiveEncryption, secretKey);
    // ── Step 7: Trim to exact original size & verify integrity ──────────
    onProgress(96, 'Verifying integrity...');
    const trimmed = finalBuffer.slice(0, metadata.size);
    const blob = new Blob([trimmed], { type: metadata.type });
    const decodedHash = await sha256(trimmed.buffer);
    const integrityOk = decodedHash === metadata.fileHash;
    onProgress(100, integrityOk ? 'Decode complete — integrity verified.' : 'Decode complete — HASH MISMATCH.');
    return {
        name: metadata.name,
        type: metadata.type,
        size: metadata.size,
        blob,
        metadata,
        decodedHash,
        integrityOk,
    };
}
//# sourceMappingURL=pixelGridCodec.js.map