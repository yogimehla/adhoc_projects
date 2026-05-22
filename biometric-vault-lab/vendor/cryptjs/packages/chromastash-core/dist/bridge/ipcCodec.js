const pending = new Map();
let handlerInstalled = false;
function installResultHandler() {
    if (handlerInstalled)
        return;
    handlerInstalled = true;
    const existing = window._externalMessageResult;
    window._externalMessageResult = (result) => {
        const requestId = result?._requestId;
        if (requestId && pending.has(requestId)) {
            const req = pending.get(requestId);
            clearTimeout(req.timeoutId);
            pending.delete(requestId);
            if (result.ok === false) {
                req.reject(new Error(result.error || 'MoBrowser returned an error'));
            }
            else {
                req.resolve(result);
            }
            return;
        }
        if (existing && existing !== window._externalMessageResult) {
            existing(result);
        }
    };
}
function generateRequestId() {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }
    return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
function sendIpc(payload) {
    return new Promise((resolve, reject) => {
        installResultHandler();
        const requestId = generateRequestId();
        const innerPayload = JSON.stringify({ ...payload, _requestId: requestId });
        const outerPayload = JSON.stringify({
            type: 'external_message',
            value: innerPayload,
        });
        const timeoutId = setTimeout(() => {
            if (pending.has(requestId)) {
                pending.delete(requestId);
                reject(new Error('MoBrowser IPC timeout after 120s'));
            }
        }, 120_000);
        pending.set(requestId, { resolve, reject, timeoutId });
        try {
            window.externalMessage.send(outerPayload);
        }
        catch (err) {
            clearTimeout(timeoutId);
            pending.delete(requestId);
            reject(err instanceof Error ? err : new Error(String(err)));
        }
    });
}
// ── Base64 helpers ──────────────────────────────────────────────────────
async function blobOrBufferToBase64(data) {
    const buffer = data instanceof Blob ? await data.arrayBuffer() : data;
    const bytes = new Uint8Array(buffer);
    let binary = '';
    const chunkSize = 0x8000;
    for (let i = 0; i < bytes.length; i += chunkSize) {
        binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunkSize)));
    }
    return btoa(binary);
}
function base64ToBlob(base64, mimeType) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return new Blob([bytes], { type: mimeType });
}
async function fileToBase64(file) {
    return blobOrBufferToBase64(file);
}
// ── Public: ipcEncode ───────────────────────────────────────────────────
export async function ipcEncode(data, options = {}, onProgress = () => { }, log = () => { }) {
    onProgress(5, 'Preparing data for native encoder...');
    const dataBase64 = await blobOrBufferToBase64(data);
    onProgress(15, 'Sending to MoBrowser native encoder...');
    log('Routing encode through MoBrowser Rust handler', {
        dataSize: dataBase64.length,
    });
    const response = await sendIpc({
        type: 'CHROMASTASH_ENCODE',
        dataBase64,
        fileName: options.fileName ?? 'encoded-file',
        mimeType: options.mimeType ?? 'application/octet-stream',
        options: {
            encryption: options.encryption ?? 'aes-256-gcm',
            secretKey: options.secretKey,
            resolution: options.resolution ?? 512,
            pixelBlockSize: options.pixelBlockSize ?? 1,
            cornerMarkers: options.cornerMarkers ?? true,
            addBorder: options.addBorder ?? false,
            slidePatterns: options.slidePatterns ?? [],
        },
    });
    onProgress(85, 'Converting slides back to Blobs...');
    if (!Array.isArray(response.slides)) {
        throw new Error('Invalid response from MoBrowser: missing slides array');
    }
    const slides = response.slides.map((b64) => base64ToBlob(b64, 'image/png'));
    const metadata = response.metadata;
    onProgress(100, 'Encoding complete.');
    return { slides, metadata };
}
// ── Public: ipcDecode ───────────────────────────────────────────────────
export async function ipcDecode(slides, options = {}, onProgress = () => { }, log = () => { }) {
    onProgress(5, 'Preparing slides for native decoder...');
    const sorted = [...slides].sort((a, b) => {
        const nameA = a.name ?? '';
        const nameB = b.name ?? '';
        return nameA.localeCompare(nameB, undefined, { numeric: true, sensitivity: 'base' });
    });
    const slidesBase64 = [];
    for (let i = 0; i < sorted.length; i++) {
        onProgress(5 + (i / sorted.length) * 10, `Preparing slide ${i + 1}/${sorted.length}...`);
        slidesBase64.push(await fileToBase64(sorted[i]));
    }
    onProgress(15, 'Sending to MoBrowser native decoder...');
    log('Routing decode through MoBrowser Rust handler', {
        slideCount: slidesBase64.length,
    });
    const response = await sendIpc({
        type: 'CHROMASTASH_DECODE',
        slidesBase64,
        options: {
            encryption: options.encryption,
            secretKey: options.secretKey,
            slidePatterns: options.slidePatterns ?? [],
            pixelBlockSize: options.pixelBlockSize ?? 'auto',
        },
    });
    onProgress(90, 'Converting result back to Blob...');
    if (typeof response.dataBase64 !== 'string' || !response.metadata) {
        throw new Error('Invalid response from MoBrowser: missing dataBase64 or metadata');
    }
    const metadata = response.metadata;
    const blob = base64ToBlob(response.dataBase64, metadata.type || 'application/octet-stream');
    onProgress(100, response.integrityOk
        ? 'Decode complete — integrity verified.'
        : 'Decode complete — HASH MISMATCH.');
    return {
        name: metadata.name,
        type: metadata.type,
        size: metadata.size,
        blob,
        metadata,
        decodedHash: response.decodedHash ?? metadata.fileHash,
        integrityOk: response.integrityOk === true,
    };
}
//# sourceMappingURL=ipcCodec.js.map