import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMemo } from 'react';
import { DEFAULTS, AVAILABLE_PATTERNS, DEFAULT_CONFIG } from '@muulorigin/chromastash-core';
import { estimateSlides } from '@muulorigin/chromastash-core';
const LABEL_DEFAULTS = {
    resolution: 'Slide Resolution',
    pixelBlockSize: 'Clarity (Pixel Block Size)',
    cornerMarkers: 'Add corner markers',
    addBorder: 'Add white border',
    encryption: 'Encryption',
    advancedTitle: 'Advanced Configuration',
    slidePatterns: 'Scramble Pattern per Slide',
    setAllTo: 'Set all to:',
    patternWarning: 'The exact same pattern for each slide is required to decode the file.',
    estimatePrefix: 'This will generate an estimated',
    estimateSuffix: 'slides.',
    noFileNote: 'Select a file to configure per-slide patterns.',
    resetDefaults: 'Reset to Defaults',
};
// ── Option metadata ────────────────────────────────────────────────────────
const RESOLUTION_OPTIONS = DEFAULTS.SLIDE_RESOLUTIONS;
const PBS_OPTIONS = [
    { value: 1, label: '1x1 (Standard)' },
    { value: 2, label: '2x2 (Robust)' },
    { value: 4, label: '4x4 (Camera-friendly)' },
];
const ENCRYPTION_OPTIONS = [
    { value: 'aes-256-gcm', label: 'AES-256-GCM (Recommended)' },
    { value: 'xor', label: 'XOR (Lightweight)' },
    { value: 'none', label: 'None' },
];
const PATTERN_OPTIONS = AVAILABLE_PATTERNS.map((p) => ({ value: p, label: p }));
// ── Helpers ────────────────────────────────────────────────────────────────
const HELP = {
    resolution: 'Higher resolutions store more data per slide but may be less robust.',
    pixelBlockSize: 'Larger blocks are easier to scan but generate more slides.',
    cornerMarkers: 'Adds markers for robust camera detection and auto-cropping.',
    addBorder: 'Adds a border to each slide to improve camera scanning.',
};
// ── Component ──────────────────────────────────────────────────────────────
export const ChromaConfigPanel = ({ config, onChange, fileSize, className, labels: labelOverrides, }) => {
    const L = { ...LABEL_DEFAULTS, ...labelOverrides };
    const set = (key, value) => {
        onChange({ ...config, [key]: value });
    };
    const estimate = useMemo(() => {
        if (fileSize == null || fileSize <= 0)
            return null;
        return estimateSlides(fileSize, {
            encryption: config.encryption,
            resolution: config.resolution,
            pixelBlockSize: config.pixelBlockSize,
            cornerMarkers: config.cornerMarkers,
        });
    }, [fileSize, config.encryption, config.resolution, config.pixelBlockSize, config.cornerMarkers]);
    const slideCount = estimate?.totalSlides ?? 0;
    // Ensure slidePatterns array matches estimated slide count
    const patterns = config.slidePatterns ?? [];
    const setPattern = (index, value) => {
        const next = [...patterns];
        while (next.length <= index)
            next.push('None');
        next[index] = value;
        set('slidePatterns', next);
    };
    const setAllPatterns = (value) => {
        const count = Math.max(slideCount, patterns.length, 1);
        set('slidePatterns', Array(count).fill(value));
    };
    return (_jsxs("div", { "data-chromastash-config": "", className: className, style: { display: 'flex', flexDirection: 'column', gap: '14px' }, children: [estimate && (_jsxs("div", { "data-chromastash-estimate": "", style: { padding: '8px 12px', borderRadius: '6px' }, children: [L.estimatePrefix, " ", _jsx("strong", { children: estimate.totalSlides }), " ", L.estimateSuffix] })), _jsxs("div", { "data-chromastash-field": "resolution", children: [_jsx("label", { "data-chromastash-label": "", children: L.resolution }), _jsx("select", { "data-chromastash-input": "", value: config.resolution, onChange: (e) => set('resolution', Number(e.target.value)), children: RESOLUTION_OPTIONS.map((r) => (_jsxs("option", { value: r, children: [r, " x ", r, r === 512 ? ' (Recommended)' : ''] }, r))) }), _jsx("small", { "data-chromastash-help": "", children: HELP.resolution })] }), _jsxs("div", { "data-chromastash-field": "pixelBlockSize", children: [_jsx("label", { "data-chromastash-label": "", children: L.pixelBlockSize }), _jsx("select", { "data-chromastash-input": "", value: config.pixelBlockSize, onChange: (e) => set('pixelBlockSize', Number(e.target.value)), children: PBS_OPTIONS.map((o) => (_jsx("option", { value: o.value, children: o.label }, o.value))) }), _jsx("small", { "data-chromastash-help": "", children: HELP.pixelBlockSize })] }), _jsxs("div", { "data-chromastash-field": "cornerMarkers", children: [_jsxs("label", { "data-chromastash-label": "", style: { display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }, children: [_jsx("input", { type: "checkbox", "data-chromastash-input": "", checked: config.cornerMarkers, onChange: (e) => set('cornerMarkers', e.target.checked) }), L.cornerMarkers] }), _jsx("small", { "data-chromastash-help": "", children: HELP.cornerMarkers })] }), _jsxs("div", { "data-chromastash-field": "addBorder", children: [_jsxs("label", { "data-chromastash-label": "", style: { display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }, children: [_jsx("input", { type: "checkbox", "data-chromastash-input": "", checked: config.addBorder, onChange: (e) => set('addBorder', e.target.checked) }), L.addBorder] }), _jsx("small", { "data-chromastash-help": "", children: HELP.addBorder })] }), _jsxs("details", { "data-chromastash-advanced": "", children: [_jsx("summary", { "data-chromastash-summary": "", style: { cursor: 'pointer', userSelect: 'none' }, children: L.advancedTitle }), _jsxs("div", { style: { display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '12px' }, children: [_jsxs("div", { "data-chromastash-field": "slidePatterns", children: [_jsxs("div", { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '6px' }, children: [_jsx("label", { "data-chromastash-label": "", children: L.slidePatterns }), _jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: '6px' }, children: [_jsx("span", { "data-chromastash-help": "", children: L.setAllTo }), _jsx("select", { "data-chromastash-input": "", onChange: (e) => setAllPatterns(e.target.value), defaultValue: "None", children: PATTERN_OPTIONS.map((o) => (_jsx("option", { value: o.value, children: o.label }, o.value))) })] })] }), _jsx("small", { "data-chromastash-warning": "", children: L.patternWarning }), fileSize != null && slideCount > 0 ? (_jsx("div", { style: { display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '8px' }, children: Array.from({ length: slideCount }, (_, i) => (_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: '8px' }, children: [_jsxs("span", { "data-chromastash-help": "", style: { minWidth: '52px' }, children: ["Slide ", i + 1] }), _jsx("select", { "data-chromastash-input": "", value: patterns[i] ?? 'None', onChange: (e) => setPattern(i, e.target.value), style: { flex: 1 }, children: PATTERN_OPTIONS.map((o) => (_jsx("option", { value: o.value, children: o.label }, o.value))) })] }, i))) })) : (_jsx("small", { "data-chromastash-help": "", style: { marginTop: '4px', display: 'block' }, children: L.noFileNote }))] }), _jsxs("div", { "data-chromastash-field": "encryption", children: [_jsx("label", { "data-chromastash-label": "", children: L.encryption }), _jsx("select", { "data-chromastash-input": "", value: config.encryption, onChange: (e) => set('encryption', e.target.value), children: ENCRYPTION_OPTIONS.map((o) => (_jsx("option", { value: o.value, children: o.label }, o.value))) })] })] })] }), _jsx("button", { "data-chromastash-reset": "", onClick: () => onChange({ ...DEFAULT_CONFIG }), type: "button", children: L.resetDefaults })] }));
};
//# sourceMappingURL=ChromaConfigPanel.js.map