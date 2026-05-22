// ---------------------------------------------------------------------------
// Minimal pure-JS PNG encoder / decoder
// ---------------------------------------------------------------------------
// Bypasses the canvas API entirely to avoid browser color-management issues
// (color space conversion, premultiplied alpha, ICC profile embedding) that
// corrupt pixel values during the canvas → PNG → canvas round-trip.
//
// Uses the browser's built-in CompressionStream / DecompressionStream for
// zlib deflate, which is what PNG IDAT chunks require.
// ---------------------------------------------------------------------------
// ── CRC-32 (used by PNG chunk encoding) ────────────────────────────────────
const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++)
        c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crcTable[n] = c;
}
function crc32(buf) {
    let crc = 0xffffffff;
    for (let i = 0; i < buf.length; i++)
        crc = crcTable[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
    return (crc ^ 0xffffffff) >>> 0;
}
// ── Helpers ────────────────────────────────────────────────────────────────
function write32(arr, offset, value) {
    arr[offset] = (value >>> 24) & 0xff;
    arr[offset + 1] = (value >>> 16) & 0xff;
    arr[offset + 2] = (value >>> 8) & 0xff;
    arr[offset + 3] = value & 0xff;
}
function read32(arr, offset) {
    return (((arr[offset] << 24) | (arr[offset + 1] << 16) | (arr[offset + 2] << 8) | arr[offset + 3]) >>> 0);
}
function makeChunk(type, data) {
    const typeBytes = new Uint8Array([
        type.charCodeAt(0), type.charCodeAt(1), type.charCodeAt(2), type.charCodeAt(3),
    ]);
    const chunk = new Uint8Array(4 + 4 + data.length + 4); // length + type + data + crc
    write32(chunk, 0, data.length);
    chunk.set(typeBytes, 4);
    chunk.set(data, 8);
    // CRC covers type + data
    const crcInput = new Uint8Array(4 + data.length);
    crcInput.set(typeBytes, 0);
    crcInput.set(data, 4);
    write32(chunk, 8 + data.length, crc32(crcInput));
    return chunk;
}
// ── Compress / Decompress via browser streams ──────────────────────────────
async function deflate(data) {
    const cs = new CompressionStream('deflate');
    const writer = cs.writable.getWriter();
    writer.write(data);
    writer.close();
    const reader = cs.readable.getReader();
    const chunks = [];
    while (true) {
        const { done, value } = await reader.read();
        if (done)
            break;
        chunks.push(value);
    }
    const totalLen = chunks.reduce((s, c) => s + c.length, 0);
    const result = new Uint8Array(totalLen);
    let offset = 0;
    for (const c of chunks) {
        result.set(c, offset);
        offset += c.length;
    }
    return result;
}
async function inflate(data) {
    const ds = new DecompressionStream('deflate');
    const writer = ds.writable.getWriter();
    writer.write(data);
    writer.close();
    const reader = ds.readable.getReader();
    const chunks = [];
    while (true) {
        const { done, value } = await reader.read();
        if (done)
            break;
        chunks.push(value);
    }
    const totalLen = chunks.reduce((s, c) => s + c.length, 0);
    const result = new Uint8Array(totalLen);
    let offset = 0;
    for (const c of chunks) {
        result.set(c, offset);
        offset += c.length;
    }
    return result;
}
// ── PNG signature ──────────────────────────────────────────────────────────
const PNG_SIGNATURE = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
// ═══════════════════════════════════════════════════════════════════════════
//  ENCODE: RGBA pixels → PNG Blob
// ═══════════════════════════════════════════════════════════════════════════
/**
 * Encode raw RGBA pixel data into a PNG Blob without using canvas.
 * @param rgba  Flat RGBA array (length = width * height * 4)
 * @param width  Image width in pixels
 * @param height Image height in pixels
 */
export async function rgbaToPngBlob(rgba, width, height) {
    // Build IHDR data (13 bytes)
    const ihdrData = new Uint8Array(13);
    write32(ihdrData, 0, width);
    write32(ihdrData, 4, height);
    ihdrData[8] = 8; // bit depth
    ihdrData[9] = 6; // color type: RGBA
    ihdrData[10] = 0; // compression method
    ihdrData[11] = 0; // filter method
    ihdrData[12] = 0; // interlace: none
    // Build raw pixel data with filter bytes (filter type 0 = None for each row)
    const rowLen = width * 4;
    const raw = new Uint8Array(height * (1 + rowLen));
    for (let y = 0; y < height; y++) {
        const rowOffset = y * (1 + rowLen);
        raw[rowOffset] = 0; // filter type: None
        raw.set(rgba.subarray(y * rowLen, y * rowLen + rowLen), rowOffset + 1);
    }
    // Compress with deflate (zlib format)
    const compressed = await deflate(raw);
    // Assemble chunks
    const ihdrChunk = makeChunk('IHDR', ihdrData);
    const idatChunk = makeChunk('IDAT', compressed);
    const iendChunk = makeChunk('IEND', new Uint8Array(0));
    // Concatenate: signature + IHDR + IDAT + IEND
    const totalLen = PNG_SIGNATURE.length + ihdrChunk.length + idatChunk.length + iendChunk.length;
    const png = new Uint8Array(totalLen);
    let off = 0;
    png.set(PNG_SIGNATURE, off);
    off += PNG_SIGNATURE.length;
    png.set(ihdrChunk, off);
    off += ihdrChunk.length;
    png.set(idatChunk, off);
    off += idatChunk.length;
    png.set(iendChunk, off);
    return new Blob([png], { type: 'image/png' });
}
/**
 * Decode a PNG Blob into raw RGBA pixel data without using canvas.
 */
export async function pngBlobToRgba(blob) {
    const buf = new Uint8Array(await blob.arrayBuffer());
    // Verify PNG signature
    for (let i = 0; i < 8; i++) {
        if (buf[i] !== PNG_SIGNATURE[i])
            throw new Error('Not a valid PNG file');
    }
    let width = 0, height = 0, bitDepth = 0, colorType = 0;
    const idatChunks = [];
    let offset = 8; // skip signature
    // Parse chunks
    while (offset < buf.length) {
        const chunkLen = read32(buf, offset);
        const chunkType = String.fromCharCode(buf[offset + 4], buf[offset + 5], buf[offset + 6], buf[offset + 7]);
        const chunkData = buf.subarray(offset + 8, offset + 8 + chunkLen);
        if (chunkType === 'IHDR') {
            width = read32(chunkData, 0);
            height = read32(chunkData, 4);
            bitDepth = chunkData[8];
            colorType = chunkData[9];
        }
        else if (chunkType === 'IDAT') {
            idatChunks.push(chunkData);
        }
        else if (chunkType === 'IEND') {
            break;
        }
        offset += 8 + chunkLen + 4; // length(4) + type(4) + data + crc(4)
    }
    if (width === 0 || height === 0)
        throw new Error('Invalid PNG: missing IHDR');
    if (bitDepth !== 8 || colorType !== 6) {
        throw new Error(`Unsupported PNG format: bitDepth=${bitDepth}, colorType=${colorType}. Expected 8-bit RGBA.`);
    }
    // Concatenate all IDAT data
    const totalIdatLen = idatChunks.reduce((s, c) => s + c.length, 0);
    const compressedData = new Uint8Array(totalIdatLen);
    let pos = 0;
    for (const c of idatChunks) {
        compressedData.set(c, pos);
        pos += c.length;
    }
    // Decompress
    const raw = await inflate(compressedData);
    // Unfilter rows (we only need to handle filter type 0 = None, which is what we write)
    const rowLen = width * 4;
    const expectedLen = height * (1 + rowLen);
    if (raw.length < expectedLen) {
        throw new Error(`PNG pixel data too short: got ${raw.length}, expected ${expectedLen}`);
    }
    const pixels = new Uint8Array(width * height * 4);
    for (let y = 0; y < height; y++) {
        const filterType = raw[y * (1 + rowLen)];
        const rowStart = y * (1 + rowLen) + 1;
        const rowData = raw.subarray(rowStart, rowStart + rowLen);
        if (filterType === 0) {
            // None
            pixels.set(rowData, y * rowLen);
        }
        else if (filterType === 1) {
            // Sub
            for (let x = 0; x < rowLen; x++) {
                const a = x >= 4 ? pixels[y * rowLen + x - 4] : 0;
                pixels[y * rowLen + x] = (rowData[x] + a) & 0xff;
            }
        }
        else if (filterType === 2) {
            // Up
            for (let x = 0; x < rowLen; x++) {
                const b = y > 0 ? pixels[(y - 1) * rowLen + x] : 0;
                pixels[y * rowLen + x] = (rowData[x] + b) & 0xff;
            }
        }
        else if (filterType === 3) {
            // Average
            for (let x = 0; x < rowLen; x++) {
                const a = x >= 4 ? pixels[y * rowLen + x - 4] : 0;
                const b = y > 0 ? pixels[(y - 1) * rowLen + x] : 0;
                pixels[y * rowLen + x] = (rowData[x] + Math.floor((a + b) / 2)) & 0xff;
            }
        }
        else if (filterType === 4) {
            // Paeth
            for (let x = 0; x < rowLen; x++) {
                const a = x >= 4 ? pixels[y * rowLen + x - 4] : 0;
                const b = y > 0 ? pixels[(y - 1) * rowLen + x] : 0;
                const c = (x >= 4 && y > 0) ? pixels[(y - 1) * rowLen + x - 4] : 0;
                const p = a + b - c;
                const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
                const pr = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
                pixels[y * rowLen + x] = (rowData[x] + pr) & 0xff;
            }
        }
        else {
            throw new Error(`Unsupported PNG filter type: ${filterType}`);
        }
    }
    return { width, height, data: pixels };
}
//# sourceMappingURL=pngCodec.js.map