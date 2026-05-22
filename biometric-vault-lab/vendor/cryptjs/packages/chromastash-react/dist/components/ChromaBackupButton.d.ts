import React from 'react';
import type { EncodeOptions, Logger } from '@muulorigin/chromastash-core';
export interface ChromaBackupButtonProps {
    /**
     * Called when the user clicks backup. Must return the data to encode.
     * This is where you run your app's export logic (e.g. backupCore.export).
     */
    onGetData: () => Promise<{
        data: Blob | ArrayBuffer;
        fileName: string;
        mimeType?: string;
    }>;
    /**
     * Called with the encoded slide blobs after encoding completes.
     * The consumer decides how to save them (ZIP download, GitHub push, etc).
     */
    onSlidesReady: (slides: Blob[], metadata: {
        fileName: string;
        totalSlides: number;
    }) => Promise<void>;
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
export declare const ChromaBackupButton: React.FC<ChromaBackupButtonProps>;
//# sourceMappingURL=ChromaBackupButton.d.ts.map