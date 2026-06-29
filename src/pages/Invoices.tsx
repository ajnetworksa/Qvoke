import React, { useState } from 'react';
import { useERPStore } from '../store';
import { PageHeader } from '../components/PageHeader';
import { matchSearchQuery } from '../utils/search';
import { StatusBadge } from '../components/StatusBadge';
import { EmptyState } from '../components/EmptyState';
import { FileSpreadsheet, Plus, Search, Trash2, CheckCircle2, LayoutGrid, List, ExternalLink } from 'lucide-react';
import { Invoice } from '../types';

export const Invoices: React.FC = () => {
  const { invoices, customers, setRoute, deleteInvoice, updateInvoice, kanbanView, setKanbanView, company, currentUser } = useERPStore();
  const canDelete = currentUser?.role === 'admin' || !!currentUser?.permissions?.canDeleteData;

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Kanban columns. 'partial'/'paid' are derived from recorded payments, so they
  // are display-only — dragging a card there is ignored (status would be wrong).
  const columns: { label: string; status: Invoice['status']; droppable: boolean }[] = [
    { label: 'Draft / مسودة', status: 'draft', droppable: true },
    { label: 'Posted / مرحلة', status: 'posted', droppable: true },
    { label: 'Partial / جزئي', status: 'partial', droppable: false },
    { label: 'Paid / مدفوع', status: 'paid', droppable: false },
    { label: 'Overdue / متأخر', status: 'overdue', droppable: true },
    { label: 'Cancelled / ملغي', status: 'cancelled', droppable: true }
  ];

  const handleDragStart = (e: React.DragEvent, invId: string) => {
    e.dataTransfer.setData('text/plain', invId);
    e.dataTransfer.effectAllowed = 'move';
  };
  const handleDragOver = (e: React.DragEvent) => e.preventDefault();
  const handleDrop = (e: React.DragEvent, target: Invoice['status'], droppable: boolean) => {
    e.preventDefault();
    if (!droppable) return;
    const invId = e.dataTransfer.getData('text/plain');
    const inv = invoices.find((i) => i.id === invId);
    if (inv && inv.status !== target) {
      updateInvoice({ ...inv, status: target, updatedAt: new Date() });
    }
  };

  // Filtering invoices
  const filteredInvoices = invoices.filter((i) => {
    const cust = customers.find((c) => c.id === i.customerId);
    const matchesSearch = matchSearchQuery(search, [
      i.number,
      i.subject,
      cust?.companyName,
      cust?.contactPerson,
      i.notes,
      i.terms
    ]);

    const matchesStatus = statusFilter === 'all' || i.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const getCustomerName = (customerId: string) => {
    const c = customers.find((cust) => cust.id === customerId);
    return c ? c.companyName : 'Unknown Customer';
  };

  // Bulk options
  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedIds(filteredInvoices.map((inv) => inv.id));
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
    if (window.confirm(`Are you sure you want to delete ${selectedIds.length} invoices?`)) {
      selectedIds.forEach((id) => deleteInvoice(id));
      setSelectedIds([]);
    }
  };

  const handleBulkPost = () => {
    selectedIds.forEach((id) => {
      const inv = invoices.find((i) => i.id === id);
      if (inv && inv.status === 'draft') {
        updateInvoice({ ...inv, status: 'posted', updatedAt: new Date() });
      }
    });
    setSelectedIds([]);
  };

  return (
    <div className="animate-fade-in text-left">
      <PageHeader
        title="Invoices / الفواتير"
        breadcrumbs={[{ label: 'Home' }, { label: 'Invoices' }]}
        actions={
          <div className="flex gap-2">
            {/* List / Kanban toggle */}
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
              onClick={() => setRoute('invoice-detail', 'new')}
              className="bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white text-xs font-semibold py-2.5 px-4 rounded-md flex items-center gap-1.5 transition-colors shadow-sm cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              New Invoice / فاتورة جديدة
            </button>
          </div>
        }
      />

      {/* Filter and Search */}
      <div className="premium-card p-4 mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="relative flex-1 min-w-[280px]">
          <Search className="absolute left-3 w-4 h-4 text-[var(--color-text-muted)] pointer-events-none" />
          <input
            type="text"
            placeholder="Search invoices (e.g. INV-2026-0001 or Customer)..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full premium-input pl-10 pr-4 py-2"
          />
        </div>

        <div className="flex gap-1.5 flex-wrap">
          {['all', 'draft', 'posted', 'partial', 'paid', 'overdue', 'cancelled'].map((st) => (
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

      {/* Bulk actions */}
      {selectedIds.length > 0 && (
        <div className="bg-[var(--color-primary-highlight)]/40 border border-[var(--color-primary)]/20 px-4 py-3 rounded-lg flex items-center justify-between mb-6 animate-slide-in">
          <span className="text-xs font-bold text-[var(--color-primary)]">
            {selectedIds.length} items selected
          </span>
          <div className="flex gap-2">
            <button
              onClick={handleBulkPost}
              className="bg-white hover:bg-[var(--color-surface-offset)] border border-[var(--color-border)] text-[var(--color-text)] text-[11px] font-semibold py-1.5 px-3 rounded flex items-center gap-1 transition-colors cursor-pointer"
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              Post Drafts
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

      {/* Main view area */}
      {filteredInvoices.length === 0 ? (
        <EmptyState
          icon={FileSpreadsheet}
          title="No invoices found / لم يتم العثور على فواتير"
          description="Create client billing statements or automatically migrate quotations to invoices inside of the document builder."
          actionText="Create your first invoice"
          onAction={() => setRoute('invoice-detail', 'new')}
        />
      ) : kanbanView ? (
        /* Kanban Board */
        <div className="flex gap-5 overflow-x-auto pb-3">
          {columns.map((col) => {
            const colInvoices = filteredInvoices.filter((i) => i.status === col.status);
            return (
              <div
                key={col.status}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, col.status, col.droppable)}
                className={`flex flex-col rounded-xl border p-4 min-h-[480px] w-72 shrink-0 ${
                  col.droppable ? 'border-[var(--color-border)]/50 bg-[var(--color-surface-2)]' : 'border-dashed border-[var(--color-border)]/40 bg-[var(--color-surface-offset)]/30'
                }`}
              >
                <div className="flex items-center justify-between border-b border-[var(--color-divider)]/40 pb-3 mb-4">
                  <span className="text-xs font-bold text-[var(--color-text)] uppercase tracking-wider">
                    {col.label}
                  </span>
                  <span className="bg-surface border border-border/40 text-[var(--color-text-muted)] text-[10px] font-mono font-bold px-2 py-0.5 rounded-full">
                    {colInvoices.length}
                  </span>
                </div>

                {!col.droppable && (
                  <p className="text-[10px] text-[var(--color-text-faint)] italic mb-2 -mt-2">
                    Auto-set from payments
                  </p>
                )}

                <div className="flex flex-col gap-3 overflow-y-auto max-h-[520px]">
                  {colInvoices.map((inv) => (
                    <div
                      key={inv.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, inv.id)}
                      onClick={() => setRoute('invoice-detail', inv.id)}
                      className="bg-[var(--color-surface)] border border-[var(--color-border)] hover:border-[var(--color-primary)]/40 hover:shadow-sm rounded-lg p-4 cursor-grab active:cursor-grabbing text-left transition-all duration-[var(--transition-interactive)] animate-fade-in group"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <span className="text-xs font-bold text-[var(--color-text)] group-hover:text-[var(--color-primary)] transition-colors">
                          {inv.number}
                        </span>
                        <ExternalLink className="w-3 h-3 text-[var(--color-text-faint)] opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>

                      <div className="text-sm font-semibold text-[var(--color-text)] line-clamp-1 mb-2">
                        {getCustomerName(inv.customerId)}
                      </div>

                      {inv.amountDue > 0 && (
                        <div className="text-[10px] font-bold text-[var(--color-error)] mb-1">
                          Balance: {inv.amountDue.toLocaleString(undefined, { minimumFractionDigits: 2 })} {inv.currency}
                        </div>
                      )}

                      <div className="flex justify-between items-end border-t border-[var(--color-divider)]/20 pt-3 mt-1">
                        <span className="text-[10px] text-[var(--color-text-muted)] font-mono">
                          {new Date(inv.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </span>
                        <span className="text-xs font-bold text-[var(--color-text)]">
                          {inv.total.toLocaleString()} {inv.currency}
                        </span>
                      </div>
                    </div>
                  ))}
                  {colInvoices.length === 0 && (
                    <div className="border border-dashed border-[var(--color-border)] rounded-lg p-6 text-center text-xs text-[var(--color-text-muted)]">
                      {col.droppable ? 'Drop cards here' : 'Empty'}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
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
                        filteredInvoices.length > 0 &&
                        selectedIds.length === filteredInvoices.length
                      }
                      className="rounded accent-[var(--color-primary)] cursor-pointer"
                    />
                  </th>
                  <th className="py-3 px-4">Invoice ID</th>
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4">Invoice Date</th>
                  <th className="py-3 px-4">Due Date</th>
                  <th className="py-3 px-4 text-right">Total</th>
                  <th className="py-3 px-4 text-right">Paid</th>
                  <th className="py-3 px-4 text-right">Balance</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-divider)]">
                {filteredInvoices.map((inv) => {
                  const isChecked = selectedIds.includes(inv.id);
                  const isOverdue = inv.status === 'overdue';
                  
                  return (
                    <tr
                      key={inv.id}
                      className={`hover:bg-[var(--color-surface-offset)]/50 transition-colors ${
                        isChecked ? 'bg-[var(--color-primary-highlight)]/10' : ''
                      } ${
                        isOverdue ? 'bg-[var(--color-warning)]/8' : ''
                      }`}
                    >
                      <td className="py-3.5 px-4">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => handleSelectOne(inv.id, e.target.checked)}
                          className="rounded accent-[var(--color-primary)] cursor-pointer"
                        />
                      </td>
                      <td
                        onClick={() => setRoute('invoice-detail', inv.id)}
                        className="py-3.5 px-4 font-bold text-[var(--color-primary)] hover:underline cursor-pointer"
                      >
                        {inv.number}
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-[var(--color-text)]">
                        {getCustomerName(inv.customerId)}
                      </td>
                      <td className="py-3.5 px-4 text-xs font-mono text-[var(--color-text-muted)]">
                        {new Date(inv.date).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: '2-digit',
                          day: '2-digit'
                        })}
                      </td>
                      <td className="py-3.5 px-4 text-xs font-mono text-[var(--color-text-muted)]">
                        {new Date(inv.dueDate).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: '2-digit',
                          day: '2-digit'
                        })}
                      </td>
                      <td className="py-3.5 px-4 font-bold text-right text-[var(--color-text)]">
                        {inv.total.toLocaleString(undefined, { minimumFractionDigits: 2 })} <span className="text-[10px] text-[var(--color-text-muted)]">{inv.currency}</span>
                      </td>
                      <td className="py-3.5 px-4 font-bold text-right text-[var(--color-success)]">
                        {inv.amountPaid.toLocaleString(undefined, { minimumFractionDigits: 2 })} <span className="text-[10px] text-[var(--color-text-muted)]">{inv.currency}</span>
                      </td>
                      <td className="py-3.5 px-4 font-bold text-right text-[var(--color-error)]">
                        {inv.amountDue.toLocaleString(undefined, { minimumFractionDigits: 2 })} <span className="text-[10px] text-[var(--color-text-muted)]">{inv.currency}</span>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <StatusBadge status={inv.status} />
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => setRoute('invoice-detail', inv.id)}
                            className="text-xs font-bold text-[var(--color-primary)] hover:text-[var(--color-primary-hover)] cursor-pointer"
                          >
                            Edit
                          </button>
                          {canDelete && (
                            <>
                              <span className="text-[var(--color-text-faint)]">|</span>
                              <button
                                onClick={() => {
                                  if (window.confirm('Delete this invoice?')) {
                                    deleteInvoice(inv.id);
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
export default Invoices;
