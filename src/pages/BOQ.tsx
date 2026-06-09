import React, { useState, useEffect, useRef } from 'react';
import { useERPStore } from '../store';
import { useAutoSave } from '../hooks/useAutoSave';
import { AutoSaveIndicator } from '../components/AutoSaveIndicator';
import { PageHeader } from '../components/PageHeader';
import { CustomerCombobox } from '../components/CustomerCombobox';
import { InlineProductSearchInput } from '../components/InlineProductSearchInput';
import { matchSearchQuery } from '../utils/search';
import {
  ClipboardList, Plus, Search, Trash2, Edit3, X, ChevronDown, ChevronUp,
  Save, CheckCircle, AlertTriangle, Loader2, Calculator, FileText
} from 'lucide-react';

interface BOQItem {
  id: string;
  productId?: string;
  description: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  total: number;
}
interface BOQSection {
  id: string;
  title: string;
  items: BOQItem[];
}
interface BOQDoc {
  id: string;
  number: string;
  title: string;
  titleAr?: string;
  customerId?: string;
  projectRef?: string;
  status: 'draft' | 'submitted' | 'approved' | 'rejected';
  sections: BOQSection[];
  notes?: string;
  currency: string;
  subtotal: number;
  total: number;
  createdAt: Date;
  updatedAt: Date;
  type?: 'boq' | 'bom';
}

const statusColors: Record<string, string> = {
  draft: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
  submitted: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  approved: 'bg-green-500/10 text-green-400 border-green-500/20',
  rejected: 'bg-red-500/10 text-red-400 border-red-500/20',
};

const newItem = (): BOQItem => ({
  id: `item-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  description: '', unit: 'pc', quantity: 1, unitPrice: 0, total: 0
});
const newSection = (): BOQSection => ({
  id: `sec-${Date.now()}`, title: 'New Section', items: [newItem()]
});

export const BOQ: React.FC = () => {
  const { token, customers, company, currentUser } = useERPStore();
  const canDelete = currentUser?.role === 'admin' || !!currentUser?.permissions?.canDeleteData;

  const [docs, setDocs] = useState<BOQDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [detailId, setDetailId] = useState<string | null>(null);
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<'all' | 'boq' | 'bom'>('all');

  // form state
  const [editDoc, setEditDoc] = useState<Partial<BOQDoc> | null>(null);

  const authH = () => ({ Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' });

  const fetchDocs = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/boq', { headers: authH() });
      if (res.ok) setDocs(await res.json());
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchDocs(); }, []);

  const filtered = docs.filter(d => {
    const docType = d.type || 'boq';
    if (activeTab !== 'all' && docType !== activeTab) return false;
    return matchSearchQuery(search, [d.number, d.title, d.projectRef, d.status]);
  });

  const calcSection = (s: BOQSection) =>
    s.items.reduce((sum, i) => sum + (i.quantity * i.unitPrice), 0);

  const calcTotal = (sections: BOQSection[]) =>
    sections.reduce((sum, s) => sum + calcSection(s), 0);

  const [isDirty, setIsDirty] = useState(false);
  const isFirstChangeRef = useRef(true);

  useEffect(() => {
    if (!editDoc) {
      setIsDirty(false);
      return;
    }
    if (isFirstChangeRef.current) {
      isFirstChangeRef.current = false;
      return;
    }
    setIsDirty(true);
  }, [editDoc]);

  const getPayload = (): Partial<BOQDoc> => {
    const subtotal = calcTotal(editDoc?.sections || []);
    return {
      ...editDoc,
      subtotal,
      total: subtotal,
      createdBy: currentUser?.id
    };
  };

  const { status: autoSaveStatus, performSave } = useAutoSave<Partial<BOQDoc>>({
    isDirty,
    getPayload,
    saveFn: async (payload) => {
      try {
        const subtotal = payload.subtotal || 0;
        const finalPayload = { ...payload, subtotal, total: subtotal };
        let res: Response;
        if (detailId === 'new') {
          res = await fetch('/api/boq', { method: 'POST', headers: authH(), body: JSON.stringify(finalPayload) });
        } else {
          res = await fetch(`/api/boq/${detailId}`, { method: 'PUT', headers: authH(), body: JSON.stringify(finalPayload) });
        }
        if (res.ok) {
          fetchDocs();
          if (detailId === 'new') {
            const data = await res.json();
            setDetailId(data.id || detailId);
          }
          return true;
        }
        return false;
      } catch (err) {
        console.error(err);
        return false;
      }
    },
    onSaveSuccess: () => {
      setIsDirty(false);
      isFirstChangeRef.current = true;
    },
    isReady: !!(editDoc && editDoc.title?.trim())
  });

  const openNew = (defaultType: 'boq' | 'bom' = 'boq') => {
    const prefix = defaultType === 'bom' ? 'BOM' : 'BOQ';
    const num = `${prefix}-${new Date().getFullYear()}-${String(docs.length + 1).padStart(4, '0')}`;
    setEditDoc({
      number: num,
      title: '',
      status: 'draft',
      sections: [newSection()],
      currency: company.currency || 'SAR',
      notes: '',
      type: defaultType
    });
    setDetailId('new');
    isFirstChangeRef.current = true;
    setIsDirty(false);
  };

  const openEdit = (d: BOQDoc) => {
    setEditDoc({ ...d });
    setDetailId(d.id);
    isFirstChangeRef.current = true;
    setIsDirty(false);
  };

  const updateItem = (secIdx: number, itemIdx: number, field: keyof BOQItem, val: any) => {
    setEditDoc(prev => {
      if (!prev) return prev;
      const sections = prev.sections ? [...prev.sections] : [];
      const items = [...sections[secIdx].items];
      const item = { ...items[itemIdx], [field]: val };
      item.total = item.quantity * item.unitPrice;
      items[itemIdx] = item;
      sections[secIdx] = { ...sections[secIdx], items };
      return { ...prev, sections };
    });
  };

  const handleProductSelect = (secIdx: number, itemIdx: number, product: any) => {
    setEditDoc(prev => {
      if (!prev) return prev;
      const sections = prev.sections ? [...prev.sections] : [];
      const items = [...sections[secIdx].items];
      
      let desc = product.name;
      if (product.description) {
        desc += ` - ${product.description}`;
      }
      
      const item = {
        ...items[itemIdx],
        productId: product.id,
        description: desc,
        unit: product.unit || 'pc',
        unitPrice: product.unitPrice || 0,
        total: (items[itemIdx].quantity || 1) * (product.unitPrice || 0)
      };
      
      items[itemIdx] = item;
      sections[secIdx] = { ...sections[secIdx], items };
      return { ...prev, sections };
    });
  };

  const handleSave = async () => {
    if (!editDoc || !editDoc.title?.trim()) return alert('Title is required');
    const success = await performSave();
    if (success) {
      setDetailId(null);
    } else {
      alert('Save failed');
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm(`Delete this ${(editDoc?.type || 'boq').toUpperCase()} document?`)) return;
    await fetch(`/api/boq/${id}`, { method: 'DELETE', headers: authH() });
    setDetailId(null);
    fetchDocs();
  };

  const toggleSection = (id: string) => {
    setCollapsedSections(prev => {
      const s = new Set(prev);
      s.has(id) ? s.delete(id) : s.add(id);
      return s;
    });
  };

  // ── DETAIL VIEW ─────────────────────────────────────────────────────────────
  if (detailId && editDoc) {
    const sections = editDoc.sections || [];
    const grandTotal = calcTotal(sections);
    const docTypeLabel = (editDoc.type || 'boq').toUpperCase();

    return (
      <div className="animate-fade-in text-left">
        <PageHeader
          title={detailId === 'new' ? `New ${docTypeLabel} Document` : `Edit ${docTypeLabel} — ${editDoc.number}`}
          breadcrumbs={[{ label: docTypeLabel }, { label: editDoc.number || 'New' }]}
          actions={
            <div className="flex gap-2 items-center">
              <AutoSaveIndicator status={autoSaveStatus} onRetry={performSave} />
              <button onClick={() => setDetailId(null)} className="border border-[var(--color-border)] hover:bg-[var(--color-surface-offset)] text-[var(--color-text)] text-xs font-semibold py-2 px-3 rounded-md flex items-center gap-1.5 cursor-pointer">
                <X className="w-3.5 h-3.5" /> Back
              </button>
              {canDelete && detailId !== 'new' && (
                <button onClick={() => handleDelete(detailId)} className="border border-red-500/30 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-semibold py-2 px-3 rounded-md flex items-center gap-1.5 cursor-pointer">
                  <Trash2 className="w-3.5 h-3.5" /> Delete
                </button>
              )}
              <button onClick={handleSave} className="bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white text-xs font-semibold py-2 px-4 rounded-md flex items-center gap-1.5 cursor-pointer">
                <Save className="w-3.5 h-3.5" /> Save {docTypeLabel}
              </button>
            </div>
          }
        />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          {/* Meta */}
          <div className="lg:col-span-2 premium-card p-5 flex flex-col gap-4">
            <h4 className="text-xs font-black uppercase text-[var(--color-text-muted)] tracking-wider">Project Details</h4>
            
            <div className="grid grid-cols-2 gap-3 text-xs font-semibold text-[var(--color-text-muted)]">
              {/* Type Selection Toggle */}
              <div className="col-span-2">
                <label className="block mb-1.5 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">Document Type / نوع المستند</label>
                <div className="flex bg-[var(--color-surface-offset)] p-0.5 rounded-lg border border-[var(--color-border)] w-fit">
                  <button
                    type="button"
                    onClick={() => {
                      setEditDoc(prev => {
                        if (!prev) return prev;
                        const isNew = detailId === 'new';
                        let num = prev.number || '';
                        if (isNew && num.startsWith('BOM-')) {
                          num = num.replace('BOM-', 'BOQ-');
                        }
                        return { ...prev, type: 'boq', number: num };
                      });
                    }}
                    className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all cursor-pointer ${
                      (editDoc.type || 'boq') === 'boq'
                        ? 'bg-[var(--color-primary)] text-white shadow-sm'
                        : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
                    }`}
                  >
                    BOQ (Bill of Quantities) / جدول الكميات
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditDoc(prev => {
                        if (!prev) return prev;
                        const isNew = detailId === 'new';
                        let num = prev.number || '';
                        if (isNew && num.startsWith('BOQ-')) {
                          num = num.replace('BOQ-', 'BOM-');
                        }
                        return { ...prev, type: 'bom', number: num };
                      });
                    }}
                    className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all cursor-pointer ${
                      editDoc.type === 'bom'
                        ? 'bg-[var(--color-primary)] text-white shadow-sm'
                        : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
                    }`}
                  >
                    BOM (Bill of Materials) / جدول المواد
                  </button>
                </div>
              </div>

              <div className="col-span-2">
                <label className="block mb-1">{docTypeLabel} Number *</label>
                <input value={editDoc.number || ''} onChange={e => setEditDoc(p => ({ ...p!, number: e.target.value }))} className="w-full premium-input font-mono text-xs" />
              </div>
              <div className="col-span-2">
                <label className="block mb-1">Title (EN) *</label>
                <input value={editDoc.title || ''} onChange={e => setEditDoc(p => ({ ...p!, title: e.target.value }))} className="w-full premium-input text-sm text-[var(--color-text)] font-bold" placeholder={`Project / ${docTypeLabel} Title`} />
              </div>
              <div className="col-span-2">
                <label className="block mb-1">Title (AR) / العنوان بالعربية</label>
                <input dir="rtl" value={editDoc.titleAr || ''} onChange={e => setEditDoc(p => ({ ...p!, titleAr: e.target.value }))} className="w-full premium-input text-sm" placeholder="عنوان المشروع" />
              </div>
              
              {/* Customer selection Combobox */}
              <div className="col-span-2 md:col-span-1">
                <CustomerCombobox
                  selectedCustomerId={editDoc.customerId || ''}
                  onSelect={id => setEditDoc(p => ({ ...p!, customerId: id }))}
                />
              </div>

              <div>
                <label className="block mb-1">Status</label>
                <select value={editDoc.status || 'draft'} onChange={e => setEditDoc(p => ({ ...p!, status: e.target.value as any }))} className="w-full premium-input">
                  <option value="draft">Draft</option>
                  <option value="submitted">Submitted</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>
              <div className="col-span-2">
                <label className="block mb-1">Project Reference</label>
                <input value={editDoc.projectRef || ''} onChange={e => setEditDoc(p => ({ ...p!, projectRef: e.target.value }))} className="w-full premium-input" placeholder="e.g. PROJ-2025-001" />
              </div>
              <div className="col-span-2">
                <label className="block mb-1">Notes / ملاحظات</label>
                <textarea rows={2} value={editDoc.notes || ''} onChange={e => setEditDoc(p => ({ ...p!, notes: e.target.value }))} className="w-full premium-input text-xs resize-none" />
              </div>
            </div>
          </div>

          {/* Summary */}
          <div className="premium-card p-5 flex flex-col gap-3">
            <h4 className="text-xs font-black uppercase text-[var(--color-text-muted)] tracking-wider flex items-center gap-1.5">
              <Calculator className="w-3.5 h-3.5" /> Summary
            </h4>
            {sections.map(s => (
              <div key={s.id} className="flex justify-between text-xs">
                <span className="text-[var(--color-text-muted)] truncate pr-2">{s.title}</span>
                <span className="font-mono font-bold text-[var(--color-text)] flex-shrink-0">{calcSection(s).toLocaleString('en-SA', { minimumFractionDigits: 2 })} {editDoc.currency}</span>
              </div>
            ))}
            <div className="border-t border-[var(--color-divider)]/40 pt-3 mt-1 flex justify-between">
              <span className="text-sm font-black text-[var(--color-text)]">Grand Total</span>
              <span className="text-lg font-black font-mono text-[var(--color-primary)]">
                {grandTotal.toLocaleString('en-SA', { minimumFractionDigits: 2 })} {editDoc.currency}
              </span>
            </div>
          </div>
        </div>

        {/* Sections */}
        <div className="flex flex-col gap-4">
          {sections.map((sec, secIdx) => (
            <div key={sec.id} className="premium-card overflow-hidden">
              {/* Section header */}
              <div className="flex items-center gap-3 px-5 py-3 bg-[var(--color-surface-offset)]/60 border-b border-[var(--color-border)]">
                <button onClick={() => toggleSection(sec.id)} className="p-1 hover:bg-[var(--color-surface)] rounded cursor-pointer">
                  {collapsedSections.has(sec.id) ? <ChevronDown className="w-3.5 h-3.5 text-[var(--color-text-muted)]" /> : <ChevronUp className="w-3.5 h-3.5 text-[var(--color-text-muted)]" />}
                </button>
                <input
                  value={sec.title}
                  onChange={e => setEditDoc(p => {
                    if (!p) return p;
                    const secs = [...(p.sections || [])];
                    secs[secIdx] = { ...secs[secIdx], title: e.target.value };
                    return { ...p, sections: secs };
                  })}
                  className="flex-1 bg-transparent text-sm font-bold text-[var(--color-text)] outline-none border-b border-transparent focus:border-[var(--color-primary)] transition-colors pb-0.5"
                />
                <span className="text-xs font-mono font-semibold text-[var(--color-primary)] flex-shrink-0">
                  {calcSection(sec).toLocaleString('en-SA', { minimumFractionDigits: 2 })} {editDoc.currency}
                </span>
                <button onClick={() => setEditDoc(p => {
                  if (!p) return p;
                  const secs = (p.sections || []).filter((_, i) => i !== secIdx);
                  return { ...p, sections: secs };
                })} className="p-1 hover:bg-red-500/10 text-[var(--color-text-faint)] hover:text-red-400 rounded cursor-pointer">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Items table */}
              {!collapsedSections.has(sec.id) && (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-[var(--color-border)] text-[var(--color-text-muted)] font-bold text-[10px] uppercase tracking-wider">
                        <th className="p-2.5 text-left w-8">#</th>
                        <th className="p-2.5 text-left min-w-[280px]">Description</th>
                        <th className="p-2.5 text-center w-16">Unit</th>
                        <th className="p-2.5 text-right w-20">Qty</th>
                        <th className="p-2.5 text-right w-28">Unit Price</th>
                        <th className="p-2.5 text-right w-28">Total</th>
                        <th className="p-2.5 w-8"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--color-border)]/40">
                      {sec.items.map((item, itemIdx) => (
                        <tr key={item.id} className="hover:bg-[var(--color-surface-offset)]/30 group">
                          <td className="p-2.5 text-[var(--color-text-faint)] font-mono">{itemIdx + 1}</td>
                          
                          {/* Searchable Product Inline Input */}
                          <td className="p-2.5 min-w-[280px]">
                            <InlineProductSearchInput
                              value={item.description}
                              onChange={val => updateItem(secIdx, itemIdx, 'description', val)}
                              onProductSelect={prod => handleProductSelect(secIdx, itemIdx, prod)}
                              placeholder="Search & type description..."
                              className="w-full bg-transparent outline-none text-[var(--color-text)] border-b border-transparent focus:border-[var(--color-primary)] transition-colors font-semibold"
                            />
                          </td>

                          <td className="p-2.5">
                            <input value={item.unit} onChange={e => updateItem(secIdx, itemIdx, 'unit', e.target.value)}
                              className="w-full bg-transparent outline-none text-center text-[var(--color-text)] border-b border-transparent focus:border-[var(--color-primary)] transition-colors font-mono" />
                          </td>
                          <td className="p-2.5">
                            <input type="number" min="0" step="0.01" value={item.quantity} onChange={e => updateItem(secIdx, itemIdx, 'quantity', parseFloat(e.target.value) || 0)}
                              className="w-full bg-transparent outline-none text-right text-[var(--color-text)] border-b border-transparent focus:border-[var(--color-primary)] transition-colors font-mono" />
                          </td>
                          <td className="p-2.5">
                            <input type="number" min="0" step="0.01" value={item.unitPrice} onChange={e => updateItem(secIdx, itemIdx, 'unitPrice', parseFloat(e.target.value) || 0)}
                              className="w-full bg-transparent outline-none text-right text-[var(--color-text)] border-b border-transparent focus:border-[var(--color-primary)] transition-colors font-mono" />
                          </td>
                          <td className="p-2.5 text-right font-mono font-bold text-[var(--color-text)]">
                            {(item.quantity * item.unitPrice).toLocaleString('en-SA', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="p-2.5">
                            <button onClick={() => setEditDoc(p => {
                              if (!p) return p;
                              const secs = [...(p.sections || [])];
                              secs[secIdx] = { ...secs[secIdx], items: secs[secIdx].items.filter((_, i) => i !== itemIdx) };
                              return { ...p, sections: secs };
                            })} className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-500/10 text-[var(--color-text-faint)] hover:text-red-400 rounded transition-all cursor-pointer">
                              <X className="w-3 h-3" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="px-4 py-2 border-t border-[var(--color-border)]/40">
                    <button onClick={() => setEditDoc(p => {
                      if (!p) return p;
                      const secs = [...(p.sections || [])];
                      secs[secIdx] = { ...secs[secIdx], items: [...secs[secIdx].items, newItem()] };
                      return { ...p, sections: secs };
                    })} className="text-[var(--color-primary)] text-[10px] font-bold flex items-center gap-1 cursor-pointer hover:underline">
                      <Plus className="w-3 h-3" /> Add Item
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}

          {/* Add section */}
          <button onClick={() => setEditDoc(p => ({ ...p!, sections: [...(p!.sections || []), newSection()] }))}
            className="w-full border border-dashed border-[var(--color-border)] hover:border-[var(--color-primary)]/50 hover:bg-[var(--color-primary)]/5 rounded-xl py-4 text-xs font-bold text-[var(--color-text-muted)] hover:text-[var(--color-primary)] flex items-center justify-center gap-2 transition-colors cursor-pointer">
            <Plus className="w-4 h-4" /> Add Section
          </button>
        </div>
      </div>
    );
  }

  // ── LIST VIEW ────────────────────────────────────────────────────────────────
  return (
    <div className="animate-fade-in text-left">
      <PageHeader
        title="BOQ & BOM Manager / إدارة جداول الكميات والمواد"
        breadcrumbs={[{ label: 'Home' }, { label: 'BOQ' }]}
        actions={
          <div className="flex gap-2">
            <button onClick={() => openNew('boq')} className="bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white text-xs font-semibold py-2.5 px-4 rounded-md flex items-center gap-1.5 transition-colors shadow-sm cursor-pointer">
              <Plus className="w-4 h-4" /> New BOQ
            </button>
            <button onClick={() => openNew('bom')} className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold py-2.5 px-4 rounded-md flex items-center gap-1.5 transition-colors shadow-sm cursor-pointer">
              <Plus className="w-4 h-4" /> New BOM
            </button>
          </div>
        }
      />

      {/* Tabs and Search Bar */}
      <div className="flex flex-col md:flex-row justify-between items-stretch md:items-center gap-4 mb-6">
        {/* Tabs */}
        <div className="flex bg-[var(--color-surface-offset)] p-1 rounded-lg border border-[var(--color-border)] self-start">
          <button
            onClick={() => setActiveTab('all')}
            className={`px-4 py-2 text-xs font-bold rounded-md transition-all cursor-pointer ${
              activeTab === 'all'
                ? 'bg-[var(--color-primary)] text-white shadow-sm'
                : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
            }`}
          >
            All / الكل
          </button>
          <button
            onClick={() => setActiveTab('boq')}
            className={`px-4 py-2 text-xs font-bold rounded-md transition-all cursor-pointer ${
              activeTab === 'boq'
                ? 'bg-[var(--color-primary)] text-white shadow-sm'
                : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
            }`}
          >
            BOQ / جدول الكميات
          </button>
          <button
            onClick={() => setActiveTab('bom')}
            className={`px-4 py-2 text-xs font-bold rounded-md transition-all cursor-pointer ${
              activeTab === 'bom'
                ? 'bg-[var(--color-primary)] text-white shadow-sm'
                : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
            }`}
          >
            BOM / جدول المواد
          </button>
        </div>

        {/* Search input */}
        <div className="flex-1 max-w-md relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-muted)] pointer-events-none" />
          <input
            type="text"
            placeholder="Search documents by number, title or project..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full premium-input pl-10 pr-4 py-2"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-[var(--color-primary)]" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="premium-card p-16 text-center flex flex-col items-center gap-4">
          <ClipboardList className="w-14 h-14 text-[var(--color-text-faint)]" />
          <div>
            <p className="font-bold text-sm text-[var(--color-text)]">No Documents Found</p>
            <p className="text-xs text-[var(--color-text-muted)] mt-1">Create your first Bill of Quantities or Bill of Materials to start.</p>
          </div>
          <div className="flex gap-3">
            <button onClick={() => openNew('boq')} className="bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white text-xs font-semibold py-2.5 px-5 rounded-md flex items-center gap-1.5 cursor-pointer">
              <Plus className="w-4 h-4" /> Create First BOQ
            </button>
            <button onClick={() => openNew('bom')} className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold py-2.5 px-5 rounded-md flex items-center gap-1.5 cursor-pointer">
              <Plus className="w-4 h-4" /> Create First BOM
            </button>
          </div>
        </div>
      ) : (
        <div className="premium-card overflow-hidden">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="border-b border-[var(--color-border)] bg-[var(--color-surface-offset)] text-[var(--color-text-muted)] font-bold text-[10px] uppercase tracking-wider">
                <th className="p-3.5 text-left">Number</th>
                <th className="p-3.5 text-left w-24">Type</th>
                <th className="p-3.5 text-left">Title</th>
                <th className="p-3.5 text-left">Customer</th>
                <th className="p-3.5 text-left">Project Ref</th>
                <th className="p-3.5 text-center">Status</th>
                <th className="p-3.5 text-right">Total</th>
                <th className="p-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]/40">
              {filtered.map(d => {
                const customer = customers.find(c => c.id === d.customerId);
                return (
                  <tr key={d.id} className="hover:bg-[var(--color-surface-offset)]/40 transition-colors">
                    <td className="p-3.5 font-mono font-bold text-[var(--color-primary)]">{d.number}</td>
                    <td className="p-3.5">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${
                        (d.type || 'boq') === 'bom'
                          ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'
                          : 'bg-teal-500/10 text-teal-400 border-teal-500/20'
                      }`}>
                        {(d.type || 'boq').toUpperCase()}
                      </span>
                    </td>
                    <td className="p-3.5">
                      <span className="font-semibold text-[var(--color-text)]">{d.title}</span>
                      {d.titleAr && <span className="block text-[10px] text-[var(--color-text-muted)] mt-0.5" dir="rtl">{d.titleAr}</span>}
                    </td>
                    <td className="p-3.5 text-[var(--color-text-muted)]">{customer?.companyName || '—'}</td>
                    <td className="p-3.5 font-mono text-[var(--color-text-muted)]">{d.projectRef || '—'}</td>
                    <td className="p-3.5 text-center">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${statusColors[d.status]}`}>
                        {d.status}
                      </span>
                    </td>
                    <td className="p-3.5 text-right font-mono font-bold text-[var(--color-text)]">
                      {d.total.toLocaleString('en-SA', { minimumFractionDigits: 2 })} {d.currency}
                    </td>
                    <td className="p-3.5 text-right">
                      <div className="flex justify-end gap-1">
                        <button onClick={() => openEdit(d)} className="p-1.5 hover:bg-[var(--color-surface-offset)] rounded text-[var(--color-text-muted)] hover:text-[var(--color-primary)] cursor-pointer">
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        {canDelete && (
                          <button onClick={() => handleDelete(d.id)} className="p-1.5 hover:bg-red-500/10 rounded text-[var(--color-text-faint)] hover:text-red-400 cursor-pointer">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default BOQ;
