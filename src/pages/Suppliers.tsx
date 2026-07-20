import React, { useState } from 'react';
import { useERPStore } from '../store';
import { Supplier, Product } from '../types';
import { PageHeader } from '../components/PageHeader';
import { matchSearchQuery } from '../utils/search';
import { EmptyState } from '../components/EmptyState';
import { ExcelImportExport } from '../components/ExcelImportExport';
import { useDebouncedAutosave } from '../hooks/useDebouncedAutosave';
import {
  Truck,
  Plus,
  Search,
  Trash2,
  Edit3,
  Loader2,
  Check,
  X,
  Package,
  ChevronDown,
  ChevronUp,
  FolderOpen,
  ArrowRight,
  Copy,
  PlusCircle,
  FolderCheck
} from 'lucide-react';

export const Suppliers: React.FC = () => {
  const {
    suppliers,
    products,
    addSupplier,
    updateSupplier,
    deleteSupplier,
    addProduct,
    updateProduct,
    company,
    currentUser,
    token
  } = useERPStore();

  const canDelete = currentUser?.role === 'admin' || !!currentUser?.permissions?.canDeleteData;

  const [search, setSearch] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editSupId, setEditSupId] = useState<string | null>(null);
  const [name, setName] = useState('');

  // Expand states for suppliers catalogs
  const [expandedSups, setExpandedSups] = useState<Set<string>>(new Set());

  // Product edit modal states
  const [selectedProductForEdit, setSelectedProductForEdit] = useState<Product | null>(null);
  const [productItemCode, setProductItemCode] = useState('');
  const [productSupplierName, setProductSupplierName] = useState('');

  // Bulk Actions
  const [selectedProductIds, setSelectedProductIds] = useState<Record<string, Set<string>>>({});
  const [bulkModal, setBulkModal] = useState<{ supplierId: string; mode: 'copy' | 'move' } | null>(null);
  const [bulkTargetSupplier, setBulkTargetSupplier] = useState('');
  const [isBulkLoading, setIsBulkLoading] = useState(false);

  const filteredSuppliers = suppliers.filter((s) =>
    matchSearchQuery(search, [s.name])
  );

  // Helper to slugify supplier name
  const getSupplierSlug = (supName: string) => {
    return supName.toLowerCase().replace(/ /g, '-');
  };

  // Helper to find products assigned to a supplier
  const getSupplierProducts = (supName: string) => {
    const slug = getSupplierSlug(supName);
    return products.filter((p) => {
      // Matches categoryId slug or contains the supplier name in its description
      const matchesCategory = p.categoryId === slug;
      const matchesDescription = p.description?.toLowerCase().includes(supName.toLowerCase()) || false;
      return matchesCategory || matchesDescription;
    });
  };

  const toggleExpand = (supId: string) => {
    const next = new Set(expandedSups);
    if (next.has(supId)) {
      next.delete(supId);
    } else {
      next.add(supId);
    }
    setExpandedSups(next);
  };

  const handleOpenCreate = () => {
    setEditSupId(null);
    setName('');
    setFormOpen(true);
  };

  const handleOpenEdit = (s: Supplier) => {
    setEditSupId(s.id);
    setName(s.name);
    setFormOpen(true);
  };

  // Autosave supplier name edits (debounced); create stays explicit.
  const autoSave = useDebouncedAutosave(
    formOpen && !!editSupId,
    editSupId,
    [name],
    () => { if (editSupId && name.trim()) updateSupplier(editSupId, name.trim()); }
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    if (editSupId) {
      updateSupplier(editSupId, name.trim());
      setFormOpen(false);
    } else {
      addSupplier(name.trim());
      setFormOpen(false);
      alert('New supplier added successfully!');
    }
  };

  // Product Assignment Modals
  const openProductEdit = (product: Product, supName: string) => {
    setSelectedProductForEdit(product);
    // Parse item code from description block: "Item Code: XXX\nSupplier: YYY"
    const codeMatch = product.description?.match(/Item Code:\s*([^\n]+)/);
    setProductItemCode(codeMatch ? codeMatch[1] : '');
    setProductSupplierName(supName);
  };

  const handleProductUpdateSubmit = async () => {
    if (!selectedProductForEdit) return;

    // Build new description block preserving existing details or rewriting
    const newDesc = `Item Code: ${productItemCode.trim() || 'N/A'}\nSupplier: ${productSupplierName || 'N/A'}`;
    const newSlug = getSupplierSlug(productSupplierName);

    const updatedPayload: Product = {
      ...selectedProductForEdit,
      description: newDesc,
      categoryId: newSlug
    };

    await updateProduct(updatedPayload);
    setSelectedProductForEdit(null);
    alert('Product assignment updated successfully!');
  };

  // Multi-select helpers
  const getSelected = (supId: string): Set<string> => selectedProductIds[supId] || new Set();

  const toggleProductSelect = (supId: string, prodId: string) => {
    const cur = new Set(getSelected(supId));
    if (cur.has(prodId)) cur.delete(prodId); else cur.add(prodId);
    setSelectedProductIds({ ...selectedProductIds, [supId]: cur });
  };

  const selectAllProducts = (supId: string, supplierProds: Product[]) => {
    setSelectedProductIds({
      ...selectedProductIds,
      [supId]: new Set(supplierProds.map((p) => p.id))
    });
  };

  const clearSelection = (supId: string) => {
    setSelectedProductIds({ ...selectedProductIds, [supId]: new Set() });
  };

  const handleBulkAction = async () => {
    if (!bulkModal || !bulkTargetSupplier) return;
    setIsBulkLoading(true);

    const selIds = getSelected(bulkModal.supplierId);
    const selectedProds = products.filter((p) => selIds.has(p.id));

    try {
      for (const prod of selectedProds) {
        // Parse item code
        const codeMatch = prod.description?.match(/Item Code:\s*([^\n]+)/);
        const itemCode = codeMatch ? codeMatch[1] : 'N/A';
        const newDesc = `Item Code: ${itemCode}\nSupplier: ${bulkTargetSupplier}`;
        const newSlug = getSupplierSlug(bulkTargetSupplier);

        if (bulkModal.mode === 'copy') {
          // Copy: create a duplicate product assigned to target supplier
          const copiedPayload: Product = {
            ...prod,
            id: `p-${Date.now()}-${Math.random()}`,
            name: `${prod.name} (Copy)`,
            description: newDesc,
            categoryId: newSlug
          };
          await addProduct(copiedPayload);
        } else {
          // Move: update the existing product's assignment
          const movedPayload: Product = {
            ...prod,
            description: newDesc,
            categoryId: newSlug
          };
          await updateProduct(movedPayload);
        }
      }
      setBulkModal(null);
      setBulkTargetSupplier('');
      clearSelection(bulkModal.supplierId);
      alert(`Successfully processed bulk ${bulkModal.mode} action!`);
    } catch (e) {
      alert('Error processing bulk supplier updates.');
    } finally {
      setIsBulkLoading(false);
    }
  };

  return (
    <div className="animate-fade-in text-left">
      <PageHeader
        title="Suppliers / الموردين"
        breadcrumbs={[{ label: 'Home' }, { label: 'Suppliers' }]}
        actions={
          <div className="flex gap-2">
            <ExcelImportExport
              title="Suppliers"
              entityType="suppliers"
              token={token}
              columns={[
                { key: 'id', label: 'ID' },
                { key: 'name', label: 'Supplier Name' },
              ]}
              templateSample={[{ id: '', name: 'Supplier Name' }]}
            />
            <button
              onClick={handleOpenCreate}
              className="bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white text-xs font-semibold py-2.5 px-4 rounded-md flex items-center gap-1.5 transition-colors shadow-sm cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              New Supplier / مورد جديد
            </button>
          </div>
        }
      />

      {/* Directory search */}
      <div className="premium-card p-4 mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="relative flex-1 min-w-[280px]">
          <Search className="absolute left-3 w-4 h-4 text-[var(--color-text-muted)] pointer-events-none" />
          <input
            type="text"
            placeholder="Search suppliers by name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full premium-input pl-10 pr-4 py-2"
          />
        </div>
      </div>

      {filteredSuppliers.length === 0 ? (
        <EmptyState
          icon={Truck}
          title="No suppliers registered"
          description="Register suppliers, track item codes, and distribute catalog sheets across multiple departments."
          actionText="Create Supplier"
          onAction={handleOpenCreate}
        />
      ) : (
        <div className="flex flex-col gap-4">
          {filteredSuppliers.map((s) => {
            const supplierProducts = getSupplierProducts(s.name);
            const isExpanded = expandedSups.has(s.id);
            const sel = getSelected(s.id);
            const allSelected = supplierProducts.length > 0 && sel.size === supplierProducts.length;
            const someSelected = sel.size > 0;

            return (
              <div
                key={s.id}
                className="premium-card p-5 flex flex-col transition-all duration-[var(--transition-interactive)] hover:border-[var(--color-primary)]/40 hover:shadow-sm"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="bg-[var(--color-primary)]/10 p-2 rounded-lg text-[var(--color-primary)]">
                      <Truck className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-[var(--color-text)]">{s.name}</h3>
                      <button
                        onClick={() => toggleExpand(s.id)}
                        className="flex items-center gap-1 text-[11px] font-bold text-[var(--color-primary)] hover:underline mt-1 bg-transparent border-0 cursor-pointer"
                      >
                        <Package className="w-3.5 h-3.5" />
                        {supplierProducts.length} Product{supplierProducts.length !== 1 ? 's' : ''} Linked
                        {isExpanded ? <ChevronUp className="w-3 h-3 ml-0.5" /> : <ChevronDown className="w-3 h-3 ml-0.5" />}
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Expand bulk operations */}
                    {someSelected && (
                      <div className="flex items-center gap-1.5 bg-[var(--color-surface-offset)] border border-[var(--color-border)] rounded-md px-2 py-1 text-xs animate-slide-in">
                        <span className="font-bold text-[var(--color-primary)] bg-[var(--color-primary)]/10 px-1.5 py-0.5 rounded">{sel.size} selected</span>
                        <button
                          onClick={() => setBulkModal({ supplierId: s.id, mode: 'copy' })}
                          className="flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-2 py-0.5 rounded transition-all cursor-pointer"
                        >
                          <Copy className="w-3 h-3" /> Copy To
                        </button>
                        <button
                          onClick={() => setBulkModal({ supplierId: s.id, mode: 'move' })}
                          className="flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 px-2 py-0.5 rounded transition-all cursor-pointer"
                        >
                          <ArrowRight className="w-3 h-3" /> Move To
                        </button>
                        <button onClick={() => clearSelection(s.id)} className="text-[var(--color-text-muted)] hover:text-[var(--color-text)] px-1 text-[10px] font-bold cursor-pointer">✕ Clear</button>
                      </div>
                    )}

                    <button
                      onClick={() => handleOpenEdit(s)}
                      className="p-2 hover:bg-[var(--color-surface-offset)] rounded text-[var(--color-text-muted)] hover:text-[var(--color-primary)] transition-colors cursor-pointer"
                      title="Edit Supplier"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    {canDelete && (
                      <button
                        onClick={() => {
                          if (window.confirm(`Are you sure you want to delete supplier ${s.name}?`)) {
                            deleteSupplier(s.id);
                          }
                        }}
                        className="p-2 hover:bg-[var(--color-error)]/10 rounded text-[var(--color-text-faint)] hover:text-[var(--color-error)] transition-colors cursor-pointer"
                        title="Delete Supplier"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Expandable Product Catalog List */}
                {isExpanded && (
                  <div className="mt-4 border border-[var(--color-border)] rounded-lg overflow-hidden animate-slide-in">
                    <div className="flex items-center justify-between px-3 py-2 bg-[var(--color-surface-offset)] border-b border-[var(--color-border)] text-xs font-semibold">
                      <button
                        onClick={() => allSelected ? clearSelection(s.id) : selectAllProducts(s.id, supplierProducts)}
                        className="flex items-center gap-1.5 text-[var(--color-primary)] hover:underline bg-transparent border-0 cursor-pointer"
                      >
                        <FolderCheck className="w-4 h-4" />
                        {allSelected ? 'Deselect All' : 'Select All Products'}
                      </button>
                      <span className="text-[var(--color-text-muted)] text-[10px]">Click any product line to reassign codes or vendor values</span>
                    </div>

                    {supplierProducts.length === 0 ? (
                      <div className="p-4 text-center text-xs text-[var(--color-text-muted)] italic">
                        No product assigned to this supplier yet.
                      </div>
                    ) : (
                      <div className="flex flex-col divide-y divide-[var(--color-border)] max-h-72 overflow-y-auto">
                        {supplierProducts.map((p) => {
                          const isSelected = sel.has(p.id);
                          // Parse item code
                          const codeMatch = p.description?.match(/Item Code:\s*([^\n]+)/);
                          const itemCode = codeMatch ? codeMatch[1] : null;

                          return (
                            <div
                              key={p.id}
                              onClick={() => openProductEdit(p, s.name)}
                              className={`flex items-center justify-between px-4 py-2.5 transition-colors cursor-pointer text-xs ${isSelected ? 'bg-[var(--color-primary)]/5' : 'hover:bg-[var(--color-surface-offset)]/30'}`}
                            >
                              <div className="flex items-center gap-3 overflow-hidden">
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={(e) => {
                                    e.stopPropagation();
                                    toggleProductSelect(s.id, p.id);
                                  }}
                                  className="w-4 h-4 text-[var(--color-primary)] border-[var(--color-border)] rounded focus:ring-[var(--color-primary)] cursor-pointer"
                                />
                                <div className="flex items-center gap-2 overflow-hidden">
                                  {itemCode ? (
                                    <span className="font-mono text-[9px] font-bold bg-[var(--color-primary)]/10 text-[var(--color-primary)] px-2 py-0.5 rounded tracking-tight shrink-0">
                                      {itemCode}
                                    </span>
                                  ) : (
                                    <span className="font-mono text-[9px] italic bg-[var(--color-surface-offset)] text-[var(--color-text-muted)] px-1.5 py-0.5 rounded shrink-0">
                                      No Code
                                    </span>
                                  )}
                                  <span className="font-bold text-[var(--color-text)] truncate">{p.name}</span>
                                </div>
                              </div>

                              <div className="flex items-center gap-4 shrink-0 font-bold font-mono text-[var(--color-text-muted)]">
                                <span>{p.unitPrice.toFixed(2)} {company.currency}</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Edit/Create Form dialog */}
      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-fade-in" onClick={() => setFormOpen(false)} />
          <form
            onSubmit={handleSubmit}
            className="relative w-full max-w-md bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl shadow-lg p-6 overflow-hidden animate-slide-in text-left flex flex-col gap-4"
          >
            <div className="flex items-center justify-between border-b border-[var(--color-border)] pb-3">
              <h3 className="text-sm font-bold text-[var(--color-text)] flex items-center gap-2">
                {editSupId ? 'Modify Supplier / تعديل المورد' : 'Create Supplier / إضافة مورد'}
                {editSupId && autoSave === 'saving' && <span className="flex items-center gap-1 text-[10px] font-semibold text-[var(--color-text-muted)]"><Loader2 className="w-3 h-3 animate-spin" /> Saving…</span>}
                {editSupId && autoSave === 'saved' && <span className="flex items-center gap-1 text-[10px] font-semibold text-emerald-500"><Check className="w-3 h-3" /> Saved</span>}
              </h3>
              <button
                type="button"
                onClick={() => setFormOpen(false)}
                className="p-1 hover:bg-[var(--color-surface-offset)] rounded transition-colors"
              >
                <X className="w-4 h-4 text-[var(--color-text-muted)]" />
              </button>
            </div>

            <div className="text-xs font-semibold text-[var(--color-text-muted)]">
              <label className="block mb-1.5">Supplier / Company Name *</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full premium-input text-sm text-[var(--color-text)] font-semibold"
                placeholder="e.g. Saudi Aramco Logistics Co."
              />
            </div>

            <div className="flex items-center justify-end gap-3 mt-4 border-t border-[var(--color-divider)]/40 pt-4 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setFormOpen(false)}
                className="px-4 py-2 border border-[var(--color-border)] hover:bg-[var(--color-surface-offset)] rounded-md text-[var(--color-text)] transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white rounded-md transition-colors cursor-pointer"
              >
                {editSupId ? 'Done' : 'Save Supplier'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── Single Product Edit / Reassignment Modal ── */}
      {selectedProductForEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-fade-in" onClick={() => setSelectedProductForEdit(null)} />
          <div className="relative w-full max-w-md bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl shadow-lg p-5 overflow-hidden animate-slide-in text-left flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-[var(--color-border)] pb-3">
              <h3 className="text-sm font-bold text-[var(--color-text)] flex items-center gap-2">
                <Package className="w-4 h-4 text-[var(--color-primary)]" />
                Edit Product Assignment
              </h3>
              <button
                type="button"
                onClick={() => setSelectedProductForEdit(null)}
                className="p-1 hover:bg-[var(--color-surface-offset)] rounded transition-colors cursor-pointer"
              >
                <X className="w-4 h-4 text-[var(--color-text-muted)]" />
              </button>
            </div>

            <div className="bg-[var(--color-surface-offset)] p-3 rounded-lg border border-[var(--color-border)] text-xs">
              <span className="text-[9px] font-black uppercase text-[var(--color-text-muted)] tracking-wider">Product Name</span>
              <p className="font-bold text-[var(--color-text)] mt-1">{selectedProductForEdit.name}</p>
              <div className="mt-2.5 pt-2 flex justify-between border-t border-[var(--color-border)]/50 text-[10px] text-[var(--color-text-muted)]">
                <span>Unit: <strong className="text-[var(--color-text)]">{selectedProductForEdit.unit}</strong></span>
                <span>Price: <strong className="text-emerald-600 font-mono">{selectedProductForEdit.unitPrice.toFixed(2)} {company.currency}</strong></span>
              </div>
            </div>

            <div className="flex flex-col gap-3.5 text-xs font-semibold text-[var(--color-text-muted)]">
              <div>
                <label className="block mb-1.5">Item Code</label>
                <input
                  type="text"
                  value={productItemCode}
                  onChange={(e) => setProductItemCode(e.target.value)}
                  className="w-full premium-input font-mono"
                  placeholder="e.g. IT-CAM-8899"
                />
              </div>

              <div>
                <label className="block mb-1.5">Assign Supplier</label>
                <select
                  value={productSupplierName}
                  onChange={(e) => setProductSupplierName(e.target.value)}
                  className="w-full premium-input"
                >
                  <option value="">— Select a supplier —</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.name}>{s.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 mt-4 border-t border-[var(--color-divider)]/40 pt-4 text-xs font-semibold">
              <button
                onClick={() => setSelectedProductForEdit(null)}
                className="px-4 py-2 border border-[var(--color-border)] hover:bg-[var(--color-surface-offset)] rounded-md text-[var(--color-text)] transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleProductUpdateSubmit}
                className="px-4 py-2 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white rounded-md transition-colors cursor-pointer"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Bulk Copy / Move Dialog ── */}
      {bulkModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-fade-in" onClick={() => setBulkModal(null)} />
          <div className="relative w-full max-w-md bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl shadow-lg p-5 overflow-hidden animate-slide-in text-left flex flex-col gap-4">
            <div className={`flex items-center justify-between border-b pb-3 ${bulkModal.mode === 'copy' ? 'border-emerald-200' : 'border-amber-200'}`}>
              <h3 className="text-sm font-bold text-[var(--color-text)] flex items-center gap-2">
                {bulkModal.mode === 'copy' ? <Copy className="w-4 h-4 text-emerald-600" /> : <ArrowRight className="w-4 h-4 text-amber-600" />}
                {bulkModal.mode === 'copy' ? 'Copy Products To Supplier' : 'Move Products To Supplier'}
              </h3>
              <button
                type="button"
                onClick={() => setBulkModal(null)}
                className="p-1 hover:bg-[var(--color-surface-offset)] rounded transition-colors cursor-pointer"
              >
                <X className="w-4 h-4 text-[var(--color-text-muted)]" />
              </button>
            </div>

            <div className="bg-[var(--color-surface-offset)] p-3 rounded-lg border border-[var(--color-border)] text-xs">
              <span className="text-[9px] font-black uppercase text-[var(--color-text-muted)] tracking-wider">Selected Products ({getSelected(bulkModal.supplierId).size})</span>
              <div className="max-h-36 overflow-y-auto space-y-1.5 mt-2">
                {products.filter((p) => getSelected(bulkModal.supplierId).has(p.id)).map((p) => {
                  const codeMatch = p.description?.match(/Item Code:\s*([^\n]+)/);
                  const itemCode = codeMatch ? codeMatch[1] : null;

                  return (
                    <div key={p.id} className="flex items-center gap-2 text-[11px]">
                      {itemCode && <span className="font-mono text-[9px] bg-[var(--color-primary)]/10 text-[var(--color-primary)] px-1 rounded shrink-0">{itemCode}</span>}
                      <span className="text-[var(--color-text)] font-semibold truncate">{p.name}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="text-xs font-semibold text-[var(--color-text-muted)]">
              <label className="block mb-1.5">{bulkModal.mode === 'copy' ? 'Copy To Supplier' : 'Move To Supplier'}</label>
              <select
                value={bulkTargetSupplier}
                onChange={(e) => setBulkTargetSupplier(e.target.value)}
                className="w-full premium-input"
              >
                <option value="">— Select target supplier —</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.name}>{s.name}</option>
                ))}
              </select>
            </div>

            {bulkModal.mode === 'copy' && (
              <p className="text-[10px] text-emerald-800 bg-emerald-50 border border-emerald-200 rounded p-2.5 leading-relaxed font-semibold">
                ℹ️ This creates <strong>duplicate</strong> product entries assigned to the selected supplier, keeping the originals under the current supplier.
              </p>
            )}
            {bulkModal.mode === 'move' && (
              <p className="text-[10px] text-amber-800 bg-amber-50 border border-amber-200 rounded p-2.5 leading-relaxed font-semibold">
                ⚠️ This <strong>reassigns</strong> the selected products to the target supplier. They will no longer appear under this supplier.
              </p>
            )}

            <div className="flex items-center justify-end gap-3 mt-2 border-t border-[var(--color-divider)]/40 pt-4 text-xs font-semibold">
              <button
                onClick={() => setBulkModal(null)}
                className="px-4 py-2 border border-[var(--color-border)] hover:bg-[var(--color-surface-offset)] rounded-md text-[var(--color-text)] transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleBulkAction}
                disabled={!bulkTargetSupplier || isBulkLoading}
                className={`px-4 py-2 text-white rounded-md transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${bulkModal.mode === 'copy' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-amber-600 hover:bg-amber-700'}`}
              >
                {isBulkLoading ? 'Processing...' : bulkModal.mode === 'copy' ? `Copy ${getSelected(bulkModal.supplierId).size} Products` : `Move ${getSelected(bulkModal.supplierId).size} Products`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Suppliers;
