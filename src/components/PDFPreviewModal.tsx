import React from 'react';
import { createPortal } from 'react-dom';
import { X, Download, Printer, FileText } from 'lucide-react';
import { BlobProvider } from '@react-pdf/renderer';
import { Company, Customer } from '../types';
import { QuotePdfDocument } from '../pdf/quote-document';
import QRCode from 'qrcode';
import { generateZatcaQRBase64 } from '../utils/zatca';
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
  footerImageUrl?: string | null,
  zatcaQrCodeImage?: string | null
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
        taxPercent: item.taxPercent,
        itemCode: item.productId ? (useERPStore.getState().products.find((p) => p.id === item.productId)?.itemCode || null) : null,
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
    vatNumber: customerProfile?.vatNumber || null,
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
    footerImageUrl: footerImageUrl || companyProfile.footerImageUrl || null,
    brandColor: companyProfile.brandColor || '#039737',
    taxLabel: `VAT ${Number.isFinite(Number(companyProfile.defaultTax)) ? Number(companyProfile.defaultTax) : 15}%`,
    vatNumber: companyProfile.vatNumber || null,
    crNumber: companyProfile.crNumber || null,
    pdfTemplate: companyProfile.pdfTemplate || null,
    pdfPayment: documentData.paymentTerms || null,
    pdfWarranty: companyProfile.pdfWarranty || null,
    pdfManpower: companyProfile.pdfManpower || null,
    pdfMobilization: companyProfile.pdfMobilization || null,
    pdfDuration: companyProfile.pdfDuration || null,
    bankName: companyProfile.bankName || null,
    bankAccount: companyProfile.bankAccount || null,
    bankIban: companyProfile.bankIban || null,
    bankAccountName: companyProfile.name || "",
    footerText: companyProfile.name || "",
    pdfHeaderBgType: companyProfile.pdfHeaderBgType || 'solid',
    pdfHeaderBgColorStart: companyProfile.pdfHeaderBgColorStart || '#91f0a9',
    pdfHeaderBgColorEnd: companyProfile.pdfHeaderBgColorEnd || '#91f0a9',
    pdfHeaderTextColor: companyProfile.pdfHeaderTextColor || '#18181b',
    pdfTableBgColor: companyProfile.pdfTableBgColor || '#91f0a9',
    pdfTableTextColor: companyProfile.pdfTableTextColor || '#18181b',
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
    zatcaQrCodeImage: zatcaQrCodeImage || undefined,
    customFieldValues: documentData.customFieldValues || {},
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
  const iframeRef = React.useRef<HTMLIFrameElement>(null);
  const [qrImage, setQrImage] = React.useState<string | null>(null);
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

  // ZATCA Phase-1 QR for invoices printed in ZATCA mode (same TLV payload the server embeds).
  React.useEffect(() => {
    let cancelled = false;
    if (!isOpen || type !== 'invoice' || printMode !== 'zatca' || !companyProfile.vatNumber) { setQrImage(null); return; }
    try {
      const tlv = generateZatcaQRBase64(
        companyProfile.name,
        companyProfile.vatNumber,
        documentData.date || documentData.createdAt || new Date().toISOString(),
        Number(documentData.total) || 0,
        Number(documentData.taxTotal) || 0
      );
      QRCode.toDataURL(tlv, { errorCorrectionLevel: 'M', margin: 1 }).then((u) => { if (!cancelled) setQrImage(u); }).catch(() => setQrImage(null));
    } catch { setQrImage(null); }
    return () => { cancelled = true; };
  }, [isOpen, type, printMode, companyProfile.vatNumber, companyProfile.name, documentData.date, documentData.createdAt, documentData.total, documentData.taxTotal]);

  const pdfDocument = React.useMemo(() => {
    if (!isOpen) return null;
    const { quote, settings } = mapToPdfData(modifiedDocumentData, companyProfile, customerProfile, type, logoUrl, footerImageUrl, qrImage);
    return (
      <QuotePdfDocument
        quote={quote}
        settings={settings}
        type={type}
        amountPaid={amountPaid}
        amountDue={amountDue}
      />
    );
  }, [isOpen, modifiedDocumentData, companyProfile, customerProfile, type, amountPaid, amountDue, logoUrl, footerImageUrl, qrImage]);

  if (!isOpen) return null;

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
              onClick={() => iframeRef.current?.contentWindow?.print()}
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

        {/* Real PDF preview: exactly what Download produces (template-driven) */}
        <div className="flex-1 bg-neutral-100 dark:bg-neutral-900 overflow-hidden">
          {pdfDocument && ready ? (
            <BlobProvider document={pdfDocument}>
              {({ url, loading, error }) => {
                if (error) {
                  return (
                    <div className="h-full flex flex-col items-center justify-center gap-2 text-sm text-[var(--color-error)] p-6 text-center">
                      <FileText className="w-8 h-8" />
                      <span className="font-bold">Could not render the PDF preview.</span>
                      <span className="text-xs text-[var(--color-text-muted)]">{String(error.message || error)}</span>
                    </div>
                  );
                }
                if (loading || !url) {
                  return <div className="h-full flex items-center justify-center text-xs text-[var(--color-text-muted)] animate-pulse">Rendering preview…</div>;
                }
                return <iframe ref={iframeRef} src={url} title="Document preview" className="w-full h-full border-0 bg-white" />;
              }}
            </BlobProvider>
          ) : (
            <div className="h-full flex items-center justify-center text-xs text-[var(--color-text-muted)] animate-pulse">Preparing…</div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};
