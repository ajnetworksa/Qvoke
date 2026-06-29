import React, { useState, useEffect } from 'react';
import { useERPStore } from '../store';
import { DocumentActivity } from '../types';
import { History, Plus, Pencil, ArrowRightLeft, Trash2, Loader2, ChevronRight } from 'lucide-react';

interface Props {
  docType: 'quotation' | 'invoice' | 'boq' | 'bom';
  docId: string;
}

const actionMeta: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  created: { label: 'Created', icon: Plus, color: 'text-green-400' },
  updated: { label: 'Updated', icon: Pencil, color: 'text-blue-400' },
  status_changed: { label: 'Status changed', icon: ArrowRightLeft, color: 'text-amber-400' },
  deleted: { label: 'Deleted', icon: Trash2, color: 'text-red-400' },
};

const fmtTime = (iso: string) => {
  try {
    return new Date(iso).toLocaleString(undefined, {
      year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return iso;
  }
};

/**
 * Per-document audit trail. Renders nothing if the current user lacks the
 * `canViewHistory` permission (admins always see it).
 */
export const DocumentTimeline: React.FC<Props> = ({ docType, docId }) => {
  const { token, currentUser } = useERPStore();
  const canView = currentUser?.role === 'admin' || !!currentUser?.permissions?.canViewHistory;

  const [logs, setLogs] = useState<DocumentActivity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!canView || !docId || docId === 'new') {
      setLoading(false);
      return;
    }
    let active = true;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/activity/${docType}/${docId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok && active) setLogs(await res.json());
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [docType, docId, token, canView]);

  if (!canView) return null;

  return (
    <div className="premium-card p-5">
      <h4 className="text-xs font-black uppercase text-[var(--color-text-muted)] tracking-wider flex items-center gap-2 mb-4">
        <History className="w-3.5 h-3.5" /> Activity & History
      </h4>

      {loading ? (
        <div className="flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading history…
        </div>
      ) : logs.length === 0 ? (
        <p className="text-xs text-[var(--color-text-muted)]">No activity recorded yet.</p>
      ) : (
        <ol className="relative border-l border-[var(--color-border)] ml-1.5 space-y-4">
          {logs.slice().reverse().map((log) => {
            const meta = actionMeta[log.action] || actionMeta.updated;
            const Icon = meta.icon;
            return (
              <li key={log.id} className="ml-4">
                <span className="absolute -left-[7px] flex h-3.5 w-3.5 items-center justify-center rounded-full bg-[var(--color-surface)] ring-2 ring-[var(--color-border)]">
                  <Icon className={`w-2.5 h-2.5 ${meta.color}`} />
                </span>
                <div className="flex items-center justify-between gap-2">
                  <span className={`text-xs font-bold ${meta.color}`}>{meta.label}</span>
                  <time className="text-[10px] text-[var(--color-text-muted)] font-mono">{fmtTime(log.timestamp)}</time>
                </div>
                <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5">
                  by <span className="font-semibold text-[var(--color-text)]">{log.actorName || 'Unknown'}</span>
                </p>
                {log.changes && log.changes.length > 0 && (
                  <ul className="mt-1.5 space-y-1">
                    {log.changes.map((c, i) => (
                      <li key={i} className="text-[11px] flex items-start gap-1.5 text-[var(--color-text-muted)]">
                        <span className="font-semibold text-[var(--color-text)] shrink-0">{c.field}:</span>
                        <span className="line-through opacity-60">{c.from}</span>
                        <ChevronRight className="w-3 h-3 shrink-0 mt-0.5" />
                        <span className="text-[var(--color-text)]">{c.to}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
};
