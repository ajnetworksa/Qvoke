import React, { useMemo, useState } from 'react';
import { useERPStore } from '../store';
import { PageHeader } from '../components/PageHeader';
import { StatusBadge } from '../components/StatusBadge';
import { EmptyState } from '../components/EmptyState';
import { matchSearchQuery } from '../utils/search';
import { Quotation, Invoice } from '../types';
import {
  Radar,
  Search,
  CalendarClock,
  X,
  Bell,
  CheckCircle2,
  FileCheck2,
  Ban,
  StickyNote,
  Pencil,
  FileText,
  FileSpreadsheet
} from 'lucide-react';
import ExcelJS from 'exceljs';

type DocType = 'quotation' | 'invoice';
type FollowFilter = 'all' | 'has' | 'due' | 'overdue' | 'none';

const startOfToday = () => new Date(new Date().toDateString());

const QUOTE_STATUSES = ['all', 'draft', 'sent', 'confirmed', 'expired', 'cancelled'];
const INVOICE_STATUSES = ['all', 'draft', 'posted', 'partial', 'paid', 'overdue', 'cancelled'];

// Bulk status changes are limited to manual transitions (no payment-derived states).
const QUOTE_BULK: { label: string; status: Quotation['status']; icon: React.ElementType; cls: string }[] = [
  { label: 'Mark Sent', status: 'sent', icon: CheckCircle2, cls: 'text-blue-600' },
  { label: 'Confirm', status: 'confirmed', icon: FileCheck2, cls: 'text-emerald-600' },
  { label: 'Cancel', status: 'cancelled', icon: Ban, cls: 'text-[var(--color-error)]' }
];
const INVOICE_BULK: { label: string; status: Invoice['status']; icon: React.ElementType; cls: string }[] = [
  { label: 'Post', status: 'posted', icon: CheckCircle2, cls: 'text-emerald-600' },
  { label: 'Cancel', status: 'cancelled', icon: Ban, cls: 'text-[var(--color-error)]' }
];

export const Tracking: React.FC = () => {
  const {
    quotations, invoices, customers, setRoute,
    updateQuotation, updateInvoice, setFollowUp
  } = useERPStore();

  const [docType, setDocType] = useState<DocType>('quotation');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [followFilter, setFollowFilter] = useState<FollowFilter>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selected, setSelected] = useState<string[]>([]);

  // Follow-up editor state (single + bulk share the same modal).
  const [editTarget, setEditTarget] = useState<{ id: string; bulk?: boolean } | null>(null);
  const [fuDate, setFuDate] = useState('');
  const [fuNote, setFuNote] = useState('');

  const docs = docType === 'quotation' ? quotations : invoices;
  const statuses = docType === 'quotation' ? QUOTE_STATUSES : INVOICE_STATUSES;
  const bulkActions = docType === 'quotation' ? QUOTE_BULK : INVOICE_BULK;

  const getCustomerName = (id: string) => customers.find((c) => c.id === id)?.companyName || 'Unknown Customer';

  const classifyFollow = (d: Quotation | Invoice): Exclude<FollowFilter, 'all'> => {
    if (!d.followUpDate) return 'none';
    const fu = new Date(String(d.followUpDate));
    if (isNaN(fu.getTime())) return 'has';
    if (fu < startOfToday()) return 'overdue';
    if (fu.getTime() === startOfToday().getTime()) return 'due';
    return 'has';
  };

  const filtered = useMemo(() => {
    const from = dateFrom ? new Date(dateFrom) : null;
    const to = dateTo ? new Date(new Date(dateTo).getTime() + 86399999) : null;
    return (docs as (Quotation | Invoice)[]).filter((d) => {
      const cust = customers.find((c) => c.id === d.customerId);
      if (!matchSearchQuery(search, [d.number, (d as any).subject, cust?.companyName, d.notes, d.followUpNote || ''])) return false;
      if (statusFilter !== 'all' && d.status !== statusFilter) return false;
      const dt = new Date(d.date);
      if (from && dt < from) return false;
      if (to && dt > to) return false;
      if (followFilter !== 'all') {
        const cls = classifyFollow(d);
        if (followFilter === 'has' && cls === 'none') return false;
        if (followFilter === 'due' && cls !== 'due') return false;
        if (followFilter === 'overdue' && cls !== 'overdue') return false;
        if (followFilter === 'none' && cls !== 'none') return false;
      }
      return true;
    });
  }, [docs, customers, search, statusFilter, followFilter, dateFrom, dateTo]);

  const overdueCount = useMemo(
    () => (docs as (Quotation | Invoice)[]).filter((d) => classifyFollow(d) === 'overdue').length,
    [docs]
  );

  const switchType = (t: DocType) => { setDocType(t); setSelected([]); setStatusFilter('all'); };

  const toggleAll = (e: React.ChangeEvent<HTMLInputElement>) =>
    setSelected(e.target.checked ? filtered.map((d) => d.id) : []);
  const toggleOne = (id: string, checked: boolean) =>
    setSelected((s) => (checked ? [...s, id] : s.filter((x) => x !== id)));

  const applyBulkStatus = (status: string) => {
    selected.forEach((id) => {
      if (docType === 'quotation') {
        const q = quotations.find((x) => x.id === id);
        if (q) updateQuotation({ ...q, status: status as Quotation['status'], updatedAt: new Date() });
      } else {
        const inv = invoices.find((x) => x.id === id);
        if (inv) updateInvoice({ ...inv, status: status as Invoice['status'], updatedAt: new Date() });
      }
    });
    setSelected([]);
  };

  const openEdit = (d: Quotation | Invoice) => {
    setEditTarget({ id: d.id });
    setFuDate(d.followUpDate ? String(d.followUpDate).slice(0, 10) : '');
    setFuNote(d.followUpNote || '');
  };
  const openBulkEdit = () => { setEditTarget({ id: '', bulk: true }); setFuDate(''); setFuNote(''); };

  const saveFollow = async () => {
    if (!editTarget) return;
    const ids = editTarget.bulk ? selected : [editTarget.id];
    await Promise.all(ids.map((id) => setFollowUp(docType, id, fuDate || null, fuNote || null)));
    setEditTarget(null);
    if (editTarget.bulk) setSelected([]);
  };

  const handleDownloadSelectedPdfs = async () => {
    if (selected.length === 0) return;
    const isOk = confirm(`Are you sure you want to download ${selected.length} PDF files? This may take a moment.`);
    if (!isOk) return;

    for (const id of selected) {
      try {
        const item = docs.find((d) => d.id === id);
        if (!item) continue;
        
        const res = await fetch('/api/pdf/generate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${useERPStore.getState().token}`
          },
          body: JSON.stringify({ documentData: item, type: docType })
        });

        if (!res.ok) continue;

        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${item.number}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
        
        // Small delay to prevent browser from blocking multiple downloads
        await new Promise(r => setTimeout(r, 600));
      } catch (e) {
        console.error(`Failed to download PDF for ${id}:`, e);
      }
    }
  };

  const handleDownloadSelectedExcels = async () => {
    if (selected.length === 0) return;
    const isOk = confirm(`Are you sure you want to download ${selected.length} Excel files? This may take a moment.`);
    if (!isOk) return;

    for (const id of selected) {
      try {
        const item = docs.find((d) => d.id === id);
        if (!item) continue;
        const custName = getCustomerName(item.customerId);
        
        const quoteInfo = [
          [],
          [(docType === 'quotation' ? 'QUOTATION' : 'INVOICE')],
          ['Document #:', item.number],
          ['Date:', new Date(item.date).toLocaleDateString()],
          ['Customer:', custName],
          ['Subject:', (item as any).subject || ''],
          []
        ];

        let baseTotal = 0;
        const itemsData = [
          ['ITEM', 'DESCRIPTION', 'QTY', 'UNIT', 'UNIT PRICE', 'DISCOUNT %', 'NET PRICE'],
          ...item.lineItems.filter(li => li.type !== 'note').map((li, index) => {
            const netPrice = li.quantity * li.unitPrice * (1 - (li.discountPercent || 0) / 100);
            baseTotal += netPrice;
            return [
              index + 1,
              li.description,
              li.quantity,
              li.unit,
              li.unitPrice,
              li.discountPercent || 0,
              netPrice
            ];
          }),
          ['', '', '', '', 'SUBTOTAL', item.subtotal],
          ['', '', '', '', 'DISCOUNT', item.discountTotal || 0],
          ['', '', '', '', 'VAT', item.taxTotal || 0],
          ['', '', '', '', 'TOTAL PACKAGE', item.total],
          [''],
          ['TERMS & NOTES', item.notes || '']
        ];

        const workbook = new ExcelJS.Workbook();
        const ws = workbook.addWorksheet('Document');

        ws.columns = [
          { key: 'A', width: 6 },
          { key: 'B', width: 45 },
          { key: 'C', width: 10 },
          { key: 'D', width: 10 },
          { key: 'E', width: 15 },
          { key: 'F', width: 12 },
          { key: 'G', width: 15 },
        ];

        const allData = [...quoteInfo, ...itemsData];
        allData.forEach(rowData => ws.addRow(rowData));

        ws.mergeCells('A2:D2');
        ws.getCell('A2').font = { size: 16, bold: true, color: { argb: 'FF1E3A8A' } };

        const startRow = 8;
        const headerRow = ws.getRow(startRow);
        for (let c = 1; c <= 7; c++) {
          headerRow.getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF166534' } };
          headerRow.getCell(c).font = { name: 'Arial', size: 10, color: { argb: 'FFFFFFFF' }, bold: true };
          headerRow.getCell(c).border = { top: { style: 'medium' }, bottom: { style: 'medium' }, left: { style: 'thin' }, right: { style: 'thin' } };
          headerRow.getCell(c).alignment = { horizontal: 'center', vertical: 'middle' };
        }

        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${custName.replace(/[^a-zA-Z0-9_\-.\s]/g, '').trim()}-${item.number}.xlsx`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        await new Promise(r => setTimeout(r, 600));
      } catch (e) {
        console.error(`Failed to download Excel for ${id}:`, e);
      }
    }
  };

  const handleDownloadMergedExcel = async () => {
    if (selected.length === 0) return;

    try {
      const workbook = new ExcelJS.Workbook();

      // 1. Summary Index Sheet
      const indexWs = workbook.addWorksheet('Summary Index');
      indexWs.columns = [
        { key: 'A', width: 6 },
        { key: 'B', width: 18 },
        { key: 'C', width: 14 },
        { key: 'D', width: 30 },
        { key: 'E', width: 14 },
        { key: 'F', width: 35 },
        { key: 'G', width: 14 },
        { key: 'H', width: 14 },
        { key: 'I', width: 14 },
        { key: 'J', width: 16 },
      ];

      indexWs.addRow([]);
      indexWs.addRow(['', 'MERGED DOCUMENT REPORT']);
      indexWs.mergeCells('B2:J2');
      indexWs.getCell('B2').font = { size: 16, bold: true, color: { argb: 'FF1E3A8A' } };

      indexWs.addRow([]);

      const headerRow = indexWs.addRow(['#', 'DOCUMENT #', 'TYPE', 'CUSTOMER', 'DATE', 'SUBJECT', 'STATUS', 'SUBTOTAL', 'VAT', 'TOTAL']);
      for (let c = 1; c <= 10; c++) {
        const cell = headerRow.getCell(c);
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A8A' } };
        cell.font = { name: 'Arial', size: 10, color: { argb: 'FFFFFFFF' }, bold: true };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      }

      let masterSubtotal = 0;
      let masterVat = 0;
      let masterTotal = 0;

      selected.forEach((id, idx) => {
        const item = docs.find((d) => d.id === id);
        if (!item) return;
        const custName = getCustomerName(item.customerId);
        masterSubtotal += item.subtotal || 0;
        masterVat += item.taxTotal || 0;
        masterTotal += item.total || 0;

        const row = indexWs.addRow([
          idx + 1,
          item.number,
          docType.toUpperCase(),
          custName,
          new Date(item.date).toLocaleDateString(),
          (item as any).subject || '',
          item.status.toUpperCase(),
          item.subtotal || 0,
          item.taxTotal || 0,
          item.total || 0
        ]);

        const bgColor = idx % 2 === 0 ? 'FFF8FAFC' : 'FFFFFFFF';
        for (let c = 1; c <= 10; c++) {
          row.getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
          row.getCell(c).border = { left: { style: 'thin' }, right: { style: 'thin' }, bottom: { style: 'thin' }, top: { style: 'thin' } };
        }
      });

      // Add Master Totals Row
      const totalRow = indexWs.addRow(['', 'TOTALS', '', '', '', '', '', masterSubtotal, masterVat, masterTotal]);
      for (let c = 1; c <= 10; c++) {
        const cell = totalRow.getCell(c);
        cell.font = { bold: true };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
        cell.border = { top: { style: 'medium' }, bottom: { style: 'double' } };
      }

      // 2. Individual Worksheets for each document
      selected.forEach((id) => {
        const item = docs.find((d) => d.id === id);
        if (!item) return;
        const custName = getCustomerName(item.customerId);
        const sheetName = item.number.replace(/[^a-zA-Z0-9_\-]/g, '_').substring(0, 31);
        const ws = workbook.addWorksheet(sheetName);

        ws.columns = [
          { key: 'A', width: 6 },
          { key: 'B', width: 45 },
          { key: 'C', width: 10 },
          { key: 'D', width: 10 },
          { key: 'E', width: 15 },
          { key: 'F', width: 12 },
          { key: 'G', width: 15 },
        ];

        const quoteInfo = [
          [],
          [(docType === 'quotation' ? 'QUOTATION' : 'INVOICE')],
          ['Document #:', item.number],
          ['Date:', new Date(item.date).toLocaleDateString()],
          ['Customer:', custName],
          ['Subject:', (item as any).subject || ''],
          []
        ];

        const itemsData = [
          ['ITEM', 'DESCRIPTION', 'QTY', 'UNIT', 'UNIT PRICE', 'DISCOUNT %', 'NET PRICE'],
          ...item.lineItems.filter(li => li.type !== 'note').map((li, index) => {
            const netPrice = li.quantity * li.unitPrice * (1 - (li.discountPercent || 0) / 100);
            return [
              index + 1,
              li.description,
              li.quantity,
              li.unit,
              li.unitPrice,
              li.discountPercent || 0,
              netPrice
            ];
          }),
          ['', '', '', '', 'SUBTOTAL', item.subtotal],
          ['', '', '', '', 'DISCOUNT', item.discountTotal || 0],
          ['', '', '', '', 'VAT', item.taxTotal || 0],
          ['', '', '', '', 'TOTAL PACKAGE', item.total],
          [''],
          ['TERMS & NOTES', item.notes || '']
        ];

        [...quoteInfo, ...itemsData].forEach(rowData => ws.addRow(rowData));

        ws.mergeCells('A2:D2');
        ws.getCell('A2').font = { size: 16, bold: true, color: { argb: 'FF1E3A8A' } };

        const startRow = 8;
        const hRow = ws.getRow(startRow);
        for (let c = 1; c <= 7; c++) {
          hRow.getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF166534' } };
          hRow.getCell(c).font = { name: 'Arial', size: 10, color: { argb: 'FFFFFFFF' }, bold: true };
          hRow.getCell(c).border = { top: { style: 'medium' }, bottom: { style: 'medium' }, left: { style: 'thin' }, right: { style: 'thin' } };
          hRow.getCell(c).alignment = { horizontal: 'center', vertical: 'middle' };
        }
      });

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Merged_${docType === 'quotation' ? 'Quotations' : 'Invoices'}_${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('Failed to export merged Excel:', e);
      alert('Failed to generate merged Excel file.');
    }
  };

  const fmt = (d: Date | string) => new Date(d).toLocaleDateString('en-US', { year: '2-digit', month: 'short', day: 'numeric' });
  const allSelected = filtered.length > 0 && selected.length === filtered.length;

  return (
    <div className="animate-fade-in text-left">
      <PageHeader
        title="Tracking & Follow-ups / المتابعة"
        breadcrumbs={[{ label: 'Home' }, { label: 'Tracking' }]}
        actions={
          overdueCount > 0 ? (
            <span className="flex items-center gap-1.5 text-xs font-bold text-[var(--color-error)] bg-[var(--color-error)]/10 border border-[var(--color-error)]/20 px-3 py-1.5 rounded-full">
              <Bell className="w-3.5 h-3.5" /> {overdueCount} follow-up{overdueCount > 1 ? 's' : ''} overdue
            </span>
          ) : null
        }
      />

      {/* Doc-type toggle */}
      <div className="flex bg-[var(--color-surface-offset)] border border-[var(--color-border)] rounded-md p-0.5 w-fit mb-4">
        {(['quotation', 'invoice'] as DocType[]).map((t) => (
          <button
            key={t}
            onClick={() => switchType(t)}
            className={`px-4 py-1.5 rounded text-xs font-bold transition-colors cursor-pointer ${
              docType === t ? 'bg-[var(--color-surface)] text-[var(--color-primary)] shadow-sm' : 'text-[var(--color-text-muted)]'
            }`}
          >
            {t === 'quotation' ? 'Quotations' : 'Invoices'}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="premium-card p-4 mb-6 flex flex-col gap-3">
        <div className="flex flex-col lg:flex-row lg:items-center gap-3">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-muted)] pointer-events-none" />
            <input
              type="text"
              placeholder="Search number, customer, subject, follow-up note…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full premium-input pl-10 pr-4 py-2"
            />
          </div>
          <div className="flex items-center gap-2 text-xs">
            <label className="text-[var(--color-text-muted)] font-semibold">From</label>
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="premium-input py-1.5" />
            <label className="text-[var(--color-text-muted)] font-semibold">To</label>
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="premium-input py-1.5" />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex gap-1.5 flex-wrap">
            {statuses.map((st) => (
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
          <div className="flex items-center gap-1.5 ml-auto">
            <CalendarClock className="w-3.5 h-3.5 text-[var(--color-text-muted)]" />
            <select
              value={followFilter}
              onChange={(e) => setFollowFilter(e.target.value as FollowFilter)}
              className="premium-input py-1.5 text-xs"
            >
              <option value="all">All follow-ups</option>
              <option value="has">Has follow-up</option>
              <option value="due">Due today</option>
              <option value="overdue">Overdue</option>
              <option value="none">No follow-up</option>
            </select>
          </div>
        </div>
      </div>

      {/* Bulk action bar */}
      {selected.length > 0 && (
        <div className="bg-[var(--color-primary-highlight)]/40 border border-[var(--color-primary)]/20 px-4 py-3 rounded-lg flex items-center justify-between mb-6 animate-slide-in flex-wrap gap-2">
          <span className="text-xs font-bold text-[var(--color-primary)]">{selected.length} selected</span>
          <div className="flex items-center gap-2 flex-wrap">
            {bulkActions.map((a) => {
              const Icon = a.icon;
              return (
                <button
                  key={a.status}
                  onClick={() => applyBulkStatus(a.status)}
                  className="bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-[11px] font-semibold py-1.5 px-3 rounded flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <Icon className={`w-3.5 h-3.5 ${a.cls}`} /> <span className="whitespace-nowrap">{a.label}</span>
                </button>
              );
            })}
            <button
              onClick={openBulkEdit}
              className="bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-[11px] font-semibold py-1.5 px-3 rounded flex items-center gap-1 transition-colors cursor-pointer"
            >
              <CalendarClock className="w-3.5 h-3.5 text-[var(--color-primary)]" /> <span className="whitespace-nowrap">Set Follow-up</span>
            </button>
            <div className="w-px h-6 bg-[var(--color-divider)] mx-1" />
            <button
              onClick={handleDownloadSelectedPdfs}
              className="bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-[11px] font-semibold py-1.5 px-3 rounded flex items-center gap-1 transition-colors cursor-pointer"
            >
              <FileText className="w-3.5 h-3.5 text-red-500" /> <span className="whitespace-nowrap">Export PDFs</span>
            </button>
            <button
              onClick={handleDownloadSelectedExcels}
              className="bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-[11px] font-semibold py-1.5 px-3 rounded flex items-center gap-1 transition-colors cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-green-600" /> <span className="whitespace-nowrap">Export Excels</span>
            </button>
            <button
              onClick={handleDownloadMergedExcel}
              className="bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-[11px] font-semibold py-1.5 px-3 rounded flex items-center gap-1 transition-colors cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-500" /> <span className="whitespace-nowrap">Merge Excel</span>
            </button>
            {editTarget?.bulk && (
              <button
                onClick={() => handleBulkDelete()}
                className="bg-red-50 dark:bg-red-900/30 hover:bg-red-100 dark:hover:bg-red-900/50 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-[11px] font-semibold py-1.5 px-3 rounded flex items-center gap-1 transition-colors cursor-pointer ml-auto"
              >
                <Trash2 className="w-3.5 h-3.5" /> <span className="whitespace-nowrap">Delete Selected</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Table */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={Radar}
          title="Nothing to track here"
          description="Adjust the filters, or add follow-up dates to documents to keep tabs on pending work and reminders."
        />
      ) : (
        <div className="premium-card overflow-hidden">
          <div className="overflow-x-auto w-full">
            <table className="w-full text-sm border-collapse text-left">
              <thead>
                <tr className="bg-[var(--color-surface-offset)] border-b border-[var(--color-border)] text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">
                  <th className="py-3 px-4 w-4">
                    <input type="checkbox" onChange={toggleAll} checked={allSelected} className="rounded accent-[var(--color-primary)] cursor-pointer" />
                  </th>
                  <th className="py-3 px-4">{docType === 'quotation' ? 'Quote' : 'Invoice'}</th>
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4 text-right">Total</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4">Follow-up</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-divider)]">
                {filtered.map((d) => {
                  const cls = classifyFollow(d);
                  const isChecked = selected.includes(d.id);
                  return (
                    <tr key={d.id} className={`hover:bg-[var(--color-surface-offset)]/50 transition-colors ${isChecked ? 'bg-[var(--color-primary-highlight)]/10' : ''}`}>
                      <td className="py-3 px-4">
                        <input type="checkbox" checked={isChecked} onChange={(e) => toggleOne(d.id, e.target.checked)} className="rounded accent-[var(--color-primary)] cursor-pointer" />
                      </td>
                      <td
                        onClick={() => setRoute(docType === 'quotation' ? 'quotation-detail' : 'invoice-detail', d.id)}
                        className="py-3 px-4 font-bold text-[var(--color-primary)] hover:underline cursor-pointer"
                      >
                        {d.number}
                      </td>
                      <td className="py-3 px-4 font-semibold text-[var(--color-text)]">{getCustomerName(d.customerId)}</td>
                      <td className="py-3 px-4 text-xs font-mono text-[var(--color-text-muted)]">{fmt(d.date)}</td>
                      <td className="py-3 px-4 text-right font-bold text-[var(--color-text)]">
                        {d.total.toLocaleString(undefined, { minimumFractionDigits: 2 })} <span className="text-[10px] text-[var(--color-text-muted)] font-normal">{d.currency}</span>
                      </td>
                      <td className="py-3 px-4 text-center"><StatusBadge status={d.status} /></td>
                      <td className="py-3 px-4">
                        <button
                          onClick={() => openEdit(d)}
                          className="group flex items-center gap-2 text-left max-w-[260px] cursor-pointer"
                          title="Edit follow-up"
                        >
                          {d.followUpDate ? (
                            <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded border whitespace-nowrap ${
                              cls === 'overdue' ? 'text-[var(--color-error)] bg-[var(--color-error)]/10 border-[var(--color-error)]/20'
                              : cls === 'due' ? 'text-amber-600 bg-amber-500/10 border-amber-500/20'
                              : 'text-[var(--color-primary)] bg-[var(--color-primary)]/10 border-[var(--color-primary)]/20'
                            }`}>
                              <CalendarClock className="w-3 h-3" />
                              {cls === 'overdue' ? 'Overdue · ' : cls === 'due' ? 'Today · ' : ''}{fmt(d.followUpDate)}
                            </span>
                          ) : (
                            <span className="text-[11px] text-[var(--color-text-faint)] italic flex items-center gap-1">
                              <Pencil className="w-3 h-3" /> Add follow-up
                            </span>
                          )}
                          {d.followUpNote && (
                            <span className="text-[11px] text-[var(--color-text-muted)] truncate flex items-center gap-1">
                              <StickyNote className="w-3 h-3 shrink-0" />{d.followUpNote}
                            </span>
                          )}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Follow-up editor modal */}
      {editTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-fade-in" onClick={() => setEditTarget(null)} />
          <div className="relative w-full max-w-md bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl shadow-lg p-6 animate-scale-in flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-[var(--color-border)] pb-3">
              <h3 className="text-sm font-bold text-[var(--color-text)] flex items-center gap-2">
                <CalendarClock className="w-4 h-4 text-[var(--color-primary)]" />
                {editTarget.bulk ? `Set follow-up · ${selected.length} selected` : 'Follow-up'}
              </h3>
              <button onClick={() => setEditTarget(null)} className="p-1 hover:bg-[var(--color-surface-offset)] rounded cursor-pointer">
                <X className="w-4 h-4 text-[var(--color-text-muted)]" />
              </button>
            </div>
            <div className="text-xs font-semibold text-[var(--color-text-muted)]">
              <label className="block mb-1.5">Follow-up date</label>
              <input type="date" value={fuDate} onChange={(e) => setFuDate(e.target.value)} className="w-full premium-input text-sm text-[var(--color-text)]" />
            </div>
            <div className="text-xs font-semibold text-[var(--color-text-muted)]">
              <label className="block mb-1.5">Note</label>
              <textarea value={fuNote} onChange={(e) => setFuNote(e.target.value)} rows={3} className="w-full premium-input text-sm text-[var(--color-text)] resize-none" placeholder="e.g. Call client about pending approval" />
            </div>
            <div className="flex items-center justify-between gap-3 mt-2 border-t border-[var(--color-divider)]/40 pt-4 text-xs font-semibold">
              {!editTarget.bulk && (
                <button
                  onClick={() => { setFuDate(''); setFuNote(''); }}
                  className="text-[var(--color-text-muted)] hover:text-[var(--color-error)] cursor-pointer"
                >
                  Clear
                </button>
              )}
              <div className="flex items-center gap-3 ml-auto">
                <button onClick={() => setEditTarget(null)} className="px-4 py-2 border border-[var(--color-border)] hover:bg-[var(--color-surface-offset)] rounded-md text-[var(--color-text)] transition-colors cursor-pointer">
                  Cancel
                </button>
                <button onClick={saveFollow} className="px-4 py-2 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white rounded-md transition-colors cursor-pointer">
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default Tracking;
