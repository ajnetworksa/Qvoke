import React, { useState } from 'react';
import { useERPStore } from '../store';
import { PageHeader } from '../components/PageHeader';
import { matchSearchQuery } from '../utils/search';
import { StatusBadge } from '../components/StatusBadge';
import { EmptyState } from '../components/EmptyState';
import { Quotation } from '../types';
import {
  Plus,
  LayoutGrid,
  List,
  Search,
  Trash2,
  ExternalLink,
  CheckCircle2,
  FileCheck2,
  FileSpreadsheet
} from 'lucide-react';

export const Quotations: React.FC = () => {
  const {
    quotations,
    customers,
    setRoute,
    deleteQuotation,
    updateQuotation,
    kanbanView,
    setKanbanView,
    company,
    currentUser
  } = useERPStore();

  const canDelete = currentUser?.role === 'admin' || !!currentUser?.permissions?.canDeleteData;

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);

  // Search and filter logic
  const filteredQuotations = quotations.filter((q) => {
    const cust = customers.find((c) => c.id === q.customerId);
    const matchesSearch = matchSearchQuery(search, [
      q.number,
      q.subject,
      cust?.companyName,
      cust?.contactPerson,
      q.notes,
      q.terms
    ]);

    const matchesStatus = statusFilter === 'all' || q.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const getCustomerName = (customerId: string) => {
    const c = customers.find((cust) => cust.id === customerId);
    return c ? c.companyName : 'Unknown Customer';
  };

  // Bulk operations
  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedIds(filteredQuotations.map((q) => q.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectOne = (id: string, checked: boolean) => {
    if (checked) {
      setSelectedIds([...selectedIds, id]);
    } else {
      setSelectedIds(selectedIds.filter((x) => x !== id));
    }
  };

  const handleBulkDelete = () => {
    if (window.confirm(`Are you sure you want to delete ${selectedIds.length} quotations?`)) {
      selectedIds.forEach((id) => deleteQuotation(id));
      setSelectedIds([]);
    }
  };

  const handleBulkStatusChange = (status: Quotation['status']) => {
    selectedIds.forEach((id) => {
      const q = quotations.find((quote) => quote.id === id);
      if (q) updateQuotation({ ...q, status, updatedAt: new Date() });
    });
    setSelectedIds([]);
  };

  // Native HTML5 Drag and Drop Handlers for Kanban
  const handleDragStart = (e: React.DragEvent, quoteId: string) => {
    e.dataTransfer.setData('text/plain', quoteId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, targetStatus: Quotation['status']) => {
    e.preventDefault();
    const quoteId = e.dataTransfer.getData('text/plain');
    const quote = quotations.find((q) => q.id === quoteId);
    if (quote && quote.status !== targetStatus) {
      updateQuotation({
        ...quote,
        status: targetStatus,
        updatedAt: new Date()
      });
    }
  };

  const columns: { label: string; status: Quotation['status'] }[] = [
    { label: 'Draft / مسودة', status: 'draft' },
    { label: 'Sent / مرسل', status: 'sent' },
    { label: 'Confirmed / مؤكد', status: 'confirmed' },
    { label: 'Cancelled / ملغي', status: 'cancelled' }
  ];

  return (
    <div className="animate-fade-in text-left">
      <PageHeader
        title="Quotations / عروض الأسعار"
        breadcrumbs={[{ label: 'Home' }, { label: 'Quotations' }]}
        actions={
          <div className="flex gap-2">
            {/* View toggles */}
            <div className="flex bg-[var(--color-surface-offset)] border border-[var(--color-border)] rounded-md p-0.5">
              <button
                onClick={() => setKanbanView(false)}
                className={`p-1.5 rounded transition-colors cursor-pointer ${
                  !kanbanView ? 'bg-[var(--color-surface)] text-[var(--color-primary)] font-bold shadow-sm' : 'text-[var(--color-text-muted)]'
                }`}
                aria-label="List View"
              >
                <List className="w-4 h-4" />
              </button>
              <button
                onClick={() => setKanbanView(true)}
                className={`p-1.5 rounded transition-colors cursor-pointer ${
                  kanbanView ? 'bg-[var(--color-surface)] text-[var(--color-primary)] font-bold shadow-sm' : 'text-[var(--color-text-muted)]'
                }`}
                aria-label="Kanban View"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
            </div>

            <button
              onClick={() => setRoute('quotation-detail', 'new')}
              className="bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white text-xs font-semibold py-2.5 px-4 rounded-md flex items-center gap-1.5 transition-colors shadow-sm"
            >
              <Plus className="w-4 h-4" />
              New Quotation / عرض سعر جديد
            </button>
          </div>
        }
      />

      {/* Filter and search bar */}
      <div className="premium-card p-4 mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="relative flex-1 min-w-[280px]">
          <Search className="absolute left-3 w-4 h-4 text-[var(--color-text-muted)] pointer-events-none" />
          <input
            type="text"
            placeholder="Search quotations (e.g. QT-2026-0001 or Customer)..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full premium-input pl-10 pr-4 py-2"
          />
        </div>

        <div className="flex items-center gap-2">
          {/* Status filter pills */}
          <div className="flex gap-1.5 flex-wrap">
            {['all', 'draft', 'sent', 'confirmed', 'expired', 'cancelled'].map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md border transition-all cursor-pointer ${
                  statusFilter === st
                    ? 'bg-[var(--color-primary)] border-[var(--color-primary)] text-white'
                    : 'bg-[var(--color-surface-2)] border-[var(--color-border)] text-[var(--color-text-muted)] hover:bg-[var(--color-surface-offset)]'
                }`}
              >
                {st.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Bulk actions */}
      {selectedIds.length > 0 && (
        <div className="bg-[var(--color-primary-highlight)]/40 border border-[var(--color-primary)]/20 px-4 py-3 rounded-lg flex items-center justify-between mb-6 animate-slide-in">
          <span className="text-xs font-bold text-[var(--color-primary)]">
            {selectedIds.length} items selected / {selectedIds.length} عناصر محددة
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleBulkStatusChange('confirmed')}
              className="bg-white hover:bg-[var(--color-surface-offset)] border border-[var(--color-border)] text-[var(--color-text)] text-[11px] font-semibold py-1.5 px-3 rounded flex items-center gap-1 transition-colors cursor-pointer"
            >
              <FileCheck2 className="w-3.5 h-3.5 text-emerald-600" />
              Confirm All
            </button>
            <button
              onClick={() => handleBulkStatusChange('sent')}
              className="bg-white hover:bg-[var(--color-surface-offset)] border border-[var(--color-border)] text-[var(--color-text)] text-[11px] font-semibold py-1.5 px-3 rounded flex items-center gap-1 transition-colors cursor-pointer"
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />
              Mark as Sent
            </button>
            {canDelete && (
              <button
                onClick={handleBulkDelete}
                className="bg-[var(--color-error)]/10 hover:bg-[var(--color-error)]/20 border border-[var(--color-error)]/20 text-[var(--color-error)] text-[11px] font-semibold py-1.5 px-3 rounded flex items-center gap-1 transition-colors cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete Selected
              </button>
            )}
          </div>
        </div>
      )}

      {/* Main View Area */}
      {filteredQuotations.length === 0 ? (
        <EmptyState
          icon={FileSpreadsheet}
          title="No quotations found / لم يتم العثور على عروض أسعار"
          description="Build quotes dynamically with line-items, taxes, and automatic bilingual PDF compile sheets in seconds."
          actionText="Create your first quotation"
          onAction={() => setRoute('quotation-detail', 'new')}
        />
      ) : kanbanView ? (
        /* Kanban Board */
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {columns.map((col) => {
            const colQuotes = filteredQuotations.filter((q) => q.status === col.status);
            return (
              <div
                key={col.status}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, col.status)}
                className="flex flex-col rounded-xl border border-[var(--color-border)]/50 bg-[var(--color-surface-2)] p-4 min-h-[480px]"
              >
                <div className="flex items-center justify-between border-b border-[var(--color-divider)]/40 pb-3 mb-4">
                  <span className="text-xs font-bold text-[var(--color-text)] uppercase tracking-wider">
                    {col.label}
                  </span>
                  <span className="bg-surface border border-border/40 text-[var(--color-text-muted)] text-[10px] font-mono font-bold px-2 py-0.5 rounded-full">
                    {colQuotes.length}
                  </span>
                </div>

                <div className="flex flex-col gap-3 overflow-y-auto max-h-[500px]">
                  {colQuotes.map((q) => (
                    <div
                      key={q.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, q.id)}
                      onClick={() => setRoute('quotation-detail', q.id)}
                      className="bg-[var(--color-surface)] border border-[var(--color-border)] hover:border-[var(--color-primary)]/40 hover:shadow-sm rounded-lg p-4 cursor-grab active:cursor-grabbing text-left transition-all duration-[var(--transition-interactive)] animate-fade-in group"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <span className="text-xs font-bold text-[var(--color-text)] group-hover:text-[var(--color-primary)] transition-colors">
                          {q.number}
                        </span>
                        <ExternalLink className="w-3 h-3 text-[var(--color-text-faint)] opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                      
                      <div className="text-sm font-semibold text-[var(--color-text)] line-clamp-1 mb-2">
                        {getCustomerName(q.customerId)}
                      </div>

                      <div className="flex justify-between items-end border-t border-[var(--color-divider)]/20 pt-3 mt-1">
                        <span className="text-[10px] text-[var(--color-text-muted)] font-mono">
                          {new Date(q.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </span>
                        <span className="text-xs font-bold text-[var(--color-text)]">
                          {q.total.toLocaleString()} {q.currency}
                        </span>
                      </div>
                    </div>
                  ))}
                  {colQuotes.length === 0 && (
                    <div className="border border-dashed border-[var(--color-border)] rounded-lg p-6 text-center text-xs text-[var(--color-text-muted)]">
                      Drop cards here
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* List View Table */
        <div className="premium-card overflow-hidden">
          <div className="overflow-x-auto w-full">
            <table className="w-full text-sm border-collapse text-left">
              <thead>
                <tr className="bg-[var(--color-surface-offset)] border-b border-[var(--color-border)] text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">
                  <th className="py-3 px-4 w-4">
                    <input
                      type="checkbox"
                      onChange={handleSelectAll}
                      checked={
                        filteredQuotations.length > 0 &&
                        selectedIds.length === filteredQuotations.length
                      }
                      className="rounded accent-[var(--color-primary)] cursor-pointer"
                    />
                  </th>
                  <th className="py-3 px-4">Quote ID</th>
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4">Created Date</th>
                  <th className="py-3 px-4">Valid Until</th>
                  <th className="py-3 px-4 text-right">Total Amount</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-divider)]">
                {filteredQuotations.map((q) => {
                  const isChecked = selectedIds.includes(q.id);
                  return (
                    <tr
                      key={q.id}
                      className={`hover:bg-[var(--color-surface-offset)]/50 transition-colors ${
                        isChecked ? 'bg-[var(--color-primary-highlight)]/10' : ''
                      }`}
                    >
                      <td className="py-3.5 px-4">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => handleSelectOne(q.id, e.target.checked)}
                          className="rounded accent-[var(--color-primary)] cursor-pointer"
                        />
                      </td>
                      <td
                        onClick={() => setRoute('quotation-detail', q.id)}
                        className="py-3.5 px-4 font-bold text-[var(--color-primary)] hover:underline cursor-pointer"
                      >
                        {q.number}
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-[var(--color-text)]">
                        {getCustomerName(q.customerId)}
                      </td>
                      <td className="py-3.5 px-4 text-xs font-mono text-[var(--color-text-muted)]">
                        {new Date(q.date).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: '2-digit',
                          day: '2-digit'
                        })}
                      </td>
                      <td className="py-3.5 px-4 text-xs font-mono text-[var(--color-text-muted)]">
                        {new Date(q.validUntil).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: '2-digit',
                          day: '2-digit'
                        })}
                      </td>
                      <td className="py-3.5 px-4 font-bold text-right text-[var(--color-text)]">
                        {q.total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{' '}
                        <span className="text-[10px] text-[var(--color-text-muted)] font-normal">{q.currency}</span>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <StatusBadge status={q.status} />
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => setRoute('quotation-detail', q.id)}
                            className="text-xs font-bold text-[var(--color-primary)] hover:text-[var(--color-primary-hover)] cursor-pointer"
                          >
                            Edit
                          </button>
                          {canDelete && (
                            <>
                              <span className="text-[var(--color-text-faint)]">|</span>
                              <button
                                onClick={() => {
                                  if (window.confirm('Delete this quotation?')) {
                                    deleteQuotation(q.id);
                                  }
                                }}
                                className="text-xs font-bold text-[var(--color-error)] hover:text-[var(--color-error)]/80 cursor-pointer"
                              >
                                Delete
                              </button>
                            </>
                          )}
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
    </div>
  );
};
export default Quotations;
