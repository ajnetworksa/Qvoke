import React, { useState, useEffect, useMemo } from 'react';
import { useERPStore } from '../store';
import { PageHeader } from '../components/PageHeader';
import { Expense } from '../types';
import {
  DollarSign, Plus, Search, Filter, Trash2, Edit2, CheckCircle2, Clock,
  FileText, ArrowDownRight, Tag, Calendar, Building, CreditCard, Download,
  TrendingDown, Layers, PieChart, ShieldAlert
} from 'lucide-react';
import EmptyState from '../components/EmptyState';

const EXPENSE_CATEGORIES: { id: Expense['category']; label: string; labelAr: string; color: string }[] = [
  { id: 'rent', label: 'Office & Facility Rent', labelAr: 'إيجار المكاتب والمرافق', color: 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border-indigo-500/30' },
  { id: 'utilities', label: 'Utilities (Power/Water/Net)', labelAr: 'المرافق (كهرباء/مياه/انترنت)', color: 'bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 border-cyan-500/30' },
  { id: 'salaries', label: 'Salaries & Payroll', labelAr: 'الرواتب والأجور', color: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30' },
  { id: 'software', label: 'Software & SaaS Tools', labelAr: 'البرمجيات والاشتراكات', color: 'bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/30' },
  { id: 'inventory', label: 'Inventory & Raw Materials', labelAr: 'المخزون والمواد الأولية', color: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30' },
  { id: 'supplies', label: 'Office Supplies & Misc', labelAr: 'مستلزمات مكتبية', color: 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30' },
  { id: 'marketing', label: 'Marketing & Advertising', labelAr: 'التسويق والدعاية', color: 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30' },
  { id: 'travel', label: 'Travel & Logistics', labelAr: 'السفر والانتقالات', color: 'bg-orange-500/15 text-orange-600 dark:text-orange-400 border-orange-500/30' },
  { id: 'maintenance', label: 'Maintenance & Repairs', labelAr: 'الصيانة والتشغيل', color: 'bg-slate-500/15 text-slate-600 dark:text-slate-400 border-slate-500/30' },
  { id: 'other', label: 'General / Other Expenses', labelAr: 'مصروفات عامة أخرى', color: 'bg-gray-500/15 text-gray-600 dark:text-gray-400 border-gray-500/30' },
];

export const Expenses: React.FC = () => {
  const { expenses, fetchExpenses, addExpense, updateExpense, deleteExpense, company, currentUser, features } = useERPStore();
  const [search, setSearch] = useState('');
  const [selectedCat, setSelectedCat] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  
  // Modal states
  const [modalOpen, setModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);

  // Form states
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<Expense['category']>('utilities');
  const [vendor, setVendor] = useState('');
  const [amount, setAmount] = useState<number | ''>('');
  const [taxRate, setTaxRate] = useState<number>(15);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [paymentMethod, setPaymentMethod] = useState<Expense['paymentMethod']>('bank_transfer');
  const [reference, setReference] = useState('');
  const [status, setStatus] = useState<Expense['status']>('paid');
  const [taxDeductible, setTaxDeductible] = useState(true);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchExpenses();
  }, [fetchExpenses]);

  const filteredExpenses = useMemo(() => {
    return expenses.filter(e => {
      const matchSearch =
        e.description.toLowerCase().includes(search.toLowerCase()) ||
        (e.vendor && e.vendor.toLowerCase().includes(search.toLowerCase())) ||
        e.number.toLowerCase().includes(search.toLowerCase()) ||
        (e.reference && e.reference.toLowerCase().includes(search.toLowerCase()));
      const matchCat = selectedCat === 'all' || e.category === selectedCat;
      const matchStatus = selectedStatus === 'all' || e.status === selectedStatus;
      return matchSearch && matchCat && matchStatus;
    });
  }, [expenses, search, selectedCat, selectedStatus]);

  // Aggregate stats
  const totalExpenses = filteredExpenses.reduce((sum, e) => sum + (Number(e.total) || 0), 0);
  const totalTax = filteredExpenses.reduce((sum, e) => sum + (Number(e.taxAmount) || 0), 0);
  const pendingCount = filteredExpenses.filter(e => e.status === 'pending').length;

  const handleOpenAdd = () => {
    setEditingExpense(null);
    setDescription('');
    setCategory('utilities');
    setVendor('');
    setAmount('');
    setTaxRate(15);
    setDate(new Date().toISOString().slice(0, 10));
    setPaymentMethod('bank_transfer');
    setReference('');
    setStatus('paid');
    setTaxDeductible(true);
    setNotes('');
    setModalOpen(true);
  };

  const handleOpenEdit = (exp: Expense) => {
    setEditingExpense(exp);
    setDescription(exp.description);
    setCategory(exp.category);
    setVendor(exp.vendor || '');
    setAmount(exp.amount);
    setTaxRate(exp.taxRate);
    setDate(exp.date);
    setPaymentMethod(exp.paymentMethod);
    setReference(exp.reference || '');
    setStatus(exp.status);
    setTaxDeductible(exp.taxDeductible !== false);
    setNotes(exp.notes || '');
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim() || amount === '' || Number(amount) <= 0) return;

    setSaving(true);
    const payload: Partial<Expense> = {
      description: description.trim(),
      category,
      vendor: vendor.trim(),
      amount: Number(amount),
      taxRate: Number(taxRate),
      date,
      paymentMethod,
      reference: reference.trim(),
      status,
      taxDeductible,
      notes: notes.trim(),
      currency: company.currency || 'SAR'
    };

    if (editingExpense) {
      payload.id = editingExpense.id;
      await updateExpense(payload);
    } else {
      await addExpense(payload);
    }

    setSaving(false);
    setModalOpen(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this expense record?')) return;
    await deleteExpense(id);
  };

  return (
    <div className="animate-fade-in text-left">
      <PageHeader
        title="Expense Tracker &amp; Vendor Bills / المصروفات والمشتريات"
        breadcrumbs={[{ label: 'Home' }, { label: 'Expenses' }]}
        actions={
          <button
            onClick={handleOpenAdd}
            className="bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white text-xs font-semibold py-2.5 px-4 rounded-md flex items-center gap-1.5 transition-colors shadow-sm cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Record Expense / إضافة مصروف</span>
          </button>
        }
      />

      {/* Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-6">
        <div className="premium-card p-5">
          <div className="flex items-center justify-between text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider mb-2">
            <span>Total Expenses / إجمالي المصروفات</span>
            <TrendingDown className="w-4 h-4 text-rose-500" />
          </div>
          <span className="text-2xl font-extrabold text-[var(--color-text)] font-mono">
            {totalExpenses.toLocaleString(undefined, { minimumFractionDigits: 2 })} {company.currency}
          </span>
          <span className="text-[10px] text-[var(--color-text-muted)] block mt-1">
            {filteredExpenses.length} total entries recorded
          </span>
        </div>

        <div className="premium-card p-5">
          <div className="flex items-center justify-between text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider mb-2">
            <span>Input VAT / ضريبة المشتريات المستردة</span>
            <Tag className="w-4 h-4 text-teal-500" />
          </div>
          <span className="text-2xl font-extrabold text-teal-600 dark:text-teal-400 font-mono">
            {totalTax.toLocaleString(undefined, { minimumFractionDigits: 2 })} {company.currency}
          </span>
          <span className="text-[10px] text-teal-600/80 font-bold block mt-1">
            Deductible from Output VAT
          </span>
        </div>

        <div className="premium-card p-5">
          <div className="flex items-center justify-between text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider mb-2">
            <span>Pending Approvals / معلق للصرف</span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <span className="text-2xl font-extrabold text-amber-500 font-mono">
            {pendingCount}
          </span>
          <span className="text-[10px] text-[var(--color-text-muted)] block mt-1">
            Unsettled expense claims
          </span>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="premium-card p-4 mb-6 flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 absolute left-3 top-3 text-[var(--color-text-muted)]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search description, vendor, ref..."
            className="w-full pl-9 pr-4 py-2 premium-input text-xs"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          <select
            value={selectedCat}
            onChange={(e) => setSelectedCat(e.target.value)}
            className="premium-input text-xs py-2"
          >
            <option value="all">All Categories / جميع الفئات</option>
            {EXPENSE_CATEGORIES.map(c => (
              <option key={c.id} value={c.id}>{c.label}</option>
            ))}
          </select>

          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="premium-input text-xs py-2"
          >
            <option value="all">All Statuses / كل الحالات</option>
            <option value="paid">Paid / مدفوع</option>
            <option value="pending">Pending / معلق</option>
            <option value="reimbursed">Reimbursed / مسترد</option>
          </select>
        </div>
      </div>

      {/* Expenses Table */}
      {filteredExpenses.length === 0 ? (
        <EmptyState
          icon={DollarSign}
          title="No expenses recorded"
          description="Start tracking business costs, supplier purchases, and operating bills."
        />
      ) : (
        <div className="premium-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-[var(--color-surface-2)] text-[var(--color-text-muted)] uppercase tracking-wider text-[10px] font-black border-b border-[var(--color-border)]">
                <tr>
                  <th className="py-3.5 px-4">Ref #</th>
                  <th className="py-3.5 px-4">Description / Vendor</th>
                  <th className="py-3.5 px-4">Category</th>
                  <th className="py-3.5 px-4">Date</th>
                  <th className="py-3.5 px-4">Payment</th>
                  <th className="py-3.5 px-4 text-right">Amount (Pre-Tax)</th>
                  <th className="py-3.5 px-4 text-right">Tax (15%)</th>
                  <th className="py-3.5 px-4 text-right">Total</th>
                  <th className="py-3.5 px-4 text-center">Status</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-divider)]/40">
                {filteredExpenses.map((item) => {
                  const catMeta = EXPENSE_CATEGORIES.find(c => c.id === item.category);
                  return (
                    <tr key={item.id} className="hover:bg-[var(--color-surface-offset)]/40 transition-colors">
                      <td className="py-3.5 px-4 font-mono font-bold text-[var(--color-text)]">
                        {item.number}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="font-bold text-[var(--color-text)] block">{item.description}</span>
                        {item.vendor && (
                          <span className="text-[10px] text-[var(--color-text-muted)] flex items-center gap-1 mt-0.5">
                            <Building className="w-3 h-3" /> {item.vendor}
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${catMeta?.color || 'bg-gray-500/10 text-gray-600'}`}>
                          {catMeta?.label.split(' (')[0] || item.category}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-[var(--color-text-muted)]">
                        {item.date}
                      </td>
                      <td className="py-3.5 px-4 capitalize text-[var(--color-text-muted)]">
                        {item.paymentMethod.replace('_', ' ')}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono text-[var(--color-text-muted)]">
                        {item.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono text-teal-600 dark:text-teal-400">
                        {item.taxAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-[var(--color-text)]">
                        {item.total.toLocaleString(undefined, { minimumFractionDigits: 2 })} {item.currency}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          item.status === 'paid'
                            ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                            : item.status === 'pending'
                            ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30'
                            : 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30'
                        }`}>
                          {item.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleOpenEdit(item)}
                            className="p-1.5 text-[var(--color-text-muted)] hover:text-[var(--color-primary)] hover:bg-[var(--color-surface-offset)] rounded transition-colors cursor-pointer"
                            title="Edit expense"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(item.id)}
                            className="p-1.5 text-rose-500 hover:bg-rose-500/10 rounded transition-colors cursor-pointer"
                            title="Delete expense"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Record / Edit Expense Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in text-left">
          <div className="relative w-full max-w-xl bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-divider)]/40 bg-[var(--color-surface-2)]">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-[var(--color-primary)]/15 text-[var(--color-primary)]">
                  <DollarSign className="w-5 h-5" />
                </div>
                <h3 className="text-sm font-extrabold text-[var(--color-text)]">
                  {editingExpense ? 'Edit Expense Record' : 'Record New Expense / تسجيل مصروف جديد'}
                </h3>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="p-6 overflow-y-auto flex flex-col gap-4">
              <div>
                <label className="block text-xs font-bold text-[var(--color-text)] mb-1">
                  Description / البيان <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g. Monthly High-Speed Internet &amp; Cloud Backup"
                  className="w-full premium-input text-xs"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-[var(--color-text)] mb-1">
                    Expense Category / فئة المصروف
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as any)}
                    className="w-full premium-input text-xs"
                  >
                    {EXPENSE_CATEGORIES.map(c => (
                      <option key={c.id} value={c.id}>{c.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[var(--color-text)] mb-1">
                    Vendor / Supplier Name / اسم المورد
                  </label>
                  <input
                    type="text"
                    value={vendor}
                    onChange={(e) => setVendor(e.target.value)}
                    placeholder="e.g. STC Telecom / Amazon AWS"
                    className="w-full premium-input text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-[var(--color-text)] mb-1">
                    Amount (Pre-Tax) / المبلغ <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={amount}
                    onChange={(e) => setAmount(e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder="0.00"
                    className="w-full premium-input text-xs font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[var(--color-text)] mb-1">
                    VAT Rate / الضريبة (%)
                  </label>
                  <input
                    type="number"
                    value={taxRate}
                    onChange={(e) => setTaxRate(Number(e.target.value))}
                    className="w-full premium-input text-xs font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[var(--color-text)] mb-1">
                    Total with VAT
                  </label>
                  <div className="w-full premium-input text-xs font-mono font-bold bg-[var(--color-surface-offset)] flex items-center">
                    {amount !== '' ? ((Number(amount) * (1 + taxRate / 100)).toFixed(2)) : '0.00'} {company.currency}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-[var(--color-text)] mb-1">
                    Date / التاريخ
                  </label>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full premium-input text-xs font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[var(--color-text)] mb-1">
                    Payment Method / طريقة الدفع
                  </label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value as any)}
                    className="w-full premium-input text-xs"
                  >
                    <option value="bank_transfer">Bank Transfer / تحويل بنكي</option>
                    <option value="card">Company Card / بطاقة بنكية</option>
                    <option value="cash">Cash / نقدي</option>
                    <option value="cheque">Cheque / شيك</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[var(--color-text)] mb-1">
                    Status / الحالة
                  </label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as any)}
                    className="w-full premium-input text-xs"
                  >
                    <option value="paid">Paid / مدفوع</option>
                    <option value="pending">Pending / معلق</option>
                    <option value="reimbursed">Reimbursed / مسترد</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[var(--color-text)] mb-1">
                  Invoice / Receipt Reference #
                </label>
                <input
                  type="text"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  placeholder="e.g. INV-98234 / STC-8812"
                  className="w-full premium-input text-xs font-mono"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="taxDeductibleCheck"
                  checked={taxDeductible}
                  onChange={(e) => setTaxDeductible(e.target.checked)}
                  className="accent-[var(--color-primary)] w-4 h-4 rounded"
                />
                <label htmlFor="taxDeductibleCheck" className="text-xs text-[var(--color-text)] font-semibold cursor-pointer">
                  Tax Deductible Expense (Include in Saudi ZATCA VAT Input Returns)
                </label>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-[var(--color-divider)]/40 mt-2">
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
                  {saving ? 'Saving...' : editingExpense ? 'Save Changes' : 'Save Expense / حفظ'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
