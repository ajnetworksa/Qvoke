import React, { useState } from 'react';
import { useERPStore } from '../store';
import { Product } from '../types';
import { PageHeader } from '../components/PageHeader';
import { matchSearchQuery } from '../utils/search';
import { EmptyState } from '../components/EmptyState';
import { ExcelImportExport } from '../components/ExcelImportExport';
import { Package, Plus, Search, Trash2, Edit3, X, Tag } from 'lucide-react';

export const Products: React.FC = () => {
  const { products, addProduct, updateProduct, deleteProduct, company, currentUser, token } = useERPStore();
  const canDelete = currentUser?.role === 'admin' || !!currentUser?.permissions?.canDeleteData;

  const [search, setSearch] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editProdId, setEditProdId] = useState<string | null>(null);

  // Form states
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<'product' | 'service'>('product');
  const [unitPrice, setUnitPrice] = useState(0);
  const [unit, setUnit] = useState('pc');
  const [taxRate, setTaxRate] = useState(15);
  const [categoryId, setCategoryId] = useState('general');

  const filtered = products.filter(p =>
    matchSearchQuery(search, [p.name, p.description, p.unit, p.categoryId, p.id, p.unitPrice])
  );

  const handleOpenCreate = () => {
    setEditProdId(null);
    setName('');
    setDescription('');
    setType('product');
    setUnitPrice(0);
    setUnit('pc');
    setTaxRate(company.defaultTax);
    setCategoryId('general');
    setFormOpen(true);
  };

  const handleOpenEdit = (p: Product) => {
    setEditProdId(p.id);
    setName(p.name);
    setDescription(p.description || '');
    setType(p.type);
    setUnitPrice(p.unitPrice);
    setUnit(p.unit);
    setTaxRate(p.taxRate);
    setCategoryId(p.categoryId || 'general');
    setFormOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const payload: Product = {
      id: editProdId || `p-${Date.now()}`,
      name,
      description,
      type,
      unitPrice,
      unit,
      taxRate,
      categoryId
    };

    if (editProdId) {
      updateProduct(payload);
    } else {
      addProduct(payload);
    }

    setFormOpen(false);
    alert(editProdId ? 'Product Updated!' : 'Product Created successfully!');
  };

  return (
    <div className="animate-fade-in text-left">
      <PageHeader
        title="Products & Services / المنتجات والخدمات"
        breadcrumbs={[{ label: 'Home' }, { label: 'Products' }]}
        actions={
          <div className="flex gap-2">
            <ExcelImportExport
              title="Products"
              entityType="products"
              token={token}
              columns={[
                { key: 'id', label: 'ID' },
                { key: 'name', label: 'Name' },
                { key: 'description', label: 'Description' },
                { key: 'type', label: 'Type' },
                { key: 'unitPrice', label: 'Unit Price' },
                { key: 'unit', label: 'Unit' },
                { key: 'taxRate', label: 'Tax Rate' },
                { key: 'categoryId', label: 'Category' },
              ]}
              templateSample={[{ id: '', name: 'Sample Product', description: 'EN / عربي', type: 'product', unitPrice: 100, unit: 'pc', taxRate: 15, categoryId: 'general' }]}
            />
            <button
              onClick={handleOpenCreate}
              className="bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white text-xs font-semibold py-2.5 px-4 rounded-md flex items-center gap-1.5 transition-colors shadow-sm cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              New Item / إضافة عنصر جديد
            </button>
          </div>
        }
      />

      {/* Product search */}
      <div className="premium-card p-4 mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="relative flex-1 min-w-[280px]">
          <Search className="absolute left-3 w-4 h-4 text-[var(--color-text-muted)] pointer-events-none" />
          <input
            type="text"
            placeholder="Search items catalog by name or description..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full premium-input pl-10 pr-4 py-2"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={Package}
          title="Product Catalog is empty"
          description="Populate products and services catalog items, billing rates, and unit categories."
          actionText="Create Item"
          onAction={handleOpenCreate}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((p) => (
            <div
              key={p.id}
              className="premium-card p-6 flex flex-col justify-between transition-all duration-[var(--transition-interactive)] hover:border-[var(--color-primary)]/40 hover:shadow-md"
            >
              <div className="text-left">
                <div className="flex items-start justify-between mb-3 border-b border-[var(--color-divider)]/30 pb-3">
                  <div>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold border mb-1.5 ${
                      p.type === 'product'
                        ? 'bg-blue-500/10 border-blue-500/20 text-blue-600'
                        : 'bg-indigo-500/10 border-indigo-500/20 text-indigo-600'
                    }`}>
                      {p.type.toUpperCase()}
                    </span>
                    <h3 className="text-sm font-bold text-[var(--color-text)] leading-tight">{p.name}</h3>
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => handleOpenEdit(p)}
                      className="p-1.5 hover:bg-[var(--color-surface-offset)] rounded text-[var(--color-text-muted)] hover:text-[var(--color-primary)] transition-colors cursor-pointer"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    {canDelete && (
                      <button
                        onClick={() => {
                          if (window.confirm(`Delete ${p.name}?`)) deleteProduct(p.id);
                        }}
                        className="p-1.5 hover:bg-[var(--color-error)]/10 rounded text-[var(--color-text-faint)] hover:text-[var(--color-error)] transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {p.description && (
                  <p className="text-xs text-[var(--color-text-muted)] leading-relaxed mb-4 line-clamp-3">
                    {p.description}
                  </p>
                )}
              </div>

              <div className="flex items-center justify-between border-t border-[var(--color-divider)]/30 pt-3 mt-2 text-xs">
                <div className="text-left">
                  <span className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase block">Price / Unit</span>
                  <span className="font-bold text-[var(--color-text)] text-sm font-mono">
                    {p.unitPrice.toFixed(2)} {company.currency} <span className="text-[10px] font-normal text-[var(--color-text-muted)]">/ {p.unit}</span>
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase block">Tax rate</span>
                  <span className="font-bold text-[var(--color-primary)] font-mono">{p.taxRate}% VAT</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Product Edit/Create Form dialog */}
      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-fade-in" onClick={() => setFormOpen(false)} />
          <form
            onSubmit={handleSubmit}
            className="relative w-full max-w-md bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl shadow-lg p-6 overflow-hidden animate-slide-in text-left flex flex-col gap-4"
          >
            <div className="flex items-center justify-between border-b border-[var(--color-border)] pb-3">
              <h3 className="text-sm font-bold text-[var(--color-text)]">
                {editProdId ? 'Modify Catalog Item / تعديل منتج' : 'Add Catalog Item / إضافة منتج'}
              </h3>
              <button
                type="button"
                onClick={() => setFormOpen(false)}
                className="p-1 hover:bg-[var(--color-surface-offset)] rounded transition-colors"
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
                    value={unitPrice === 0 ? '' : unitPrice}
                    onChange={(e) => setUnitPrice(parseFloat(e.target.value) || 0)}
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
                onClick={() => setFormOpen(false)}
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
      )}
    </div>
  );
};
export default Products;
