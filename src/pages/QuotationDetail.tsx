import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useERPStore, calculateTotals } from '../store';
import { Customer, Product, LineItem, Quotation } from '../types';
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
import { CurrencyInput } from '../components/CurrencyInput';
import {
  Plus,
  Trash2,
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
  Globe
} from 'lucide-react';
import { PDFPreviewModal } from '../components/PDFPreviewModal';
import { EmailSendModal } from '../components/EmailSendModal';
import { DocumentTimeline } from '../components/DocumentTimeline';
import { getLineNumber } from '../utils/lineNumber';
import type { LineNumberFormat } from '../utils/lineNumber';

interface QuotationDetailProps {
  id: string; // 'new' or a quotation id
}

export const QuotationDetail: React.FC<QuotationDetailProps> = ({ id }) => {
  const {
    quotations,
    customers,
    products,
    setRoute,
    addQuotation,
    updateQuotation,
    deleteQuotation,
    convertToInvoice,
    company,
    token,
    currentUser
  } = useERPStore();

  const isNew = id === 'new';
  const canOverridePrice = currentUser?.role === 'admin' || !!currentUser?.permissions?.canOverridePrice;
  const canUseWatermark = currentUser?.role === 'admin' || !!currentUser?.permissions?.canUseWatermark;
  const canUsePricingControls = currentUser?.role === 'admin' || !!currentUser?.permissions?.canUsePricingControls;
  const canUseMarkup = currentUser?.role === 'admin' || !!currentUser?.permissions?.canUseMarkup;
  const existingQuote = quotations.find((q) => q.id === id);

  // Core Quote Form State
  const [number, setNumber] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [date, setDate] = useState<Date>(new Date());
  const [validUntil, setValidUntil] = useState<Date>(new Date(Date.now() + 15 * 24 * 60 * 60 * 1000)); // 15 days validity
  const [status, setStatus] = useState<Quotation['status']>('draft');
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [notes, setNotes] = useState('');
  const [terms, setTerms] = useState('');
  const [currency, setCurrency] = useState('SAR');
  const [subject, setSubject] = useState('');
  const [subjectAr, setSubjectAr] = useState('');
  const [watermarkText, setWatermarkText] = useState('DRAFT');
  const [watermarkType, setWatermarkType] = useState<'none' | 'center' | 'multi'>('none');
  const [hidePrices, setHidePrices] = useState(false);
  const [manualTotal, setManualTotal] = useState<number | ''>('');

  // Form Utility States
  const [isDirty, setIsDirty] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [pdfModalOpen, setPdfModalOpen] = useState(false);
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'items' | 'terms'>('items');

  // Populate data on load
  const skipSyncRef = useRef(false);
  const committedRef = useRef(false); // true once this new quote has been created server-side
  const [newId] = useState(() => `qt-${Date.now()}-${Math.floor(Math.random() * 10000)}`);

  // localStorage-backed draft: survives navigation (e.g. jump to Products & back)
  // and reloads, independent of server autosave. Keyed by the route id ('new' or real id).
  const draft = useDraft<any>('quotation', id);

  // Apply a draft/quote snapshot to all form fields.
  const applySnapshot = (s: any) => {
    setNumber(id === 'new' ? '' : (s.number ?? ''));
    setCustomerId(s.customerId ?? '');
    setDate(s.date ? new Date(s.date) : new Date());
    setValidUntil(s.validUntil ? new Date(s.validUntil) : new Date(Date.now() + 15 * 24 * 60 * 60 * 1000));
    setStatus(s.status ?? 'draft');
    setLineItems(s.lineItems ? JSON.parse(JSON.stringify(s.lineItems)) : []);
    setNotes(s.notes ?? '');
    setTerms(s.terms ?? '');
    setCurrency(s.currency ?? company.currency);
    setSubject(s.subject ?? '');
    setSubjectAr(s.subjectAr ?? '');
    setWatermarkText(s.watermarkText ?? 'DRAFT');
    setWatermarkType(s.watermarkType ?? 'none');
    setHidePrices(s.hidePrices ?? false);
    setManualTotal(s.manualTotal !== undefined && s.manualTotal !== null ? s.manualTotal : '');
    if (s.markup !== undefined && s.markup !== null) setMarkup(s.markup);
  };

  useEffect(() => {
    if (skipSyncRef.current) {
      skipSyncRef.current = false;
      return;
    }

    if (isNew) {
      // For NEW quotations: always start completely fresh.
      // Clear any stale draft from a previous abandoned "new" session.
      draft.clear();

      // Reset form to blank defaults
      setNumber('');
      setCustomerId('');
      setDate(new Date());
      setValidUntil(new Date(Date.now() + 15 * 24 * 60 * 60 * 1000));
      setStatus('draft');
      setSubject('');
      setSubjectAr('');
      setLineItems([
        {
          id: 'li-init',
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
      setNotes('Any additional work/device will be considered Change Order.\nسيتم اعتبار أي عمل إضافي بمثابة أمر تغيير.');
      setTerms(
        "Payment: 50% Downpayment | Balance Upon Delivery\nمقدم 50% | الرصيد عند التسليم\nWarranty: 2 YEARS limited warranty and/or supplier's recommendation\nضمان محدود لمدة عامين وأو توصية المورد\nManpower: 4 Technicians, 1 Supervisor\nفنيين 1 مشرف 4\nBANK DETAILS: ALINMA BANK - Account: 68206662020000\nIBAN: SA0305000068206662020000 ABDULMOSHIN ABDULAZIZ AL-JABR TRADING CO."
      );
      setCurrency(company.currency);
      setWatermarkText('DRAFT');
      setWatermarkType('none');
      setHidePrices(false);
      setManualTotal('');
      setIsDirty(false);
      return;
    }

    // ── EXISTING document (id is a real ID) ──

    // Try restoring an unsaved draft (user navigated away mid-edit)
    const saved = draft.load();
    if (saved) {
      applySnapshot(saved);
      setIsDirty(true);
      return;
    }

    // Populate from the store if the quote is loaded
    if (existingQuote) {
      setNumber(existingQuote.number);
      setCustomerId(existingQuote.customerId);
      setDate(new Date(existingQuote.date));
      setValidUntil(new Date(existingQuote.validUntil));
      setStatus(existingQuote.status);
      setLineItems(JSON.parse(JSON.stringify(existingQuote.lineItems))); // copy
      setNotes(existingQuote.notes || '');
      setTerms(existingQuote.terms || '');
      setCurrency(existingQuote.currency);
      setSubject(existingQuote.subject || '');
      setSubjectAr(existingQuote.subjectAr || '');
      setWatermarkText(existingQuote.watermarkText || 'DRAFT');
      setWatermarkType(existingQuote.watermarkType || 'none');
      setHidePrices(existingQuote.hidePrices || false);
      setManualTotal(existingQuote.manualTotal !== undefined && existingQuote.manualTotal !== null ? existingQuote.manualTotal : '');
      setIsDirty(false);
    }
    // If existingQuote is not yet loaded (store still updating after POST),
    // do nothing — the effect will re-run when existingQuote becomes available.
  }, [id, existingQuote]);

  useEffect(() => {
    if (isNew) {
      const token = useERPStore.getState().token;
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      fetch('/api/settings/defaultMarkupPercentage', { headers })
        .then((res) => res.json())
        .then((data) => {
          if (data.value) {
            setMarkup(parseFloat(data.value) || 0);
          }
        })
        .catch(console.error);
    }
  }, [id, isNew]);

  // Pricing Markup State (M.U. %)
  const [markup, setMarkup] = useState<number>(8);

  // MU keyword filters (legacy defaults: Installation excluded, Materials zero markup)
  const [muFilters] = useState<{ zeroMarkup: string[]; excluded: string[] }>({
    zeroMarkup: ['Materials'],
    excluded: ['Installation']
  });

  // Persist a draft snapshot on every edit while dirty; nothing lingers once saved.
  useEffect(() => {
    if (!isDirty) return;
    draft.save({
      number, customerId, date, validUntil, status, lineItems, notes, terms,
      subject, subjectAr, currency, watermarkText, watermarkType, hidePrices,
      manualTotal, markup,
    });
  }, [isDirty, number, customerId, date, validUntil, status, lineItems, notes, terms,
      subject, subjectAr, currency, watermarkText, watermarkType, hidePrices, manualTotal, markup]);

  // Height synchronization states for side-by-side Analysis Sidebar
  const rowRefs = useRef<Map<string, HTMLTableRowElement>>(new Map());
  const descriptionArRefs = useRef<Map<string, HTMLTextAreaElement>>(new Map());
  const descriptionRowRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const headerRef = useRef<HTMLTableRowElement | null>(null);
  const tableWrapperRef = useRef<HTMLDivElement | null>(null);
  const [rowHeights, setRowHeights] = useState<number[]>([]);
  const [headerHeight, setHeaderHeight] = useState<number>(44);

  const adjustRowDescriptionHeights = (itemId: string) => {
    const rowEl = descriptionRowRefs.current.get(itemId);
    const arEl = descriptionArRefs.current.get(itemId);
    if (!rowEl) return;
    const searchInput = rowEl.querySelector('input, textarea') as HTMLElement | null;
    if (searchInput) searchInput.style.height = 'auto';
    if (arEl) arEl.style.height = 'auto';
    const searchHeight = searchInput ? searchInput.scrollHeight : 0;
    const arHeight = arEl ? arEl.scrollHeight : 0;
    const maxHeight = Math.max(searchHeight, arHeight, 28);
    if (searchInput) searchInput.style.height = `${maxHeight}px`;
    if (arEl) arEl.style.height = `${maxHeight}px`;
  };

  const adjustAllDescriptionHeights = () => {
    requestAnimationFrame(() => {
      lineItems.forEach((item) => {
        if (item.type === 'item') adjustRowDescriptionHeights(item.id);
      });
    });
  };

  useEffect(() => {
    adjustAllDescriptionHeights();
  }, [lineItems]);

  useEffect(() => {
    window.addEventListener('resize', adjustAllDescriptionHeights);
    return () => window.removeEventListener('resize', adjustAllDescriptionHeights);
  }, [lineItems]);

  // Sync heights of table rows with Analysis Sidebar rows using ResizeObserver
  useEffect(() => {
    let animationFrameId = 0;

    const updateHeights = () => {
      animationFrameId = window.requestAnimationFrame(() => {
        if (headerRef.current) {
          setHeaderHeight(Math.ceil(headerRef.current.getBoundingClientRect().height));
        }
        const heights = lineItems.map((item) => {
          const el = rowRefs.current.get(item.id);
          return el ? Math.ceil(el.getBoundingClientRect().height) : 40;
        });
        setRowHeights(heights);
      });
    };

    const observer = new ResizeObserver(updateHeights);

    if (headerRef.current) observer.observe(headerRef.current);
    if (tableWrapperRef.current) observer.observe(tableWrapperRef.current);
    rowRefs.current.forEach((el) => {
      if (el) observer.observe(el);
    });

    updateHeights();
    const t1 = setTimeout(updateHeights, 50);
    const t2 = setTimeout(updateHeights, 200);
    const t3 = setTimeout(updateHeights, 500);

    return () => {
      observer.disconnect();
      window.cancelAnimationFrame(animationFrameId);
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [lineItems]);

  // Recalculate unitPrice based on global markup changes
  useEffect(() => {
    setLineItems((prevItems) =>
      prevItems.map((item) => {
        if (
          item.type !== 'item' ||
          (item.manualPrice !== undefined && item.manualPrice !== null) ||
          item.originalPrice === undefined ||
          item.originalPrice === null
        ) {
          return item;
        }

        const newUnitPrice = Math.round(item.originalPrice * (1 + markup / 100) * 100) / 100;
        const baseAmount = item.quantity * newUnitPrice;
        const discountAmount = baseAmount * (item.discountPercent / 100);

        return {
          ...item,
          unitPrice: newUnitPrice,
          subtotal: Math.round((baseAmount - discountAmount) * 100) / 100
        };
      })
    );
  }, [markup]);

  // Recalculate totals reactive to lineItems
  const storeTotals = calculateTotals(lineItems);

  // --- ADVANCED MU CALCULATIONS (aligned with legacy Dynamic Quotation) ---
  const getItemRule = (item: LineItem) => {
    if (item.type !== 'item') return 'EXCL';

    // Manual override takes precedence
    if (item.ruleOverride === 'EXCL') return 'EXCL';
    if (item.ruleOverride === 'INCL') {
      const desc = (item.description || '').toLowerCase();
      if (muFilters.zeroMarkup.some((kw) => desc.includes(kw.toLowerCase()))) return 'ZM';
      const hasManual = item.manualPrice !== undefined && item.manualPrice !== null;
      const hasDB = item.originalPrice !== undefined && item.originalPrice !== null;
      const isMaterials = desc.includes('materials');
      if (hasManual && (isMaterials || !hasDB)) return 'MAN';
      if (hasDB) return 'DB';
      return '--';
    }

    // Default automatic keyword checks
    const desc = (item.description || '').toLowerCase();
    if (muFilters.excluded.some((kw) => desc.includes(kw.toLowerCase()))) return 'EXCL';
    if (muFilters.zeroMarkup.some((kw) => desc.includes(kw.toLowerCase()))) return 'ZM';

    const hasManual = item.manualPrice !== undefined && item.manualPrice !== null;
    const hasDB = item.originalPrice !== undefined && item.originalPrice !== null;
    const isMaterials = desc.includes('materials');

    if (hasManual && (isMaterials || !hasDB)) return 'MAN';
    if (hasDB) return 'DB';
    return '--';
  };

  // Item numbering — delegates to the shared utility respecting the company-wide format setting
  const getItemNumber = (idx: number): string => {
    const fmt = (company.lineNumberFormat || 'sequential') as LineNumberFormat;
    return getLineNumber(lineItems, idx, fmt);
  };

  const { baseTotal, markupProfit } = useMemo(() => {
    let baseTotal = 0;
    let markupProfit = 0;

    lineItems.forEach((item) => {
      if (item.type !== 'item') return;
      const rule = getItemRule(item);
      const saleTotal = item.subtotal || 0;

      if (rule === 'EXCL') {
        // Excluded from MU entirely
      } else if (rule === 'ZM') {
        baseTotal += saleTotal;
      } else {
        let itemBaseUnit = 0;
        if (rule === 'MAN') itemBaseUnit = item.manualPrice!;
        else if (rule === 'DB') itemBaseUnit = item.originalPrice!;

        const itemBaseTotal = itemBaseUnit * item.quantity;
        baseTotal += itemBaseTotal;
        markupProfit += saleTotal - itemBaseTotal;
      }
    });

    return { baseTotal, markupProfit };
  }, [lineItems, muFilters]);

  const totals = useMemo(() => {
    return {
      ...storeTotals,
      baseTotal: Math.round(baseTotal * 100) / 100,
      markupProfit: Math.round(markupProfit * 100) / 100
    };
  }, [storeTotals, baseTotal, markupProfit]);

  const getPayload = (): Quotation => {
    const finalTotal = manualTotal !== '' ? Number(manualTotal) : totals.total;
    const finalSubtotal = manualTotal !== '' ? Math.round((finalTotal / 1.15) * 100) / 100 : totals.subtotal;
    const finalTaxTotal = manualTotal !== '' ? Math.round((finalTotal - finalSubtotal) * 100) / 100 : totals.taxTotal;

    return {
      id: isNew ? newId : id,
      number,
      customerId,
      date,
      validUntil,
      status,
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
      createdAt: existingQuote ? existingQuote.createdAt : new Date(),
      updatedAt: new Date(),
      watermarkText,
      watermarkType,
      hidePrices,
      manualTotal: manualTotal !== '' ? Number(manualTotal) : undefined
    };
  };

  const { status: autoSaveStatus, performSave } = useAutoSave<Quotation>({
    isDirty,
    getPayload,
    saveFn: async (payload) => {
      // Create exactly once: committedRef prevents a second POST (the legacy
      // bug where autosave + manual save raced and produced a duplicate/phantom
      // quote). After the first successful create, every save is an update.
      if (isNew && !committedRef.current) {
        committedRef.current = true;
        const ok = await addQuotation(payload);
        if (!ok) committedRef.current = false; // allow retry on failure
        return ok;
      }
      return await updateQuotation(payload);
    },
    onSaveSuccess: (payload) => {
      setIsDirty(false);
      draft.clear(); // committed to server — drop the local draft
      if (isNew) {
        skipSyncRef.current = true;
        setRoute('quotation-detail', payload.id);
      }
    },
    isReady: !!customerId
  });

  // Line Item actions
  const handleAddLine = () => {
    const newItem: LineItem = {
      id: `li-${Date.now()}-${Math.random()}`,
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
    const newSection: LineItem = {
      id: `sec-${Date.now()}`,
      type: 'section',
      description: 'Section Title / عنوان القسم',
      quantity: 0,
      unit: 'pc',
      unitPrice: 0,
      discountPercent: 0,
      taxPercent: 0,
      subtotal: 0
    };
    setLineItems([...lineItems, newSection]);
    setIsDirty(true);
  };

  const handleAddNote = () => {
    const newNote: LineItem = {
      id: `note-${Date.now()}`,
      type: 'note',
      description: 'Customer Note details...',
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

        // Legacy: manual price override sets selling unit price
        if ('manualPrice' in fields) {
          const val = fields.manualPrice;
          if (val !== undefined && val !== null && !isNaN(val)) {
            updated.manualPrice = Math.round(val * 100) / 100;
            updated.unitPrice = updated.manualPrice;
          } else {
            updated.manualPrice = undefined;
            if (updated.originalPrice !== undefined && updated.originalPrice !== null) {
              updated.unitPrice =
                Math.round(updated.originalPrice * (1 + markup / 100) * 100) / 100;
            }
          }
        }

        // Legacy: editing unit price in grid sets manual override
        if ('unitPrice' in fields && !('manualPrice' in fields)) {
          const val = fields.unitPrice;
          if (val !== undefined && val !== null && !isNaN(val)) {
            updated.manualPrice = Math.round(val * 100) / 100;
          }
        }

        // Auto-recalculate line subtotal
        if (updated.type === 'item') {
          const baseAmount = updated.quantity * updated.unitPrice;
          const discountAmount = baseAmount * (updated.discountPercent / 100);
          updated.subtotal = Math.round((baseAmount - discountAmount) * 100) / 100;
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

    const calculatedSellingPrice = Math.round(product.unitPrice * (1 + markup / 100) * 100) / 100;

    handleUpdateLine(lineId, {
      productId: product.id,
      description: arDesc ? `${enDesc} / ${arDesc}` : enDesc,
      unit: product.unit,
      originalPrice: product.unitPrice,
      manualPrice: undefined,
      unitPrice: calculatedSellingPrice,
      taxPercent: product.taxRate
    });
  };

  const handleDeleteLine = (lineId: string) => {
    setLineItems(lineItems.filter((item) => item.id !== lineId));
    setIsDirty(true);
  };

  // Reordering lines (HTML5 drag & drop helper)
  const handleDragStart = (e: React.DragEvent, index: number) => {
    e.dataTransfer.setData('text/plain', String(index));
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    const startIndex = parseInt(e.dataTransfer.getData('text/plain'));
    if (isNaN(startIndex) || startIndex === targetIndex) return;

    const list = [...lineItems];
    const [removed] = list.splice(startIndex, 1);
    list.splice(targetIndex, 0, removed);

    setLineItems(list);
    setIsDirty(true);
  };

  // Form persistence
  const handleSave = async () => {
    if (!customerId) {
      alert('Please select a customer / الرجاء اختيار عميل');
      return;
    }

    const success = await performSave();
    if (success) {
      draft.clear();
      setRoute('quotations');
    } else {
      alert('Failed to save quotation / فشل حفظ عرض السعر');
    }
  };

  const handleConfirm = () => {
    if (!customerId) {
      alert('Please select a customer / الرجاء اختيار عميل');
      return;
    }
    setStatus('confirmed');

    const finalTotal = manualTotal !== '' ? Number(manualTotal) : totals.total;
    const finalSubtotal = manualTotal !== '' ? Math.round((finalTotal / 1.15) * 100) / 100 : totals.subtotal;
    const finalTaxTotal = manualTotal !== '' ? Math.round((finalTotal - finalSubtotal) * 100) / 100 : totals.taxTotal;

    const payload: Quotation = {
      id: isNew ? newId : id,
      number,
      customerId,
      date,
      validUntil,
      status: 'confirmed' as const,
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
      createdAt: existingQuote ? existingQuote.createdAt : new Date(),
      updatedAt: new Date(),
      watermarkText,
      watermarkType,
      hidePrices,
      manualTotal: manualTotal !== '' ? Number(manualTotal) : undefined
    };

    if (isNew && !committedRef.current) {
      committedRef.current = true;
      addQuotation(payload);
    } else {
      updateQuotation(payload);
    }

    setIsDirty(false);
    draft.clear();
    alert('Quotation Confirmed! Ready to invoice.');
  };

  const handleConvertToInvoice = () => {
    if (isDirty) {
      alert('Please save the quotation first / الرجاء حفظ التعديلات أولاً');
      return;
    }

    const invoiceId = convertToInvoice(id);
    if (invoiceId) {
      alert('Quotation successfully converted to Invoice / تم تحويل العرض إلى فاتورة بنجاح');
      setRoute('invoice-detail', invoiceId);
    } else {
      alert('Failed to convert. Check if already converted.');
    }
  };

  const handleDuplicate = () => {
    setNumber('');
    setStatus('draft');
    setIsDirty(true);
    alert(`Duplicated! Please modify and save.`);
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

  const handleDelete = () => {
    deleteQuotation(id);
    draft.clear();
    setRoute('quotations');
  };

  // Compile active document data for PDFs and Emails
  const documentData = {
    id,
    number,
    customerId,
    date,
    validUntil,
    status,
    lineItems,
    notes,
    terms,
    subject,
    subjectAr,
    currency,
    subtotal: manualTotal !== '' ? Math.round((Number(manualTotal) / 1.15) * 100) / 100 : totals.subtotal,
    discountTotal: manualTotal !== '' ? 0 : totals.discountTotal,
    taxTotal: manualTotal !== '' ? Math.round((Number(manualTotal) - (Number(manualTotal) / 1.15)) * 100) / 100 : totals.taxTotal,
    total: manualTotal !== '' ? Number(manualTotal) : totals.total,
    watermarkText,
    watermarkType,
    hidePrices,
    manualTotal: manualTotal !== '' ? Number(manualTotal) : undefined
  };

  const customerObj = customers.find((c) => c.id === customerId);

  return (
    <div className="animate-fade-in text-left">
      <PageHeader
        title={isNew ? (number || 'New Quotation / عرض سعر جديد') : `${number}`}
        breadcrumbs={[
          { label: 'Home', onClick: () => setRoute('dashboard') },
          { label: 'Quotations', onClick: () => setRoute('quotations') },
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
                <button
                  onClick={handleConfirm}
                  disabled={status === 'confirmed'}
                  className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-semibold py-2 px-4 rounded-md flex items-center gap-1.5 transition-colors shadow-sm cursor-pointer"
                >
                  <CheckCircle className="w-4 h-4" />
                  Confirm / تأكيد
                </button>

                {status === 'confirmed' && (
                  <button
                    onClick={handleConvertToInvoice}
                    className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold py-2 px-4 rounded-md flex items-center gap-1.5 transition-colors shadow-sm cursor-pointer"
                  >
                    <FileText className="w-4 h-4" />
                    Create Invoice / إنشاء فاتورة
                  </button>
                )}

                <button
                  onClick={() => setPdfModalOpen(true)}
                  className="bg-[var(--color-surface-offset)] hover:bg-[var(--color-divider)] border border-[var(--color-border)] text-[var(--color-text)] text-xs font-semibold py-2 px-4 rounded-md flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  Print PDF / طباعة
                </button>

                <button
                  onClick={() => setEmailModalOpen(true)}
                  className="bg-[var(--color-surface-offset)] hover:bg-[var(--color-divider)] border border-[var(--color-border)] text-[var(--color-text)] text-xs font-semibold py-2 px-4 rounded-md flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Send className="w-4 h-4 text-[var(--color-text-muted)]" />
                  Email
                </button>

                <div className="relative group">
                  <button className="bg-[var(--color-surface-offset)] hover:bg-[var(--color-divider)] border border-[var(--color-border)] text-[var(--color-text)] text-xs font-semibold py-2 px-3 rounded-md flex items-center transition-colors cursor-pointer">
                    Actions <ChevronDown className="w-3.5 h-3.5 ml-1" />
                  </button>
                  <div className="absolute right-0 top-full mt-1 hidden group-hover:block bg-[var(--color-surface)] border border-[var(--color-border)] rounded-md shadow-lg py-1 w-32 z-10">
                    <button
                      onClick={handleDuplicate}
                      className="w-full text-left px-3 py-1.5 text-xs text-[var(--color-text)] hover:bg-[var(--color-surface-offset)] font-semibold flex items-center gap-1.5 cursor-pointer"
                    >
                      <Copy className="w-3.5 h-3.5" /> Duplicate
                    </button>
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
        {/* Core details side (left) - now full width */}
        <div className="w-full flex flex-col gap-6">
          {/* Dates & Reference card (Moved above Quotation Builder) */}
          <div className="premium-card p-6">
            <span className="text-xs font-bold text-[var(--color-text)] uppercase tracking-wider border-b border-[var(--color-divider)]/40 pb-2 mb-4 block">
              Dates & Reference / المواعيد والمرجع
            </span>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <DatePicker
                label="Date Created / التاريخ"
                value={date}
                onChange={(d) => {
                  setDate(d);
                  setIsDirty(true);
                }}
              />

              <DatePicker
                label="Expiration Date / صالح لغاية"
                value={validUntil}
                onChange={(d) => {
                  setValidUntil(d);
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
          </div>

          <div className="premium-card p-6">
            <div className="flex justify-between items-start border-b border-[var(--color-border)]/50 pb-4 mb-4">
              <span className="text-sm font-bold text-[var(--color-text)]">
                Quotation Builder / تفاصيل العرض
              </span>
              <StatusBadge status={status} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div>
                <label className="block text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-2">
                  Quote Reference / الرقم المرجعي
                </label>
                <input
                  type="text"
                  value={number}
                  onChange={(e) => {
                    setNumber(e.target.value);
                    setIsDirty(true);
                  }}
                  className="w-full premium-input font-mono font-bold"
                  placeholder="QT-2026-0001"
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

            {/* Customer select combobox */}
            <div className="mb-6">
              <CustomerCombobox selectedCustomerId={customerId} onSelect={(id) => {
                setCustomerId(id);
                setIsDirty(true);
              }} />
            </div>

            {/* Display billing coordinates of selected customer */}
            {customerObj && (
              <div className="bg-[var(--color-surface-offset)] border border-[var(--color-border)] rounded-lg p-4 mb-6 text-sm flex flex-col md:flex-row gap-6 animate-slide-in">
                <div className="flex-1">
                  <div className="text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider mb-1">Billing Details</div>
                  <div className="font-bold text-[var(--color-text)]">{customerObj.companyName}</div>
                  <div className="text-[var(--color-text-muted)]">{customerObj.contactPerson}</div>
                  <div className="text-[var(--color-text-muted)]">{customerObj.email} | {customerObj.phone}</div>
                </div>
                <div className="flex-1">
                  <div className="text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider mb-1">Billing Address</div>
                  <div className="text-[var(--color-text-muted)]">
                    {customerObj.billingAddress.street}, {customerObj.billingAddress.district && `${customerObj.billingAddress.district}, `}
                    {customerObj.billingAddress.city}, {customerObj.billingAddress.postalCode}
                  </div>
                  <div className="text-xs font-bold text-[var(--color-primary)] mt-1.5">
                    VAT / الرقم الضريبي: {customerObj.vatNumber || 'Not registered'}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Tab switching */}
          <div className="border-b border-[var(--color-border)] flex gap-4">
            <button
              onClick={() => setActiveTab('items')}
              className={`pb-2.5 text-xs font-bold uppercase tracking-wider border-b-2 cursor-pointer ${activeTab === 'items'
                  ? 'border-[var(--color-primary)] text-[var(--color-primary)]'
                  : 'border-transparent text-[var(--color-text-muted)]'
                }`}
            >
              Line Items / البنود
            </button>
            <button
              onClick={() => setActiveTab('terms')}
              className={`pb-2.5 text-xs font-bold uppercase tracking-wider border-b-2 cursor-pointer ${activeTab === 'terms'
                  ? 'border-transparent text-[var(--color-text-muted)]'
                  : 'border-[var(--color-primary)] text-[var(--color-primary)]'
                }`}
            >
              Additional Terms / شروط إضافية
            </button>
          </div>

          {activeTab === 'items' ? (
            <div className="w-full">
              {/* M.U. % sits above the MU column so line-item headers align */}
              {canUseMarkup && (
                <div className="hidden lg:flex w-full mb-0">
                  <div className="flex-1" />
                  <div className="w-[320px] shrink-0 h-9 flex justify-between items-center px-3 premium-card rounded-b-none border-b-0 bg-[var(--color-surface)]">
                    <span className="font-bold text-xs text-[var(--color-text)] uppercase tracking-wider">M.U. %</span>
                    <input
                      type="number"
                      value={markup}
                      onChange={(e) => setMarkup(parseFloat(e.target.value) || 0)}
                      className="w-16 p-1 bg-yellow-400 text-black font-extrabold outline-none text-center rounded border border-yellow-500 text-xs"
                    />
                  </div>
                </div>
              )}

              <div className="flex flex-col lg:flex-row gap-4 items-stretch w-full lg:mt-0">
                {/* Inline Line Items Grid */}
                <div className="flex-1 premium-card min-w-0 w-full flex flex-col lg:rounded-tr-none">
                  <div ref={tableWrapperRef} className="overflow-x-auto w-full pb-36 min-h-[300px]">
                    <table className="w-full text-sm text-left border-collapse">
                      <thead>
                        <tr ref={headerRef} className="bg-[var(--color-surface-offset)] border-b border-[var(--color-border)] text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">
                          <th className="py-2.5 px-3 w-8 text-center"></th>
                          <th className="py-2.5 px-3 w-8 text-center">#</th>
                          <th className="py-2.5 px-3 min-w-[450px]">Description / الوصف</th>
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
                            ref={(el) => {
                              if (el) {
                                rowRefs.current.set(item.id, el);
                              } else {
                                rowRefs.current.delete(item.id);
                              }
                            }}
                            onDragOver={handleDragOver}
                            onDrop={(e) => handleDrop(e, idx)}
                            className={`group ${item.type === 'section'
                                ? 'bg-[var(--color-surface-offset)] font-bold'
                                : item.type === 'note'
                                  ? 'bg-amber-500/5 italic'
                                  : 'hover:bg-[var(--color-surface-offset)]/30'
                              }`}
                          >
                            {/* Drag Handle */}
                            <td className="py-2 px-1 text-center">
                              <div
                                draggable
                                onDragStart={(e) => handleDragStart(e, idx)}
                                className="cursor-grab active:cursor-grabbing p-1 inline-flex items-center justify-center hover:bg-[var(--color-surface-offset)] rounded transition-colors"
                              >
                                <GripVertical
                                  className="w-3.5 h-3.5 text-[var(--color-text-faint)] group-hover:text-[var(--color-text-muted)]"
                                />
                              </div>
                            </td>

                            {/* Row Index — only items get a number */}
                            <td className="py-2 px-1 text-xs text-center font-mono text-[var(--color-text-muted)] select-none">
                              {item.type === 'item' ? getItemNumber(idx) : ''}
                            </td>

                            {/* Description field */}
                            <td className="py-2 px-2 align-top">
                              {item.type === 'item' ? (
                                <div
                                  ref={(el) => {
                                    if (el) descriptionRowRefs.current.set(item.id, el);
                                    else descriptionRowRefs.current.delete(item.id);
                                  }}
                                  className="flex gap-2 w-full items-start"
                                >
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
                                    ref={(el) => {
                                      if (el) descriptionArRefs.current.set(item.id, el);
                                      else descriptionArRefs.current.delete(item.id);
                                    }}
                                    rows={1}
                                    value={item.description.includes(' / ') ? item.description.split(' / ')[1] : ''}
                                    onChange={(e) => {
                                      const parts = item.description.includes(' / ') ? item.description.split(' / ') : [item.description, ''];
                                      const enPart = parts[0] || '';
                                      handleUpdateLine(item.id, { description: `${enPart} / ${e.target.value}` });
                                    }}
                                    onInput={() => adjustRowDescriptionHeights(item.id)}
                                    className="w-full bg-transparent border border-transparent hover:border-[var(--color-border)] focus:border-[var(--color-primary)] focus:bg-[var(--color-surface-2)] rounded py-1 px-1.5 text-xs text-[var(--color-text)] focus:outline-none resize-none overflow-hidden text-right font-arabic"
                                    placeholder="Arabic Description / الوصف بالعربي"
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

                            {/* Qty */}
                            <td className="py-2 px-2">
                              {item.type === 'item' && (
                                <input
                                  type="number"
                                  min="0.01"
                                  step="any"
                                  value={item.quantity}
                                  onChange={(e) => handleUpdateLine(item.id, { quantity: parseFloat(e.target.value) || 0 })}
                                  className="w-full bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded py-1 px-1.5 text-center text-xs text-[var(--color-text)] focus:outline-none"
                                />
                              )}
                            </td>

                            {/* Unit select */}
                            <td className="py-2 px-2">
                              {item.type === 'item' && (
                                <select
                                  value={item.unit}
                                  onChange={(e) => handleUpdateLine(item.id, { unit: e.target.value })}
                                  className="w-full bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded py-1 px-1 text-center text-xs text-[var(--color-text)] focus:outline-none"
                                >
                                  <option value="pc">pc</option>
                                  <option value="set">set</option>
                                  <option value="lot">lot</option>
                                  <option value="hr">hr</option>
                                  <option value="day">day</option>
                                  <option value="m">m</option>
                                  <option value="kg">kg</option>
                                </select>
                              )}
                            </td>

                            {/* Price */}
                            <td className="py-2 px-2">
                              {item.type === 'item' && (
                                <input
                                  type="number"
                                  step="0.01"
                                  value={item.unitPrice}
                                  onChange={(e) => handleUpdateLine(item.id, { unitPrice: parseFloat(e.target.value) || 0 })}
                                  className="w-full bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded py-1 px-1 text-right text-xs text-[var(--color-text)] focus:outline-none font-mono"
                                />
                              )}
                            </td>

                            {/* Discount */}
                            <td className="py-2 px-2">
                              {item.type === 'item' && (
                                <input
                                  type="number"
                                  min="0"
                                  max="100"
                                  value={item.discountPercent}
                                  onChange={(e) => handleUpdateLine(item.id, { discountPercent: parseFloat(e.target.value) || 0 })}
                                  className="w-full bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded py-1 px-1 text-center text-xs text-[var(--color-text)] focus:outline-none font-mono"
                                />
                              )}
                            </td>

                            {/* Tax */}
                            <td className="py-2 px-2">
                              {item.type === 'item' && (
                                <select
                                  value={item.taxPercent}
                                  onChange={(e) => handleUpdateLine(item.id, { taxPercent: parseFloat(e.target.value) || 0 })}
                                  className="w-full bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded py-1 px-1 text-center text-xs text-[var(--color-text)] focus:outline-none"
                                >
                                  <option value="0">0%</option>
                                  <option value="5">5%</option>
                                  <option value="15">15%</option>
                                </select>
                              )}
                            </td>

                            {/* Subtotal */}
                            <td className="py-2 px-3 text-right font-bold text-xs text-[var(--color-text)] font-mono">
                              {item.type === 'item' && item.subtotal.toFixed(2)}
                            </td>

                            {/* Delete Row Icon */}
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

                  {/* Builder Footer Buttons */}
                  <div className="flex flex-wrap gap-2 px-4 py-3 bg-[var(--color-surface-offset)] border-t border-[var(--color-border)] justify-start">
                    <button
                      type="button"
                      onClick={handleAddLine}
                      className="bg-[var(--color-surface)] hover:bg-[var(--color-surface-offset)] border border-[var(--color-border)] text-[var(--color-text)] text-xs font-semibold py-1.5 px-3 rounded flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5 text-[var(--color-primary)]" /> Add Line
                    </button>
                    <button
                      type="button"
                      onClick={handleAddSection}
                      className="bg-[var(--color-surface)] hover:bg-[var(--color-surface-offset)] border border-[var(--color-border)] text-[var(--color-text)] text-xs font-semibold py-1.5 px-3 rounded flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      <PlusSquare className="w-3.5 h-3.5 text-[var(--color-text-muted)]" /> Add Section
                    </button>
                    <button
                      type="button"
                      onClick={handleAddNote}
                      className="bg-[var(--color-surface)] hover:bg-[var(--color-surface-offset)] border border-[var(--color-border)] text-[var(--color-text)] text-xs font-semibold py-1.5 px-3 rounded flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      <FileText className="w-3.5 h-3.5 text-[var(--color-text-muted)]" /> Add Note
                    </button>
                  </div>
                </div>

                {/* Analysis Sidebar — row heights synced with line items table */}
                {canUseMarkup && (
                  <div className="w-full lg:w-[320px] shrink-0 premium-card flex flex-col bg-[var(--color-surface-offset)] overflow-hidden lg:rounded-tl-none">
                    {/* M.U. % on mobile/tablet (desktop uses bar above) */}
                    <div className="lg:hidden h-9 shrink-0 flex justify-between items-center px-3 border-b border-[var(--color-border)] bg-[var(--color-surface)]">
                      <span className="font-bold text-xs text-[var(--color-text)] uppercase tracking-wider">M.U. %</span>
                      <input
                        type="number"
                        value={markup}
                        onChange={(e) => setMarkup(parseFloat(e.target.value) || 0)}
                        className="w-16 p-1 bg-yellow-400 text-black font-extrabold outline-none text-center rounded border border-yellow-500 text-xs"
                      />
                    </div>

                    {/* Column headers — height locked to line items thead */}
                    <div
                      style={{ height: `${headerHeight}px`, minHeight: `${headerHeight}px`, maxHeight: `${headerHeight}px` }}
                      className="box-border grid grid-cols-[2.5rem_4.5rem_1fr_1fr] shrink-0 bg-[var(--color-surface-offset)] border-b border-[var(--color-border)] text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider"
                    >
                      <div className="flex items-center justify-center border-r border-[var(--color-border)]/50">Rule</div>
                      <div className="flex items-center justify-center border-r border-[var(--color-border)]/50">Manual</div>
                      <div className="flex items-center justify-center border-r border-[var(--color-border)]/50">Base</div>
                      <div className="flex items-center justify-center">Total</div>
                    </div>

                    {/* Analysis rows — one per line item, pixel-matched height */}
                    <div className="flex flex-col flex-1">
                      {lineItems.map((item, index) => {
                        const rule = getItemRule(item);
                        let displayBase = 0;
                        let displayTotal = 0;

                        if (rule === 'EXCL') {
                          displayBase = 0;
                          displayTotal = 0;
                        } else if (rule === 'ZM') {
                          displayBase = item.unitPrice || 0;
                          displayTotal = item.subtotal || 0;
                        } else {
                          if (rule === 'MAN') displayBase = item.manualPrice!;
                          else if (rule === 'DB') displayBase = item.originalPrice!;
                          displayTotal = displayBase * item.quantity;
                        }

                        const isBelowCost =
                          item.manualPrice !== undefined &&
                          item.originalPrice !== undefined &&
                          item.manualPrice < item.originalPrice;

                        const rowH = rowHeights[index] ?? 40;

                        return (
                          <div
                            key={`side-${item.id}`}
                            style={{ height: `${rowH}px`, minHeight: `${rowH}px`, maxHeight: `${rowH}px` }}
                            className="box-border grid grid-cols-[2.5rem_4.5rem_1fr_1fr] border-b border-[var(--color-border)]/40 last:border-0 hover:bg-[var(--color-surface)] transition-colors overflow-hidden"
                          >
                            <div className="flex flex-col items-center justify-center border-r border-[var(--color-border)]/30 font-mono text-[9px] font-bold py-0.5">
                              {item.type === 'item' ? (
                                <>
                                  <select
                                    value={item.ruleOverride || (muFilters.excluded.some((kw) => (item.description || '').toLowerCase().includes(kw.toLowerCase())) ? 'EXCL' : 'INCL')}
                                    onChange={(e) => handleUpdateLine(item.id, { ruleOverride: e.target.value as 'EXCL' | 'INCL' })}
                                    className={`text-[9px] font-bold bg-transparent outline-none cursor-pointer rounded px-0.5 border border-transparent hover:border-[var(--color-border)] max-w-full truncate ${
                                      rule === 'EXCL' ? 'text-red-500 bg-red-500/10' : 'text-green-600 bg-green-500/10'
                                    }`}
                                  >
                                    <option value="INCL" className="bg-[var(--color-surface)] text-green-600 font-bold">INCL</option>
                                    <option value="EXCL" className="bg-[var(--color-surface)] text-red-500 font-bold">EXCL</option>
                                  </select>
                                  {rule !== 'EXCL' && (
                                    <span className="text-[7.5px] font-semibold text-[var(--color-text-muted)] scale-90 -mt-0.5">{rule}</span>
                                  )}
                                </>
                              ) : (
                                <span className="text-red-500 bg-red-500/10 px-1 py-0.5 rounded">EXCL</span>
                              )}
                            </div>

                            <div className="flex items-center justify-center border-r border-[var(--color-border)]/30 px-0.5">
                              {item.type === 'item' ? (
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  placeholder="none"
                                  value={item.manualPrice !== undefined ? item.manualPrice : ''}
                                  onChange={(e) => {
                                    const val = e.target.value === '' ? undefined : parseFloat(e.target.value);
                                    handleUpdateLine(item.id, { manualPrice: val });
                                  }}
                                  className={`w-full bg-[var(--color-surface-2)] border rounded text-[10px] font-mono py-0.5 text-center focus:outline-none ${
                                    isBelowCost
                                      ? 'border-red-500/50 text-red-500 focus:border-red-500'
                                      : 'border-[var(--color-border)] text-[var(--color-text)] focus:border-[var(--color-primary)]'
                                  }`}
                                  disabled={!canOverridePrice}
                                />
                              ) : (
                                <span className="text-gray-400">—</span>
                              )}
                            </div>

                            <div className="flex items-center justify-end border-r border-[var(--color-border)]/30 px-2 font-mono text-[10px] text-[var(--color-text)]">
                              {displayBase.toFixed(2)}
                            </div>

                            <div className="flex items-center justify-end px-2 font-mono text-[10px] font-semibold text-[var(--color-text)]">
                              {displayTotal.toFixed(2)}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* Terms and Conditions Tab */
            <div className="premium-card p-6 flex flex-col gap-4">
              <div>
                <label className="block text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-2">
                  Customer Internal Notes / ملاحظات للعميل
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
                  placeholder="These notes will be printed on the invoice document..."
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-2">
                  Terms & Conditions / الشروط والأحكام
                </label>
                <textarea
                  rows={8}
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
                  placeholder="Payment details, delivery schedules, banking coordinates..."
                />
              </div>
            </div>
          )}
        </div>

        {/* Right Columns (Meta & Totals panel) - right-aligned under table */}
        <div className="flex justify-end text-left w-full mt-4">
          {/* Totals panel */}
          <div className="w-full md:w-96 premium-card p-6 bg-[var(--color-surface-offset)] border border-[var(--color-border)] rounded-xl shadow-lg">
            <span className="text-xs font-bold text-[var(--color-text)] uppercase tracking-wider border-b border-[var(--color-border)] pb-2 mb-4 block">
              Summary Calculations / ملخص الحساب
            </span>

            {/* Custom Settings (Hide Prices & Manual Total) */}
            {canUsePricingControls && (
              <div className="border-b border-[var(--color-border)]/50 pb-3 mb-3 flex flex-col gap-3">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={hidePrices}
                    onChange={(e) => {
                      setHidePrices(e.target.checked);
                      setIsDirty(true);
                    }}
                    className="rounded border-[var(--color-border)] text-[var(--color-primary)] focus:ring-[var(--color-primary)] w-4 h-4 cursor-pointer"
                  />
                  <span className="text-xs font-bold text-[var(--color-text)]">
                    Hide Table Prices on PDF / إخفاء أسعار البنود
                  </span>
                </label>

                <div>
                  <label className="block text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider mb-1">
                    Manual Grand Total Override / إجمالي يدوي مخصص
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.01"
                      placeholder="Auto-calculated / تلقائي"
                      value={manualTotal}
                      disabled={!canOverridePrice}
                      onChange={(e) => {
                        const val = e.target.value === '' ? '' : parseFloat(e.target.value);
                        setManualTotal(val);
                        setIsDirty(true);
                      }}
                      className="w-full premium-input py-1.5 px-3 text-xs font-mono font-bold disabled:opacity-60 disabled:cursor-not-allowed"
                    />
                    {manualTotal !== '' && canOverridePrice && (
                      <button
                        type="button"
                        onClick={() => {
                          setManualTotal('');
                          setIsDirty(true);
                        }}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-red-500 hover:text-red-600 font-bold"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}

            <div className="flex flex-col gap-3 text-sm">
              <div className="flex justify-between text-[var(--color-text-muted)]">
                <span>Subtotal (Gross) / المجموع:</span>
                <span className="font-mono">
                  {(manualTotal !== '' ? Number(manualTotal) / 1.15 : totals.subtotal).toFixed(2)} {currency}
                </span>
              </div>

              {manualTotal === '' && totals.discountTotal > 0 && (
                <div className="flex justify-between text-[var(--color-error)] font-semibold">
                  <span>Discount / الخصم:</span>
                  <span className="font-mono">-{totals.discountTotal.toFixed(2)} {currency}</span>
                </div>
              )}

              <div className="flex justify-between text-[var(--color-text-muted)]">
                <span>Taxable Amount / خاضع للضريبة:</span>
                <span className="font-mono">
                  {(manualTotal !== '' ? Number(manualTotal) / 1.15 : totals.subtotal - totals.discountTotal).toFixed(2)} {currency}
                </span>
              </div>

              {manualTotal === '' && (
                <div className="flex justify-between text-emerald-500 font-bold">
                  <span>Profit Markup (MU) / هامش الربح:</span>
                  <span className="font-mono">{totals.markupProfit.toFixed(2)} {currency}</span>
                </div>
              )}

              <div className="flex justify-between text-[var(--color-text-muted)] border-b border-[var(--color-border)] pb-3 mb-2">
                <span>VAT (15%) / ضريبة القيمة المضافة:</span>
                <span className="font-mono">
                  {(manualTotal !== '' ? Number(manualTotal) - (Number(manualTotal) / 1.15) : totals.taxTotal).toFixed(2)} {currency}
                </span>
              </div>

              <div className="flex justify-between items-center rounded-xl p-4 bg-[#97F2B7] text-black shadow-inner mt-4">
                <span className="text-sm font-black uppercase tracking-wider">Grand Total / الإجمالي العام:</span>
                <span className="text-2xl font-black font-mono">
                  {(manualTotal !== '' ? Number(manualTotal) : totals.total).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {currency}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {!isNew && id && (
        <div className="mt-6">
          <DocumentTimeline docType="quotation" docId={id} />
        </div>
      )}

      {/* Confirmation and Action Overlays */}
      <ConfirmDialog
        isOpen={deleteConfirmOpen}
        type="danger"
        title="Delete Quotation?"
        message={`Are you sure you want to delete ${number}? This action is destructive and cannot be undone.`}
        onConfirm={handleDelete}
        onClose={() => setDeleteConfirmOpen(false)}
      />

      {pdfModalOpen && (
        <PDFPreviewModal
          isOpen={pdfModalOpen}
          documentData={documentData}
          companyProfile={company}
          customerProfile={customerObj}
          type="quotation"
          onClose={() => setPdfModalOpen(false)}
        />
      )}

      {emailModalOpen && (
        <EmailSendModal
          isOpen={emailModalOpen}
          to={customerObj?.email || ''}
          subject={`Quotation Request ${number} from ${company.name}`}
          body={`Dear ${customerObj?.contactPerson || 'Customer'},\n\nPlease find attached our quotation ${number} detailing the security systems installation details.\n\nBest regards,\n${company.name}`}
          attachmentName={`${number}.pdf`}
          onClose={() => setEmailModalOpen(false)}
        />
      )}
    </div>
  );
};
export default QuotationDetail;
