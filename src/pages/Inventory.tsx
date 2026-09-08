import React, { useState, useEffect, useMemo } from 'react';
import { useERPStore } from '../store';
import { PageHeader } from '../components/PageHeader';
import { Product, InventoryTransaction } from '../types';
import {
  Package, Layers, AlertTriangle, ArrowDownRight, ArrowUpRight,
  Plus, Search, RefreshCw, Filter, History, CheckCircle2, ShoppingBag
} from 'lucide-react';
import EmptyState from '../components/EmptyState';

export const Inventory: React.FC = () => {
  const { products, inventoryLogs, fetchInventoryLogs, adjustInventory, company } = useERPStore();
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'stock' | 'logs'>('stock');

  // Adjustment Modal state
  const [adjustModalOpen, setAdjustModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [adjustType, setAdjustType] = useState<'in' | 'out' | 'adjustment'>('in');
  const [adjustQty, setAdjustQty] = useState<number | ''>('');
  const [adjustNotes, setAdjustNotes] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchInventoryLogs();
  }, [fetchInventoryLogs]);

  const physicalProducts = useMemo(() => {
    return products.filter(p => p.type === 'product');
  }, [products]);

  const filteredProducts = useMemo(() => {
    return physicalProducts.filter(p =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.itemCode && p.itemCode.toLowerCase().includes(search.toLowerCase())) ||
      (p.supplierName && p.supplierName.toLowerCase().includes(search.toLowerCase()))
    );
  }, [physicalProducts, search]);

  const lowStockCount = useMemo(() => {
    return physicalProducts.filter(p => (Number(p.stockQuantity) || 0) <= (Number(p.minStockLevel) || 5)).length;
  }, [physicalProducts]);

  const totalStockUnits = useMemo(() => {
    return physicalProducts.reduce((sum, p) => sum + (Number(p.stockQuantity) || 0), 0);
  }, [physicalProducts]);

  const handleOpenAdjust = (prod: Product) => {
    setSelectedProduct(prod);
    setAdjustType('in');
    setAdjustQty('');
    setAdjustNotes('');
    setAdjustModalOpen(true);
  };

  const handleAdjustSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct || adjustQty === '' || Number(adjustQty) <= 0) return;

    setSaving(true);
    await adjustInventory(selectedProduct.id, adjustType, Number(adjustQty), adjustNotes);
    setSaving(false);
    setAdjustModalOpen(false);
  };

  return (
    <div className="animate-fade-in text-left">
      <PageHeader
        title="Inventory &amp; Stock Management / إدارة المخزون والمستودعات"
        breadcrumbs={[{ label: 'Home' }, { label: 'Inventory' }]}
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab(activeTab === 'stock' ? 'logs' : 'stock')}
              className="px-3.5 py-2 rounded-md border border-[var(--color-border)] text-xs font-semibold hover:bg-[var(--color-surface-offset)] transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <History className="w-4 h-4" />
              <span>{activeTab === 'stock' ? 'Stock Movement Logs' : 'Stock Levels'}</span>
            </button>
          </div>
        }
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-6">
        <div className="premium-card p-5">
          <div className="flex items-center justify-between text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider mb-2">
            <span>Total Catalog Products</span>
            <Package className="w-4 h-4 text-[var(--color-primary)]" />
          </div>
          <span className="text-2xl font-extrabold text-[var(--color-text)] font-mono">
            {physicalProducts.length}
          </span>
          <span className="text-[10px] text-[var(--color-text-muted)] block mt-1">
            Tracked physical inventory items
          </span>
        </div>

        <div className="premium-card p-5">
          <div className="flex items-center justify-between text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider mb-2">
            <span>Total Units in Stock</span>
            <Layers className="w-4 h-4 text-teal-500" />
          </div>
          <span className="text-2xl font-extrabold text-teal-600 dark:text-teal-400 font-mono">
            {totalStockUnits.toLocaleString()}
          </span>
          <span className="text-[10px] text-[var(--color-text-muted)] block mt-1">
            Available on hand
          </span>
        </div>

        <div className="premium-card p-5">
          <div className="flex items-center justify-between text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider mb-2">
            <span>Low Stock Alerts / تنبيهات النقص</span>
            <AlertTriangle className="w-4 h-4 text-amber-500" />
          </div>
          <span className={`text-2xl font-extrabold font-mono ${lowStockCount > 0 ? 'text-amber-500' : 'text-emerald-500'}`}>
            {lowStockCount}
          </span>
          <span className="text-[10px] text-[var(--color-text-muted)] block mt-1">
            {lowStockCount > 0 ? 'Items below reorder point' : 'All items sufficiently stocked'}
          </span>
        </div>
      </div>

      {/* Search & Tabs */}
      <div className="premium-card p-4 mb-6 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-3 text-[var(--color-text-muted)]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search SKU, product name..."
            className="w-full pl-9 pr-4 py-2 premium-input text-xs"
          />
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('stock')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'stock'
                ? 'bg-[var(--color-primary)] text-white shadow-sm'
                : 'bg-[var(--color-surface-offset)] text-[var(--color-text-muted)]'
            }`}
          >
            Product Stock Levels
          </button>
          <button
            onClick={() => setActiveTab('logs')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'logs'
                ? 'bg-[var(--color-primary)] text-white shadow-sm'
                : 'bg-[var(--color-surface-offset)] text-[var(--color-text-muted)]'
            }`}
          >
            Audit Log ({inventoryLogs.length})
          </button>
        </div>
      </div>

      {/* View Content */}
      {activeTab === 'stock' ? (
        filteredProducts.length === 0 ? (
          <EmptyState
            icon={Package}
            title="No inventory products found"
            description="Physical products with tracking enabled will appear here."
          />
        ) : (
          <div className="premium-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-[var(--color-surface-2)] text-[var(--color-text-muted)] uppercase tracking-wider text-[10px] font-black border-b border-[var(--color-border)]">
                  <tr>
                    <th className="py-3.5 px-4">Item Code / SKU</th>
                    <th className="py-3.5 px-4">Product Name</th>
                    <th className="py-3.5 px-4">Unit</th>
                    <th className="py-3.5 px-4 text-right">Unit Price</th>
                    <th className="py-3.5 px-4 text-center">Stock Level</th>
                    <th className="py-3.5 px-4 text-center">Min Threshold</th>
                    <th className="py-3.5 px-4 text-center">Status</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-divider)]/40">
                  {filteredProducts.map((p) => {
                    const currentQty = Number(p.stockQuantity) || 0;
                    const minLvl = Number(p.minStockLevel) || 5;
                    const isLow = currentQty <= minLvl;
                    const isOut = currentQty === 0;

                    return (
                      <tr key={p.id} className="hover:bg-[var(--color-surface-offset)]/40 transition-colors">
                        <td className="py-3.5 px-4 font-mono font-bold text-[var(--color-text)]">
                          {p.itemCode || '—'}
                        </td>
                        <td className="py-3.5 px-4 font-bold text-[var(--color-text)]">
                          {p.name}
                        </td>
                        <td className="py-3.5 px-4 text-[var(--color-text-muted)]">
                          {p.unit || 'Unit'}
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono font-bold text-[var(--color-text)]">
                          {p.unitPrice.toLocaleString()} {company.currency}
                        </td>
                        <td className="py-3.5 px-4 text-center font-mono font-extrabold text-sm">
                          <span className={isOut ? 'text-rose-500' : isLow ? 'text-amber-500' : 'text-emerald-600 dark:text-emerald-400'}>
                            {currentQty}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-center font-mono text-[var(--color-text-muted)]">
                          {minLvl}
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          {isOut ? (
                            <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-500/15 text-rose-500 border border-rose-500/30">
                              Out of Stock
                            </span>
                          ) : isLow ? (
                            <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-500/15 text-amber-500 border border-amber-500/30">
                              Low Stock
                            </span>
                          ) : (
                            <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                              In Stock
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <button
                            onClick={() => handleOpenAdjust(p)}
                            className="px-2.5 py-1 rounded-md bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white text-[11px] font-bold transition-all shadow-sm cursor-pointer"
                          >
                            Adjust Stock
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )
      ) : (
        /* Movement Logs Table */
        <div className="premium-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-[var(--color-surface-2)] text-[var(--color-text-muted)] uppercase tracking-wider text-[10px] font-black border-b border-[var(--color-border)]">
                <tr>
                  <th className="py-3.5 px-4">Date &amp; Time</th>
                  <th className="py-3.5 px-4">Product</th>
                  <th className="py-3.5 px-4">Type</th>
                  <th className="py-3.5 px-4 text-right">Quantity</th>
                  <th className="py-3.5 px-4 text-right">Previous</th>
                  <th className="py-3.5 px-4 text-right">New Balance</th>
                  <th className="py-3.5 px-4">Ref / Notes</th>
                  <th className="py-3.5 px-4">Actor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-divider)]/40">
                {inventoryLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-[var(--color-surface-offset)]/40 transition-colors">
                    <td className="py-3 px-4 font-mono text-[var(--color-text-muted)]">
                      {new Date(log.createdAt).toLocaleString()}
                    </td>
                    <td className="py-3 px-4 font-bold text-[var(--color-text)]">
                      {log.productName || 'Product'}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        log.type === 'in'
                          ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                          : 'bg-rose-500/15 text-rose-500'
                      }`}>
                        {log.type === 'in' ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                        {log.type}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold">
                      {log.quantity}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-[var(--color-text-muted)]">
                      {log.previousStock}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-[var(--color-primary)]">
                      {log.newStock}
                    </td>
                    <td className="py-3 px-4 text-[var(--color-text-muted)]">
                      {log.notes || '—'}
                    </td>
                    <td className="py-3 px-4 text-[11px] text-[var(--color-text-muted)]">
                      {log.createdByName || 'System'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Stock Adjustment Modal */}
      {adjustModalOpen && selectedProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in text-left">
          <div className="relative w-full max-w-md bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-divider)]/40 bg-[var(--color-surface-2)]">
              <h3 className="text-sm font-extrabold text-[var(--color-text)]">
                Stock Adjustment / تعديل رصيد المخزون
              </h3>
            </div>

            <form onSubmit={handleAdjustSubmit} className="p-6 flex flex-col gap-4">
              <div className="p-3 rounded-lg bg-[var(--color-surface-offset)] border border-[var(--color-border)] text-xs">
                <span className="text-[var(--color-text-muted)] block text-[10px] uppercase font-bold">Target Product:</span>
                <span className="font-bold text-[var(--color-text)] text-sm">{selectedProduct.name}</span>
                <span className="text-[11px] text-[var(--color-text-muted)] block mt-0.5">
                  Current Stock: <span className="font-mono font-bold text-[var(--color-primary)]">{selectedProduct.stockQuantity || 0} {selectedProduct.unit}</span>
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold text-[var(--color-text)] mb-1">Adjustment Type</label>
                <select
                  value={adjustType}
                  onChange={(e) => setAdjustType(e.target.value as any)}
                  className="w-full premium-input text-xs"
                >
                  <option value="in">Stock In (+) / إضافة مخزون وارد</option>
                  <option value="out">Stock Out (-) / صرف مخزون صادر</option>
                  <option value="adjustment">Exact Count Set / جرد فعلي وتصحيح</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-[var(--color-text)] mb-1">
                  Quantity / الكمية <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  step="1"
                  min="1"
                  required
                  value={adjustQty}
                  onChange={(e) => setAdjustQty(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="0"
                  className="w-full premium-input text-xs font-mono font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[var(--color-text)] mb-1">
                  Reason / Notes / سبب التعديل
                </label>
                <input
                  type="text"
                  value={adjustNotes}
                  onChange={(e) => setAdjustNotes(e.target.value)}
                  placeholder="e.g. Supplier Shipment Recv / Physical inventory audit"
                  className="w-full premium-input text-xs"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-[var(--color-divider)]/40">
                <button
                  type="button"
                  onClick={() => setAdjustModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-[var(--color-text-muted)] hover:bg-[var(--color-surface-offset)] rounded-md transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 text-xs font-bold bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white rounded-md transition-all shadow-sm cursor-pointer disabled:opacity-50"
                >
                  {saving ? 'Applying...' : 'Apply Stock Change'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
