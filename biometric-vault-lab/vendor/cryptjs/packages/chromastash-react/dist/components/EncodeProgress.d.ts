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
export declare const EncodeProgress: React.FC<EncodeProgressProps>;
//# sourceMappingURL=EncodeProgress.d.ts.map