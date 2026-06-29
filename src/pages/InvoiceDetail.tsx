import React, { useState, useEffect, useRef } from 'react';
import { useERPStore, calculateTotals } from '../store';
import { Customer, Product, LineItem, Invoice, Payment } from '../types';
import { PageHeader } from '../components/PageHeader';
import { useAutoSave } from '../hooks/useAutoSave';
import { useDraft } from '../hooks/useDraft';
import { AutoSaveIndicator } from '../components/AutoSaveIndicator';
import { CustomerCombobox } from '../components/CustomerCombobox';
import { ProductCombobox } from '../components/ProductCombobox';
import { InlineProductSearchInput } from '../components/InlineProductSearchInput';
import { DatePicker } from '../components/DatePicker';
import { StatusBadge } from '../components/StatusBadge';
import { ConfirmDialog } from '../components/ConfirmDialog';
import {
  Save,
  Send,
  CheckCircle,
  FileText,
  Copy,
  ChevronDown,
  GripVertical,
  X,
  PlusSquare,
  AlertTriangle,
  Plus,
  Trash2,
  DollarSign,
  Calendar,
  CreditCard,
  Building,
  Globe
} from 'lucide-react';
import { PDFPreviewModal } from '../components/PDFPreviewModal';
import { EmailSendModal } from '../components/EmailSendModal';
import { DocumentTimeline } from '../components/DocumentTimeline';

interface InvoiceDetailProps {
  id: string; // 'new' or a invoice id
}

export const InvoiceDetail: React.FC<InvoiceDetailProps> = ({ id }) => {
  const {
    invoices,
    quotations,
    customers,
    products,
    setRoute,
    addInvoice,
    updateInvoice,
    deleteInvoice,
    recordPayment,
    company,
    token,
    currentUser
  } = useERPStore();

  const isNew = id === 'new';
  const canOverridePrice = currentUser?.role === 'admin' || !!currentUser?.permissions?.canOverridePrice;
  const canUseWatermark = currentUser?.role === 'admin' || !!currentUser?.permissions?.canUseWatermark;
  const canUsePricingControls = currentUser?.role === 'admin' || !!currentUser?.permissions?.canUsePricingControls;
  const existingInv = invoices.find((i) => i.id === id);

  // Form State
  const [number, setNumber] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [date, setDate] = useState<Date>(new Date());
  const [dueDate, setDueDate] = useState<Date>(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000));
  const [status, setStatus] = useState<Invoice['status']>('draft');
  const [paymentTerms, setPaymentTerms] = useState('Net 30');
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [notes, setNotes] = useState('');
  const [terms, setTerms] = useState('');
  const [currency, setCurrency] = useState('SAR');
  const [linkedQuoteId, setLinkedQuoteId] = useState<string | undefined>(undefined);
  const [subject, setSubject] = useState('');
  const [subjectAr, setSubjectAr] = useState('');
  const [watermarkText, setWatermarkText] = useState('PAID');
  const [watermarkType, setWatermarkType] = useState<'none' | 'center' | 'multi'>('none');
  const [hidePrices, setHidePrices] = useState(false);
  const [manualTotal, setManualTotal] = useState<string>('');

  // Utility states
  const [isDirty, setIsDirty] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [pdfModalOpen, setPdfModalOpen] = useState(false);
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'items' | 'payments' | 'terms'>('items');

  // Payment capture modal inputs
  const [payAmount, setPayAmount] = useState(0);
  const [payMethod, setPayMethod] = useState<Payment['method']>('bank_transfer');
  const [payRef, setPayRef] = useState('');
  const [payNote, setPayNote] = useState('');

  const skipSyncRef = useRef(false);
  const committedRef = useRef(false); // true once this new invoice has been created server-side
  const [newId] = useState(() => `inv-${Date.now()}`);

  // localStorage-backed draft: survives navigation & reloads (see useDraft).
  const draft = useDraft<any>('invoice', id);

  const applySnapshot = (s: any) => {
    setNumber(s.number ?? '');
    setCustomerId(s.customerId ?? '');
    setDate(s.date ? new Date(s.date) : new Date());
    setDueDate(s.dueDate ? new Date(s.dueDate) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000));
    setStatus(s.status ?? 'draft');
    setPaymentTerms(s.paymentTerms ?? 'Net 30');
    setLineItems(s.lineItems ? JSON.parse(JSON.stringify(s.lineItems)) : []);
    setNotes(s.notes ?? '');
    setTerms(s.terms ?? '');
    setCurrency(s.currency ?? company.currency);
    setLinkedQuoteId(s.linkedQuoteId);
    setSubject(s.subject ?? '');
    setSubjectAr(s.subjectAr ?? '');
    setWatermarkText(s.watermarkText ?? 'PAID');
    setWatermarkType(s.watermarkType ?? 'none');
    setHidePrices(!!s.hidePrices);
    setManualTotal(s.manualTotal !== undefined && s.manualTotal !== null ? String(s.manualTotal) : '');
  };

  useEffect(() => {
    if (skipSyncRef.current) {
      skipSyncRef.current = false;
      return;
    }
    const saved = draft.load();
    if (saved) {
      applySnapshot(saved);
      setIsDirty(true);
      return;
    }
    if (existingInv) {
      setNumber(existingInv.number);
      setCustomerId(existingInv.customerId);
      setDate(new Date(existingInv.date));
      setDueDate(new Date(existingInv.dueDate));
      setStatus(existingInv.status);
      setPaymentTerms(existingInv.paymentTerms);
      setLineItems(JSON.parse(JSON.stringify(existingInv.lineItems)));
      setNotes(existingInv.notes || '');
      setTerms(existingInv.terms || '');
      setCurrency(existingInv.currency);
      setLinkedQuoteId(existingInv.linkedQuoteId);
      setSubject(existingInv.subject || '');
      setSubjectAr(existingInv.subjectAr || '');
      setWatermarkText(existingInv.watermarkText || 'PAID');
      setWatermarkType(existingInv.watermarkType || 'none');
      setHidePrices(!!existingInv.hidePrices);
      setManualTotal(existingInv.manualTotal !== undefined && existingInv.manualTotal !== null ? String(existingInv.manualTotal) : '');
      setIsDirty(false);
    } else {
      const nextNum = `INV-2026-${String(invoices.length + 1).padStart(4, '0')}`;
      setNumber(nextNum);
      setCustomerId('');
      setDate(new Date());
      setDueDate(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000));
      setStatus('draft');
      setPaymentTerms('Net 30');
      setSubject('');
      setSubjectAr('');
      setLineItems([
        {
          id: 'li-init-inv',
          type: 'item',
          description: '',
          quantity: 1,
          unit: 'pc',
          unitPrice: 0,
          discountPercent: 0,
          taxPercent: 15,
          subtotal: 0
        }
      ]);
      setNotes('Please settle within the payment period.\nالرجاء السداد خلال فترة الدفع المحددة.');
      setTerms(
        "BANK DETAILS: ALINMA BANK - Account: 68206662020000\nIBAN: SA0305000068206662020000 ABDULMOSHIN ABDULAZIZ AL-JABR TRADING CO."
      );
      setCurrency(company.currency);
      setLinkedQuoteId(undefined);
      setWatermarkText('PAID');
      setWatermarkType('none');
      setHidePrices(false);
      setManualTotal('');
      setIsDirty(false);
    }
  }, [id, existingInv]);

  // Handle automatic dynamic due-date setting based on terms drop-down
  useEffect(() => {
    if (isNew || status === 'draft') {
      const days = paymentTerms === 'Net 15' ? 15 : paymentTerms === 'Net 30' ? 30 : 0;
      setDueDate(new Date(date.getTime() + days * 24 * 60 * 60 * 1000));
    }
  }, [paymentTerms, date]);

  // Persist draft on every edit while dirty.
  useEffect(() => {
    if (!isDirty) return;
    draft.save({
      number, customerId, date, dueDate, status, paymentTerms, lineItems, notes, terms,
      currency, linkedQuoteId, subject, subjectAr, watermarkText, watermarkType, hidePrices, manualTotal,
    });
  }, [isDirty, number, customerId, date, dueDate, status, paymentTerms, lineItems, notes, terms,
      currency, linkedQuoteId, subject, subjectAr, watermarkText, watermarkType, hidePrices, manualTotal]);

  const totals = calculateTotals(lineItems);

  const getPayload = (): Invoice => {
    const finalTotal = manualTotal !== '' ? Number(manualTotal) : totals.total;
    const finalSubtotal = manualTotal !== '' ? Math.round((finalTotal / 1.15) * 100) / 100 : totals.subtotal;
    const finalTaxTotal = manualTotal !== '' ? Math.round((finalTotal - finalSubtotal) * 100) / 100 : totals.taxTotal;

    return {
      id: isNew ? newId : id,
      number,
      customerId,
      date,
      dueDate,
      status,
      paymentTerms,
      lineItems,
      notes,
      terms,
      subject,
      subjectAr,
      currency,
      subtotal: finalSubtotal,
      discountTotal: manualTotal !== '' ? 0 : totals.discountTotal,
      taxTotal: finalTaxTotal,
      total: finalTotal,
      payments: existingInv ? existingInv.payments : [],
      amountPaid: existingInv ? existingInv.amountPaid : 0,
      amountDue: Math.round((finalTotal - (existingInv ? existingInv.amountPaid : 0)) * 100) / 100,
      linkedQuoteId,
      createdAt: existingInv ? existingInv.createdAt : new Date(),
      updatedAt: new Date(),
      watermarkText,
      watermarkType,
      hidePrices,
      manualTotal: manualTotal !== '' ? Number(manualTotal) : undefined
    };
  };

  const { status: autoSaveStatus, performSave } = useAutoSave<Invoice>({
    isDirty,
    getPayload,
    saveFn: async (payload) => {
      if (isNew && !committedRef.current) {
        committedRef.current = true;
        const ok = await addInvoice(payload);
        if (!ok) committedRef.current = false;
        return ok;
      }
      return await updateInvoice(payload);
    },
    onSaveSuccess: (payload) => {
      setIsDirty(false);
      draft.clear();
      if (isNew) {
        skipSyncRef.current = true;
        setRoute('invoice-detail', payload.id);
      }
    },
    isReady: !!customerId
  });

  // Line item manipulation
  const handleAddLine = () => {
    const newItem: LineItem = {
      id: `li-i-${Date.now()}`,
      type: 'item',
      description: '',
      quantity: 1,
      unit: 'pc',
      unitPrice: 0,
      discountPercent: 0,
      taxPercent: company.defaultTax,
      subtotal: 0
    };
    setLineItems([...lineItems, newItem]);
    setIsDirty(true);
  };

  const handleAddSection = () => {
    const newSec: LineItem = {
      id: `sec-i-${Date.now()}`,
      type: 'section',
      description: 'Section title...',
      quantity: 0,
      unit: 'pc',
      unitPrice: 0,
      discountPercent: 0,
      taxPercent: 0,
      subtotal: 0
    };
    setLineItems([...lineItems, newSec]);
    setIsDirty(true);
  };

  const handleAddNote = () => {
    const newNote: LineItem = {
      id: `note-i-${Date.now()}`,
      type: 'note',
      description: 'Invoice note details...',
      quantity: 0,
      unit: 'pc',
      unitPrice: 0,
      discountPercent: 0,
      taxPercent: 0,
      subtotal: 0
    };
    setLineItems([...lineItems, newNote]);
    setIsDirty(true);
  };

  const handleUpdateLine = (lineId: string, fields: Partial<LineItem>) => {
    setLineItems(
      lineItems.map((item) => {
        if (item.id !== lineId) return item;
        const updated = { ...item, ...fields };
        if (updated.type === 'item') {
          const amt = updated.quantity * updated.unitPrice;
          updated.subtotal = Math.round((amt - amt * (updated.discountPercent / 100)) * 100) / 100;
        }
        return updated;
      })
    );
    setIsDirty(true);
  };

  const handleProductSelect = async (lineId: string, product: Product) => {
    let enDesc = product.name;
    let arDesc = '';
    
    if (product.name.includes(' / ')) {
      const parts = product.name.split(' / ');
      enDesc = parts[0].trim();
      arDesc = parts[1]?.trim() || '';
    }
    
    if (product.description) {
      if (product.description.includes(' / ')) {
        const descParts = product.description.split(' / ');
        enDesc += `\n${descParts[0].trim()}`;
        arDesc += arDesc ? `\n${descParts[1]?.trim() || ''}` : (descParts[1]?.trim() || '');
      } else {
        enDesc += `\n${product.description}`;
      }
    }

    if (!arDesc && enDesc) {
      const tr = await translateText(enDesc);
      if (tr) arDesc = tr;
    }

    handleUpdateLine(lineId, {
      productId: product.id,
      description: arDesc ? `${enDesc} / ${arDesc}` : enDesc,
      unit: product.unit,
      unitPrice: product.unitPrice,
      taxPercent: product.taxRate
    });
  };

  const handleDeleteLine = (lineId: string) => {
    setLineItems(lineItems.filter((i) => i.id !== lineId));
    setIsDirty(true);
  };

  const handleSave = async () => {
    if (!customerId) {
      alert('Please select a customer / الرجاء اختيار العميل');
      return;
    }

    const success = await performSave();
    if (success) {
      draft.clear();
      setRoute('invoices');
    } else {
      alert('Failed to save invoice / فشل حفظ الفاتورة');
    }
  };

  const handlePost = () => {
    setStatus('posted');
    setIsDirty(true);
    alert('Invoice Posted successfully! Ready to accept payment transactions.');
  };

  const handleRegisterPayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (payAmount <= 0) {
      alert('Payment amount must be greater than zero / الرجاء إدخال مبلغ صالح');
      return;
    }

    const newPayment: Payment = {
      id: `pay-${Date.now()}`,
      date: new Date(),
      amount: payAmount,
      method: payMethod,
      reference: payRef,
      note: payNote
    };

    recordPayment(id, newPayment);
    setPaymentModalOpen(false);
    setPayAmount(0);
    setPayRef('');
    setPayNote('');
    alert('Payment registered successfully!');
  };

  const handleDelete = () => {
    deleteInvoice(id);
    draft.clear();
    setRoute('invoices');
  };

  const [isTranslating, setIsTranslating] = useState(false);

  const translateText = async (text: string): Promise<string> => {
    if (!text) return '';
    try {
      const res = await fetch('/api/translate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ text })
      });
      if (res.ok) {
        const data = await res.json();
        return data.translation || '';
      }
    } catch (e) {
      console.error(e);
    }
    return '';
  };

  const handleAutoTranslateAll = async () => {
    if (lineItems.length === 0) return;
    const isConfirm = window.confirm('This will translate all English fields in your items and terms to bilingual Arabic formats. Proceed?');
    if (!isConfirm) return;

    setIsTranslating(true);
    try {
      // 0. Translate Subject
      if (subject) {
        const trSubject = await translateText(subject);
        if (trSubject) setSubjectAr(trSubject);
      }

      // 1. Translate Notes & Terms
      if (notes) {
        const cleanNotes = notes.split('\n').map(line => line.split(' | ')[0]).join('\n');
        const translatedNotes = await translateText(cleanNotes);
        if (translatedNotes) {
          setNotes(`${cleanNotes}\n${translatedNotes}`);
        }
      }

      if (terms) {
        const lines = terms.split('\n');
        const translatedLines = [];
        for (const line of lines) {
          if (!line.trim()) continue;
          const eng = line.split('/')[0].split('|')[0].trim();
          const tr = await translateText(eng);
          if (tr) {
            translatedLines.push(`${eng}\n${tr}`);
          } else {
            translatedLines.push(line);
          }
        }
        setTerms(translatedLines.join('\n'));
      }

      // 2. Translate Line Items
      const updatedLines = [];
      for (const item of lineItems) {
        if (item.type === 'item' && item.description) {
          const parts = item.description.split('/');
          const engPart = parts[0].trim();
          const tr = await translateText(engPart);
          if (tr) {
            updatedLines.push({
              ...item,
              description: `${engPart} / ${tr}`
            });
          } else {
            updatedLines.push(item);
          }
        } else {
          updatedLines.push(item);
        }
      }
      setLineItems(updatedLines);
      setIsDirty(true);
      alert('Translation completed! Document is now bilingual.');
    } catch (err) {
      console.error('Translation error:', err);
      alert('Some fields failed to translate.');
    } finally {
      setIsTranslating(false);
    }
  };

  const documentData = {
    id,
    number,
    customerId,
    date,
    validUntil: dueDate,
    status,
    lineItems,
    notes,
    terms,
    subject,
    subjectAr,
    currency,
    subtotal: manualTotal !== '' ? Number(manualTotal) / 1.15 : totals.subtotal,
    discountTotal: manualTotal !== '' ? 0 : totals.discountTotal,
    taxTotal: manualTotal !== '' ? Number(manualTotal) - (Number(manualTotal) / 1.15) : totals.taxTotal,
    total: manualTotal !== '' ? Number(manualTotal) : totals.total,
    watermarkText,
    watermarkType,
    hidePrices,
    manualTotal: manualTotal !== '' ? Number(manualTotal) : undefined
  };

  const custObj = customers.find((c) => c.id === customerId);

  return (
    <div className="animate-fade-in text-left">
      <PageHeader
        title={isNew ? 'New Invoice / فاتورة جديدة' : `${number}`}
        breadcrumbs={[
          { label: 'Home', onClick: () => setRoute('dashboard') },
          { label: 'Invoices', onClick: () => setRoute('invoices') },
          { label: isNew ? 'New' : number }
        ]}
        actions={
          <div className="flex gap-2 items-center">
            <AutoSaveIndicator status={autoSaveStatus} onRetry={performSave} />
            
            <button
              onClick={handleAutoTranslateAll}
              disabled={isTranslating}
              className="bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-xs font-semibold py-2 px-4 rounded-md flex items-center gap-1.5 transition-colors shadow-sm cursor-pointer"
              title="Translate all items & terms to Arabic automatically"
            >
              <Globe className="w-4 h-4" />
              {isTranslating ? 'Translating...' : 'Bilingual Translate / ترجمة ثنائية اللغة'}
            </button>

            <button
              onClick={handleSave}
              className="bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white text-xs font-semibold py-2 px-4 rounded-md flex items-center gap-1.5 transition-colors shadow-sm cursor-pointer"
            >
              <Save className="w-4 h-4" />
              Save Draft / حفظ
            </button>

            {!isNew && (
              <>
                {status === 'draft' && (
                  <button
                    onClick={handlePost}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold py-2 px-4 rounded-md flex items-center gap-1.5 transition-colors shadow-sm cursor-pointer"
                  >
                    <CheckCircle className="w-4 h-4" />
                    Post Invoice / ترحيل الفاتورة
                  </button>
                )}

                {status !== 'draft' && status !== 'paid' && (
                  <button
                    onClick={() => {
                      setPayAmount(existingInv ? existingInv.amountDue : totals.total);
                      setPaymentModalOpen(true);
                    }}
                    className="bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white text-xs font-semibold py-2 px-4 rounded-md flex items-center gap-1.5 transition-colors shadow-sm cursor-pointer"
                  >
                    <DollarSign className="w-4 h-4" />
                    Register Payment / تسجيل الدفع
                  </button>
                )}

                <button
                  onClick={() => setPdfModalOpen(true)}
                  className="bg-[var(--color-surface-offset)] hover:bg-[var(--color-divider)] border border-[var(--color-border)] text-[var(--color-text)] text-xs font-semibold py-2 px-4 rounded-md flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  Print PDF / طباعة
                </button>

                <div className="relative group">
                  <button className="bg-[var(--color-surface-offset)] hover:bg-[var(--color-divider)] border border-[var(--color-border)] text-[var(--color-text)] text-xs font-semibold py-2 px-3 rounded-md flex items-center transition-colors cursor-pointer">
                    Actions <ChevronDown className="w-3.5 h-3.5 ml-1" />
                  </button>
                  <div className="absolute right-0 top-full mt-1 hidden group-hover:block bg-[var(--color-surface)] border border-[var(--color-border)] rounded-md shadow-lg py-1 w-32 z-10">
                    {(currentUser?.role === 'admin' || !!currentUser?.permissions?.canDeleteData) && (
                      <button
                        onClick={() => setDeleteConfirmOpen(true)}
                        className="w-full text-left px-3 py-1.5 text-xs text-[var(--color-error)] hover:bg-[var(--color-error)]/10 font-semibold flex items-center gap-1.5 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Delete
                      </button>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        }
      />

      <div className="flex flex-col gap-6">
        <div className="w-full flex flex-col gap-6">
          {/* Dates & Payment Terms card (Moved above Invoice Builder) */}
          <div className="premium-card p-6">
            <span className="text-xs font-bold text-[var(--color-text)] uppercase tracking-wider border-b border-[var(--color-divider)]/40 pb-2 mb-4 block">
              Dates & Payment Terms / المواعيد وشروط الدفع
            </span>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <DatePicker
                label="Invoice Date / تاريخ الفاتورة"
                value={date}
                onChange={(d) => {
                  setDate(d);
                  setIsDirty(true);
                }}
              />

              <div>
                <label className="block text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-2">
                  Payment Terms / فترة السداد
                </label>
                <select
                  value={paymentTerms}
                  onChange={(e) => {
                    setPaymentTerms(e.target.value);
                    setIsDirty(true);
                  }}
                  disabled={status !== 'draft'}
                  className="w-full premium-input"
                >
                  <option value="Due on Receipt">Due on Receipt / عند الاستلام</option>
                  <option value="Net 15">Net 15 Days / بعد 15 يوماً</option>
                  <option value="Net 30">Net 30 Days / بعد 30 يوماً</option>
                </select>
              </div>

              <DatePicker
                label="Due Date / تاريخ الاستحقاق"
                value={dueDate}
                disabled={status !== 'draft'}
                onChange={(d) => {
                  setDueDate(d);
                  setIsDirty(true);
                }}
              />
            </div>

            {/* PDF Watermark Configuration */}
            {canUseWatermark && (
              <>
                <div className="border-t border-[var(--color-divider)]/40 my-4" />

                <span className="text-xs font-bold text-[var(--color-text)] uppercase tracking-wider mb-3 block">
                  PDF Watermark Configuration / إعدادات العلامة المائية
                </span>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-2">
                      Watermark Placement / نمط العلامة المائية
                    </label>
                    <select
                      value={watermarkType}
                      onChange={(e) => {
                        setWatermarkType(e.target.value as any);
                        setIsDirty(true);
                      }}
                      className="w-full premium-input font-bold"
                    >
                      <option value="none">Disabled / معطل</option>
                      <option value="center">Center / في المنتصف</option>
                      <option value="multi">Repeated Grid / شبكة متكررة</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-2">
                      Watermark Text / نص العلامة المائية
                    </label>
                    <input
                      type="text"
                      value={watermarkText}
                      onChange={(e) => {
                        setWatermarkText(e.target.value);
                        setIsDirty(true);
                      }}
                      disabled={watermarkType === 'none'}
                      className="w-full premium-input font-bold uppercase disabled:opacity-50 disabled:cursor-not-allowed"
                      placeholder="e.g. PAID, DRAFT, CONFIDENTIAL"
                    />
                  </div>
                </div>
              </>
            )}

            {/* Pricing Override Controls */}
            {canUsePricingControls && (
              <>
                <div className="border-t border-[var(--color-divider)]/40 my-4" />

                <span className="text-xs font-bold text-[var(--color-text)] uppercase tracking-wider mb-3 block">
                  Summary Calculations / ملخص الحساب
                </span>

                <div className="flex flex-col gap-4">
                  {/* Hide Prices Toggle */}
                  <label className="flex items-center gap-3 cursor-pointer group">
                    <div className="relative">
                      <input
                        type="checkbox"
                        checked={hidePrices}
                        onChange={(e) => {
                          setHidePrices(e.target.checked);
                          setIsDirty(true);
                        }}
                        className="sr-only"
                        id="inv-hide-prices-toggle"
                      />
                      <div
                        className={`w-9 h-5 rounded-full transition-colors ${hidePrices ? 'bg-[var(--color-primary)]' : 'bg-[var(--color-border)]'}`}
                      />
                      <div
                        className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${hidePrices ? 'translate-x-4' : 'translate-x-0'}`}
                      />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-[var(--color-text)] block">
                        Hide Table Prices on PDF / إخفاء أسعار البنود
                      </span>
                      <span className="text-[10px] text-[var(--color-text-muted)]">
                        Hides Unit Price and Net Price columns from the PDF document
                      </span>
                    </div>
                  </label>

                  {/* Manual Total Override */}
                  <div>
                    <label className="block text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-2">
                      Manual Grand Total Override / إجمالي يدوي مخصص
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={manualTotal}
                      disabled={!canOverridePrice}
                      onChange={(e) => {
                        setManualTotal(e.target.value);
                        setIsDirty(true);
                      }}
                      className="w-full premium-input font-mono font-bold disabled:opacity-60 disabled:cursor-not-allowed"
                      placeholder={`Auto-calculated / تلقائي (${totals.total.toFixed(2)} ${currency})`}
                    />
                    {manualTotal !== '' && canOverridePrice && (
                      <button
                        type="button"
                        onClick={() => { setManualTotal(''); setIsDirty(true); }}
                        className="mt-1 text-[10px] text-[var(--color-error)] hover:underline cursor-pointer font-semibold"
                      >
                        ✕ Clear override / مسح التعديل
                      </button>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>

          <div className="premium-card p-6">
            <div className="flex justify-between items-start border-b border-[var(--color-border)]/50 pb-4 mb-4">
              <div>
                <span className="text-sm font-bold text-[var(--color-text)] block">
                  Invoice Builder / تفاصيل الفاتورة
                </span>
                {linkedQuoteId && (
                  <span className="text-[10px] text-[var(--color-primary)] font-bold">
                    Linked to Quote / مرتبطة بالعرض: {quotations.find(q => q.id === linkedQuoteId)?.number || 'QT'}
                  </span>
                )}
              </div>
              <StatusBadge status={status} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div>
                <label className="block text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-2">
                  Invoice ID / رقم الفاتورة
                </label>
                <input
                  type="text"
                  value={number}
                  onChange={(e) => {
                    setNumber(e.target.value);
                    setIsDirty(true);
                  }}
                  className="w-full premium-input font-mono font-bold"
                  placeholder="INV-2026-0001"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-2">
                  Preferred Currency / العملة
                </label>
                <select
                  value={currency}
                  onChange={(e) => {
                    setCurrency(e.target.value);
                    setIsDirty(true);
                  }}
                  className="w-full premium-input"
                >
                  <option value="SAR">SAR (Saudi Riyal)</option>
                  <option value="USD">USD (US Dollar)</option>
                  <option value="EUR">EUR (Euro)</option>
                </select>
              </div>
            </div>

            {/* Bilingual Subject Input fields */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div>
                <label className="block text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-2">
                  Subject (English) / العنوان (بالإنجليزي)
                </label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => {
                    setSubject(e.target.value);
                    setIsDirty(true);
                  }}
                  onBlur={async () => {
                    if (subject && !subjectAr) {
                      const tr = await translateText(subject);
                      if (tr) setSubjectAr(tr);
                    }
                  }}
                  className="w-full premium-input"
                  placeholder="e.g. Supply and Installation of Security Systems"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-2">
                  Subject (Arabic) / العنوان (بالعربي)
                </label>
                <input
                  type="text"
                  value={subjectAr}
                  onChange={(e) => {
                    setSubjectAr(e.target.value);
                    setIsDirty(true);
                  }}
                  className="w-full premium-input text-right font-semibold"
                  placeholder="مثال: توريد وتركيب الأنظمة الأمنية"
                  dir="rtl"
                />
              </div>
            </div>

            <div className="mb-6">
              <CustomerCombobox selectedCustomerId={customerId} onSelect={(id) => {
                setCustomerId(id);
                setIsDirty(true);
              }} />
            </div>

            {custObj && (
              <div className="bg-[var(--color-surface-offset)] border border-[var(--color-border)] rounded-lg p-4 mb-6 text-sm flex flex-col md:flex-row gap-6 animate-slide-in">
                <div className="flex-1">
                  <div className="text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider mb-1">Billing Coordinates</div>
                  <div className="font-bold text-[var(--color-text)]">{custObj.companyName}</div>
                  <div className="text-[var(--color-text-muted)]">{custObj.contactPerson}</div>
                  <div className="text-[var(--color-text-muted)]">{custObj.email} | {custObj.phone}</div>
                </div>
                <div className="flex-1">
                  <div className="text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider mb-1">Billed To</div>
                  <div className="text-[var(--color-text-muted)]">
                    {custObj.billingAddress.street}, {custObj.billingAddress.city}
                  </div>
                  <div className="text-xs font-bold text-[var(--color-primary)] mt-1.5">
                    VAT / الرقم الضريبي: {custObj.vatNumber || 'Not registered'}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Tab switching */}
          <div className="border-b border-[var(--color-border)] flex gap-4">
            <button
              onClick={() => setActiveTab('items')}
              className={`pb-2.5 text-xs font-bold uppercase tracking-wider border-b-2 cursor-pointer ${
                activeTab === 'items'
                  ? 'border-[var(--color-primary)] text-[var(--color-primary)]'
                  : 'border-transparent text-[var(--color-text-muted)]'
              }`}
            >
              Line Items / البنود
            </button>
            
            {!isNew && existingInv && existingInv.payments.length > 0 && (
              <button
                onClick={() => setActiveTab('payments')}
                className={`pb-2.5 text-xs font-bold uppercase tracking-wider border-b-2 cursor-pointer ${
                  activeTab === 'payments'
                    ? 'border-[var(--color-primary)] text-[var(--color-primary)]'
                    : 'border-transparent text-[var(--color-text-muted)]'
                }`}
              >
                Payment Ledger ({existingInv.payments.length}) / سجل المقبوضات
              </button>
            )}

            <button
              onClick={() => setActiveTab('terms')}
              className={`pb-2.5 text-xs font-bold uppercase tracking-wider border-b-2 cursor-pointer ${
                activeTab === 'terms'
                  ? 'border-transparent text-[var(--color-text-muted)]'
                  : 'border-[var(--color-primary)] text-[var(--color-primary)]'
              }`}
            >
              Terms & Conditions / شروط الدفع
            </button>
          </div>

          {activeTab === 'items' ? (
            <div className="premium-card">
              <div className="overflow-x-auto w-full pb-36 min-h-[300px]">
                <table className="w-full text-sm text-left border-collapse">
                  <thead>
                    <tr className="bg-[var(--color-surface-offset)] border-b border-[var(--color-border)] text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">
                      <th className="py-2.5 px-3 w-8 text-center"></th>
                      <th className="py-2.5 px-3 w-8 text-center">#</th>
                      <th className="py-2.5 px-3 min-w-[650px] w-[700px]">Description / الوصف</th>
                      <th className="py-2.5 px-3 w-16 text-center">Qty</th>
                      <th className="py-2.5 px-3 w-20 text-center">Unit</th>
                      <th className="py-2.5 px-3 w-28 text-right">Price</th>
                      <th className="py-2.5 px-3 w-20 text-center">Disc %</th>
                      <th className="py-2.5 px-3 w-20 text-center">Tax %</th>
                      <th className="py-2.5 px-3 w-28 text-right">Subtotal</th>
                      <th className="py-2.5 px-3 w-10 text-center"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--color-divider)]">
                    {lineItems.map((item, idx) => (
                      <tr
                        key={item.id}
                        className={item.type !== 'item' ? 'bg-[var(--color-surface-offset)] font-bold' : ''}
                      >
                        <td className="py-2 px-1 text-center">
                          <GripVertical className="w-3.5 h-3.5 text-[var(--color-text-faint)] inline" />
                        </td>
                        <td className="py-2 px-1 text-xs text-center font-mono text-[var(--color-text-muted)]">
                          {idx + 1}
                        </td>
                        {/* Description field */}
                        <td className="py-2 px-2">
                          {item.type === 'item' ? (
                            <div className="flex gap-2 w-full items-start">
                              <InlineProductSearchInput
                                value={item.description.includes(' / ') ? item.description.split(' / ')[0] : item.description}
                                onChange={(val) => {
                                  const parts = item.description.includes(' / ') ? item.description.split(' / ') : [item.description, ''];
                                  const arPart = parts.slice(1).join(' / ') || '';
                                  handleUpdateLine(item.id, { description: `${val} / ${arPart}` });
                                }}
                                onBlur={async () => {
                                  const parts = item.description.includes(' / ') ? item.description.split(' / ') : [item.description, ''];
                                  const enPart = parts[0] || '';
                                  let arPart = parts.slice(1).join(' / ') || '';
                                  if (enPart && !arPart) {
                                    const tr = await translateText(enPart);
                                    if (tr) {
                                      handleUpdateLine(item.id, { description: `${enPart} / ${tr}` });
                                    }
                                  }
                                }}
                                onProductSelect={(prod) => handleProductSelect(item.id, prod)}
                                placeholder="Search & Type English Description... / ابحث واكتب الوصف"
                              />
                              <textarea
                                rows={1}
                                value={item.description.includes(' / ') ? item.description.split(' / ').slice(1).join(' / ') : ''}
                                onChange={(e) => {
                                  const parts = item.description.includes(' / ') ? item.description.split(' / ') : [item.description, ''];
                                  const enPart = parts[0] || '';
                                  handleUpdateLine(item.id, { description: `${enPart} / ${e.target.value}` });
                                }}
                                className="w-1/2 bg-transparent border border-transparent hover:border-[var(--color-border)] focus:border-[var(--color-primary)] focus:bg-[var(--color-surface-2)] rounded py-1 px-1.5 text-xs text-[var(--color-text)] focus:outline-none text-right resize-y font-semibold"
                                placeholder="الوصف بالعربي"
                                dir="rtl"
                              />
                            </div>
                          ) : (
                            <textarea
                              rows={1}
                              value={item.description}
                              onChange={(e) => handleUpdateLine(item.id, { description: e.target.value })}
                              className="w-full bg-transparent border border-transparent hover:border-[var(--color-border)] focus:border-[var(--color-primary)] focus:bg-[var(--color-surface-2)] rounded py-1 px-1.5 text-xs text-[var(--color-text)] focus:outline-none resize-y"
                              placeholder={
                                item.type === 'section' ? 'Enter Section Heading...' : 'Enter internal notes...'
                              }
                            />
                          )}
                        </td>
                        <td className="py-2 px-2">
                          {item.type === 'item' && (
                            <input
                              type="number"
                              min="0.01"
                              value={item.quantity}
                              onChange={(e) => handleUpdateLine(item.id, { quantity: parseFloat(e.target.value) || 0 })}
                              className="w-full bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded py-1 px-1 text-center text-xs text-[var(--color-text)] focus:outline-none"
                            />
                          )}
                        </td>
                        <td className="py-2 px-2">
                          {item.type === 'item' && (
                            <select
                              value={item.unit}
                              onChange={(e) => handleUpdateLine(item.id, { unit: e.target.value })}
                              className="w-full bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded py-1 px-1 text-center text-xs"
                            >
                              <option value="pc">pc</option>
                              <option value="set">set</option>
                              <option value="hr">hr</option>
                              <option value="day">day</option>
                            </select>
                          )}
                        </td>
                        <td className="py-2 px-2">
                          {item.type === 'item' && (
                            <input
                              type="number"
                              value={item.unitPrice}
                              onChange={(e) => handleUpdateLine(item.id, { unitPrice: parseFloat(e.target.value) || 0 })}
                              className="w-full bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded py-1 px-1 text-right text-xs font-mono"
                            />
                          )}
                        </td>
                        <td className="py-2 px-2">
                          {item.type === 'item' && (
                            <input
                              type="number"
                              value={item.discountPercent}
                              onChange={(e) => handleUpdateLine(item.id, { discountPercent: parseFloat(e.target.value) || 0 })}
                              className="w-full bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded py-1 px-1 text-center text-xs font-mono"
                            />
                          )}
                        </td>
                        <td className="py-2 px-2">
                          {item.type === 'item' && (
                            <select
                              value={item.taxPercent}
                              onChange={(e) => handleUpdateLine(item.id, { taxPercent: parseFloat(e.target.value) || 0 })}
                              className="w-full bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded py-1 px-1 text-center text-xs"
                            >
                              <option value="0">0%</option>
                              <option value="5">5%</option>
                              <option value="15">15%</option>
                            </select>
                          )}
                        </td>
                        <td className="py-2 px-3 text-right font-bold text-xs text-[var(--color-text)] font-mono">
                          {item.type === 'item' && item.subtotal.toFixed(2)}
                        </td>
                        <td className="py-2 px-2 text-center">
                          <button
                            type="button"
                            onClick={() => handleDeleteLine(item.id)}
                            className="p-1 hover:bg-[var(--color-error)]/10 text-[var(--color-text-faint)] hover:text-[var(--color-error)] rounded transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-wrap gap-2 px-4 py-3 bg-[var(--color-surface-offset)] border-t border-[var(--color-border)] justify-start">
                <button
                  type="button"
                  onClick={handleAddLine}
                  className="bg-white hover:bg-[var(--color-surface-offset)] border border-[var(--color-border)] text-[var(--color-text)] text-xs font-semibold py-1.5 px-3 rounded flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5 text-[var(--color-primary)]" /> Add Line
                </button>
                <button
                  type="button"
                  onClick={handleAddSection}
                  className="bg-white hover:bg-[var(--color-surface-offset)] border border-[var(--color-border)] text-[var(--color-text)] text-xs font-semibold py-1.5 px-3 rounded flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <PlusSquare className="w-3.5 h-3.5" /> Add Section
                </button>
                <button
                  type="button"
                  onClick={handleAddNote}
                  className="bg-white hover:bg-[var(--color-surface-offset)] border border-[var(--color-border)] text-[var(--color-text)] text-xs font-semibold py-1.5 px-3 rounded flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <FileText className="w-3.5 h-3.5" /> Add Note
                </button>
              </div>
            </div>
          ) : activeTab === 'payments' && existingInv ? (
            /* Payments Ledger List */
            <div className="premium-card p-6 flex flex-col gap-4">
              <span className="text-xs font-bold text-[var(--color-text)] uppercase tracking-wider block">
                Cash Flow Registry / سجل الدفعات والمحصلات
              </span>
              <div className="flex flex-col border border-[var(--color-border)] rounded-lg overflow-hidden divide-y divide-[var(--color-divider)] bg-[var(--color-surface-2)]">
                {existingInv.payments.map((p) => (
                  <div key={p.id} className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 text-xs font-semibold text-[var(--color-text-muted)] hover:bg-[var(--color-surface-offset)]/40 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded bg-emerald-500/10 text-emerald-600">
                        <DollarSign className="w-4 h-4" />
                      </div>
                      <div className="text-left">
                        <div className="font-bold text-[var(--color-text)]">{p.method.toUpperCase()} Payment</div>
                        <div className="text-[var(--color-text-muted)] font-mono">{p.reference || 'No Reference #'}</div>
                      </div>
                    </div>
                    <div className="text-left md:text-right">
                      <div className="font-bold text-[var(--color-text)] text-sm">{p.amount.toLocaleString()} {currency}</div>
                      <div className="text-[10px] font-mono text-[var(--color-text-muted)]">
                        {new Date(p.date).toLocaleString()}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="premium-card p-6 flex flex-col gap-4">
              <div>
                <label className="block text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-2">
                  Customer Internal Notes
                </label>
                <textarea
                  rows={4}
                  value={notes}
                  onChange={(e) => {
                    setNotes(e.target.value);
                    setIsDirty(true);
                  }}
                  onBlur={async () => {
                    if (notes && !notes.includes('\n') && !/[أ-ي]/.test(notes)) {
                      const tr = await translateText(notes);
                      if (tr) setNotes(`${notes}\n${tr}`);
                    }
                  }}
                  className="w-full premium-input text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-2">
                  Bank details & T&Cs
                </label>
                <textarea
                  rows={6}
                  value={terms}
                  onChange={(e) => {
                    setTerms(e.target.value);
                    setIsDirty(true);
                  }}
                  onBlur={async () => {
                    if (terms) {
                      const lines = terms.split('\n');
                      const translatedLines = [];
                      let hasUpdates = false;
                      for (const line of lines) {
                        if (!line.trim()) continue;
                        if (!/[أ-ي]/.test(line)) {
                          const tr = await translateText(line);
                          if (tr) {
                            translatedLines.push(`${line}\n${tr}`);
                            hasUpdates = true;
                            continue;
                          }
                        }
                        translatedLines.push(line);
                      }
                      if (hasUpdates) setTerms(translatedLines.join('\n'));
                    }
                  }}
                  className="w-full premium-input text-xs leading-relaxed"
                />
              </div>
            </div>
          )}
        </div>

        {/* Right Details Panel - right-aligned under table */}
        <div className="flex justify-end text-left w-full mt-4">
          {/* Invoices Balance calculations panel */}
          <div className="w-full md:w-96 premium-card p-6 bg-[var(--color-surface-offset)] border border-[var(--color-border)] rounded-xl shadow-lg">
            <span className="text-xs font-bold text-[var(--color-text)] uppercase tracking-wider border-b border-[var(--color-border)] pb-2 mb-4 block">
              Financial Summary / الملخص المالي
            </span>

            {manualTotal !== '' && (
              <div className="flex items-center gap-1.5 mb-3 text-[10px] font-bold text-amber-500 bg-amber-500/10 border border-amber-500/20 rounded px-2 py-1">
                ⚡ Manual total override active
              </div>
            )}

            <div className="flex flex-col gap-3 text-sm">
              <div className="flex justify-between text-[var(--color-text-muted)]">
                <span>Subtotal / المجموع:</span>
                <span className="font-mono">
                  {(manualTotal !== '' ? Number(manualTotal) / 1.15 : totals.subtotal).toFixed(2)} {currency}
                </span>
              </div>

              {manualTotal === '' && totals.discountTotal > 0 && (
                <div className="flex justify-between text-[var(--color-error)]">
                  <span>Total Discount / الخصم:</span>
                  <span className="font-mono">-{totals.discountTotal.toFixed(2)} {currency}</span>
                </div>
              )}

              <div className="flex justify-between text-[var(--color-text-muted)] border-b border-[var(--color-border)] pb-3 mb-2">
                <span>VAT (15%) / ضريبة:</span>
                <span className="font-mono">
                  {(manualTotal !== '' ? Number(manualTotal) - (Number(manualTotal) / 1.15) : totals.taxTotal).toFixed(2)} {currency}
                </span>
              </div>

              <div className="flex justify-between items-center rounded-xl p-4 bg-[#97F2B7] text-black shadow-inner mt-4">
                <span className="text-sm font-black uppercase tracking-wider">Invoice Total / الإجمالي العام:</span>
                <span className="text-2xl font-black font-mono">
                  {(manualTotal !== '' ? Number(manualTotal) : totals.total).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {currency}
                </span>
              </div>

              {!isNew && existingInv && (
                <>
                  <div className="flex justify-between items-baseline py-1 text-[var(--color-success)] font-semibold border-t border-[var(--color-border)] pt-2">
                    <span>Amount Paid / المقبوض:</span>
                    <span className="font-mono">
                      {existingInv.amountPaid.toLocaleString()} {currency}
                    </span>
                  </div>

                  <div className="flex justify-between items-baseline py-2 bg-[var(--color-surface)] border border-[var(--color-border)] px-3 rounded-md mt-1.5">
                    <span className="text-xs font-black text-[var(--color-error)] uppercase">Outstanding / المستحق:</span>
                    <span className="text-base font-black text-[var(--color-error)] font-mono">
                      {existingInv.amountDue.toLocaleString()} {currency}
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {!isNew && id && (
        <div className="mt-6">
          <DocumentTimeline docType="invoice" docId={id} />
        </div>
      )}

      {/* Dialog Modals */}
      <ConfirmDialog
        isOpen={deleteConfirmOpen}
        type="danger"
        title="Delete Invoice?"
        message={`Are you sure you want to delete ${number}? This action is destructive and cannot be undone.`}
        onConfirm={handleDelete}
        onClose={() => setDeleteConfirmOpen(false)}
      />

      {pdfModalOpen && (
        <PDFPreviewModal
          isOpen={pdfModalOpen}
          documentData={documentData}
          companyProfile={company}
          customerProfile={custObj}
          type="invoice"
          amountPaid={existingInv?.amountPaid}
          amountDue={existingInv?.amountDue}
          onClose={() => setPdfModalOpen(false)}
        />
      )}

      {emailModalOpen && (
        <EmailSendModal
          isOpen={emailModalOpen}
          to={custObj?.email || ''}
          subject={`Invoice ${number} from ${company.name}`}
          body={`Dear ${custObj?.contactPerson || 'Customer'},\n\nPlease find attached invoice ${number} detailing the security systems services.\n\nBest regards,\n${company.name}`}
          attachmentName={`${number}.pdf`}
          onClose={() => setEmailModalOpen(false)}
        />
      )}

      {/* Register Payment Dialog */}
      {paymentModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-fade-in" onClick={() => setPaymentModalOpen(false)} />
          <form
            onSubmit={handleRegisterPayment}
            className="relative w-full max-w-md bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl shadow-lg p-6 overflow-hidden animate-slide-in text-left"
          >
            <div className="flex items-center justify-between border-b border-[var(--color-border)] pb-3 mb-4">
              <h3 className="text-sm font-bold text-[var(--color-text)] flex items-center gap-1.5">
                <DollarSign className="w-5 h-5 text-emerald-600" />
                Register Payment Transaction / تسجيل مقبوضات
              </h3>
              <button
                type="button"
                onClick={() => setPaymentModalOpen(false)}
                className="p-1 hover:bg-[var(--color-surface-offset)] rounded transition-colors"
              >
                <X className="w-4 h-4 text-[var(--color-text-muted)]" />
              </button>
            </div>

            <div className="flex flex-col gap-4 text-xs font-semibold text-[var(--color-text-muted)]">
              <div>
                <label className="block uppercase tracking-wider mb-2">Payment Amount / مبلغ السداد *</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={payAmount === 0 ? '' : payAmount}
                  onChange={(e) => setPayAmount(parseFloat(e.target.value) || 0)}
                  className="w-full premium-input text-sm font-mono font-bold"
                  placeholder="0.00"
                />
              </div>

              <div>
                <label className="block uppercase tracking-wider mb-2">Method / طريقة السداد</label>
                <select
                  value={payMethod}
                  onChange={(e) => setPayMethod(e.target.value as Payment['method'])}
                  className="w-full premium-input text-sm text-[var(--color-text)] font-semibold"
                >
                  <option value="bank_transfer">Bank Transfer / تحويل بنكي</option>
                  <option value="cash">Cash / نقداً</option>
                  <option value="card">Card / بطاقة ائتمانية</option>
                  <option value="cheque">Cheque / شيك</option>
                </select>
              </div>

              <div>
                <label className="block uppercase tracking-wider mb-2">Reference / الرقم المرجعي</label>
                <input
                  type="text"
                  value={payRef}
                  onChange={(e) => setPayRef(e.target.value)}
                  className="w-full premium-input text-sm font-mono"
                  placeholder="e.g. TR-99001122"
                />
              </div>

              <div>
                <label className="block uppercase tracking-wider mb-2">Notes / ملاحظات</label>
                <textarea
                  rows={2}
                  value={payNote}
                  onChange={(e) => setPayNote(e.target.value)}
                  className="w-full premium-input text-xs"
                  placeholder="Memo details..."
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 mt-6 border-t border-[var(--color-divider)]/40 pt-4">
              <button
                type="button"
                onClick={() => setPaymentModalOpen(false)}
                className="px-4 py-2 border border-[var(--color-border)] hover:bg-[var(--color-surface-offset)] rounded-md text-xs font-semibold text-[var(--color-text)] transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white rounded-md text-xs font-semibold transition-colors cursor-pointer"
              >
                Register Payment
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
export default InvoiceDetail;
