import React, { useMemo } from 'react';
import type { ChromaConfig, EncryptionMethod, SlidePattern } from '@muulorigin/chromastash-core';
import { DEFAULTS, AVAILABLE_PATTERNS, DEFAULT_CONFIG } from '@muulorigin/chromastash-core';
import { estimateSlides } from '@muulorigin/chromastash-core';

// ── Label overrides for i18n ───────────────────────────────────────────────

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

const LABEL_DEFAULTS: Required<ChromaConfigLabels> = {
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

// ── Props ──────────────────────────────────────────────────────────────────

export interface ChromaConfigPanelProps {
  config: ChromaConfig;
  onChange: (config: ChromaConfig) => void;
  /** File size in bytes — needed for slide estimate. */
  fileSize?: number;
  className?: string;
  labels?: Partial<ChromaConfigLabels>;
}

// ── Option metadata ────────────────────────────────────────────────────────

const RESOLUTION_OPTIONS = DEFAULTS.SLIDE_RESOLUTIONS as readonly number[];

const PBS_OPTIONS: { value: number; label: string }[] = [
  { value: 1, label: '1x1 (Standard)' },
  { value: 2, label: '2x2 (Robust)' },
  { value: 4, label: '4x4 (Camera-friendly)' },
];

const ENCRYPTION_OPTIONS: { value: EncryptionMethod; label: string }[] = [
  { value: 'aes-256-gcm', label: 'AES-256-GCM (Recommended)' },
  { value: 'xor', label: 'XOR (Lightweight)' },
  { value: 'none', label: 'None' },
];

const PATTERN_OPTIONS: { value: SlidePattern; label: string }[] =
  AVAILABLE_PATTERNS.map((p) => ({ value: p, label: p }));

// ── Helpers ────────────────────────────────────────────────────────────────

const HELP: Record<string, string> = {
  resolution: 'Higher resolutions store more data per slide but may be less robust.',
  pixelBlockSize: 'Larger blocks are easier to scan but generate more slides.',
  cornerMarkers: 'Adds markers for robust camera detection and auto-cropping.',
  addBorder: 'Adds a border to each slide to improve camera scanning.',
};

// ── Component ──────────────────────────────────────────────────────────────

export const ChromaConfigPanel: React.FC<ChromaConfigPanelProps> = ({
  config,
  onChange,
  fileSize,
  className,
  labels: labelOverrides,
}) => {
  const L = { ...LABEL_DEFAULTS, ...labelOverrides };

  const set = <K extends keyof ChromaConfig>(key: K, value: ChromaConfig[K]) => {
    onChange({ ...config, [key]: value });
  };

  const estimate = useMemo(() => {
    if (fileSize == null || fileSize <= 0) return null;
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

  const setPattern = (index: number, value: SlidePattern) => {
    const next = [...patterns];
    while (next.length <= index) next.push('None');
    next[index] = value;
    set('slidePatterns', next);
  };

  const setAllPatterns = (value: SlidePattern) => {
    const count = Math.max(slideCount, patterns.length, 1);
    set('slidePatterns', Array(count).fill(value));
  };

  return (
    <div data-chromastash-config="" className={className} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {/* ── Slide estimate ── */}
      {estimate && (
        <div data-chromastash-estimate="" style={{ padding: '8px 12px', borderRadius: '6px' }}>
          {L.estimatePrefix} <strong>{estimate.totalSlides}</strong> {L.estimateSuffix}
        </div>
      )}

      {/* ── Resolution ── */}
      <div data-chromastash-field="resolution">
        <label data-chromastash-label="">{L.resolution}</label>
        <select
          data-chromastash-input=""
          value={config.resolution}
          onChange={(e) => set('resolution', Number(e.target.value))}
        >
          {RESOLUTION_OPTIONS.map((r) => (
            <option key={r} value={r}>
              {r} x {r}{r === 512 ? ' (Recommended)' : ''}
            </option>
          ))}
        </select>
        <small data-chromastash-help="">{HELP.resolution}</small>
      </div>

      {/* ── Pixel Block Size ── */}
      <div data-chromastash-field="pixelBlockSize">
        <label data-chromastash-label="">{L.pixelBlockSize}</label>
        <select
          data-chromastash-input=""
          value={config.pixelBlockSize}
          onChange={(e) => set('pixelBlockSize', Number(e.target.value))}
        >
          {PBS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <small data-chromastash-help="">{HELP.pixelBlockSize}</small>
      </div>

      {/* ── Corner markers ── */}
      <div data-chromastash-field="cornerMarkers">
        <label data-chromastash-label="" style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
          <input type="checkbox" data-chromastash-input="" checked={config.cornerMarkers} onChange={(e) => set('cornerMarkers', e.target.checked)} />
          {L.cornerMarkers}
        </label>
        <small data-chromastash-help="">{HELP.cornerMarkers}</small>
      </div>

      {/* ── White border ── */}
      <div data-chromastash-field="addBorder">
        <label data-chromastash-label="" style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
          <input type="checkbox" data-chromastash-input="" checked={config.addBorder} onChange={(e) => set('addBorder', e.target.checked)} />
          {L.addBorder}
        </label>
        <small data-chromastash-help="">{HELP.addBorder}</small>
      </div>

      {/* ── Advanced section (collapsible) ── */}
      <details data-chromastash-advanced="">
        <summary data-chromastash-summary="" style={{ cursor: 'pointer', userSelect: 'none' }}>
          {L.advancedTitle}
        </summary>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '12px' }}>
          {/* ── Scramble patterns ── */}
          <div data-chromastash-field="slidePatterns">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '6px' }}>
              <label data-chromastash-label="">{L.slidePatterns}</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span data-chromastash-help="">{L.setAllTo}</span>
                <select
                  data-chromastash-input=""
                  onChange={(e) => setAllPatterns(e.target.value as SlidePattern)}
                  defaultValue="None"
                >
                  {PATTERN_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <small data-chromastash-warning="">{L.patternWarning}</small>

            {fileSize != null && slideCount > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '8px' }}>
                {Array.from({ length: slideCount }, (_, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span data-chromastash-help="" style={{ minWidth: '52px' }}>Slide {i + 1}</span>
                    <select
                      data-chromastash-input=""
                      value={patterns[i] ?? 'None'}
                      onChange={(e) => setPattern(i, e.target.value as SlidePattern)}
                      style={{ flex: 1 }}
                    >
                      {PATTERN_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            ) : (
              <small data-chromastash-help="" style={{ marginTop: '4px', display: 'block' }}>
                {L.noFileNote}
              </small>
            )}
          </div>

          {/* ── Encryption ── */}
          <div data-chromastash-field="encryption">
            <label data-chromastash-label="">{L.encryption}</label>
            <select
              data-chromastash-input=""
              value={config.encryption}
              onChange={(e) => set('encryption', e.target.value as EncryptionMethod)}
            >
              {ENCRYPTION_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
        </div>
      </details>

      {/* ── Reset ── */}
      <button data-chromastash-reset="" onClick={() => onChange({ ...DEFAULT_CONFIG })} type="button">
        {L.resetDefaults}
      </button>
    </div>
  );
};
