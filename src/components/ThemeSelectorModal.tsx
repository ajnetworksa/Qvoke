import React from 'react';
import { useERPStore } from '../store';
import { UI_THEMES, UIThemeDefinition } from '../theme';
import { Palette, Check, Sparkles, X } from 'lucide-react';

interface ThemeSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ThemeSelectorModal: React.FC<ThemeSelectorModalProps> = ({ isOpen, onClose }) => {
  const { uiTheme, setUITheme, applyActiveTheme } = useERPStore();
  const [selectedCat, setSelectedCat] = React.useState<string>('all');

  if (!isOpen) return null;

  const categories = [
    { id: 'all', label: 'All Themes / جميع السمات' },
    { id: 'core', label: 'Modern Enterprise / العصري' },
    { id: 'fintech', label: 'Obsidian FinTech / أوبسيديان فاينتك' },
    { id: 'aesthetic', label: 'Glass & Neumorphism / الجمالية' }
  ];

  const filteredThemes = selectedCat === 'all'
    ? UI_THEMES
    : UI_THEMES.filter(t => t.category === selectedCat);

  const handleSelectTheme = (id: string) => {
    setUITheme(id);
    document.documentElement.setAttribute('data-ui-theme', id);
    applyActiveTheme?.();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-fade-in text-left">
      <div className="relative w-full max-w-4xl max-h-[90vh] bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl shadow-2xl flex flex-col overflow-hidden text-left">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-divider)]/40 bg-[var(--color-surface-2)]">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-[var(--color-primary)]/15 text-[var(--color-primary)]">
              <Palette className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-[var(--color-text)] flex items-center gap-2">
                Qvoke Theme Studio
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--color-primary)]/20 text-[var(--color-primary)] font-black uppercase tracking-wider">
                  Visual Engine
                </span>
              </h2>
              <p className="text-xs text-[var(--color-text-muted)]">
                Choose from Modern Enterprise, Obsidian FinTech, Frosted Glass Acrylic, and 3D Neumorphism.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[var(--color-text-muted)] hover:bg-[var(--color-surface-offset)] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Category Filters */}
        <div className="flex items-center gap-2 px-6 py-3 border-b border-[var(--color-divider)]/30 bg-[var(--color-surface)] overflow-x-auto">
          {categories.map(cat => (
            <button
              key={cat.id}
              onClick={() => setSelectedCat(cat.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                selectedCat === cat.id
                  ? 'bg-[var(--color-primary)] text-white shadow-sm'
                  : 'bg-[var(--color-surface-2)] text-[var(--color-text-muted)] hover:bg-[var(--color-surface-offset)]'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Theme Cards Grid */}
        <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredThemes.map((item: UIThemeDefinition) => {
            const isSelected = uiTheme === item.id;
            return (
              <div
                key={item.id}
                onClick={() => handleSelectTheme(item.id)}
                className={`group relative p-5 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between ${
                  isSelected
                    ? 'border-[var(--color-primary)] bg-[var(--color-primary-highlight)]/20 shadow-lg scale-[1.02]'
                    : 'border-[var(--color-border)] bg-[var(--color-surface-2)] hover:border-[var(--color-primary)]/60 hover:bg-[var(--color-surface-offset)]'
                }`}
              >
                <div>
                  {/* Top bar with swatches & active check */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      {item.swatches.map((color, i) => (
                        <span
                          key={i}
                          className="w-5 h-5 rounded-full border border-black/10 shadow-sm"
                          style={{ backgroundColor: color }}
                        />
                      ))}
                    </div>
                    {isSelected && (
                      <span className="flex items-center gap-1 text-[10px] font-black uppercase text-[var(--color-primary)] bg-[var(--color-primary)]/15 px-2.5 py-1 rounded-full">
                        <Check className="w-3.5 h-3.5" /> Active
                      </span>
                    )}
                  </div>

                  <h3 className="text-sm font-extrabold text-[var(--color-text)] group-hover:text-[var(--color-primary)] transition-colors">
                    {item.name}
                  </h3>
                  <span className="text-[11px] font-bold text-[var(--color-text-muted)] block mb-2" dir="rtl">
                    {item.nameAr}
                  </span>
                  <p className="text-xs text-[var(--color-text-muted)] leading-relaxed mb-3">
                    {item.description}
                  </p>
                </div>

                {/* Features Pill tags */}
                <div className="flex flex-wrap gap-1.5 pt-3 border-t border-[var(--color-divider)]/30">
                  {item.features.map((feat, idx) => (
                    <span
                      key={idx}
                      className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-[var(--color-surface)] text-[var(--color-text-muted)] border border-[var(--color-border)]/60"
                    >
                      {feat}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-[var(--color-divider)]/40 bg-[var(--color-surface-2)]">
          <div className="flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
            <Sparkles className="w-4 h-4 text-[var(--color-primary)] animate-pulse" />
            <span>Theme applies instantly across all windows and responsive devices.</span>
          </div>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-lg bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white text-xs font-bold transition-all shadow-sm cursor-pointer"
          >
            Apply &amp; Close / تطبيق
          </button>
        </div>
      </div>
    </div>
  );
};