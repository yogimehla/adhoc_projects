import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export const EncodeProgress = ({ progress, message, isActive, isError = false, className = '', }) => {
    if (!isActive && !message)
        return null;
    const barColor = isError ? '#e24b4a' : progress >= 100 ? '#1d9e75' : '#378add';
    return (_jsxs("div", { className: className, "data-chromastash-encode-progress": true, children: [_jsx("div", { style: {
                    width: '100%',
                    height: 4,
                    backgroundColor: 'rgba(128,128,128,0.15)',
                    borderRadius: 2,
                    overflow: 'hidden',
                }, children: _jsx("div", { style: {
                        width: `${Math.min(100, Math.max(0, progress))}%`,
                        height: '100%',
                        backgroundColor: barColor,
                        transition: 'width 200ms ease',
                    } }) }), message && (_jsx("div", { style: {
                    fontSize: 12,
                    marginTop: 4,
                    color: isError ? '#e24b4a' : undefined,
                }, children: message }))] }));
};
//# sourceMappingURL=EncodeProgress.js.map