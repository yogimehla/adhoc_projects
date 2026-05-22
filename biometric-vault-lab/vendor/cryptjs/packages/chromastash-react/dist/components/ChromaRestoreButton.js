import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// ---------------------------------------------------------------------------
// ChromaRestoreButton  —  Drop-in "Restore from Slides" button
// ---------------------------------------------------------------------------
// Opens a file picker for PNG slides (or a ZIP), decodes them back to the
// original file, and hands the result to the consumer app for import.
// ---------------------------------------------------------------------------
import { useRef, useCallback, useState } from 'react';
import { useChromaDecode } from '../hooks/useChromaDecode.js';
export const ChromaRestoreButton = ({ onRestored, decodeOptions = {}, acceptZip = true, label = 'Restore from Slides', className = '', buttonClassName = '', progressClassName = '', disabled = false, logger, onError, }) => {
    const { decode, progress, statusMessage, isDecoding, error, reset } = useChromaDecode(logger);
    const fileInputRef = useRef(null);
    const [phase, setPhase] = useState('idle');
    const handleFiles = useCallback(async (files) => {
        reset();
        try {
            let slideFiles = Array.from(files);
            // If a single ZIP was selected, unpack it
            if (slideFiles.length === 1 && slideFiles[0].name.endsWith('.zip') && acceptZip) {
                setPhase('unpacking');
                // Dynamic import — jszip must be installed in the consumer app
                let JSZip;
                try {
                    JSZip = (await import('jszip' /* webpackIgnore: true */)).default;
                }
                catch {
                    throw new Error('jszip is required to unpack ZIP files. Install it: npm install jszip');
                }
                const zip = await JSZip.loadAsync(slideFiles[0]);
                const pngFiles = [];
                const entries = zip.files;
                for (const [name, entry] of Object.entries(entries)) {
                    if (entry.dir || !name.toLowerCase().endsWith('.png'))
                        continue;
                    const blob = await entry.async('blob');
                    pngFiles.push(new File([blob], name, { type: 'image/png' }));
                }
                if (pngFiles.length === 0) {
                    throw new Error('ZIP contains no PNG slides.');
                }
                slideFiles = pngFiles;
            }
            // Filter to only PNG/image files
            slideFiles = slideFiles.filter((f) => f.type.startsWith('image/') || f.name.toLowerCase().endsWith('.png'));
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
        }
        catch (err) {
            setPhase('error');
            if (onError && err instanceof Error) {
                onError(err);
            }
        }
    }, [decode, decodeOptions, acceptZip, onRestored, reset, onError]);
    const handleClick = () => fileInputRef.current?.click();
    const handleChange = (e) => {
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
    return (_jsxs("div", { className: className, "data-chromastash-restore": true, children: [_jsx("input", { ref: fileInputRef, type: "file", accept: acceptAttr, multiple: true, onChange: handleChange, style: { display: 'none' } }), _jsx("button", { onClick: handleClick, disabled: disabled || isWorking, className: buttonClassName, type: "button", children: isWorking ? `${Math.round(progress)}%` : label }), (isWorking || phase === 'done' || phase === 'error') && (_jsxs("div", { className: progressClassName, "data-chromastash-progress": true, children: [isWorking && (_jsx("div", { style: {
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
//# sourceMappingURL=ChromaRestoreButton.js.map