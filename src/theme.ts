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

// Curated Enterprise Presets
export const THEME_PRESETS: ThemePreset[] = [
  { key: 'teal',     label: 'Teal (Default)', swatch: '#01696f',
    light: { p: '#01696f', h: '#0c4e54', hl: '#cedcd8' },
    dark:  { p: '#12c4c7', h: '#0e9ea1', hl: 'rgba(18,196,199,0.14)' } },
  { key: 'slate',    label: 'Slate (Muted)', swatch: '#3d6b6e',
    light: { p: '#3d6b6e', h: '#2f5457', hl: '#d6e2e2' },
    dark:  { p: '#6fb3b6', h: '#4f9093', hl: 'rgba(111,179,182,0.14)' } },
  { key: 'indigo',   label: 'Indigo Blue',   swatch: '#4f46e5',
    light: { p: '#4f46e5', h: '#4338ca', hl: '#e2e0fb' },
    dark:  { p: '#8b93f8', h: '#6366f1', hl: 'rgba(139,147,248,0.14)' } },
  { key: 'emerald',  label: 'Saudi Emerald', swatch: '#059669',
    light: { p: '#059669', h: '#047857', hl: '#cdeadd' },
    dark:  { p: '#34d399', h: '#10b981', hl: 'rgba(52,211,153,0.14)' } },
  { key: 'amber',    label: 'Warm Amber',    swatch: '#b45309',
    light: { p: '#b45309', h: '#92400e', hl: '#f2e2c6' },
    dark:  { p: '#fbbf24', h: '#f59e0b', hl: 'rgba(251,191,36,0.14)' } },
  { key: 'midnight', label: 'Midnight Obsidian', swatch: '#334155',
    light: { p: '#334155', h: '#1e293b', hl: '#dce2ea' },
    dark:  { p: '#94a3b8', h: '#64748b', hl: 'rgba(148,163,184,0.16)' } },
];

export const DEFAULT_PRESET = 'teal';

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

export interface UIThemeDefinition {
  id: string;
  name: string;
  nameAr: string;
  category: 'core' | 'aesthetic' | 'fintech';
  description: string;
  swatches: string[];
  features: string[];
}

export const UI_THEMES: UIThemeDefinition[] = [
  {
    id: 'modern',
    name: 'Modern Enterprise',
    nameAr: 'العصري الحديث',
    category: 'core',
    description: 'Crisp, high-precision corporate design with razor-sharp borders and clean contrast.',
    swatches: ['#01696f', '#f8fafc', '#0f172a'],
    features: ['High density tables', 'Subtle border lines', 'Balanced contrast', 'Clean typography']
  },
  {
    id: 'obsidian',
    name: 'Obsidian FinTech (Linear Style)',
    nameAr: 'أوبسيديان فاينتك',
    category: 'fintech',
    description: 'Ultra-refined dark graphite & deep obsidian interface inspired by Linear and Stripe, engineered for high-density financial data and quote processing.',
    swatches: ['#090a0f', '#10b981', '#181b24'],
    features: ['Deep obsidian contrast', 'Emerald financial accents', 'Monospace tabular figures', 'Micro-line dividers']
  },
  {
    id: 'glassmorphism',
    name: 'Frosted Glass Acrylic',
    nameAr: 'الزجاجي الشفاف',
    category: 'aesthetic',
    description: 'Ultra-modern frosted glass with deep backdrop blur, luminous border highlights, and ambient glowing surfaces.',
    swatches: ['#38bdf8', '#818cf8', 'rgba(255,255,255,0.15)'],
    features: ['Backdrop blur 16px', 'Frosted glass panels', 'Ambient glowing borders', 'Floating card elevation']
  },
  {
    id: 'neumorphism',
    name: 'Tactile 3D Neumorphism',
    nameAr: 'النيومورفيزم ثلاثي الأبعاد',
    category: 'aesthetic',
    description: 'Tactile 3D soft-extruded surfaces with dual light and dark cast shadows and debossed form fields.',
    swatches: ['#e0e5ec', '#a3b1c6', '#3b82f6'],
    features: ['Embossed card surfaces', 'Dual light/dark cast shadows', 'Debossed inset input fields', 'Soft pill buttons']
  }
];
