import React, { useState, useRef } from 'react';
import { Download, Upload, FileSpreadsheet, CheckCircle, AlertTriangle, Loader2, X } from 'lucide-react';
import ExcelJS from 'exceljs';

interface Column {
  key: string;
  label: string;
}

interface ImportResult {
  inserted: number;
  updated: number;
  errors: number;
}

interface Props {
  title: string;
  entityType: 'products' | 'customers' | 'suppliers';
  columns: Column[];
  templateSample?: Record<string, any>[];
  token: string | null;
  onImportDone?: () => void;
}

export const ExcelImportExport: React.FC<Props> = ({
  title, entityType, columns, templateSample, token, onImportDone
}) => {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'export' | 'import'>('export');
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // ── EXPORT ──────────────────────────────────────────────────────────────────
  const handleExport = async () => {
    try {
      const res = await fetch(`/api/export/${entityType}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Export failed');
      const data = await res.json();

      const workbook = new ExcelJS.Workbook();
      const ws = workbook.addWorksheet(title);

      ws.columns = columns.map(c => ({ header: c.label, key: c.key, width: 22 }));

      data.forEach((row: any) => {
        const rowData: any = {};
        columns.forEach(c => {
          rowData[c.key] = row[c.key] ?? '';
        });
        ws.addRow(rowData);
      });

      // Style header row (bold)
      ws.getRow(1).eachCell((cell) => {
        cell.font = { bold: true };
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FF01696F' }
        };
        cell.alignment = { horizontal: 'center' };
      });

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${entityType}_export_${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (e: any) {
      alert('Export failed: ' + e.message);
    }
  };

  // ── DOWNLOAD TEMPLATE ───────────────────────────────────────────────────────
  const handleDownloadTemplate = async () => {
    const sample = templateSample || [Object.fromEntries(columns.map(c => [c.key, '']))];
    const workbook = new ExcelJS.Workbook();
    const ws = workbook.addWorksheet(`${entityType}_template`);
    ws.columns = columns.map(c => ({ header: c.label, key: c.key, width: 22 }));
    sample.forEach(row => ws.addRow(row));

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${entityType}_import_template.xlsx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  // ── IMPORT ──────────────────────────────────────────────────────────────────
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setImportResult(null);
    setImportError(null);

    try {
      const buf = await file.arrayBuffer();
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buf);
      const ws = workbook.worksheets[0];

      if (!ws || ws.rowCount < 2) {
        setImportError('The file appears to be empty or has no data rows.');
        setImporting(false);
        return;
      }

      // Map header row to column keys
      const headerRow = ws.getRow(1);
      const header: string[] = [];
      headerRow.eachCell((cell, colNumber) => {
        header[colNumber] = String(cell.value).trim();
      });

      const colKeyByColNumber: Record<number, string> = {};
      columns.forEach(c => {
        const idx = header.findIndex(h => h && (h.toLowerCase() === c.label.toLowerCase() || h.toLowerCase() === c.key.toLowerCase()));
        if (idx > 0) colKeyByColNumber[idx] = c.key;
      });

      const rows: any[] = [];
      ws.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return; // skip header
        const obj: Record<string, any> = {};
        Object.entries(colKeyByColNumber).forEach(([colStr, key]) => {
          const cellVal = row.getCell(Number(colStr)).value;
          obj[key] = cellVal !== null && cellVal !== undefined ? cellVal : '';
        });
        if (Object.values(obj).some(v => v !== '' && v != null)) {
          rows.push(obj);
        }
      });

      if (rows.length === 0) {
        setImportError('No valid data rows found in the file.');
        setImporting(false);
        return;
      }

      const res = await fetch(`/api/import/${entityType}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ rows })
      });
      const result = await res.json();
      if (res.ok) {
        setImportResult(result);
        onImportDone?.();
      } else {
        setImportError(result.error || 'Import failed');
      }
    } catch (err: any) {
      setImportError('Failed to parse file: ' + err.message);
    } finally {
      setImporting(false);
      e.target.value = '';
    }
  };

  return (
    <>
      {/* Trigger Button */}
      <button
        onClick={() => setOpen(true)}
        className="bg-[var(--color-surface-offset)] border border-[var(--color-border)] hover:bg-[var(--color-divider)] text-[var(--color-text)] text-xs font-semibold py-2 px-3 rounded-md flex items-center gap-1.5 transition-colors cursor-pointer"
        title={`Import / Export ${title}`}
      >
        <FileSpreadsheet className="w-3.5 h-3.5 text-green-500" />
        Excel
      </button>

      {/* Modal */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="relative w-full max-w-md bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl shadow-2xl overflow-hidden animate-slide-in">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--color-border)]">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-green-500" />
                <h3 className="text-sm font-bold text-[var(--color-text)]">Excel — {title}</h3>
              </div>
              <button onClick={() => setOpen(false)} className="p-1 hover:bg-[var(--color-surface-offset)] rounded transition-colors">
                <X className="w-4 h-4 text-[var(--color-text-muted)]" />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-[var(--color-border)]">
              {(['export', 'import'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => { setActiveTab(tab); setImportResult(null); setImportError(null); }}
                  className={`flex-1 py-2.5 text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer ${
                    activeTab === tab
                      ? 'bg-[var(--color-primary)]/10 text-[var(--color-primary)] border-b-2 border-[var(--color-primary)]'
                      : 'text-[var(--color-text-muted)] hover:bg-[var(--color-surface-offset)]'
                  }`}
                >
                  {tab === 'export' ? 'Export Data' : 'Import Data'}
                </button>
              ))}
            </div>

            {/* Content */}
            <div className="p-5 flex flex-col gap-4">
              {activeTab === 'export' ? (
                <>
                  <p className="text-xs text-[var(--color-text-muted)] leading-relaxed">
                    Export all <strong className="text-[var(--color-text)]">{title}</strong> records to an Excel (.xlsx) file for offline editing, backup, or sharing.
                  </p>
                  <div className="text-[11px] text-[var(--color-text-muted)] bg-[var(--color-surface-offset)] rounded-lg p-3">
                    <span className="block font-bold text-[var(--color-text)] mb-1">Exported Columns:</span>
                    <span>{columns.map(c => c.label).join(' · ')}</span>
                  </div>
                  <button
                    onClick={handleExport}
                    className="w-full bg-green-600 hover:bg-green-700 text-white text-xs font-bold py-2.5 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    Download {title} Excel File
                  </button>
                </>
              ) : (
                <>
                  <p className="text-xs text-[var(--color-text-muted)] leading-relaxed">
                    Import records from an Excel (.xlsx) file. Existing records (matched by ID) will be updated; new ones will be inserted.
                  </p>

                  {/* Template download */}
                  <button
                    onClick={handleDownloadTemplate}
                    className="w-full bg-[var(--color-surface-offset)] border border-[var(--color-border)] hover:bg-[var(--color-divider)] text-[var(--color-text)] text-xs font-semibold py-2 px-3 rounded-lg flex items-center justify-center gap-2 transition-colors cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Download Import Template
                  </button>

                  {/* Import result */}
                  {importResult && (
                    <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3 text-xs text-green-500 font-semibold">
                      <CheckCircle className="w-4 h-4 inline mr-1.5" />
                      Import complete — <strong>{importResult.inserted}</strong> inserted · <strong>{importResult.updated || 0}</strong> updated · <strong>{importResult.errors}</strong> skipped
                    </div>
                  )}
                  {importError && (
                    <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-xs text-red-500 font-semibold">
                      <AlertTriangle className="w-4 h-4 inline mr-1.5" />
                      {importError}
                    </div>
                  )}

                  {/* Upload button */}
                  <label className={`w-full flex items-center justify-center gap-2 text-xs font-bold py-2.5 px-4 rounded-lg border cursor-pointer transition-colors ${
                    importing
                      ? 'bg-[var(--color-primary)]/10 border-[var(--color-primary)]/30 text-[var(--color-primary)]'
                      : 'bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white border-transparent'
                  }`}>
                    <input
                      ref={fileRef}
                      type="file"
                      accept=".xlsx,.xls,.csv"
                      className="hidden"
                      onChange={handleFileChange}
                      disabled={importing}
                    />
                    {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                    {importing ? 'Importing...' : 'Choose Excel File to Import'}
                  </label>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ExcelImportExport;
