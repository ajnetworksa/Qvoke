import React, { useState, useRef, useEffect } from 'react';
import { useERPStore } from '../store';
import { Product } from '../types';
import { Search, Package } from 'lucide-react';
import { matchSearchQuery } from '../utils/search';
import { QuickCreateProductModal } from './QuickCreateProductModal';

interface InlineProductSearchInputProps {
  value: string;
  onChange: (val: string) => void;
  onProductSelect: (product: Product) => void;
  onBlur?: () => void;
  placeholder?: string;
  className?: string;
}

export const InlineProductSearchInput: React.FC<InlineProductSearchInputProps> = ({
  value,
  onChange,
  onProductSelect,
  onBlur,
  placeholder = 'English Description',
  className = ''
}) => {
  const { products, addProduct } = useERPStore();
  const [isOpen, setIsOpen] = useState(false);
  const [showQuickCreate, setShowQuickCreate] = useState(false);
  const [qcName, setQcName] = useState('');

  const containerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredProducts = React.useMemo(() => {
    if (!value.trim()) return []; // only suggest when user has typed something
    return products.filter(p =>
      matchSearchQuery(value, [p.name, p.description, p.categoryId, p.unit, p.unitPrice])
    ).slice(0, 5); // limit to 5 top recommendations for compact inline list
  }, [products, value]);

  const handleSelectProduct = (p: Product) => {
    onProductSelect(p);
    setIsOpen(false);
    setTimeout(() => {
      textareaRef.current?.blur();
    }, 0);
  };

  const handleQuickCreateSave = (newProd: Product) => {
    addProduct(newProd);
    onProductSelect(newProd);
    onChange(newProd.name);
    setShowQuickCreate(false);
    setIsOpen(false);
    
    setTimeout(() => {
      textareaRef.current?.blur();
    }, 0);
  };

  return (
    <div ref={containerRef} className="relative w-full">
      <textarea
        ref={textareaRef}
        rows={1}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
        onBlur={onBlur}
        className={`${className} w-full bg-transparent border border-transparent hover:border-[var(--color-border)] focus:border-[var(--color-primary)] focus:bg-[var(--color-surface-2)] rounded py-1 px-1.5 text-xs text-[var(--color-text)] focus:outline-none resize-y`}
        placeholder={placeholder}
      />

      {isOpen && value.trim().length > 0 && !showQuickCreate && (
        <div className="absolute z-50 left-0 w-full min-w-[320px] md:min-w-[460px] mt-1 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg shadow-xl overflow-hidden animate-slide-in">
          {filteredProducts.length > 0 ? (
            <>
              <div className="bg-[var(--color-surface-offset)] px-3 py-1 border-b border-[var(--color-border)] text-[9px] font-bold text-[var(--color-text-muted)] tracking-wider uppercase flex items-center gap-1">
                <Search className="w-2.5 h-2.5" /> Direct Product Matches / اقتراحات المنتجات
              </div>
              <div className="divide-y divide-[var(--color-divider)] max-h-48 overflow-y-auto">
                {filteredProducts.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      handleSelectProduct(p);
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-[var(--color-surface-offset)]/70 transition-colors flex flex-col gap-0.5 cursor-pointer"
                  >
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-bold text-[var(--color-text)] truncate max-w-[300px]">{p.name}</span>
                      <span className="font-mono text-[var(--color-primary)] font-bold text-[10px]">
                        {p.unitPrice.toFixed(2)} SAR
                      </span>
                    </div>
                    {p.description && (
                      <span className="text-[9px] text-[var(--color-text-muted)] line-clamp-1">
                        {p.description}
                      </span>
                    )}
                  </button>
                ))}
              </div>
              <div
                onMouseDown={(e) => {
                  e.preventDefault();
                  setQcName(value);
                  setIsOpen(false);
                  setShowQuickCreate(true);
                }}
                className="flex items-center justify-center gap-2 px-4 py-3 border-t border-[var(--color-border)] text-sm font-semibold text-[var(--color-primary)] bg-[var(--color-surface-2)] cursor-pointer hover:bg-[var(--color-primary-highlight)]/30 transition-colors"
              >
                <Package className="w-4 h-4" />
                Add New Product / إضافة منتج جديد
              </div>
            </>
          ) : (
            <div className="flex flex-col">
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  setIsOpen(false);
                }}
                className="w-full text-left px-3 py-3 hover:bg-[var(--color-surface-offset)]/70 transition-colors cursor-pointer border-b border-[var(--color-border)] flex flex-col gap-1"
              >
                <div className="text-xs font-bold text-[var(--color-primary)]">
                  + Add item to quote / إضافة كبند مخصص
                </div>
                <div className="text-[10px] text-[var(--color-text-muted)] truncate">
                  Use "{value}" as a custom line item
                </div>
              </button>
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  setQcName(value);
                  setIsOpen(false);
                  setShowQuickCreate(true);
                }}
                className="w-full text-left px-3 py-3 hover:bg-[var(--color-surface-offset)]/70 transition-colors cursor-pointer flex flex-col gap-1 bg-[var(--color-surface-2)]"
              >
                <div className="text-xs font-bold text-[var(--color-primary)] flex items-center gap-1">
                  <Package className="w-3.5 h-3.5" />
                  + Add to Product Catalog / إضافة لقاعدة البيانات
                </div>
                <div className="text-[10px] text-[var(--color-text-muted)] truncate">
                  Create "{value}" as a reusable product
                </div>
              </button>
            </div>
          )}
        </div>
      )}

      {showQuickCreate && (
        <QuickCreateProductModal
          initialName={qcName}
          onClose={() => setShowQuickCreate(false)}
          onSave={handleQuickCreateSave}
        />
      )}
    </div>
  );
};
