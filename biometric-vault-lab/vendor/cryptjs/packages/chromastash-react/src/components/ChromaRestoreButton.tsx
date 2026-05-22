// ---------------------------------------------------------------------------
// ChromaRestoreButton  —  Drop-in "Restore from Slides" button
// ---------------------------------------------------------------------------
// Opens a file picker for PNG slides (or a ZIP), decodes them back to the
// original file, and hands the result to the consumer app for import.
// ---------------------------------------------------------------------------

import React, { useRef, useCallback, useState } from 'react';
import { useChromaDecode } from '../hooks/useChromaDecode.js';
import type { DecodeOptions, DecodeResult, Logger } from '@muulorigin/chromastash-core';

export interface ChromaRestoreButtonProps {
  /**
   * Called with the decoded result. The consumer decides what to do
   * (e.g. backupCore.importProject(result.blob)).
   */
  onRestored: (result: DecodeResult) => Promise<void>;

  /** Decode options (encryption, patterns, block size). */
  decodeOptions?: DecodeOptions;

  /** Whether to accept a .zip of slides instead of individual PNGs.
   *  When true, the component unpacks the ZIP before decoding. @default true */
  acceptZip?: boolean;

  /** Button label when idle. @default "Restore from Slides" */
  label?: string;

  /** CSS class applied to the outer wrapper div. */
  className?: string;

  /** CSS class applied to the button element. */
  buttonClassName?: string;

  /** CSS class applied to the progress bar container. */
  progressClassName?: string;

  disabled?: boolean;

  logger?: Logger;

  /** Called on error. If omitted, error shows inline. */
  onError?: (error: Error) => void;
}

export const ChromaRestoreButton: React.FC<ChromaRestoreButtonProps> = ({
  onRestored,
  decodeOptions = {},
  acceptZip = true,
  label = 'Restore from Slides',
  className = '',
  buttonClassName = '',
  progressClassName = '',
  disabled = false,
  logger,
  onError,
}) => {
  const { decode, progress, statusMessage, isDecoding, error, reset } = useChromaDecode(logger);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [phase, setPhase] = useState<'idle' | 'unpacking' | 'decoding' | 'importing' | 'done' | 'error'>('idle');

  const handleFiles = useCallback(
    async (files: FileList | File[]) => {
      reset();
      try {
        let slideFiles: File[] = Array.from(files);

        // If a single ZIP was selected, unpack it
        if (slideFiles.length === 1 && slideFiles[0].name.endsWith('.zip') && acceptZip) {
          setPhase('unpacking');
          // Dynamic import — jszip must be installed in the consumer app
          let JSZip: any;
          try {
            JSZip = (await import('jszip' /* webpackIgnore: true */)).default;
          } catch {
            throw new Error(
              'jszip is required to unpack ZIP files. Install it: npm install jszip',
            );
          }
          const zip = await JSZip.loadAsync(slideFiles[0]);
          const pngFiles: File[] = [];

          const entries: Record<string, any> = zip.files;
          for (const [name, entry] of Object.entries(entries)) {
            if (entry.dir || !name.toLowerCase().endsWith('.png')) continue;
            const blob: Blob = await entry.async('blob');
            pngFiles.push(new File([blob], name, { type: 'image/png' }));
          }

          if (pngFiles.length === 0) {
            throw new Error('ZIP contains no PNG slides.');
          }
          slideFiles = pngFiles;
        }

        // Filter to only PNG/image files
        slideFiles = slideFiles.filter(
          (f) => f.type.startsWith('image/') || f.name.toLowerCase().endsWith('.png'),
        );
        if (slideFiles.length === 0) {
          throw new Error('No valid image files selected.');
        }

        // Decode
        setPhase('decoding');
        const result = await decode(slideFiles, decodeOptions);

        // Hand to consumer
        setPhase('importing');
        await onRestored(result);

        setPhase('done');
        setTimeout(() => setPhase('idle'), 3000);
      } catch (err) {
        setPhase('error');
        if (onError && err instanceof Error) {
          onError(err);
        }
      }
    },
    [decode, decodeOptions, acceptZip, onRestored, reset, onError],
  );

  const handleClick = () => fileInputRef.current?.click();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFiles(e.target.files);
      e.target.value = ''; // reset so same files can be selected again
    }
  };

  const isWorking = phase === 'unpacking' || phase === 'decoding' || phase === 'importing';
  const barColor = phase === 'error' ? '#e24b4a' : '#1d9e75';

  const acceptAttr = acceptZip ? 'image/png,.zip' : 'image/png';

  const statusText = (() => {
    switch (phase) {
      case 'unpacking': return 'Unpacking ZIP...';
      case 'decoding': return statusMessage || 'Decoding...';
      case 'importing': return 'Importing backup...';
      case 'done': return 'Restore complete!';
      case 'error': return error ?? 'An error occurred.';
      default: return '';
    }
  })();

  return (
    <div className={className} data-chromastash-restore>
      <input
        ref={fileInputRef}
        type="file"
        accept={acceptAttr}
        multiple
        onChange={handleChange}
        style={{ display: 'none' }}
      />

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
