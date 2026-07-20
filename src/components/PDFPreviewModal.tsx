import React from 'react';
import { createPortal } from 'react-dom';
import { X, Download, Printer, FileText } from 'lucide-react';
import { BlobProvider } from '@react-pdf/renderer';
import { Company, Customer } from '../types';
import { QuotePdfDocument } from '../pdf/quote-document';
import { useERPStore } from '../store';

function fmt(n: number) {
  return new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

// ── MAPPER: Maps New ERP objects to QuotePdfDocument specs ───────────────────
const mapToPdfData = (
  documentData: any,
  companyProfile: Company,
  customerProfile?: Customer,
  type?: 'quotation' | 'invoice',
  logoUrl?: string | null,
  footerImageUrl?: string | null
) => {
  const isInvoice = type === 'invoice';

  // Map lines — exclude 'note' rows (employee-only, not for PDF)
  const lines = (documentData.lineItems || [])
    .filter((item: any) => item.type !== 'note')
    .map((item: any) => {
      // Split bilingual description: "English / العربية"
      const parts = item.description.includes(' / ')
        ? item.description.split(' / ')
        : [item.description, ''];
      const descEn = parts[0];
      const descAr = parts.slice(1).join(' / ');

      return {
        type: item.type || 'item',
        description: descEn,
        descriptionAr: descAr || null,
        quantity: item.quantity,
        unit: item.unit || 'pcs',
        unitPrice: item.unitPrice,
        discount: item.discountPercent || 0,
      };
    });

  // Map customer
  const customerAddress = customerProfile?.billingAddress
    ? [customerProfile.billingAddress.street, customerProfile.billingAddress.district].filter(Boolean).join(', ')
    : '';

  const customer = {
    company: customerProfile?.companyName || 'Walk-in Customer',
    contactName: customerProfile?.contactPerson || null,
    email: customerProfile?.email || null,
    phone: customerProfile?.phone || null,
    address: customerAddress || null,
    city: customerProfile?.billingAddress?.city || null,
    country: customerProfile?.billingAddress?.country || null,
  };

  // Map settings
  const companyAddress = companyProfile.address
    ? [companyProfile.address.street, companyProfile.address.district, companyProfile.address.city].filter(Boolean).join(', ')
    : '';

  const settings = {
    companyName: companyProfile.name,
    email: companyProfile.email || null,
    phone: companyProfile.phone || null,
    address: companyAddress || null,
    logoUrl: logoUrl || companyProfile.logo || null,
    footerImageUrl: footerImageUrl || null,
    brandColor: companyProfile.brandColor || '#01696f',
    taxLabel: `VAT ${companyProfile.defaultTax || 15}%`,
    pdfPayment: isInvoice ? (documentData.paymentTerms || null) : null,
    pdfWarranty: null,
    pdfManpower: null,
    pdfMobilization: null,
    pdfDuration: null,
    bankName: null,
    bankAccount: null,
    bankIban: null,
    bankAccountName: null,
    footerText: companyProfile.name,
    pdfHeaderBgType: companyProfile.pdfHeaderBgType || 'solid',
    pdfHeaderBgColorStart: companyProfile.pdfHeaderBgColorStart || companyProfile.brandColor || '#01696f',
    pdfHeaderBgColorEnd: companyProfile.pdfHeaderBgColorEnd || companyProfile.brandColor || '#01696f',
    pdfHeaderTextColor: companyProfile.pdfHeaderTextColor || '#ffffff',
    pdfTableBgColor: companyProfile.pdfTableBgColor || companyProfile.brandColor || '#01696f',
    pdfTableTextColor: companyProfile.pdfTableTextColor || '#ffffff',
  };

  // Map quote
  const quote = {
    number: documentData.number,
    createdAt: documentData.date || documentData.createdAt || new Date(),
    validUntil: isInvoice ? (documentData.dueDate || null) : (documentData.validUntil || null),
    currency: documentData.currency || companyProfile.currency || 'SAR',
    subject: documentData.subject || null,
    subjectAr: documentData.subjectAr || null,
    notes: documentData.notes || documentData.terms || null,
    notesAr: documentData.notesAr || null,
    payment: isInvoice ? (documentData.paymentTerms || null) : (documentData.payment || null),
    paymentAr: documentData.paymentAr || null,
    warranty: documentData.warranty || null,
    warrantyAr: documentData.warrantyAr || null,
    manpower: documentData.manpower || null,
    manpowerAr: documentData.manpowerAr || null,
    mobilization: documentData.mobilization || null,
    mobilizationAr: documentData.mobilizationAr || null,
    duration: documentData.duration || null,
    durationAr: documentData.durationAr || null,
    bankDetails: documentData.bankDetails || null,
    bankDetailsAr: documentData.bankDetailsAr || null,
    subtotal: documentData.subtotal,
    discountTotal: documentData.discountTotal || 0,
    taxTotal: documentData.taxTotal,
    total: documentData.total,
    customer,
    lines,
    watermarkText: documentData.watermarkText || null,
    watermarkType: documentData.watermarkType || 'none',
    hidePrices: documentData.hidePrices || false,
    manualTotal: documentData.manualTotal !== undefined && documentData.manualTotal !== null ? Number(documentData.manualTotal) : undefined,
    printMode: documentData.printMode || 'standard',
  };

  return { quote, settings };
};

// ── Server-side Download Button ───────────────────────────────────────────────
// Fetches PDF from the Express API which sends Content-Disposition: attachment
// This guarantees the filename is preserved — browser security cannot interfere.
const DownloadButton: React.FC<{ documentData: any; type: 'quotation' | 'invoice' }> = ({ documentData, type }) => {
  const token = useERPStore((s) => s.token);
  const [downloading, setDownloading] = React.useState(false);

  const handleDownload = async () => {
    if (!documentData.id) {
      alert('Please save the document first before downloading.');
      return;
    }
    setDownloading(true);
    try {
      const res = await fetch('/api/pdf/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ documentData, type })
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Server error' }));
        throw new Error(err.error || 'Failed to generate PDF');
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${documentData.number || 'document'}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(`Download failed: ${err.message}`);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <button
      onClick={handleDownload}
      disabled={downloading}
      className={`text-white text-xs font-semibold py-1.5 px-3 rounded-md flex items-center gap-1.5 transition-colors shadow-sm cursor-pointer ${downloading
        ? 'bg-[var(--color-primary)]/70 cursor-not-allowed'
        : 'bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)]'
        }`}
    >
      <Download className={`w-3.5 h-3.5 ${downloading ? 'animate-pulse' : ''}`} />
      {downloading ? 'Generating...' : 'Download PDF'}
    </button>
  );
};

// ── Modal Container ───────────────────────────────────────────────────────────
interface PDFPreviewModalProps {
  isOpen: boolean;
  documentData: any;
  companyProfile: Company;
  customerProfile?: Customer;
  type: 'quotation' | 'invoice';
  amountPaid?: number;
  amountDue?: number;
  onClose: () => void;
}

export const PDFPreviewModal: React.FC<PDFPreviewModalProps> = ({
  isOpen,
  documentData,
  companyProfile,
  customerProfile,
  type,
  amountPaid = 0,
  amountDue = 0,
  onClose
}) => {
  const [ready, setReady] = React.useState(false);
  const [logoUrl, setLogoUrl] = React.useState<string | null>(null);
  const [footerImageUrl, setFooterImageUrl] = React.useState<string | null>(null);
  const [printMode, setPrintMode] = React.useState<'zatca' | 'standard' | 'novat'>(type === 'invoice' ? 'zatca' : 'standard');

  const modifiedDocumentData = React.useMemo(() => {
    const isNoVat = printMode === 'novat';
    return {
      ...documentData,
      printMode,
      taxTotal: isNoVat ? 0 : documentData.taxTotal,
      total: isNoVat ? (documentData.subtotal - (documentData.discountTotal || 0)) : documentData.total,
    };
  }, [documentData, printMode]);

  // Fetch logo and footer image from settings API
  React.useEffect(() => {
    if (!isOpen) return;
    const token = useERPStore.getState().token;
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    fetch('/api/settings/logo', { headers })
      .then(res => res.json())
      .then(data => { if (data.value) setLogoUrl(data.value); })
      .catch(console.error);

    fetch('/api/settings/footerImage', { headers })
      .then(res => res.json())
      .then(data => { if (data.value) setFooterImageUrl(data.value); })
      .catch(console.error);
  }, [isOpen]);

  React.useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        setReady(true);
      }, 300);
      return () => clearTimeout(timer);
    } else {
      setReady(false);
    }
  }, [isOpen]);

  const pdfDocument = React.useMemo(() => {
    if (!isOpen) return null;
    const { quote, settings } = mapToPdfData(modifiedDocumentData, companyProfile, customerProfile, type, logoUrl, footerImageUrl);
    return (
      <QuotePdfDocument
        quote={quote}
        settings={settings}
        type={type}
        amountPaid={amountPaid}
        amountDue={amountDue}
      />
    );
  }, [isOpen, modifiedDocumentData, companyProfile, customerProfile, type, amountPaid, amountDue, logoUrl, footerImageUrl]);

  if (!isOpen) return null;
  const isInvoice = type === 'invoice';

  // Get bilingual notes split side-by-side
  const noteItems = React.useMemo(() => {
    const notes = documentData.notes || documentData.terms || '';
    const notesAr = documentData.notesAr || '';
    if (notesAr.trim()) {
      const enLines = notes.split('\n').filter(Boolean);
      const arLines = notesAr.split('\n').filter(Boolean);
      const count = Math.max(enLines.length, arLines.length, 1);
      return Array.from({ length: count }, (_, i) => ({
        en: enLines[i] ?? enLines[0] ?? '',
        ar: arLines[i] ?? arLines[0] ?? '',
      }));
    }
    if (!notes) return [];
    return notes.split('\n').map((line: string) => {
      const cleanLine = line.trim();
      const pipeIdx = cleanLine.indexOf('|');
      if (pipeIdx !== -1 && pipeIdx > 10) {
        const parts = cleanLine.split('|');
        return { en: parts[0].trim(), ar: parts[1]?.trim() ?? '' };
      }
      const standardTranslations: Record<string, string> = {
        'Full Payment in ADVANCE': 'الدفع الكامل مقدماً',
        '80% Downpayment | Balance before completion.': '80% دفعة مقدمة | الرصيد قبل الإكمال',
        "2 YEARS limited warranty and/or supplier's recommendation": 'ضمان محدود لمدة عامين و/أو توصية المورد',
        "2 YEARS limited warranty and/or supplier's recommendation.": 'ضمان محدود لمدة عامين و/أو توصية المورد.',
        "1 YEAR limited warranty and/or supplier's recommendation": 'ضمان محدود لمدة سنة و/أو توصية المورد',
        '2 Technicians, 1 Supervisor': '2 فنيين، 1 مشرف',
        '2 Technicians, 1 Supervisor.': '2 فنيين، 1 مشرف.',
        '3 Technicians, 1 Supervisor': '3 فنيين، 1 مشرف',
        '3 Technicians, 1 Supervisor.': '3 فنيين، 1 مشرف.',
        '4 Technicians, 1 Supervisor': '4 فنيين، 1 مشرف',
        '4 Technicians, 1 Supervisor.': '4 فنيين، 1 مشرف.',
        '1-2 days upon confirmation of payment': '1-2 أيام بعد تأكيد الدفع',
        '2-3 days upon confirmation of payment': '2-3 أيام بعد تأكيد الدفع',
        '2-3 days upon confirmation of payment.': '2-3 أيام بعد تأكيد الدفع.',
        '3-4 days upon confirmation of payment': '3-4 أيام بعد تأكيد الدفع',
        '3-4 days upon confirmation of payment.': '3-4 أيام بعد تأكيد الدفع.',
        '4-5 days upon confirmation of payment': '4-5 أيام بعد تأكيد الدفع',
        '1-2 Working Days': '1-2 يوم عمل',
        '1-2 Working Days.': '1-2 يوم عمل.',
        '2-3 Working Days': '2-3 يوم عمل',
        '3-4 Working Days': '3-4 يوم عمل',
        '4-5 Working Days': '4-5 يوم عمل',
        '4-5 Working Days.': '4-5 يوم عمل.',
        '5-7 Working Days': '5-7 يوم عمل',
        '10-14 Working Days': '10-14 يوم عمل',
        '25-30 Working Days': '25-30 يوم عمل',
        '25-30 Working Days.': '25-30 يوم عمل.',
        'Any additional work/device will be considered Change Order': 'سيتم اعتبار أي عمل إضافي/جهاز بمثابة أمر تغيير',
        'Any additional work/device will be considered Change Order.': 'سيتم اعتبار أي عمل إضافي/جهاز بمثابة أمر تغيير.',
        'Any additional work|device will be considered Change Order': 'سيتم اعتبار أي عمل إضافي|جهاز بمثابة أمر تغيير',
        'Internet source is provided by the OWNER.': 'يتم توفير مصدر الإنترنت من قبل المالك.',
        'Internet source is provided by the OWNER': 'يتم توفير مصدر الإنترنت من قبل المالك',
      };
      if (standardTranslations[cleanLine]) return { en: cleanLine, ar: standardTranslations[cleanLine] };
      return { en: cleanLine, ar: '' };
    });
  }, [documentData.notes, documentData.terms, documentData.notesAr]);

  const getBilingualParts = (en: string | null | undefined, ar: string | null | undefined) => {
    if (!en && !ar) return { en: '', ar: '' };
    if (en && ar) return { en: en.trim(), ar: ar.trim() };
    const value = (en || ar || '').trim();
    if (!ar && value.includes('|')) {
      const parts = value.split('|');
      return { en: parts[0].trim(), ar: parts[1]?.trim() ?? '' };
    }
    const standardTranslations: Record<string, string> = {
      'Full Payment in ADVANCE': 'الدفع الكامل مقدماً',
      '80% Downpayment | Balance before completion.': '80% دفعة مقدمة | الرصيد قبل الإكمال',
      "2 YEARS limited warranty and/or supplier's recommendation": 'ضمان محدود لمدة عامين و/أو توصية المورد',
      "2 YEARS limited warranty and/or supplier's recommendation.": 'ضمان محدود لمدة عامين و/أو توصية المورد.',
      "1 YEAR limited warranty and/or supplier's recommendation": 'ضمان محدود لمدة سنة و/أو توصية المورد',
      '2 Technicians, 1 Supervisor': '2 فنيين، 1 مشرف',
      '2 Technicians, 1 Supervisor.': '2 فنيين، 1 مشرف.',
      '3 Technicians, 1 Supervisor': '3 فنيين، 1 مشرف',
      '3 Technicians, 1 Supervisor.': '3 فنيين، 1 مشرف.',
      '4 Technicians, 1 Supervisor': '4 فنيين، 1 مشرف',
      '4 Technicians, 1 Supervisor.': '4 فنيين، 1 مشرف.',
      '1-2 days upon confirmation of payment': '1-2 أيام بعد تأكيد الدفع',
      '2-3 days upon confirmation of payment': '2-3 أيام بعد تأكيد الدفع',
      '2-3 days upon confirmation of payment.': '2-3 أيام بعد تأكيد الدفع.',
      '3-4 days upon confirmation of payment': '3-4 أيام بعد تأكيد الدفع',
      '3-4 days upon confirmation of payment.': '3-4 أيام بعد تأكيد الدفع.',
      '4-5 days upon confirmation of payment': '4-5 أيام بعد تأكيد الدفع',
      '1-2 Working Days': '1-2 يوم عمل',
      '1-2 Working Days.': '1-2 يوم عمل.',
      '2-3 Working Days': '2-3 يوم عمل',
      '3-4 Working Days': '3-4 يوم عمل',
      '4-5 Working Days': '4-5 يوم عمل',
      '4-5 Working Days.': '4-5 يوم عمل.',
      '5-7 Working Days': '5-7 يوم عمل',
      '10-14 Working Days': '10-14 يوم عمل',
      '25-30 Working Days': '25-30 يوم عمل',
      '25-30 Working Days.': '25-30 يوم عمل.',
      'Any additional work/device will be considered Change Order': 'سيتم اعتبار أي عمل إضافي/جهاز بمثابة أمر تغيير',
      'Any additional work/device will be considered Change Order.': 'سيتم اعتبار أي عمل إضافي/جهاز بمثابة أمر تغيير.',
      'Any additional work|device will be considered Change Order': 'سيتم اعتبار أي عمل إضافي|جهاز بمثابة أمر تغيير',
      'Internet source is provided by the OWNER.': 'يتم توفير مصدر الإنترنت من قبل المالك.',
      'Internet source is provided by the OWNER': 'يتم توفير مصدر الإنترنت من قبل المالك',
    };
    if (!ar && standardTranslations[value]) {
      return { en: value, ar: standardTranslations[value] };
    }
    return { en: en || value, ar: ar || '' };
  };

  const termsRows = React.useMemo(() => {
    const paymentField = isInvoice ? (documentData.paymentTerms || null) : (documentData.payment || null);
    const paymentArField = documentData.paymentAr || null;
    const warrantyField = documentData.warranty || null;
    const warrantyArField = documentData.warrantyAr || null;
    const manpowerField = documentData.manpower || null;
    const manpowerArField = documentData.manpowerAr || null;
    const mobilizationField = documentData.mobilization || null;
    const mobilizationArField = documentData.mobilizationAr || null;
    const durationField = documentData.duration || null;
    const durationArField = documentData.durationAr || null;

    return [
      { label: 'PAYMENT', en: paymentField, ar: paymentArField },
      { label: 'WARRANTY', en: warrantyField, ar: warrantyArField },
      { label: 'MANPOWER', en: manpowerField, ar: manpowerArField },
      { label: 'MOBILIZATION', en: mobilizationField, ar: mobilizationArField },
      { label: 'DURATION', en: durationField, ar: durationArField },
    ]
      .filter(r => r.en || r.ar)
      .map(r => {
        const parts = getBilingualParts(r.en, r.ar);
        return { label: r.label, en: parts.en, ar: parts.ar };
      });
  }, [documentData, isInvoice]);

  const bank = React.useMemo(() => {
    const bankDetails = documentData.bankDetails || null;
    const bankDetailsAr = documentData.bankDetailsAr || null;
    return getBilingualParts(bankDetails, bankDetailsAr);
  }, [documentData.bankDetails, documentData.bankDetailsAr]);

  // Ensure brand color is visible (not near-black) for PDF backgrounds
  const ensureVisibleColor = (hex: string): string => {
    const h = hex.replace('#', '');
    const r = parseInt(h.substring(0, 2), 16);
    const g = parseInt(h.substring(2, 4), 16);
    const b = parseInt(h.substring(4, 6), 16);
    const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
    if (luminance < 40) {
      const boost = 60;
      return `#${Math.min(255, r + boost).toString(16).padStart(2, '0')}${Math.min(255, g + boost).toString(16).padStart(2, '0')}${Math.min(255, b + boost).toString(16).padStart(2, '0')}`;
    }
    return hex;
  };
  const brand = ensureVisibleColor(companyProfile.brandColor || '#01696f');
  const pdfHeaderBgType = companyProfile.pdfHeaderBgType || 'solid';
  const pdfHeaderBgColorStart = ensureVisibleColor(companyProfile.pdfHeaderBgColorStart || companyProfile.brandColor || '#01696f');
  const pdfHeaderBgColorEnd = ensureVisibleColor(companyProfile.pdfHeaderBgColorEnd || companyProfile.brandColor || '#01696f');
  const pdfHeaderTextColor = companyProfile.pdfHeaderTextColor || '#ffffff';
  const pdfTableBgColor = ensureVisibleColor(companyProfile.pdfTableBgColor || companyProfile.brandColor || '#01696f');
  const pdfTableTextColor = companyProfile.pdfTableTextColor || '#ffffff';

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 overflow-y-auto">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-fade-in" onClick={onClose} />

      <div className="relative w-full max-w-4xl bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl shadow-lg flex flex-col h-[90vh] overflow-hidden animate-slide-in text-left">
        {/* Top Navbar */}
        <div className="h-14 border-b border-[var(--color-border)] px-4 flex items-center justify-between bg-[var(--color-surface-offset)]">
          <span className="text-xs font-bold text-[var(--color-text)] flex items-center gap-1.5 uppercase tracking-wider">
            <FileText className="w-4 h-4 text-[var(--color-primary)]" />
            Bilingual Document Preview ({type.toUpperCase()})
          </span>

          <div className="flex items-center gap-2">
            {type === 'invoice' && (
              <select
                value={printMode}
                onChange={(e) => setPrintMode(e.target.value as 'zatca' | 'standard' | 'novat')}
                className="bg-white border border-[var(--color-border)] text-[var(--color-text)] text-xs font-semibold py-1.5 px-2 rounded-md outline-none cursor-pointer"
              >
                <option value="zatca">ZATCA (Tax + QR)</option>
                <option value="standard">Standard (Tax)</option>
                <option value="novat">Non-VAT Invoice</option>
              </select>
            )}

            <DownloadButton documentData={modifiedDocumentData} type={type} />

            <button
              onClick={() => window.print()}
              className="bg-white hover:bg-[var(--color-surface-offset)] border border-[var(--color-border)] text-[var(--color-text)] text-xs font-semibold py-1.5 px-3 rounded-md flex items-center gap-1 transition-colors cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              Print
            </button>

            <button onClick={onClose} className="p-1 hover:bg-[var(--color-border)] rounded text-[var(--color-text-muted)] cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Paper Sheet Preview Area */}
        <div className="flex-1 bg-neutral-100 dark:bg-neutral-900 p-6 md:p-10 overflow-y-auto flex justify-center">
          <div
            id="printable-document"
            className="w-full max-w-[210mm] min-h-[297mm] bg-white border border-neutral-200 shadow-md p-6 md:p-8 text-neutral-800 text-xs flex flex-col relative"
            style={{ fontFamily: "'Tajawal', 'Inter', sans-serif" }}
          >
            {/* HTML Watermark Overlay */}
            {documentData.watermarkType && documentData.watermarkType !== 'none' && documentData.watermarkText && (
              <div className="absolute inset-0 pointer-events-none overflow-hidden select-none z-0 flex items-center justify-center">
                {documentData.watermarkType === 'center' ? (
                  <div 
                    className="text-neutral-300/15 font-black text-6xl md:text-8xl tracking-widest uppercase"
                    style={{ transform: 'rotate(-35deg)', fontFamily: "'Tajawal', sans-serif" }}
                  >
                    {documentData.watermarkText}
                  </div>
                ) : (
                  <div className="w-full h-full flex flex-col justify-around py-12 opacity-[0.12]">
                    {[1, 2, 3].map((row) => (
                      <div key={row} className="flex justify-around items-center">
                        {[1, 2, 3].map((col) => (
                          <span 
                            key={col} 
                            className="text-neutral-400 font-bold text-lg md:text-xl uppercase"
                            style={{ transform: 'rotate(-30deg)', fontFamily: "'Tajawal', sans-serif" }}
                          >
                            {documentData.watermarkText}
                          </span>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            <div className="flex-1 relative z-10">
              {/* Header */}
              <div className="flex justify-between items-start border-b border-neutral-800 pb-4 mb-5">
                <div className="text-left">
                  <h2 className="text-xl font-black tracking-tight" style={{ color: pdfHeaderBgColorStart }}>
                    {isInvoice ? (printMode === 'novat' ? 'INVOICE' : 'TAX INVOICE') : 'QUOTATION'}
                  </h2>
                  <div className="text-[10px] text-neutral-500 mt-1 space-y-0.5 font-semibold">
                    <div>Quote ID / رقم العرض: <span className="font-bold text-neutral-800">{documentData.number}</span></div>
                    <div>Date / التاريخ: <span className="font-bold text-neutral-800">{new Date(documentData.date).toLocaleDateString()}</span></div>
                    <div>{isInvoice ? 'Due Date / تاريخ الاستحقاق' : 'Valid Until / صالح لغاية'}: <span className="font-bold text-neutral-800">{new Date(documentData.validUntil).toLocaleDateString()}</span></div>
                  </div>
                </div>
                <div className="text-right">
                  {logoUrl ? (
                    <img src={logoUrl} alt="Company Logo" className="max-h-12 object-contain ml-auto" />
                  ) : (
                    <>
                      <h1 className="text-sm font-extrabold" style={{ color: pdfHeaderBgColorStart }}>{companyProfile.name}</h1>
                      {companyProfile.vatNumber && <p className="text-[9px] text-neutral-500 font-semibold mt-0.5">VAT: {companyProfile.vatNumber}</p>}
                      {companyProfile.email && <p className="text-[9px] text-neutral-400">{companyProfile.email}</p>}
                    </>
                  )}
                </div>
              </div>

              {/* Customer Info */}
              <div className="border border-neutral-800 mb-4 text-[10px]">
                <div className="bg-neutral-100 px-3 py-1 border-b border-neutral-800 font-bold text-[11px]">CUSTOMER INFO</div>
                <div className="p-2.5 space-y-1">
                  <div className="flex justify-between">
                    <div><span className="font-bold">Customer:</span> <span className="font-bold">{customerProfile?.companyName}</span></div>
                    <div><span className="font-bold">Mobile:</span> {customerProfile?.phone}</div>
                  </div>
                  <div><span className="font-bold">Address:</span> {customerProfile?.billingAddress?.street}, {customerProfile?.billingAddress?.city}</div>
                  <div className="flex justify-between">
                    <div><span className="font-bold">Contact:</span> {customerProfile?.contactPerson}</div>
                    <div><span className="font-bold">E-mail:</span> {customerProfile?.email}</div>
                  </div>
                  {(documentData.subject || documentData.subjectAr) && (
                    <div className="flex items-start text-[10px] gap-2 pt-1 mt-1 border-t border-neutral-200">
                      <span className="font-bold w-[58px] shrink-0">Subject:</span>
                      <div className="flex-1 flex justify-between gap-4">
                        <span className="text-left">{documentData.subject || ''}</span>
                        {documentData.subjectAr && (
                          <span className="text-right font-medium text-neutral-800" dir="rtl">
                            {documentData.subjectAr}
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Items Table */}
              <table className="w-full text-[9px] border-collapse mb-4">
                <thead>
                  <tr style={{
                    background: pdfHeaderBgType === 'gradient'
                      ? `linear-gradient(90deg, ${pdfHeaderBgColorStart}, ${pdfHeaderBgColorEnd})`
                      : pdfTableBgColor,
                    color: pdfTableTextColor
                  }}>
                    <th className="border border-neutral-800 px-1.5 py-1 w-7 text-center font-bold">ITEM</th>
                    <th className="border border-neutral-800 px-1.5 py-1 text-left font-bold">DESCRIPTION</th>
                    <th className="border border-neutral-800 px-1.5 py-1 w-8 text-center font-bold">QTY</th>
                    <th className="border border-neutral-800 px-1.5 py-1 w-8 text-center font-bold">UNIT</th>
                    {!documentData.hidePrices && (
                      <>
                        <th className="border border-neutral-800 px-1.5 py-1 w-16 text-right font-bold">UNIT PRICE</th>
                        <th className="border border-neutral-800 px-1.5 py-1 w-20 text-right font-bold">NET PRICE</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {documentData.lineItems.map((item: any, idx: number) => {
                    if (item.type !== 'item') {
                      return (
                        <tr key={item.id} className="bg-neutral-100 font-bold">
                          <td className="border border-neutral-300 px-1.5 py-1 text-center text-neutral-400">{idx + 1}</td>
                          <td colSpan={documentData.hidePrices ? 3 : 5} className="border border-neutral-300 px-1.5 py-1 uppercase text-[8px] text-neutral-500 tracking-wider">{item.description}</td>
                        </tr>
                      );
                    }
                    const netPrice = item.quantity * item.unitPrice * (1 - (item.discountPercent || 0) / 100);
                    const parts = item.description.includes(' / ') ? item.description.split(' / ') : [item.description, ''];
                    return (
                      <tr key={item.id} className={idx % 2 === 1 ? 'bg-neutral-50' : ''}>
                        <td className="border border-neutral-300 px-1.5 py-1 text-center text-neutral-400">{idx + 1}</td>
                        <td className="border border-neutral-300 px-1.5 py-1">
                          <div className="flex items-center w-full gap-4 text-[9px]">
                            <span className="w-1/2 text-left pr-2 text-neutral-800">{parts[0]}</span>
                            {parts[1] && (
                              <span className="w-1/2 text-right pl-2 font-medium text-neutral-800" dir="rtl">
                                {parts.slice(1).join(' / ')}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="border border-neutral-300 px-1.5 py-1 text-center font-mono">{item.quantity}</td>
                        <td className="border border-neutral-300 px-1.5 py-1 text-center">{item.unit}</td>
                        {!documentData.hidePrices && (
                          <>
                            <td className="border border-neutral-300 px-1.5 py-1 text-right font-mono">{fmt(item.unitPrice)}</td>
                            <td className="border border-neutral-300 px-1.5 py-1 text-right font-mono font-bold">{fmt(netPrice)}</td>
                          </>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* Totals & Notes */}
              <div className="flex justify-between items-start gap-4 text-[10px]">
                {/* Note box */}
                <div className="flex-1 border border-neutral-800 p-2.5 text-[8.5px] flex flex-col gap-1">
                  <div className="flex gap-1.5">
                    <span className="font-bold shrink-0 w-8">NOTE:</span>
                    <div className="flex-1 flex gap-4">
                      {/* English side */}
                      <div className="flex-1 space-y-0.5 text-neutral-600">
                        {noteItems.length > 0 ? (
                          noteItems.map((item, idx) => (
                            <p key={idx}>{item.en}</p>
                          ))
                        ) : (
                          <p className="italic text-neutral-300">—</p>
                        )}
                      </div>
                      {/* Arabic side */}
                      {noteItems.some(n => n.ar) && (
                        <div className="flex-1 space-y-0.5 text-right font-medium text-neutral-800" dir="rtl">
                          {noteItems.map((item, idx) => (
                            <p key={idx}>{item.ar}</p>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Totals */}
                <div className="w-40 border border-neutral-800 shrink-0">
                  <div className="flex justify-between px-2 py-1 border-b border-neutral-800">
                    <span className="font-bold">SUBTOTAL</span>
                    <span>{modifiedDocumentData.currency} {fmt(modifiedDocumentData.subtotal)}</span>
                  </div>
                  {modifiedDocumentData.discountTotal > 0 && (
                    <div className="flex justify-between px-2 py-1 border-b border-neutral-800">
                      <span className="font-bold">DISCOUNT</span>
                      <span>-{modifiedDocumentData.currency} {fmt(modifiedDocumentData.discountTotal)}</span>
                    </div>
                  )}
                  {printMode !== 'novat' && (
                    <div className="flex justify-between px-2 py-1 border-b border-neutral-800">
                      <span className="font-bold">VAT 15%</span>
                      <span>{modifiedDocumentData.currency} {fmt(modifiedDocumentData.taxTotal)}</span>
                    </div>
                  )}
                  <div className="flex justify-between px-2 py-1.5 font-bold" style={{
                    background: pdfHeaderBgType === 'gradient'
                      ? `linear-gradient(90deg, ${pdfHeaderBgColorStart}, ${pdfHeaderBgColorEnd})`
                      : pdfTableBgColor,
                    color: pdfTableTextColor
                  }}>
                    <span>TOTAL PACKAGE</span>
                    <span>{modifiedDocumentData.currency} {fmt(modifiedDocumentData.total)}</span>
                  </div>
                </div>
              </div>

              {/* Terms Section */}
              {termsRows.length > 0 && (
                <div className="mt-3 space-y-0.5 border-t border-neutral-200 pt-2 text-[8px]">
                  {termsRows.map((row) => (
                    <div key={row.label} className="flex justify-between items-center py-0.5">
                      <div className="flex gap-1.5 flex-1">
                        <span className="font-bold">{row.label}:</span>
                        <span className="text-neutral-600">{row.en}</span>
                      </div>
                      {row.ar && (
                        <span className="flex-1 text-right font-medium text-neutral-800" dir="rtl">{row.ar}</span>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Bank Details */}
              {(bank.en || bank.ar) && (
                <div className="mt-3 border-t border-neutral-200 pt-2 text-[8px]">
                  <span className="font-bold block mb-1">BANK DETAILS</span>
                  <div className="flex justify-between items-start gap-4">
                    <span className="flex-1 text-neutral-600 whitespace-pre-wrap">{bank.en}</span>
                    {bank.ar && (
                      <span className="flex-1 text-right font-medium text-neutral-800 whitespace-pre-wrap" dir="rtl">{bank.ar}</span>
                    )}
                  </div>
                </div>
              )}

              {/* Bottom footer graphic image mockup */}
              {footerImageUrl && (
                <div className="mt-4 border-t border-neutral-100 pt-2 flex justify-center">
                  <img src={footerImageUrl} className="w-full h-8 object-contain" alt="Footer Logo" />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default PDFPreviewModal;
