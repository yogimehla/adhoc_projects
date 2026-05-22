import type { ChromaConfig } from '@muulorigin/chromastash-core';
export interface ChromaConfigStorage {
    get: (key: string) => Promise<string | null>;
    set: (key: string, value: string) => Promise<void>;
}
export interface UseChromaConfigOptions {
    /** Storage key prefix. @default 'chromastash' */
    storageKey?: string;
    /** Custom storage adapter. @default localStorage */
    storage?: ChromaConfigStorage;
}
export interface UseChromaConfigReturn {
    config: ChromaConfig;
    updateConfig: (partial: Partial<ChromaConfig>) => void;
    resetToDefaults: () => void;
    /** false until config is loaded from storage */
    isLoaded: boolean;
}
export declare function useChromaConfig(options?: UseChromaConfigOptions): UseChromaConfigReturn;
//# sourceMappingURL=useChromaConfig.d.ts.map