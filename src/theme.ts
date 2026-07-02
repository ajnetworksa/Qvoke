// Theme presets + runtime accent application.
// Base neutrals (surfaces/text/borders) live in index.css per light/dark mode.
// The accent (--color-primary*) is overridden at runtime here, resolved as:
//   user accent override → company theme → preset default.

export interface AccentSet { p: string; h: string; hl: string }
export interface ThemePreset {
  key: string;
  label: string;
  swatch: string;   // representative colour for the picker
  light: AccentSet;
  dark: AccentSet;
}

// "Slate" is the muted/understated default; the rest are optional presets.
export const THEME_PRESETS: ThemePreset[] = [
  { key: 'slate',    label: 'Slate (Muted)', swatch: '#3d6b6e',
    light: { p: '#3d6b6e', h: '#2f5457', hl: '#d6e2e2' },
    dark:  { p: '#6fb3b6', h: '#4f9093', hl: 'rgba(111,179,182,0.14)' } },
  { key: 'teal',     label: 'Teal',          swatch: '#01696f',
    light: { p: '#01696f', h: '#0c4e54', hl: '#cedcd8' },
    dark:  { p: '#12c4c7', h: '#0e9ea1', hl: 'rgba(18,196,199,0.14)' } },
  { key: 'indigo',   label: 'Indigo',        swatch: '#4f46e5',
    light: { p: '#4f46e5', h: '#4338ca', hl: '#e2e0fb' },
    dark:  { p: '#8b93f8', h: '#6366f1', hl: 'rgba(139,147,248,0.14)' } },
  { key: 'emerald',  label: 'Emerald',       swatch: '#059669',
    light: { p: '#059669', h: '#047857', hl: '#cdeadd' },
    dark:  { p: '#34d399', h: '#10b981', hl: 'rgba(52,211,153,0.14)' } },
  { key: 'rose',     label: 'Rose',          swatch: '#be185d',
    light: { p: '#be185d', h: '#9d174d', hl: '#f6d6e4' },
    dark:  { p: '#fb7185', h: '#f43f5e', hl: 'rgba(251,113,133,0.14)' } },
  { key: 'amber',    label: 'Amber',         swatch: '#b45309',
    light: { p: '#b45309', h: '#92400e', hl: '#f2e2c6' },
    dark:  { p: '#fbbf24', h: '#f59e0b', hl: 'rgba(251,191,36,0.14)' } },
  { key: 'midnight', label: 'Midnight',      swatch: '#475569',
    light: { p: '#334155', h: '#1e293b', hl: '#dce2ea' },
    dark:  { p: '#94a3b8', h: '#64748b', hl: 'rgba(148,163,184,0.16)' } },
];

export const DEFAULT_PRESET = 'slate';

const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
const parseHex = (hex: string): [number, number, number] | null => {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const int = parseInt(m[1], 16);
  return [(int >> 16) & 255, (int >> 8) & 255, int & 255];
};
const toHex = (r: number, g: number, b: number) =>
  '#' + [r, g, b].map((v) => clamp(v).toString(16).padStart(2, '0')).join('');
// Darken a hex colour by a percentage (for the hover shade).
const darken = (hex: string, pct: number) => {
  const rgb = parseHex(hex);
  if (!rgb) return hex;
  const f = 1 - pct / 100;
  return toHex(rgb[0] * f, rgb[1] * f, rgb[2] * f);
};
const rgba = (hex: string, a: number) => {
  const rgb = parseHex(hex);
  if (!rgb) return hex;
  return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${a})`;
};

// Resolve the accent set to apply given the current inputs and mode.
export const resolveAccent = (
  presetKey: string | undefined,
  accentHex: string | undefined,
  isDark: boolean
): AccentSet => {
  if (accentHex && parseHex(accentHex)) {
    return { p: accentHex, h: darken(accentHex, isDark ? 12 : 15), hl: rgba(accentHex, isDark ? 0.16 : 0.18) };
  }
  const preset = THEME_PRESETS.find((x) => x.key === presetKey) || THEME_PRESETS[0];
  return isDark ? preset.dark : preset.light;
};

// Write the accent CSS variables onto <html>.
export const applyAccent = (a: AccentSet) => {
  const root = document.documentElement;
  root.style.setProperty('--color-primary', a.p);
  root.style.setProperty('--color-primary-hover', a.h);
  root.style.setProperty('--color-primary-highlight', a.hl);
};
