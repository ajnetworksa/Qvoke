import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useERPStore } from '../store';
import { AppNotification } from '../types';
import { Bell, Check, FileText, Clock, AlertTriangle, Loader2 } from 'lucide-react';

const typeIcon: Record<string, React.ElementType> = {
  quote_expiring: Clock,
  invoice_overdue: AlertTriangle,
  doc_created: FileText,
  doc_updated: FileText,
  system: Bell,
};

const fmtAgo = (iso: string) => {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
};

export const NotificationBell: React.FC = () => {
  const { token, setRoute } = useERPStore();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const authH = useCallback(() => ({ Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }), [token]);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications', { headers: authH() });
      if (res.ok) setItems(await res.json());
    } catch { /* ignore */ }
  }, [authH]);

  // Refresh derived notifications (expiring quotes / overdue invoices), then load. Poll every 5 min.
  useEffect(() => {
    let active = true;
    const run = async () => {
      try { await fetch('/api/notifications/refresh', { method: 'POST', headers: authH() }); } catch { /* ignore */ }
      if (active) load();
    };
    run();
    const t = setInterval(run, 5 * 60 * 1000);
    return () => { active = false; clearInterval(t); };
  }, [authH, load]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const unread = items.filter(i => !i.isRead).length;

  const markAll = async () => {
    setLoading(true);
    try {
      await fetch('/api/notifications/read-all', { method: 'POST', headers: authH() });
      setItems(items.map(i => ({ ...i, isRead: true })));
    } finally { setLoading(false); }
  };

  const openItem = async (n: AppNotification) => {
    if (!n.isRead) {
      try { await fetch(`/api/notifications/${n.id}/read`, { method: 'POST', headers: authH() }); } catch { /* ignore */ }
      setItems(items.map(i => i.id === n.id ? { ...i, isRead: true } : i));
    }
    if (n.link) {
      const [type, recId] = n.link.split(':');
      const pageMap: Record<string, string> = {
        quotation: 'quotation-detail',
        invoice: 'invoice-detail',
      };
      if (pageMap[type]) setRoute(pageMap[type], recId);
    }
    setOpen(false);
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 hover:bg-[var(--color-surface-offset)] rounded-full text-[var(--color-text-muted)] transition-colors cursor-pointer"
        aria-label="Notifications"
      >
        <Bell className="w-4 h-4" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 flex items-center justify-center text-[9px] font-black text-white bg-red-500 rounded-full">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 max-h-[28rem] overflow-hidden flex flex-col bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg shadow-xl z-50">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-[var(--color-border)]">
            <span className="text-xs font-black uppercase tracking-wider text-[var(--color-text)]">Notifications</span>
            {unread > 0 && (
              <button onClick={markAll} disabled={loading} className="text-[10px] font-semibold text-[var(--color-primary)] hover:underline flex items-center gap-1 cursor-pointer">
                {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />} Mark all read
              </button>
            )}
          </div>
          <div className="overflow-y-auto">
            {items.length === 0 ? (
              <p className="text-xs text-[var(--color-text-muted)] text-center py-8">You're all caught up 🎉</p>
            ) : (
              items.map(n => {
                const Icon = typeIcon[n.type] || Bell;
                return (
                  <button
                    key={n.id}
                    onClick={() => openItem(n)}
                    className={`w-full text-left px-4 py-3 border-b border-[var(--color-border)]/50 hover:bg-[var(--color-surface-offset)] cursor-pointer flex gap-3 ${n.isRead ? 'opacity-60' : ''}`}
                  >
                    <Icon className="w-4 h-4 mt-0.5 shrink-0 text-[var(--color-primary)]" />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-[var(--color-text)] truncate">{n.title}</p>
                      {n.body && <p className="text-[11px] text-[var(--color-text-muted)] truncate">{n.body}</p>}
                      <p className="text-[10px] text-[var(--color-text-faint)] mt-0.5">{fmtAgo(n.createdAt)}</p>
                    </div>
                    {!n.isRead && <span className="w-2 h-2 rounded-full bg-[var(--color-primary)] mt-1.5 shrink-0" />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};
