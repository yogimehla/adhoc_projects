// ---------------------------------------------------------------------------
// ChromaBackupButton  —  Drop-in "Secure Backup" button with progress UI
// ---------------------------------------------------------------------------
// Accepts a data blob (e.g. .ccbk from Cognitive Canvas, ZIP from POS),
// encodes it into ChromaStash slides, and triggers a ZIP download.
// ---------------------------------------------------------------------------

import React, { useState, useCallback } from 'react';
import { useChromaEncode } from '../hooks/useChromaEncode.js';
import type { EncodeOptions, Logger } from '@muulorigin/chromastash-core';

export interface ChromaBackupButtonProps {
  /**
   * Called when the user clicks backup. Must return the data to encode.
   * This is where you run your app's export logic (e.g. backupCore.export).
   */
  onGetData: () => Promise<{ data: Blob | ArrayBuffer; fileName: string; mimeType?: string }>;

  /**
   * Called with the encoded slide blobs after encoding completes.
   * The consumer decides how to save them (ZIP download, GitHub push, etc).
   */
  onSlidesReady: (slides: Blob[], metadata: { fileName: string; totalSlides: number }) => Promise<void>;

  /** Encode options (encryption, resolution, patterns, etc). */
  encodeOptions?: Omit<EncodeOptions, 'fileName' | 'mimeType'>;

  /** Button label when idle. @default "Secure Backup" */
  label?: string;

  /** CSS class applied to the outer wrapper div. */
  className?: string;

  /** CSS class applied to the button element. */
  buttonClassName?: string;

  /** CSS class applied to the progress bar container. */
  progressClassName?: string;

  /** Disable the button externally. */
  disabled?: boolean;

  /** Optional logger for debug output. */
  logger?: Logger;

  /** Called when an error occurs. If not provided, error is shown in the UI. */
  onError?: (error: Error) => void;
}

export const ChromaBackupButton: React.FC<ChromaBackupButtonProps> = ({
  onGetData,
  onSlidesReady,
  encodeOptions = {},
  label = 'Secure Backup',
  className = '',
  buttonClassName = '',
  progressClassName = '',
  disabled = false,
  logger,
  onError,
}) => {
  const { encode, progress, statusMessage, isEncoding, error, reset } = useChromaEncode(logger);
  const [phase, setPhase] = useState<'idle' | 'exporting' | 'encoding' | 'saving' | 'done' | 'error'>('idle');

  const handleClick = useCallback(async () => {
    reset();
    try {
      // Phase 1: Get data from consumer app
      setPhase('exporting');
      const { data, fileName, mimeType } = await onGetData();

      // Phase 2: Encode to slides
      setPhase('encoding');
      const result = await encode(data, {
        ...encodeOptions,
        fileName,
        mimeType: mimeType ?? 'application/octet-stream',
      });

      // Phase 3: Hand slides to consumer for saving
      setPhase('saving');
      await onSlidesReady(result.slides, {
        fileName,
        totalSlides: result.slides.length,
      });

      setPhase('done');
      setTimeout(() => setPhase('idle'), 3000);
    } catch (err) {
      setPhase('error');
      if (onError && err instanceof Error) {
        onError(err);
      }
    }
  }, [onGetData, onSlidesReady, encodeOptions, encode, reset, onError]);

  const isWorking = phase === 'exporting' || phase === 'encoding' || phase === 'saving';
  const barColor = phase === 'error' ? '#e24b4a' : '#1d9e75';

  const statusText = (() => {
    switch (phase) {
      case 'exporting': return 'Preparing backup data...';
      case 'encoding': return statusMessage || 'Encoding...';
      case 'saving': return 'Saving slides...';
      case 'done': return 'Backup complete!';
      case 'error': return error ?? 'An error occurred.';
      default: return '';
    }
  })();

  return (
    <div className={className} data-chromastash-backup>
      <button
        onClick={handleClick}
        disabled={disabled || isWorking}
        className={buttonClassName}
        type="button"
      >
        {isWorking ? `${Math.round(progress)}%` : label}
      </button>

      {(isWorking || phase === 'done' || phase === 'error') && (
        <div className={progressClassName} data-chromastash-progress>
          {/* Progress bar */}
          {isWorking && (
            <div
              style={{
                width: '100%',
                height: 4,
                backgroundColor: 'rgba(128,128,128,0.2)',
                borderRadius: 2,
                overflow: 'hidden',
                marginTop: 8,
              }}
            >
              <div
                style={{
                  width: `${progress}%`,
                  height: '100%',
                  backgroundColor: barColor,
                  transition: 'width 200ms ease',
                }}
              />
            </div>
          )}

          {/* Status text */}
          {statusText && (
            <div
              style={{
                fontSize: 12,
                marginTop: 4,
                color: phase === 'error' ? '#e24b4a' : phase === 'done' ? '#1d9e75' : undefined,
              }}
            >
              {statusText}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
