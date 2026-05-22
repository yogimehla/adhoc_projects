// ---------------------------------------------------------------------------
// useChromaDecode  —  React hook for decoding ChromaStash slides back to data
// ---------------------------------------------------------------------------
import { useState, useCallback } from 'react';
import { decode as coreDecode, } from '@muulorigin/chromastash-core';
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
export function useChromaDecode(logger) {
    const [progress, setProgress] = useState(0);
    const [statusMessage, setStatusMessage] = useState('');
    const [isDecoding, setIsDecoding] = useState(false);
    const [error, setError] = useState(null);
    const [result, setResult] = useState(null);
    const log = logger ?? (() => { });
    const reset = useCallback(() => {
        setProgress(0);
        setStatusMessage('');
        setIsDecoding(false);
        setError(null);
        setResult(null);
    }, []);
    const decode = useCallback(async (slides, options) => {
        reset();
        setIsDecoding(true);
        try {
            const decoded = await coreDecode(slides, options, (pct, msg) => {
                setProgress(pct);
                setStatusMessage(msg);
            }, log);
            setResult(decoded);
            setProgress(100);
            setStatusMessage(decoded.integrityOk
                ? `Decoded "${decoded.name}" — integrity verified.`
                : `Decoded "${decoded.name}" — WARNING: hash mismatch.`);
            return decoded;
        }
        catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            setError(message);
            throw err;
        }
        finally {
            setIsDecoding(false);
        }
    }, [log, reset]);
    return { decode, progress, statusMessage, isDecoding, error, result, reset };
}
//# sourceMappingURL=useChromaDecode.js.map