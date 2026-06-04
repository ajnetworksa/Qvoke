import React, { useState, useRef, useEffect } from 'react';
import { useERPStore } from '../store';
import { Product } from '../types';
import { Search, ChevronDown, Check, X, Plus, Package } from 'lucide-react';
import { matchSearchQuery } from '../utils/search';

interface ProductComboboxProps {
  selectedProductId?: string;
  onSelect: (product: Product) => void;
  placeholder?: string;
}

export const ProductCombobox: React.FC<ProductComboboxProps> = ({
  selectedProductId,
  onSelect,
  placeholder = 'Select Product / اختر منتجاً...'
}) => {
  const { products, addProduct, company } = useERPStore();
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [showQuickCreate, setShowQuickCreate] = useState(false);

  // Quick-create form
  const [qcName, setQcName] = useState('');
  const [qcPrice, setQcPrice] = useState('');
  const [qcUnit, setQcUnit] = useState('pc');
  const [qcType, setQcType] = useState<'product' | 'service'>('product');

  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setShowQuickCreate(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedProduct = products.find(p => p.id === selectedProductId);

  const filtered = products.filter(p =>
    matchSearchQuery(search, [p.name, p.description, p.categoryId, p.unit, p.unitPrice])
  );

  const handleSelect = (product: Product) => {
    onSelect(product);
    setIsOpen(false);
    setSearch('');
  };

  const handleQuickCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!qcName.trim()) return;

    const newProd: Product = {
      id: `p-${Date.now()}`,
      name: qcName.trim(),
      description: '',
      type: qcType,
      unitPrice: parseFloat(qcPrice) || 0,
      unit: qcUnit,
      taxRate: company.defaultTax || 15,
      categoryId: 'general'
    };

    addProduct(newProd);
    onSelect(newProd);
    setQcName('');
    setQcPrice('');
    setQcUnit('pc');
    setQcType('product');
    setShowQuickCreate(false);
    setIsOpen(false);
  };

  return (
    <div className="relative w-full" ref={containerRef}>
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between premium-input cursor-pointer py-1.5"
      >
        <span className={`truncate text-sm ${selectedProduct ? 'text-[var(--color-text)]' : 'text-[var(--color-text-faint)]'}`}>
          {selectedProduct ? selectedProduct.name : placeholder}
        </span>
        <ChevronDown className="w-4 h-4 text-[var(--color-text-muted)] flex-shrink-0 ml-1" />
      </div>

      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg shadow-lg overflow-hidden animate-slide-in">
          {!showQuickCreate ? (
            <>
              {/* Search header */}
              <div className="flex items-center px-3 py-2 border-b border-[var(--color-border)] bg-[var(--color-surface-offset)]">
                <Search className="w-4 h-4 text-[var(--color-text-muted)] mr-2" />
                <input
                  type="text"
                  placeholder="Search product / ابحث عن منتج..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full bg-transparent border-0 text-sm focus:outline-none focus:ring-0 text-[var(--color-text)]"
                  autoFocus
                />
                {search && (
                  <button onClick={() => setSearch('')} type="button">
                    <X className="w-4 h-4 text-[var(--color-text-muted)]" />
                  </button>
                )}
              </div>

              {/* Product list */}
              <div className="max-h-52 overflow-y-auto">
                {filtered.length > 0 ? (
                  filtered.map((p) => (
                    <div
                      key={p.id}
                      onClick={() => handleSelect(p)}
                      className={`flex flex-col px-4 py-2 text-sm cursor-pointer hover:bg-[var(--color-surface-offset)] transition-colors border-b border-[var(--color-border)]/30 last:border-b-0 ${
                        p.id === selectedProductId ? 'bg-[var(--color-primary-highlight)]/20 font-semibold text-[var(--color-primary)]' : 'text-[var(--color-text)]'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold truncate mr-2">{p.name}</span>
                        <span className="text-xs font-bold text-[var(--color-primary)] whitespace-nowrap">
                          {p.unitPrice.toFixed(2)} SAR / {p.unit}
                        </span>
                      </div>
                      {p.description && (
                        <span className="text-[11px] text-[var(--color-text-muted)] line-clamp-1 mt-0.5 font-normal">
                          {p.description.replace(/\n/g, ' ')}
                        </span>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="px-4 py-3 text-sm text-[var(--color-text-muted)] text-center">
                    No products found
                  </div>
                )}
              </div>

              {/* Quick Create trigger */}
              <div
                onClick={() => { setQcName(search); setShowQuickCreate(true); }}
                className="flex items-center justify-center gap-2 px-4 py-3 border-t border-[var(--color-border)] text-sm font-semibold text-[var(--color-primary)] bg-[var(--color-surface-2)] cursor-pointer hover:bg-[var(--color-primary-highlight)]/30 transition-colors"
              >
                <Package className="w-4 h-4" />
                Add New Product / إضافة منتج جديد
              </div>
            </>
          ) : (
            /* Quick-create form */
            <form onSubmit={handleQuickCreate} className="p-4 flex flex-col gap-3">
              <div className="flex items-center justify-between border-b border-[var(--color-border)] pb-2 mb-1">
                <span className="text-sm font-bold text-[var(--color-text)]">Quick Create Product / إنشاء سريع</span>
                <button type="button" onClick={() => setShowQuickCreate(false)} className="p-1 hover:bg-[var(--color-surface-offset)] rounded">
                  <X className="w-4 h-4 text-[var(--color-text-muted)]" />
                </button>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--color-text-muted)] mb-1">Product Name *</label>
                <input
                  type="text" required value={qcName}
                  onChange={(e) => setQcName(e.target.value)}
                  className="w-full premium-input py-1.5" placeholder="e.g. Hikvision Camera 4MP"
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-[var(--color-text-muted)] mb-1">Unit Price (SAR)</label>
                  <input
                    type="number" step="0.01" min="0" value={qcPrice}
                    onChange={(e) => setQcPrice(e.target.value)}
                    className="w-full premium-input py-1.5 text-xs font-mono" placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[var(--color-text-muted)] mb-1">Unit</label>
                  <select value={qcUnit} onChange={(e) => setQcUnit(e.target.value)} className="w-full premium-input py-1.5 text-xs">
                    <option value="pc">pc</option>
                    <option value="set">set</option>
                    <option value="lot">lot</option>
                    <option value="hr">hr</option>
                    <option value="day">day</option>
                    <option value="m">m</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--color-text-muted)] mb-1">Type</label>
                <select value={qcType} onChange={(e) => setQcType(e.target.value as any)} className="w-full premium-input py-1.5 text-xs">
                  <option value="product">Product / منتج</option>
                  <option value="service">Service / خدمة</option>
                </select>
              </div>

              <button
                type="submit"
                className="w-full mt-1 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white py-2 px-4 rounded-md text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                Save & Select Product
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  );
};
export default ProductCombobox;
