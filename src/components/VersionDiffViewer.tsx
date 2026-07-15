import React, { useState, useEffect } from 'react';
import { useERPStore } from '../store';
import { History, Loader2, RotateCcw, AlertTriangle, FileText, X } from 'lucide-react';

interface Snapshot {
  id: string;
  docType: string;
  docId: string;
  version: number;
  actorName: string;
  createdAt: string;
}

interface Props {
  docType: 'quotation' | 'invoice' | 'boq' | 'bom';
  docId: string;
  onClose: () => void;
  onRestored: () => void;
}

export const VersionDiffViewer: React.FC<Props> = ({ docType, docId, onClose, onRestored }) => {
  const { token, currentUser } = useERPStore();
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [viewingJson, setViewingJson] = useState<string | null>(null);

  const canRestore = currentUser?.role === 'admin' || !!currentUser?.permissions?.canManageSettings;

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch(`/api/snapshots/${docType}/${docId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!res.ok) throw new Error('Failed to load snapshots');
        const data = await res.json();
        if (active) setSnapshots(data);
      } catch (err: any) {
        if (active) setError(err.message);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [docType, docId, token]);

  const handleRestore = async (snapshotId: string) => {
    if (!window.confirm('Are you sure you want to restore this version? The current version will be saved as a new snapshot.')) return;
    setRestoringId(snapshotId);
    setError(null);
    try {
      const res = await fetch(`/api/restore/${docType}/${docId}/${snapshotId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to restore');
      }
      onRestored();
    } catch (err: any) {
      setError(err.message);
      setRestoringId(null);
    }
  };

  const loadSnapshotJson = async (snapshotId: string) => {
    try {
      const res = await fetch(`/api/snapshots/${docType}/${docId}/${snapshotId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to load snapshot data');
      const data = await res.json();
      setViewingJson(JSON.stringify(data, null, 2));
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-[var(--color-border)]">
          <h2 className="text-sm font-bold flex items-center gap-2">
            <History className="w-4 h-4 text-primary" /> Document Versions
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-[var(--color-surface-hover)] rounded text-[var(--color-text-muted)] transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 overflow-y-auto flex-1">
          {error && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded flex gap-2 items-center">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-10 text-xs text-[var(--color-text-muted)] gap-2">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading versions...
            </div>
          ) : snapshots.length === 0 ? (
            <div className="text-center py-10 text-[var(--color-text-muted)] text-sm">
              No previous versions found for this document.
            </div>
          ) : viewingJson ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[var(--color-text-muted)]">Raw Snapshot Data</span>
                <button 
                  onClick={() => setViewingJson(null)}
                  className="text-xs bg-[var(--color-surface-hover)] px-3 py-1 rounded hover:bg-[var(--color-border)] transition-colors"
                >
                  Back to List
                </button>
              </div>
              <pre className="text-[10px] text-[var(--color-text-muted)] bg-black/20 p-4 rounded-lg overflow-x-auto font-mono">
                {viewingJson}
              </pre>
            </div>
          ) : (
            <div className="space-y-3">
              {snapshots.map((snap, idx) => (
                <div key={snap.id} className="flex items-center justify-between p-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-hover)]/30 hover:bg-[var(--color-surface-hover)] transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="bg-primary/10 text-primary w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs">
                      v{snap.version}
                    </div>
                    <div>
                      <div className="text-xs font-semibold">
                        {new Date(snap.createdAt).toLocaleString()}
                        {idx === 0 && <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded-full bg-blue-500/10 text-blue-400">Latest</span>}
                      </div>
                      <div className="text-[11px] text-[var(--color-text-muted)] mt-0.5">
                        Saved by {snap.actorName || 'System'}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => loadSnapshotJson(snap.id)}
                      className="p-1.5 text-[var(--color-text-muted)] hover:text-blue-400 hover:bg-blue-400/10 rounded transition-colors"
                      title="View raw data"
                    >
                      <FileText className="w-4 h-4" />
                    </button>
                    {canRestore && (
                      <button
                        onClick={() => handleRestore(snap.id)}
                        disabled={restoringId !== null}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-amber-500 hover:text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 rounded transition-colors disabled:opacity-50"
                      >
                        {restoringId === snap.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
                        Restore
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
