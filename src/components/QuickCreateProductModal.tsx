import React, { useState } from 'react';
import { X } from 'lucide-react';
import { useERPStore } from '../store';
import { Product } from '../types';

interface QuickCreateProductModalProps {
  initialName: string;
  onClose: () => void;
  onSave: (product: Product) => void;
}

export const QuickCreateProductModal: React.FC<QuickCreateProductModalProps> = ({
  initialName,
  onClose,
  onSave
}) => {
  const { company } = useERPStore();

  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState('');
  const [type, setType] = useState<'product' | 'service'>('product');
  const [unitPrice, setUnitPrice] = useState<number | ''>('');
  const [unit, setUnit] = useState('pc');
  const [taxRate, setTaxRate] = useState(company.defaultTax || 15);
  const [categoryId, setCategoryId] = useState('general');
  const [itemCode, setItemCode] = useState('');
  const [supplierName, setSupplierName] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const newProd: Product = {
      id: `p-${Date.now()}`,
      name: name.trim(),
      description,
      type,
      unitPrice: typeof unitPrice === 'number' ? unitPrice : 0,
      unit,
      taxRate,
      categoryId,
      itemCode,
      supplierName
    };

    onSave(newProd);
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-fade-in" onClick={onClose} />
      <form
        onSubmit={handleSubmit}
        className="relative w-full max-w-md bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl shadow-lg p-6 overflow-hidden animate-slide-in text-left flex flex-col gap-4"
      >
        <div className="flex items-center justify-between border-b border-[var(--color-border)] pb-3">
          <h3 className="text-sm font-bold text-[var(--color-text)] flex items-center gap-2">
            Add Catalog Item / إضافة منتج
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1 hover:bg-[var(--color-surface-offset)] rounded transition-colors cursor-pointer"
          >
            <X className="w-4 h-4 text-[var(--color-text-muted)]" />
          </button>
        </div>

        <div className="flex flex-col gap-3 text-xs font-semibold text-[var(--color-text-muted)]">
          <div>
            <label className="block mb-1.5">Item Name *</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full premium-input text-sm text-[var(--color-text)] font-semibold"
              placeholder="e.g. Hikvision Bullet Camera"
              autoFocus
            />
          </div>

          <div>
            <label className="block mb-1.5">Description (printed on document) / الوصف</label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full premium-input text-xs"
              placeholder="Bilingual details (AR/EN) printed in lines..."
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block mb-1.5">Item Code (Optional)</label>
              <input
                type="text"
                value={itemCode}
                onChange={(e) => setItemCode(e.target.value)}
                className="w-full premium-input text-xs font-mono"
                placeholder="e.g. SKU-1234"
              />
            </div>
            <div>
              <label className="block mb-1.5">Supplier Name (Optional)</label>
              <input
                type="text"
                value={supplierName}
                onChange={(e) => setSupplierName(e.target.value)}
                className="w-full premium-input text-xs"
                placeholder="e.g. Hikvision KSA"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block mb-1.5">Item Type</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as 'product' | 'service')}
                className="w-full premium-input text-xs text-[var(--color-text)] font-semibold"
              >
                <option value="product">Product / منتج ملموس</option>
                <option value="service">Service / خدمة أو تركيب</option>
              </select>
            </div>

            <div>
              <label className="block mb-1.5">Category ID</label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full premium-input text-xs"
              >
                <option value="general">General</option>
                <option value="cctv">CCTV Security</option>
                <option value="networking">Networking</option>
                <option value="storage">Storage</option>
                <option value="audio">Audio</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-2">
              <label className="block mb-1.5">Unit Price / السعر *</label>
              <input
                type="number"
                step="0.01"
                required
                value={unitPrice}
                onChange={(e) => setUnitPrice(e.target.value === '' ? '' : parseFloat(e.target.value) || 0)}
                className="w-full premium-input text-xs font-mono"
                placeholder="0.00"
              />
            </div>

            <div>
              <label className="block mb-1.5">Unit Type</label>
              <select
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                className="w-full premium-input text-xs"
              >
                <option value="pc">pc</option>
                <option value="set">set</option>
                <option value="lot">lot</option>
                <option value="hr">hr</option>
                <option value="day">day</option>
                <option value="m">m</option>
                <option value="roll">roll</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block mb-1.5">Default Tax / ضريبة افتراضية</label>
            <select
              value={taxRate}
              onChange={(e) => setTaxRate(parseFloat(e.target.value) || 0)}
              className="w-full premium-input text-xs"
            >
              <option value="0">0% VAT</option>
              <option value="5">5% VAT</option>
              <option value="15">15% VAT (Standard KSA)</option>
            </select>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 mt-4 border-t border-[var(--color-divider)]/40 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-[var(--color-border)] hover:bg-[var(--color-surface-offset)] rounded-md text-xs font-semibold text-[var(--color-text)] transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-4 py-2 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white rounded-md text-xs font-semibold transition-colors cursor-pointer"
          >
            Save Item
          </button>
        </div>
      </form>
    </div>
  );
};
