import React, { useState, useEffect } from 'react';
import { useERPStore } from '../store';
import { Trash2, RotateCcw, AlertCircle, Shield, FileText, Calendar, Clock, Loader2, Search, Pin, PinOff, Receipt, Sparkles } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

interface RecycleBinItem {
  quote_id: string;
  number?: string;
  subject: string;
  customer_name: string;
  author_name: string;
  deleted_at: string;
  deleted_by: string;
  retain_forever: number;
  type?: 'quotation' | 'invoice';
}

export function RecycleBin() {
  const { initializeStore } = useERPStore();
  const [items, setItems] = useState<RecycleBinItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [pruning, setPruning] = useState(false);
  const [typeFilter, setTypeFilter] = useState<'all' | 'quotation' | 'invoice'>('all');

  const getToken = () => localStorage.getItem('erp_token') || sessionStorage.getItem('erp_token');

  useEffect(() => {
    fetchItems();
  }, []);

  const fetchItems = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await fetch(`${API_BASE}/recycle-bin`, {
        headers: { 'Authorization': `Bearer ${getToken()}` }
      });
      if (res.ok) {
        const data = await res.json();
        setItems(data);
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to fetch recycle bin');
      }
    } catch (err) {
      setError('Network error or API not implemented');
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async (quote_id: string) => {
    if (!confirm(`Are you sure you want to restore ${quote_id}?`)) return;
    try {
      const res = await fetch(`${API_BASE}/recycle-bin/${quote_id}/restore`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${getToken()}` }
      });
      if (res.ok) {
        await fetchItems();
        await initializeStore();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to restore');
      }
    } catch {
      alert('Network error');
    }
  };

  const handleDelete = async (quote_id: string) => {
    if (!confirm(`WARNING: This will PERMANENTLY delete ${quote_id}. This action cannot be undone. Are you sure?`)) return;
    try {
      const res = await fetch(`${API_BASE}/recycle-bin/${quote_id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${getToken()}` }
      });
      if (res.ok) {
        await fetchItems();
        await initializeStore();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to delete');
      }
    } catch {
      alert('Network error');
    }
  };

  const handleToggleRetain = async (quote_id: string, currentRetain: number) => {
    try {
      const res = await fetch(`${API_BASE}/recycle-bin/${quote_id}/retain`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getToken()}`
        },
        body: JSON.stringify({ retain: currentRetain ? 0 : 1 })
      });
      if (res.ok) {
        fetchItems();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to update retention status');
      }
    } catch {
      alert('Network error');
    }
  };

  const handlePrune = async (days: number) => {
    if (!confirm(`Purge all non-retained items older than ${days} days permanently?`)) return;
    setPruning(true);
    try {
      const res = await fetch(`${API_BASE}/recycle-bin/prune`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getToken()}`
        },
        body: JSON.stringify({ days })
      });
      if (res.ok) {
        const data = await res.json();
        alert(`Pruned ${data.purgedQuotes || 0} quotes and ${data.purgedInvoices || 0} invoices.`);
        await fetchItems();
        await initializeStore();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to prune');
      }
    } catch {
      alert('Network error');
    } finally {
      setPruning(false);
    }
  };

  const filteredItems = items.filter(item => {
    if (typeFilter !== 'all' && item.type !== typeFilter) return false;
    const query = search.toLowerCase();
    return (
      (item.quote_id && item.quote_id.toLowerCase().includes(query)) ||
      (item.number && item.number.toLowerCase().includes(query)) ||
      (item.subject && item.subject.toLowerCase().includes(query)) ||
      (item.customer_name && item.customer_name.toLowerCase().includes(query)) ||
      (item.deleted_by && item.deleted_by.toLowerCase().includes(query))
    );
  });

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-fade-in text-left">
      <div className="premium-card p-6 flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-red-500/10 rounded-xl border border-red-500/20">
            <Trash2 className="text-red-500" size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-[var(--color-text)]">Recycle Bin</h1>
            <p className="text-[var(--color-text-muted)] text-sm mt-1">Manage deleted quotations & invoices. Retain items or restore them back to active operations.</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {/* Document Type Filter */}
          <div className="flex rounded-lg border border-[var(--color-border)] p-0.5 bg-[var(--color-surface-offset)]">
            {(['all', 'quotation', 'invoice'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTypeFilter(t)}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold uppercase transition-colors cursor-pointer ${
                  typeFilter === t
                    ? 'bg-[var(--color-primary)] text-white shadow-sm'
                    : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
                }`}
              >
                {t === 'all' ? 'All' : t === 'quotation' ? 'Quotes' : 'Invoices'}
              </button>
            ))}
          </div>

          <div className="relative w-full md:w-56">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
            <input
              type="text"
              placeholder="Search deleted items..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-1.5 premium-input text-xs"
            />
          </div>

          <button
            onClick={() => handlePrune(30)}
            disabled={pruning}
            className="px-3 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 shrink-0 disabled:opacity-50"
            title="Purge items deleted over 30 days ago"
          >
            {pruning ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
            Prune 30d+
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-500/10 text-red-500 rounded-xl border border-red-500/20 flex items-center gap-2 text-sm">
          <AlertCircle size={18} /> {error}
        </div>
      )}

      <div className="premium-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-[var(--color-surface-offset)] border-b border-[var(--color-border)] text-[var(--color-text-muted)] font-semibold tracking-wider text-xs uppercase">
              <tr>
                <th className="px-4 py-3">Document</th>
                <th className="px-4 py-3">Subject</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Deleted By</th>
                <th className="px-4 py-3">Deleted At</th>
                <th className="px-4 py-3 text-center">Retention</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-[var(--color-text-muted)]">
                    <Loader2 size={24} className="animate-spin mx-auto mb-2 text-[var(--color-primary)]" />
                    Loading recycle bin...
                  </td>
                </tr>
              ) : filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-[var(--color-text-muted)]">
                    <Trash2 size={24} className="mx-auto mb-2 opacity-50" />
                    Recycle bin is empty
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => (
                  <tr key={item.quote_id} className="hover:bg-[var(--color-surface-offset)] transition-colors">
                    <td className="px-4 py-3 font-medium text-[var(--color-text)]">
                      <div className="flex items-center gap-2">
                        {item.type === 'invoice' ? (
                          <Receipt size={14} className="text-emerald-500 shrink-0" />
                        ) : (
                          <FileText size={14} className="text-blue-500 shrink-0" />
                        )}
                        <span className="font-mono font-bold text-xs">
                          {item.number || item.quote_id}
                        </span>
                        <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded border ${
                          item.type === 'invoice'
                            ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                            : 'bg-blue-500/10 text-blue-500 border-blue-500/20'
                        }`}>
                          {item.type === 'invoice' ? 'Invoice' : 'Quote'}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[var(--color-text)] text-xs">{item.subject || '—'}</td>
                    <td className="px-4 py-3 text-[var(--color-text)] text-xs font-semibold">{item.customer_name || '—'}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5 text-[var(--color-text)] text-xs">
                        <Shield size={13} className="text-[var(--color-primary)]" />
                        {item.deleted_by || 'System'}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col">
                        <span className="flex items-center gap-1.5 text-[var(--color-text)] text-xs">
                          <Calendar size={11} className="text-[var(--color-text-muted)]" />
                          {new Date(item.deleted_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </span>
                        <span className="flex items-center gap-1.5 text-[var(--color-text-muted)] text-[10px] mt-0.5">
                          <Clock size={11} />
                          {new Date(item.deleted_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => handleToggleRetain(item.quote_id, item.retain_forever)}
                        title={item.retain_forever ? "Pinned: Will never be auto-purged" : "Auto-Clear: Subject to retention auto-purge"}
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase transition-colors border cursor-pointer ${
                          item.retain_forever 
                            ? 'bg-amber-500/10 text-amber-500 border-amber-500/20 hover:bg-amber-500/20' 
                            : 'bg-transparent text-[var(--color-text-muted)] border-[var(--color-border)] hover:bg-[var(--color-surface-offset)]'
                        }`}
                      >
                        {item.retain_forever ? <Pin size={10} /> : <PinOff size={10} />}
                        {item.retain_forever ? 'Pinned' : 'Auto-Clear'}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleRestore(item.quote_id)}
                          className="p-1.5 text-[var(--color-primary)] hover:bg-[var(--color-primary)]/10 rounded-lg transition-colors cursor-pointer"
                          title="Restore back to active list"
                        >
                          <RotateCcw size={15} />
                        </button>
                        <button
                          onClick={() => handleDelete(item.quote_id)}
                          className="p-1.5 text-red-500 hover:bg-red-500/10 rounded-lg transition-colors cursor-pointer"
                          title="Delete Permanently"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
