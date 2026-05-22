import React from 'react';
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
export declare const ChromaRestoreButton: React.FC<ChromaRestoreButtonProps>;
//# sourceMappingURL=ChromaRestoreButton.d.ts.map