import { type DecodeOptions, type DecodeResult, type Logger } from '@muulorigin/chromastash-core';
export interface UseChromaDecodeReturn {
    /** Decode PNG slides back to the original file. */
    decode: (slides: (Blob | File)[], options?: DecodeOptions) => Promise<DecodeResult>;
    /** Current progress 0-100. */
    progress: number;
    /** Human-readable status message. */
    statusMessage: string;
    /** True while decoding is in progress. */
    isDecoding: boolean;
    /** Error message from the last failed decode, or null. */
    error: string | null;
    /** The last successful decode result (persists until next decode or reset). */
    result: DecodeResult | null;
    /** Reset state to idle. */
    reset: () => void;
}
/**
 * React hook that wraps `@muulorigin/chromastash-core/decode` with
 * reactive progress tracking and result storage.
 *
 * @example
 * ```tsx
 * const { decode, progress, isDecoding, result } = useChromaDecode();
 *
 * const handleRestore = async (slideFiles: File[]) => {
 *   const { blob, name, integrityOk } = await decode(slideFiles, {
 *     encryption: 'aes-256-gcm',
 *     secretKey: userPassword,
 *   });
 *   if (!integrityOk) showWarning('Hash mismatch — file may be corrupt.');
 *   await backupCore.importProject(blob);
 * };
 * ```
 */
export declare function useChromaDecode(logger?: Logger): UseChromaDecodeReturn;
//# sourceMappingURL=useChromaDecode.d.ts.map