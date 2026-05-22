import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// ---------------------------------------------------------------------------
// ChromaBackupButton  —  Drop-in "Secure Backup" button with progress UI
// ---------------------------------------------------------------------------
// Accepts a data blob (e.g. .ccbk from Cognitive Canvas, ZIP from POS),
// encodes it into ChromaStash slides, and triggers a ZIP download.
// ---------------------------------------------------------------------------
import { useState, useCallback } from 'react';
import { useChromaEncode } from '../hooks/useChromaEncode.js';
export const ChromaBackupButton = ({ onGetData, onSlidesReady, encodeOptions = {}, label = 'Secure Backup', className = '', buttonClassName = '', progressClassName = '', disabled = false, logger, onError, }) => {
    const { encode, progress, statusMessage, isEncoding, error, reset } = useChromaEncode(logger);
    const [phase, setPhase] = useState('idle');
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
        }
        catch (err) {
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
    return (_jsxs("div", { className: className, "data-chromastash-backup": true, children: [_jsx("button", { onClick: handleClick, disabled: disabled || isWorking, className: buttonClassName, type: "button", children: isWorking ? `${Math.round(progress)}%` : label }), (isWorking || phase === 'done' || phase === 'error') && (_jsxs("div", { className: progressClassName, "data-chromastash-progress": true, children: [isWorking && (_jsx("div", { style: {
                            width: '100%',
                            height: 4,
                            backgroundColor: 'rgba(128,128,128,0.2)',
                            borderRadius: 2,
                            overflow: 'hidden',
                            marginTop: 8,
                        }, children: _jsx("div", { style: {
                                width: `${progress}%`,
                                height: '100%',
                                backgroundColor: barColor,
                                transition: 'width 200ms ease',
                            } }) })), statusText && (_jsx("div", { style: {
                            fontSize: 12,
                            marginTop: 4,
                            color: phase === 'error' ? '#e24b4a' : phase === 'done' ? '#1d9e75' : undefined,
                        }, children: statusText }))] }))] }));
};
//# sourceMappingURL=ChromaBackupButton.js.map