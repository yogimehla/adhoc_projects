// ---------------------------------------------------------------------------
// Corner-marker detection & perspective correction
// ---------------------------------------------------------------------------
// Detects four black square markers at slide corners, finds their centres,
// then applies a homography transform to produce a clean, axis-aligned
// square image at the target resolution.
// ---------------------------------------------------------------------------
// ── Corner detection ────────────────────────────────────────────────────────
/**
 * Detect four black corner-marker blobs in an image.
 * Returns their centre points or `null` if fewer than 4 candidates are found.
 */
export function detectCorners(imageData) {
    const { width, height, data } = imageData;
    // 1. Binary threshold
    const binary = new Uint8Array(width * height);
    for (let i = 0; i < data.length; i += 4) {
        const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
        if (gray < 100)
            binary[i / 4] = 1;
    }
    // 2. BFS connected components
    const visited = new Uint8Array(width * height);
    const blobs = [];
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const i = y * width + x;
            if (binary[i] !== 1 || visited[i])
                continue;
            const blob = { pixels: [], minX: x, minY: y, maxX: x, maxY: y };
            const queue = [{ x, y }];
            visited[i] = 1;
            while (queue.length > 0) {
                const p = queue.shift();
                blob.pixels.push(p);
                blob.minX = Math.min(blob.minX, p.x);
                blob.minY = Math.min(blob.minY, p.y);
                blob.maxX = Math.max(blob.maxX, p.x);
                blob.maxY = Math.max(blob.maxY, p.y);
                for (const n of [
                    { x: p.x, y: p.y - 1 }, { x: p.x, y: p.y + 1 },
                    { x: p.x - 1, y: p.y }, { x: p.x + 1, y: p.y },
                ]) {
                    if (n.x >= 0 && n.x < width && n.y >= 0 && n.y < height) {
                        const ni = n.y * width + n.x;
                        if (binary[ni] === 1 && !visited[ni]) {
                            visited[ni] = 1;
                            queue.push(n);
                        }
                    }
                }
            }
            blobs.push(blob);
        }
    }
    // 3. Filter for roughly-square marker candidates
    const candidates = blobs.filter((b) => {
        const w = b.maxX - b.minX + 1;
        const h = b.maxY - b.minY + 1;
        const area = b.pixels.length;
        return (w > 5 && h > 5 &&
            w < width / 4 && h < height / 4 &&
            area / (w * h) > 0.7 &&
            Math.abs(w / h - 1) < 0.5);
    });
    if (candidates.length < 4)
        return null;
    // 4. Assign candidates to quadrants
    const cx = width / 2;
    const cy = height / 2;
    const quads = { tl: [], tr: [], bl: [], br: [] };
    for (const c of candidates) {
        const mx = (c.minX + c.maxX) / 2;
        const my = (c.minY + c.maxY) / 2;
        if (mx < cx && my < cy)
            quads.tl.push(c);
        else if (mx > cx && my < cy)
            quads.tr.push(c);
        else if (mx < cx && my > cy)
            quads.bl.push(c);
        else
            quads.br.push(c);
    }
    // Sort each quadrant to find the corner-most blob
    quads.tl.sort((a, b) => (a.minX ** 2 + a.minY ** 2) - (b.minX ** 2 + b.minY ** 2));
    quads.tr.sort((a, b) => ((width - a.maxX) ** 2 + a.minY ** 2) - ((width - b.maxX) ** 2 + b.minY ** 2));
    quads.bl.sort((a, b) => (a.minX ** 2 + (height - a.maxY) ** 2) - (b.minX ** 2 + (height - b.maxY) ** 2));
    quads.br.sort((a, b) => ((width - a.maxX) ** 2 + (height - a.maxY) ** 2) - ((width - b.maxX) ** 2 + (height - b.maxY) ** 2));
    const corners = [quads.tl[0], quads.tr[0], quads.bl[0], quads.br[0]];
    if (corners.some((c) => !c))
        return null;
    const centre = (b) => ({ x: (b.minX + b.maxX) / 2, y: (b.minY + b.maxY) / 2 });
    return {
        tl: centre(corners[0]),
        tr: centre(corners[1]),
        bl: centre(corners[2]),
        br: centre(corners[3]),
    };
}
// ── Perspective transform ───────────────────────────────────────────────────
/**
 * Solve the 8-coefficient homography matrix that maps
 * destination points (p1..p4) to source points (p5..p8).
 * https://math.stackexchange.com/a/296796
 */
function solveHomography(p1, p2, p3, p4, p5, p6, p7, p8) {
    const { x: x1, y: y1 } = p1, { x: x2, y: y2 } = p2;
    const { x: x3, y: y3 } = p3, { x: x4, y: y4 } = p4;
    const { x: x5, y: y5 } = p5, { x: x6, y: y6 } = p6;
    const { x: x7, y: y7 } = p7, { x: x8, y: y8 } = p8;
    const B = [x5, y5, x6, y6, x7, y7, x8, y8];
    const A = [
        [x1, y1, 1, 0, 0, 0, -x1 * x5, -y1 * x5],
        [0, 0, 0, x1, y1, 1, -x1 * y5, -y1 * y5],
        [x2, y2, 1, 0, 0, 0, -x2 * x6, -y2 * x6],
        [0, 0, 0, x2, y2, 1, -x2 * y6, -y2 * y6],
        [x3, y3, 1, 0, 0, 0, -x3 * x7, -y3 * x7],
        [0, 0, 0, x3, y3, 1, -x3 * y7, -y3 * y7],
        [x4, y4, 1, 0, 0, 0, -x4 * x8, -y4 * x8],
        [0, 0, 0, x4, y4, 1, -x4 * y8, -y4 * y8],
    ];
    // Gaussian elimination
    for (let i = 0; i < 8; i++) {
        let maxRow = i;
        for (let k = i + 1; k < 8; k++)
            if (Math.abs(A[k][i]) > Math.abs(A[maxRow][i]))
                maxRow = k;
        [A[i], A[maxRow]] = [A[maxRow], A[i]];
        [B[i], B[maxRow]] = [B[maxRow], B[i]];
        for (let k = i + 1; k < 8; k++) {
            const c = -A[k][i] / A[i][i];
            for (let j = i; j < 8; j++)
                A[k][j] = i === j ? 0 : A[k][j] + c * A[i][j];
            B[k] += c * B[i];
        }
    }
    const x = new Array(8);
    for (let i = 7; i >= 0; i--) {
        x[i] = B[i] / A[i][i];
        for (let k = i - 1; k >= 0; k--)
            B[k] -= A[k][i] * x[i];
    }
    return [...x, 1];
}
/**
 * Perspective-correct an image using four corner points and output a
 * square image of `outputRes × outputRes`.
 */
export function perspectiveCorrect(src, corners, outputRes) {
    const { tl, tr, bl, br } = corners;
    const { width: sw, height: sh, data: sd } = src;
    const dw = outputRes;
    const dh = outputRes;
    const M = solveHomography({ x: 0, y: 0 }, { x: dw, y: 0 }, { x: 0, y: dh }, { x: dw, y: dh }, tl, tr, bl, br);
    const dst = new ImageData(dw, dh);
    const dd = dst.data;
    for (let y = 0; y < dh; y++) {
        for (let x = 0; x < dw; x++) {
            const z = M[6] * x + M[7] * y + 1;
            const sx = (M[0] * x + M[1] * y + M[2]) / z;
            const sy = (M[3] * x + M[4] * y + M[5]) / z;
            if (sx >= 0 && sx < sw && sy >= 0 && sy < sh) {
                const si = (Math.floor(sy) * sw + Math.floor(sx)) * 4;
                const di = (y * dw + x) * 4;
                dd[di] = sd[si];
                dd[di + 1] = sd[si + 1];
                dd[di + 2] = sd[si + 2];
                dd[di + 3] = 255;
            }
        }
    }
    return dst;
}
//# sourceMappingURL=perspective.js.map