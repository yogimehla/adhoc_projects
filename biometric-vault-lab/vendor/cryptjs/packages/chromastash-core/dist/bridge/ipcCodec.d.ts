import type { EncodeOptions, EncodeResult, DecodeOptions, DecodeResult, ProgressCallback, Logger } from '../types.js';
export declare function ipcEncode(data: ArrayBuffer | Blob, options?: EncodeOptions, onProgress?: ProgressCallback, log?: Logger): Promise<EncodeResult>;
export declare function ipcDecode(slides: (Blob | File)[], options?: DecodeOptions, onProgress?: ProgressCallback, log?: Logger): Promise<DecodeResult>;
//# sourceMappingURL=ipcCodec.d.ts.map