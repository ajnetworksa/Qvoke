import React, { useState, useEffect, useRef } from 'react';
import { useERPStore } from '../store';
import ExcelJS from 'exceljs';
import {
  Database, RefreshCw, HardDrive, Download, AlertTriangle,
  Clock, Trash2, CheckCircle, Loader2, FileArchive, Upload, UploadCloud,
  FileSpreadsheet
} from 'lucide-react';

interface BackupFile {
  filename: string;
  size: number;
  createdAt: string;
}

export const DatabaseBackupDB: React.FC = () => {
  const { token } = useERPStore();
  const [backups, setBackups] = useState<BackupFile[]>([]);
  const [actioning, setActioning] = useState<string | null>(null);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 5000);
  };

  const authHeaders = () => ({
    'Authorization': `Bearer ${token}`
  });

  // Full Excel export (all tables in one workbook)
  const handleExportFullExcel = async () => {
    setActioning('excel-export');
    try {
      const res = await fetch('/api/export/full', { headers: authHeaders() });
      if (!res.ok) throw new Error('Export failed');
      const data = await res.json();

      const workbook = new ExcelJS.Workbook();

      const addSheet = (name: string, rows: any[]) => {
        if (!rows.length) return;
        const worksheet = workbook.addWorksheet(name);
        
        const keys = Object.keys(rows[0]);
        worksheet.columns = keys.map(k => ({ header: k, key: k, width: 20 }));
        
        rows.forEach(row => {
          worksheet.addRow(row);
        });
      };

      addSheet('Products', data.products || []);
      addSheet('Customers', data.customers || []);
      addSheet('Suppliers', data.suppliers || []);
      addSheet('Quotations', data.quotations || []);
      addSheet('Invoices', data.invoices || []);

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const date = new Date().toISOString().slice(0, 10);
      a.download = `ERP_Full_Export_${date}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      showToast('Full Excel export downloaded!', 'success');
    } catch (e: any) {
      showToast('Export failed: ' + e.message, 'error');
    } finally {
      setActioning(null);
    }
  };

  // Fetch Backups List
  const fetchBackups = async () => {
    try {
      const res = await fetch('/api/admin/backups', { headers: authHeaders() });
      if (res.ok) setBackups(await res.json());
    } catch (e) {
      console.error('Failed to load backups', e);
    }
  };

  useEffect(() => { fetchBackups(); }, []);

  // Optimize & Compact
  const handleOptimize = async () => {
    setActioning('optimize');
    try {
      const res = await fetch('/api/admin/optimize', { method: 'POST', headers: authHeaders() });
      const data = await res.json();
      if (res.ok) showToast(data.message || 'Database optimized!', 'success');
      else showToast(data.error || 'Optimization failed', 'error');
    } catch {
      showToast('Network failure during optimization.', 'error');
    } finally {
      setActioning(null);
    }
  };

  // Create Snapshot
  const handleCreateBackup = async () => {
    setActioning('backup');
    try {
      const res = await fetch('/api/admin/backup', { method: 'POST', headers: authHeaders() });
      const data = await res.json();
      if (res.ok) {
        showToast(`✅ Snapshot created: ${data.filename}`, 'success');
        fetchBackups();
      } else {
        showToast(data.error || 'Failed to create backup', 'error');
      }
    } catch {
      showToast('Network failure during backup.', 'error');
    } finally {
      setActioning(null);
    }
  };

  // Download a backup file
  const handleDownload = (filename: string) => {
    const link = document.createElement('a');
    link.href = `/api/admin/backup/download/${encodeURIComponent(filename)}`;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Delete a backup file
  const handleDelete = async (filename: string) => {
    if (!window.confirm(`Delete backup "${filename}"? This cannot be undone.`)) return;
    setActioning(`delete-${filename}`);
    try {
      const res = await fetch(`/api/admin/backup/${encodeURIComponent(filename)}`, {
        method: 'DELETE',
        headers: authHeaders()
      });
      const data = await res.json();
      if (res.ok) {
        showToast('Backup deleted.', 'success');
        fetchBackups();
      } else {
        showToast(data.error || 'Delete failed', 'error');
      }
    } catch {
      showToast('Network failure during delete.', 'error');
    } finally {
      setActioning(null);
    }
  };

  // Restore from snapshot
  const handleRestore = async (filename: string) => {
    if (!window.confirm(
      `⚠️ RESTORE WARNING\n\nThis will overwrite ALL current data with backup:\n"${filename}"\n\nThe server will restart. Proceed?`
    )) return;
    setActioning('restore');
    try {
      const res = await fetch('/api/admin/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ filename })
      });
      const data = await res.json();
      if (res.ok) {
        showToast('Restored! Re-authenticating...', 'success');
        setTimeout(() => {
          localStorage.removeItem('erp_token');
          sessionStorage.removeItem('erp_token');
          window.location.reload();
        }, 1200);
      } else {
        showToast(data.error || 'Restore failed', 'error');
      }
    } catch {
      showToast('Restore timeout. Please reload manually.', 'error');
    } finally {
      setActioning(null);
    }
  };

  // Upload .db file to restore
  const handleUploadRestore = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.endsWith('.db')) {
      showToast('Only .db files are accepted.', 'error');
      return;
    }
    if (!window.confirm(
      `⚠️ RESTORE FROM UPLOAD\n\nThis will replace ALL live data with the uploaded file:\n"${file.name}"\n\nThe server will restart immediately. Proceed?`
    )) {
      e.target.value = '';
      return;
    }
    setUploadStatus('uploading');
    try {
      const formData = new FormData();
      formData.append('dbfile', file);
      const res = await fetch('/api/admin/restore/upload', {
        method: 'POST',
        headers: authHeaders(),
        body: formData
      });
      const data = await res.json();
      if (res.ok) {
        setUploadStatus('success');
        showToast('Upload restore successful! Reloading...', 'success');
        setTimeout(() => {
          localStorage.removeItem('erp_token');
          sessionStorage.removeItem('erp_token');
          window.location.reload();
        }, 1500);
      } else {
        setUploadStatus('error');
        showToast(data.error || 'Upload restore failed', 'error');
        setTimeout(() => setUploadStatus('idle'), 5000);
      }
    } catch {
      setUploadStatus('error');
      showToast('Network failure during upload restore.', 'error');
      setTimeout(() => setUploadStatus('idle'), 5000);
    } finally {
      e.target.value = '';
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  return (
    <div className="flex flex-col gap-6 text-left">
      {/* Toast Notification */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 flex items-center gap-2.5 px-4 py-3 rounded-lg shadow-lg text-xs font-bold animate-slide-in border ${
          toast.type === 'success'
            ? 'bg-green-950/90 border-green-500/30 text-green-400'
            : 'bg-red-950/90 border-red-500/30 text-red-400'
        }`}>
          {toast.type === 'success' ? <CheckCircle className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
          {toast.msg}
        </div>
      )}

      {/* Operations Panel */}
      <div className="premium-card p-6">
        <div className="border-b border-[var(--color-divider)]/30 pb-4 mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-[var(--color-text)] flex items-center gap-2">
              <Database className="w-4 h-4 text-[var(--color-primary)]" />
              Database Operations / صيانة قاعدة البيانات
            </h3>
            <p className="text-xs text-[var(--color-text-muted)] mt-1">
              Optimize storage, create encrypted snapshots, and manage historical restore points.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleOptimize}
              disabled={actioning !== null}
              className="bg-[var(--color-surface-offset)] border border-[var(--color-border)] hover:bg-[var(--color-divider)] text-[var(--color-text)] text-xs font-semibold py-2 px-3 rounded-md flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
            >
              {actioning === 'optimize' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <HardDrive className="w-3.5 h-3.5" />}
              VACUUM / Compact
            </button>

            <button
              onClick={handleCreateBackup}
              disabled={actioning !== null}
              className="bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white text-xs font-semibold py-2 px-3.5 rounded-md flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
            >
              {actioning === 'backup' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Clock className="w-3.5 h-3.5" />}
              Take Snapshot
            </button>

            <button
              onClick={handleExportFullExcel}
              disabled={actioning !== null}
              className="bg-green-700 hover:bg-green-800 text-white text-xs font-semibold py-2 px-3.5 rounded-md flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
              title="Export all tables (Products, Customers, Suppliers, Quotations, Invoices) to a single Excel workbook"
            >
              {actioning === 'excel-export' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileSpreadsheet className="w-3.5 h-3.5" />}
              Export Full Excel
            </button>
          </div>
        </div>

        {/* Warning Banner */}
        <div className="bg-amber-500/8 border border-amber-500/20 p-4 rounded-lg flex gap-3 text-xs leading-relaxed text-amber-500 font-semibold mb-6">
          <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div>
            <span className="block font-black mb-0.5">Security Notice — Data Maintenance</span>
            Restore operations completely replace all live records. Always download a current snapshot before restoring. The server will automatically restart after a restore.
          </div>
        </div>

        {/* Upload Restore Section */}
        <div className="border border-[var(--color-border)] border-dashed rounded-xl p-5 bg-[var(--color-surface-offset)]/40 mb-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h4 className="text-xs font-bold text-[var(--color-text)] flex items-center gap-1.5 mb-1">
                <UploadCloud className="w-4 h-4 text-purple-400" />
                Restore from Uploaded File
              </h4>
              <p className="text-[11px] text-[var(--color-text-muted)]">
                Upload a <code className="bg-[var(--color-surface)] px-1 rounded font-mono">.db</code> backup file from your local machine to restore the database.
              </p>
            </div>
            <label className={`flex-shrink-0 flex items-center gap-1.5 text-xs font-bold py-2 px-4 rounded-lg border cursor-pointer transition-colors ${
              uploadStatus === 'uploading'
                ? 'bg-purple-500/10 border-purple-500/30 text-purple-400'
                : uploadStatus === 'success'
                ? 'bg-green-500/10 border-green-500/30 text-green-400'
                : uploadStatus === 'error'
                ? 'bg-red-500/10 border-red-500/30 text-red-400'
                : 'bg-purple-500/10 border-purple-500/30 text-purple-400 hover:bg-purple-500/20'
            }`}>
              <input
                ref={fileInputRef}
                type="file"
                accept=".db"
                className="hidden"
                onChange={handleUploadRestore}
                disabled={uploadStatus === 'uploading'}
              />
              {uploadStatus === 'uploading' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> :
               uploadStatus === 'success' ? <CheckCircle className="w-3.5 h-3.5" /> :
               <Upload className="w-3.5 h-3.5" />}
              {uploadStatus === 'uploading' ? 'Uploading...' :
               uploadStatus === 'success' ? 'Restored!' :
               uploadStatus === 'error' ? 'Failed – Retry' :
               'Choose .db File to Restore'}
            </label>
          </div>
        </div>

        {/* Backup List */}
        <div className="flex items-center justify-between mb-3">
          <span className="text-[10px] font-black uppercase text-[var(--color-text-muted)] tracking-wider">
            Snapshot Repository ({backups.length} snapshots)
          </span>
          <button onClick={fetchBackups} className="p-1.5 hover:bg-[var(--color-surface-offset)] rounded text-[var(--color-text-muted)] transition-colors" title="Refresh list">
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>

        {backups.length === 0 ? (
          <div className="border border-[var(--color-border)] border-dashed rounded-xl p-10 text-center">
            <FileArchive className="w-8 h-8 text-[var(--color-text-faint)] mx-auto mb-2" />
            <p className="text-xs text-[var(--color-text-muted)] italic">No snapshots found. Click "Take Snapshot" to create the first backup.</p>
          </div>
        ) : (
          <div className="border border-[var(--color-border)] rounded-xl overflow-hidden">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="bg-[var(--color-surface-offset)] border-b border-[var(--color-border)] text-[var(--color-text-muted)] font-bold text-[10px] uppercase tracking-wider">
                  <th className="p-3 w-8">#</th>
                  <th className="p-3">File Reference</th>
                  <th className="p-3 w-20">Size</th>
                  <th className="p-3 w-36">Created</th>
                  <th className="p-3 text-right w-36">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)] text-[var(--color-text)]">
                {backups.map((b, idx) => (
                  <tr key={b.filename} className="hover:bg-[var(--color-surface-offset)]/40 transition-colors">
                    <td className="p-3 text-[var(--color-text-faint)] font-mono">{idx + 1}</td>
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <FileArchive className="w-4 h-4 text-purple-400 flex-shrink-0" />
                        <span className="font-mono font-semibold truncate max-w-[220px]">{b.filename}</span>
                      </div>
                    </td>
                    <td className="p-3 font-mono text-[var(--color-text-muted)]">{formatBytes(b.size)}</td>
                    <td className="p-3 text-[var(--color-text-muted)]">
                      {new Date(b.createdAt).toLocaleString('en-SA', { month: 'short', day: 'numeric', year: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="p-3">
                      <div className="flex justify-end gap-1.5">
                        {/* Download */}
                        <button
                          onClick={() => handleDownload(b.filename)}
                          disabled={actioning !== null}
                          title="Download backup"
                          className="p-1.5 bg-[var(--color-primary)]/10 hover:bg-[var(--color-primary)]/20 text-[var(--color-primary)] rounded border border-[var(--color-primary)]/20 transition-colors cursor-pointer disabled:opacity-40"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>

                        {/* Restore */}
                        <button
                          onClick={() => handleRestore(b.filename)}
                          disabled={actioning !== null}
                          title="Restore this snapshot"
                          className="px-2.5 py-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 rounded border border-amber-500/20 flex items-center gap-1 text-[10px] font-bold cursor-pointer disabled:opacity-40 transition-colors"
                        >
                          {actioning === 'restore' ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                          Restore
                        </button>

                        {/* Delete */}
                        <button
                          onClick={() => handleDelete(b.filename)}
                          disabled={actioning !== null}
                          title="Delete this backup"
                          className="p-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded border border-red-500/20 transition-colors cursor-pointer disabled:opacity-40"
                        >
                          {actioning === `delete-${b.filename}` ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default DatabaseBackupDB;
