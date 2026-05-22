import { type EncodeOptions, type EncodeResult, type Logger } from '@muulorigin/chromastash-core';
export interface UseChromaEncodeReturn {
    /** Encode a blob/buffer into PNG slides. Resolves when complete. */
    encode: (data: ArrayBuffer | Blob, options?: EncodeOptions) => Promise<EncodeResult>;
    /** Current progress 0-100. */
    progress: number;
    /** Human-readable status message. */
    statusMessage: string;
    /** True while encoding is in progress. */
    isEncoding: boolean;
    /** Error message from the last failed encode, or null. */
    error: string | null;
    /** Reset state (progress, error, message) to idle. */
    reset: () => void;
}
/**
 * React hook that wraps `@muulorigin/chromastash-core/encode` with
 * reactive progress tracking.
 *
 * @param logger  Optional logger function for structured debug output.
 *
 * @example
 * ```tsx
 * const { encode, progress, isEncoding } = useChromaEncode();
 *
 * const handleBackup = async () => {
 *   const ccbkBlob = await backupCore.exportProject(projectId);
 *   const { slides } = await encode(ccbkBlob, {
 *     encryption: 'aes-256-gcm',
 *     secretKey: userPassword,
 *     fileName: `${project.name}.ccbk`,
 *   });
 *   // slides is Blob[] — download as ZIP or store individually
 * };
 * ```
 */
export declare function useChromaEncode(logger?: Logger): UseChromaEncodeReturn;
//# sourceMappingURL=useChromaEncode.d.ts.map