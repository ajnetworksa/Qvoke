import React, { useState, useEffect, useMemo } from 'react';
import { useERPStore } from '../store';
import { PageHeader } from '../components/PageHeader';
import { RecurringInvoice, Customer } from '../types';
import {
  Calendar, Clock, Plus, Play, Pause, Trash2, Edit2, CheckCircle2,
  AlertCircle, Receipt, ArrowRight, UserCheck, Search, Filter, RefreshCw
} from 'lucide-react';
import EmptyState from '../components/EmptyState';

export const RecurringInvoices: React.FC = () => {
  const {
    recurringInvoices,
    fetchRecurringInvoices,
    addRecurringInvoice,
    updateRecurringInvoice,
    deleteRecurringInvoice,
    processRecurringInvoice,
    customers,
    company,
    setRoute
  } = useERPStore();

  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRecurring, setEditingRecurring] = useState<RecurringInvoice | null>(null);

  // Form states
  const [customerId, setCustomerId] = useState('');
  const [profileName, setProfileName] = useState('');
  const [frequency, setFrequency] = useState<RecurringInvoice['frequency']>('monthly');
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [nextRunDate, setNextRunDate] = useState(new Date().toISOString().slice(0, 10));
  const [autoSendEmail, setAutoSendEmail] = useState(true);
  const [itemDesc, setItemDesc] = useState('');
  const [itemPrice, setItemPrice] = useState<number | ''>('');
  const [itemQty, setItemQty] = useState<number>(1);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => {
    fetchRecurringInvoices();
  }, [fetchRecurringInvoices]);

  const filteredRecurring = useMemo(() => {
    return recurringInvoices.filter(r => {
      const matchSearch =
        r.profileName.toLowerCase().includes(search.toLowerCase()) ||
        r.number.toLowerCase().includes(search.toLowerCase()) ||
        (r.customerName && r.customerName.toLowerCase().includes(search.toLowerCase()));
      return matchSearch;
    });
  }, [recurringInvoices, search]);

  const handleOpenAdd = () => {
    setEditingRecurring(null);
    setCustomerId(customers[0]?.id || '');
    setProfileName('');
    setFrequency('monthly');
    const today = new Date().toISOString().slice(0, 10);
    setStartDate(today);
    setNextRunDate(today);
    setAutoSendEmail(true);
    setItemDesc('Monthly Managed IT & Software Services');
    setItemPrice(2500);
    setItemQty(1);
    setNotes('');
    setModalOpen(true);
  };

  const handleOpenEdit = (rec: RecurringInvoice) => {
    setEditingRecurring(rec);
    setCustomerId(rec.customerId);
    setProfileName(rec.profileName);
    setFrequency(rec.frequency);
    setStartDate(rec.startDate);
    setNextRunDate(rec.nextRunDate);
    setAutoSendEmail(rec.autoSendEmail);
    const items = typeof rec.lineItems === 'string' ? JSON.parse(rec.lineItems) : rec.lineItems;
    const first = items[0] || {};
    setItemDesc(first.description || '');
    setItemPrice(first.unitPrice || 0);
    setItemQty(first.quantity || 1);
    setNotes(rec.notes || '');
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerId || !profileName.trim() || itemPrice === '') return;

    setSaving(true);
    const lineSubtotal = (Number(itemPrice) || 0) * (Number(itemQty) || 1);
    const lineTax = lineSubtotal * 0.15;
    const lineTotal = lineSubtotal + lineTax;

    const lineItems = [
      {
        id: `item-${Date.now()}`,
        type: 'item' as const,
        description: itemDesc.trim(),
        quantity: Number(itemQty) || 1,
        unit: 'Month',
        unitPrice: Number(itemPrice) || 0,
        discountPercent: 0,
        taxPercent: 15,
        subtotal: lineSubtotal
      }
    ];

    const payload: Partial<RecurringInvoice> = {
      customerId,
      profileName: profileName.trim(),
      frequency,
      startDate,
      nextRunDate,
      autoSendEmail,
      currency: company.currency || 'SAR',
      lineItems,
      notes: notes.trim(),
      total: lineTotal,
      status: 'active'
    };

    if (editingRecurring) {
      payload.id = editingRecurring.id;
      await updateRecurringInvoice(payload);
    } else {
      await addRecurringInvoice(payload);
    }

    setSaving(false);
    setModalOpen(false);
  };

  const handleProcessNow = async (rec: RecurringInvoice) => {
    setProcessingId(rec.id);
    const result = await processRecurringInvoice(rec.id);
    setProcessingId(null);
    if (result.success && result.invoiceId) {
      if (confirm(`Invoice ${result.invoiceNumber} created successfully! Open in invoice editor?`)) {
        setRoute('invoice-detail', result.invoiceId);
      }
    }
  };

  const handleTogglePause = async (rec: RecurringInvoice) => {
    const nextStatus = rec.status === 'active' ? 'paused' : 'active';
    await updateRecurringInvoice({ id: rec.id, status: nextStatus });
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to cancel and delete this recurring invoice profile?')) return;
    await deleteRecurringInvoice(id);
  };

  return (
    <div className="animate-fade-in text-left">
      <PageHeader
        title="Recurring Invoices &amp; Subscriptions / الفواتير المتكررة والاشتراكات"
        breadcrumbs={[{ label: 'Home' }, { label: 'Invoices' }, { label: 'Recurring' }]}
        actions={
          <button
            onClick={handleOpenAdd}
            className="bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white text-xs font-semibold py-2.5 px-4 rounded-md flex items-center gap-1.5 transition-colors shadow-sm cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>New Schedule / جدولة جديدة</span>
          </button>
        }
      />

      {/* Top Search */}
      <div className="premium-card p-4 mb-6 flex items-center justify-between gap-3">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 absolute left-3 top-3 text-[var(--color-text-muted)]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search profile, customer, number..."
            className="w-full pl-9 pr-4 py-2 premium-input text-xs"
          />
        </div>
        <div className="text-xs text-[var(--color-text-muted)] font-semibold">
          {filteredRecurring.length} Active Schedules
        </div>
      </div>

      {/* Recurring Profiles List */}
      {filteredRecurring.length === 0 ? (
        <EmptyState
          icon={Calendar}
          title="No recurring invoices configured"
          description="Automate recurring client retainers, SaaS licenses, maintenance contracts, and periodic billing."
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredRecurring.map((item) => {
            const isPaused = item.status === 'paused';
            return (
              <div
                key={item.id}
                className={`premium-card p-5 flex flex-col justify-between transition-all ${
                  isPaused ? 'opacity-70 border-dashed' : ''
                }`}
              >
                <div>
                  {/* Top line */}
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-mono text-xs font-bold text-[var(--color-primary)]">
                      {item.number}
                    </span>
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                      item.status === 'active'
                        ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                        : 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30'
                    }`}>
                      {item.status}
                    </span>
                  </div>

                  <h3 className="text-sm font-extrabold text-[var(--color-text)] mb-1">
                    {item.profileName}
                  </h3>
                  <span className="text-xs text-[var(--color-text-muted)] block mb-3">
                    Customer: <span className="font-bold text-[var(--color-text)]">{item.customerName || 'N/A'}</span>
                  </span>

                  <div className="p-3 rounded-lg bg-[var(--color-surface-offset)] border border-[var(--color-border)]/70 text-xs flex flex-col gap-1.5 mb-4">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-[var(--color-text-muted)]">Frequency / التكرار:</span>
                      <span className="font-bold capitalize text-[var(--color-text)]">{item.frequency.replace('_', ' ')}</span>
                    </div>
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-[var(--color-text-muted)]">Next Run / الاستحقاق القادم:</span>
                      <span className="font-mono font-bold text-teal-600 dark:text-teal-400">{item.nextRunDate}</span>
                    </div>
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-[var(--color-text-muted)]">Generated Count:</span>
                      <span className="font-bold text-[var(--color-text)]">{item.generationCount || 0} invoices</span>
                    </div>
                    <div className="flex items-center justify-between text-xs pt-1 border-t border-[var(--color-divider)]/40">
                      <span className="font-bold text-[var(--color-text)]">Scheduled Total:</span>
                      <span className="font-mono font-black text-[var(--color-primary)]">
                        {item.total.toLocaleString(undefined, { minimumFractionDigits: 2 })} {item.currency}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Card Actions */}
                <div className="flex items-center justify-between pt-3 border-t border-[var(--color-divider)]/40">
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleTogglePause(item)}
                      className={`p-2 rounded-lg border text-xs font-bold transition-colors cursor-pointer flex items-center gap-1 ${
                        isPaused
                          ? 'border-emerald-500/40 text-emerald-600 hover:bg-emerald-500/10'
                          : 'border-amber-500/40 text-amber-600 hover:bg-amber-500/10'
                      }`}
                      title={isPaused ? 'Resume schedule' : 'Pause schedule'}
                    >
                      {isPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
                    </button>
                    <button
                      onClick={() => handleOpenEdit(item)}
                      className="p-2 rounded-lg border border-[var(--color-border)] text-[var(--color-text-muted)] hover:bg-[var(--color-surface-offset)] transition-colors cursor-pointer"
                      title="Edit schedule"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(item.id)}
                      className="p-2 rounded-lg border border-rose-500/30 text-rose-500 hover:bg-rose-500/10 transition-colors cursor-pointer"
                      title="Delete profile"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <button
                    onClick={() => handleProcessNow(item)}
                    disabled={processingId === item.id}
                    className="px-3 py-1.5 rounded-lg bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${processingId === item.id ? 'animate-spin' : ''}`} />
                    <span>{processingId === item.id ? 'Generating...' : 'Generate Now'}</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in text-left">
          <div className="relative w-full max-w-xl bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-divider)]/40 bg-[var(--color-surface-2)]">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-[var(--color-primary)]/15 text-[var(--color-primary)]">
                  <Calendar className="w-5 h-5" />
                </div>
                <h3 className="text-sm font-extrabold text-[var(--color-text)]">
                  {editingRecurring ? 'Edit Recurring Invoice Schedule' : 'Create Recurring Subscription Schedule'}
                </h3>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="p-6 overflow-y-auto flex flex-col gap-4">
              <div>
                <label className="block text-xs font-bold text-[var(--color-text)] mb-1">
                  Profile Name / مسمى الاشتراك <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={profileName}
                  onChange={(e) => setProfileName(e.target.value)}
                  placeholder="e.g. Monthly Web Hosting &amp; Retainer - Acme Corp"
                  className="w-full premium-input text-xs"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-[var(--color-text)] mb-1">
                    Customer / العميل <span className="text-rose-500">*</span>
                  </label>
                  <select
                    required
                    value={customerId}
                    onChange={(e) => setCustomerId(e.target.value)}
                    className="w-full premium-input text-xs"
                  >
                    <option value="">Select customer...</option>
                    {customers.map(c => (
                      <option key={c.id} value={c.id}>{c.companyName}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[var(--color-text)] mb-1">
                    Billing Frequency / دورة الفوترة
                  </label>
                  <select
                    value={frequency}
                    onChange={(e) => setFrequency(e.target.value as any)}
                    className="w-full premium-input text-xs"
                  >
                    <option value="weekly">Weekly / أسبوعي</option>
                    <option value="monthly">Monthly / شهري</option>
                    <option value="quarterly">Quarterly (3 Months) / ربع سنوي</option>
                    <option value="semi_annual">Semi-Annual (6 Months) / نصف سنوي</option>
                    <option value="yearly">Yearly / سنوي</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-[var(--color-text)] mb-1">
                    Start Date / تاريخ البدء
                  </label>
                  <input
                    type="date"
                    required
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full premium-input text-xs font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[var(--color-text)] mb-1">
                    Next Run Date / موعد الإنشاء القادم
                  </label>
                  <input
                    type="date"
                    required
                    value={nextRunDate}
                    onChange={(e) => setNextRunDate(e.target.value)}
                    className="w-full premium-input text-xs font-mono"
                  />
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-[var(--color-surface-offset)] border border-[var(--color-border)] flex flex-col gap-3">
                <span className="text-[11px] font-black text-[var(--color-text-muted)] uppercase tracking-wider">
                  Recurring Line Item / بند الخدمة المتكرر:
                </span>
                <div>
                  <label className="block text-[11px] text-[var(--color-text)] font-semibold mb-1">Description</label>
                  <input
                    type="text"
                    required
                    value={itemDesc}
                    onChange={(e) => setItemDesc(e.target.value)}
                    className="w-full premium-input text-xs"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] text-[var(--color-text)] font-semibold mb-1">Unit Price ({company.currency})</label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={itemPrice}
                      onChange={(e) => setItemPrice(e.target.value === '' ? '' : Number(e.target.value))}
                      className="w-full premium-input text-xs font-mono font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-[var(--color-text)] font-semibold mb-1">Quantity</label>
                    <input
                      type="number"
                      min="1"
                      value={itemQty}
                      onChange={(e) => setItemQty(Number(e.target.value))}
                      className="w-full premium-input text-xs font-mono"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-[var(--color-divider)]/40">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-[var(--color-text-muted)] hover:bg-[var(--color-surface-offset)] rounded-md transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 text-xs font-bold bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white rounded-md transition-all shadow-sm cursor-pointer disabled:opacity-50"
                >
                  {saving ? 'Saving...' : editingRecurring ? 'Save Changes' : 'Create Schedule / حفظ'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
