// ---------------------------------------------------------------------------
// useChromaDecode  —  React hook for decoding ChromaStash slides back to data
// ---------------------------------------------------------------------------

import { useState, useCallback } from 'react';
import {
  decode as coreDecode,
  type DecodeOptions,
  type DecodeResult,
  type Logger,
} from '@muulorigin/chromastash-core';

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
export function useChromaDecode(logger?: Logger): UseChromaDecodeReturn {
  const [progress, setProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState('');
  const [isDecoding, setIsDecoding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<DecodeResult | null>(null);

  const log: Logger = logger ?? (() => {});

  const reset = useCallback(() => {
    setProgress(0);
    setStatusMessage('');
    setIsDecoding(false);
    setError(null);
    setResult(null);
  }, []);

  const decode = useCallback(
    async (slides: (Blob | File)[], options?: DecodeOptions): Promise<DecodeResult> => {
      reset();
      setIsDecoding(true);

      try {
        const decoded = await coreDecode(
          slides,
          options,
          (pct, msg) => {
            setProgress(pct);
            setStatusMessage(msg);
          },
          log,
        );
        setResult(decoded);
        setProgress(100);
        setStatusMessage(
          decoded.integrityOk
            ? `Decoded "${decoded.name}" — integrity verified.`
            : `Decoded "${decoded.name}" — WARNING: hash mismatch.`,
        );
        return decoded;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setError(message);
        throw err;
      } finally {
        setIsDecoding(false);
      }
    },
    [log, reset],
  );

  return { decode, progress, statusMessage, isDecoding, error, result, reset };
}
