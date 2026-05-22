// ---------------------------------------------------------------------------
// EncodeProgress  —  Minimal progress indicator for encode/decode operations
// ---------------------------------------------------------------------------
// Use this alongside the hooks when you want custom button logic but still
// want a pre-built progress bar.
// ---------------------------------------------------------------------------

import React from 'react';

export interface EncodeProgressProps {
  /** 0-100 progress value. */
  progress: number;
  /** Status message to display. */
  message?: string;
  /** Whether the operation is currently running. */
  isActive: boolean;
  /** Whether the operation ended in error. */
  isError?: boolean;
  /** CSS class for the outer container. */
  className?: string;
}

export const EncodeProgress: React.FC<EncodeProgressProps> = ({
  progress,
  message,
  isActive,
  isError = false,
  className = '',
}) => {
  if (!isActive && !message) return null;

  const barColor = isError ? '#e24b4a' : progress >= 100 ? '#1d9e75' : '#378add';

  return (
    <div className={className} data-chromastash-encode-progress>
      <div
        style={{
          width: '100%',
          height: 4,
          backgroundColor: 'rgba(128,128,128,0.15)',
          borderRadius: 2,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${Math.min(100, Math.max(0, progress))}%`,
            height: '100%',
            backgroundColor: barColor,
            transition: 'width 200ms ease',
          }}
        />
      </div>

      {message && (
        <div
          style={{
            fontSize: 12,
            marginTop: 4,
            color: isError ? '#e24b4a' : undefined,
          }}
        >
          {message}
        </div>
      )}
    </div>
  );
};
