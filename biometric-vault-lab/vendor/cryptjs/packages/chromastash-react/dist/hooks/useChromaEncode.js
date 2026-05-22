// ---------------------------------------------------------------------------
// useChromaEncode  —  React hook for encoding data into ChromaStash slides
// ---------------------------------------------------------------------------
import { useState, useCallback, useRef } from 'react';
import { encode as coreEncode, } from '@muulorigin/chromastash-core';
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
export function useChromaEncode(logger) {
    const [progress, setProgress] = useState(0);
    const [statusMessage, setStatusMessage] = useState('');
    const [isEncoding, setIsEncoding] = useState(false);
    const [error, setError] = useState(null);
    const abortRef = useRef(false);
    const log = logger ?? (() => { });
    const reset = useCallback(() => {
        setProgress(0);
        setStatusMessage('');
        setIsEncoding(false);
        setError(null);
        abortRef.current = false;
    }, []);
    const encode = useCallback(async (data, options) => {
        reset();
        setIsEncoding(true);
        try {
            const result = await coreEncode(data, options, (pct, msg) => {
                setProgress(pct);
                setStatusMessage(msg);
            }, log);
            setProgress(100);
            setStatusMessage('Encoding complete.');
            return result;
        }
        catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            setError(message);
            throw err;
        }
        finally {
            setIsEncoding(false);
        }
    }, [log, reset]);
    return { encode, progress, statusMessage, isEncoding, error, reset };
}
//# sourceMappingURL=useChromaEncode.js.map