import React from 'react';
import type { ChromaConfig } from '@muulorigin/chromastash-core';
export interface ChromaConfigLabels {
    resolution?: string;
    pixelBlockSize?: string;
    cornerMarkers?: string;
    addBorder?: string;
    encryption?: string;
    advancedTitle?: string;
    slidePatterns?: string;
    setAllTo?: string;
    patternWarning?: string;
    estimatePrefix?: string;
    estimateSuffix?: string;
    noFileNote?: string;
    resetDefaults?: string;
}
export interface ChromaConfigPanelProps {
    config: ChromaConfig;
    onChange: (config: ChromaConfig) => void;
    /** File size in bytes — needed for slide estimate. */
    fileSize?: number;
    className?: string;
    labels?: Partial<ChromaConfigLabels>;
}
export declare const ChromaConfigPanel: React.FC<ChromaConfigPanelProps>;
//# sourceMappingURL=ChromaConfigPanel.d.ts.map