/**
 * PDF template model: defaults, presets and normalisation.
 *
 * Pure module (no browser / store imports) so the same code drives the Studio live preview,
 * the in-app PDF preview and the server-side PDF renderer.
 */
import type {
  PDFSectionStyle,
  PDFTemplateConfig,
  PDFSectionItem,
  PDFSectionField
} from '../types';

export type PdfDocType = 'quotation' | 'invoice';

export const PDF_FONT_OPTIONS: { value: PDFTemplateConfig['typography']['fontFamily']; label: string; note: string }[] = [
  { value: 'Tajawal', label: 'Tajawal', note: 'Arabic + Latin (recommended for bilingual documents)' },
  { value: 'Helvetica', label: 'Helvetica', note: 'Latin only – Arabic text will not render' },
  { value: 'Times-Roman', label: 'Times', note: 'Latin only – Arabic text will not render' },
  { value: 'Courier', label: 'Courier', note: 'Latin only – monospaced' }
];

const f = (id: string, key: string, label: string, labelAr: string, order: number, extra: Partial<PDFSectionField> = {}): PDFSectionField => ({
  id, key, label, labelAr, enabled: true, order, ...extra
});

export const DEFAULT_PDF_TEMPLATE: PDFTemplateConfig = {
  preset: 'executive',
  name: 'Executive Modern (النموذج التنفيذي الحديث)',
  headerStyle: 'gradient',
  sections: [
    {
      id: 'header', name: 'Header & Brand Info', nameAr: 'الهيدر ومعلومات المنشأة', enabled: true, width: 'full', order: 1,
      fields: [
        f('h_logo', 'logo', 'Logo', 'الشعار', 1, { isLocked: true }),
        f('h_name', 'companyName', 'Company Name', 'اسم المؤسسة', 2, { isLocked: true }),
        f('h_addr', 'address', 'Address', 'العنوان', 3),
        f('h_phone', 'phone', 'Phone', 'رقم الهاتف', 4),
        f('h_email', 'email', 'Email', 'البريد الإلكتروني', 5),
        f('h_org', 'orgNumber', 'Organization Number (CR/VAT)', 'السجل التجاري والضريبي', 6)
      ]
    },
    {
      id: 'meta', name: 'Document Reference', nameAr: 'بيانات المستند', enabled: true, width: 'full', order: 2,
      fields: [
        f('m_no', 'number', 'Document Number', 'رقم المستند', 1, { isLocked: true }),
        f('m_date', 'date', 'Issue Date', 'تاريخ الإصدار', 2),
        f('m_due', 'dueDate', 'Due / Valid Until', 'تاريخ الاستحقاق / الصلاحية', 3)
      ]
    },
    {
      id: 'customer', name: 'Customer Details', nameAr: 'بيانات العميل', enabled: true, width: 'half', order: 3,
      fields: [
        f('c_name', 'customerName', 'Customer Name', 'اسم العميل', 1, { isLocked: true }),
        f('c_comp', 'customerContact', 'Contact Person', 'الشخص المسؤول', 2),
        f('c_addr', 'customerAddress', 'Customer Address', 'عنوان العميل', 3),
        f('c_email', 'customerEmail', 'Customer Email', 'البريد الإلكتروني للعميل', 4),
        f('c_phone', 'customerPhone', 'Customer Phone', 'هاتف العميل', 5),
        f('c_tax', 'customerTaxId', 'Customer Tax ID (VAT)', 'الرقم الضريبي للعميل', 6),
        f('c_subj', 'subject', 'Subject', 'الموضوع', 7)
      ]
    },
    {
      id: 'vehicle', name: 'Project / Service Specs', nameAr: 'مواصفات المشروع / الخدمة', enabled: true, width: 'half', order: 4,
      fields: []
    },
    {
      id: 'line_items', name: 'Line Items', nameAr: 'جدول البنود', enabled: true, width: 'full', order: 5,
      fields: [
        f('li_desc', 'description', 'Item Description', 'وصف البند', 1, { isLocked: true }),
        f('li_qty', 'quantity', 'Quantity & Units', 'الكمية والوحدة', 2, { isLocked: true }),
        f('li_price', 'unitPrice', 'Unit Price', 'سعر الوحدة', 3),
        f('li_tax', 'taxRate', 'VAT', 'ضريبة القيمة المضافة', 4),
        f('li_total', 'total', 'Line Total', 'المجموع', 5, { isLocked: true })
      ]
    },
    {
      id: 'summary', name: 'Financial Summary & Notes', nameAr: 'الملخص المالي والملاحظات', enabled: true, width: 'full', order: 6,
      fields: [
        f('s_notes', 'notes', 'Notes', 'الملاحظات', 1),
        f('s_sub', 'subtotal', 'Subtotal Amount', 'المجموع الفرعي', 2, { isLocked: true }),
        f('s_disc', 'discount', 'Total Discount', 'إجمالي الخصم', 3),
        f('s_tax', 'taxTotal', 'VAT', 'إجمالي الضريبة', 4),
        f('s_total', 'grandTotal', 'Grand Total', 'الإجمالي النهائي', 5, { isLocked: true }),
        f('s_due', 'balanceDue', 'Paid & Balance Due', 'المدفوع والمستحق', 6)
      ]
    },
    {
      id: 'zatca_qr', name: 'ZATCA QR Code', nameAr: 'رمز هيئة الزكاة والضريبة', enabled: true, width: 'half', order: 7,
      fields: [f('z_qr', 'zatcaQr', 'ZATCA TLV Base64 QR (invoices)', 'رمز هيئة الزكاة والضريبة', 1, { isLocked: true })]
    },
    {
      id: 'bank_details', name: 'Bank Details', nameAr: 'البيانات البنكية', enabled: true, width: 'half', order: 8,
      fields: [
        f('b_name', 'bankName', 'Bank Name', 'اسم البنك', 1),
        f('b_acc', 'bankAccount', 'Account Number', 'رقم الحساب', 2),
        f('b_iban', 'bankIban', 'IBAN', 'الآيبان', 3),
        f('b_free', 'bankDetails', 'Bank details from document terms', 'بيانات بنكية من المستند', 4)
      ]
    },
    {
      id: 'payment_terms', name: 'Terms & Conditions', nameAr: 'الشروط والأحكام والضمان', enabled: true, width: 'full', order: 9,
      fields: [
        f('t_pay', 'paymentTerms', 'Payment Terms', 'شروط الدفع', 1),
        f('t_war', 'warrantyTerms', 'Warranty & Maintenance', 'الضمان والصيانة', 2),
        f('t_man', 'manpowerTerms', 'Manpower', 'العمالة', 3),
        f('t_mob', 'mobilizationTerms', 'Mobilization', 'التجهيز', 4),
        f('t_dur', 'durationTerms', 'Duration', 'المدة', 5)
      ]
    },
    {
      id: 'signatures', name: 'Authorized Signatures', nameAr: 'قسم التواقيع والاعتماد', enabled: false, width: 'full', order: 10,
      fields: [
        f('sig_comp', 'companySignature', 'Company Signatory & Seal', 'توقيع وختم المنشأة', 1),
        f('sig_client', 'clientSignature', 'Client Acceptance & Signature', 'توقيع وقبول العميل', 2)
      ]
    },
    {
      id: 'footer', name: 'Page Footer', nameAr: 'تذييل الصفحة', enabled: true, width: 'full', order: 11,
      fields: [
        f('f_img', 'footerImage', 'Footer Banner Image', 'صورة التذييل', 1),
        f('f_contact', 'footerContact', 'Company Contact & Website', 'معلومات التواصل والموقع', 2),
        f('f_page', 'pageNumbers', 'Page Numbers (Page X of Y)', 'ترقيم الصفحات', 3)
      ]
    }
  ],
  customFields: [
    { id: 'cf_1', name: 'Purchase order number', key: 'purchase_order', type: 'text', appliesTo: 'all', sectionId: 'vehicle', sectionName: 'Project / Service Specs' },
    { id: 'cf_2', name: 'Project reference', key: 'project_ref', type: 'text', appliesTo: 'all', sectionId: 'vehicle', sectionName: 'Project / Service Specs' },
    { id: 'cf_3', name: 'Site contact', key: 'site_contact', type: 'text', appliesTo: 'quotation', sectionId: 'vehicle', sectionName: 'Project / Service Specs' }
  ],
  colors: {
    primary: '#01696f',
    headerBgStart: '#01696f',
    headerBgEnd: '#0d9488',
    headerText: '#ffffff',
    tableHeaderBg: '#01696f',
    tableHeaderText: '#ffffff',
    zebraRowBg: '#f8fafc',
    accentBorder: '#01696f'
  },
  tableColumns: {
    showIndex: true, showItemCode: false, showDescEn: true, showDescAr: true, showQty: true,
    showUnit: true, showUnitPrice: true, showDiscount: false, showTax: false, showTotal: true
  },
  typography: { fontFamily: 'Tajawal', bodyFontSize: 9, titleFontSize: 22 },
  watermark: { enabled: false, text: 'PAID', opacity: 0.08, angle: 45 },
  page: { size: 'A4', margins: 'normal' }
};

export interface PdfPreset {
  id: string;
  label: string;
  description: string;
  patch: Pick<PDFTemplateConfig, 'headerStyle' | 'colors'> & { typography?: Partial<PDFTemplateConfig['typography']> };
}

export const PDF_PRESETS: PdfPreset[] = [
  {
    id: 'executive', label: 'Executive Modern', description: 'Teal gradient header, clean zebra table.',
    patch: { headerStyle: 'gradient', colors: { ...DEFAULT_PDF_TEMPLATE.colors } }
  },
  {
    id: 'zatca_official', label: 'ZATCA Official', description: 'Boxed header, green accent, compliance-first look.',
    patch: {
      headerStyle: 'boxed',
      colors: { primary: '#047857', headerBgStart: '#047857', headerBgEnd: '#047857', headerText: '#ffffff', tableHeaderBg: '#047857', tableHeaderText: '#ffffff', zebraRowBg: '#f0fdf4', accentBorder: '#047857' }
    }
  },
  {
    id: 'corporate_blue', label: 'Corporate Blue', description: 'Solid navy band with light blue banding.',
    patch: {
      headerStyle: 'solid',
      colors: { primary: '#1d4ed8', headerBgStart: '#1e3a8a', headerBgEnd: '#1e3a8a', headerText: '#ffffff', tableHeaderBg: '#1e3a8a', tableHeaderText: '#ffffff', zebraRowBg: '#eff6ff', accentBorder: '#1d4ed8' }
    }
  },
  {
    id: 'luxury_gold', label: 'Luxury Gold', description: 'Dark charcoal with champagne-gold accents.',
    patch: {
      headerStyle: 'gradient',
      colors: { primary: '#b8860b', headerBgStart: '#1c1917', headerBgEnd: '#44403c', headerText: '#fde68a', tableHeaderBg: '#292524', tableHeaderText: '#fde68a', zebraRowBg: '#fafaf9', accentBorder: '#b8860b' }
    }
  },
  {
    id: 'monochrome', label: 'Monochrome', description: 'Minimal black & white, ideal for printing.',
    patch: {
      headerStyle: 'minimal',
      colors: { primary: '#111827', headerBgStart: '#111827', headerBgEnd: '#111827', headerText: '#111827', tableHeaderBg: '#e5e7eb', tableHeaderText: '#111827', zebraRowBg: '#f9fafb', accentBorder: '#111827' }
    }
  }
];

export function applyPreset(tpl: PDFTemplateConfig, presetId: string): PDFTemplateConfig {
  const p = PDF_PRESETS.find((x) => x.id === presetId);
  if (!p) return tpl;
  return {
    ...tpl,
    preset: p.id,
    name: p.label,
    headerStyle: p.patch.headerStyle,
    colors: { ...p.patch.colors },
    typography: { ...tpl.typography, ...(p.patch.typography || {}) }
  };
}

const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;
export const safeColor = (v: unknown, fallback: string): string => (typeof v === 'string' && HEX.test(v.trim()) ? v.trim() : fallback);

const clamp = (n: unknown, lo: number, hi: number, fallback: number) => {
  const x = Number(n);
  return Number.isFinite(x) ? Math.min(hi, Math.max(lo, x)) : fallback;
};

const STYLE_COLOR_KEYS = ['bg', 'text', 'titleColor', 'headBg', 'border', 'altBg'] as const;
const STYLE_FONTS = new Set(['Tajawal', 'Helvetica', 'Times-Roman', 'Courier']);

/** Drops invalid per-section style values so a bad import can never break rendering. */
export function cleanSectionStyle(raw: any): PDFSectionStyle | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const out: PDFSectionStyle = {};
  for (const k of STYLE_COLOR_KEYS) {
    const v = raw[k];
    if (typeof v === 'string' && HEX.test(v.trim())) out[k] = v.trim();
  }
  if (raw.fontSize !== undefined && raw.fontSize !== '' && Number.isFinite(Number(raw.fontSize))) out.fontSize = clamp(raw.fontSize, 6, 16, 9);
  if (raw.radius !== undefined && raw.radius !== '' && Number.isFinite(Number(raw.radius))) out.radius = clamp(raw.radius, 0, 14, 2);
  if (typeof raw.fontFamily === 'string' && STYLE_FONTS.has(raw.fontFamily)) out.fontFamily = raw.fontFamily as PDFSectionStyle['fontFamily'];
  return Object.keys(out).length ? out : undefined;
}

const BUILTIN_FONTS = new Set(['Helvetica', 'Times-Roman', 'Courier']);

/** Sections for one document type: per-type override (quoteSections / invoiceSections) or the shared list. */
export function sectionsFor(raw: Partial<PDFTemplateConfig> | undefined | null, docType: PdfDocType): PDFSectionItem[] {
  const own = docType === 'invoice' ? raw?.invoiceSections : raw?.quoteSections;
  return (own && own.length ? own : raw?.sections) || DEFAULT_PDF_TEMPLATE.sections;
}

function mergeSections(saved: PDFSectionItem[]): PDFSectionItem[] {
  const savedIds = new Set(saved.map((s) => s.id));
  const merged = saved.map((s) => {
    const def = DEFAULT_PDF_TEMPLATE.sections.find((d) => d.id === s.id);
    if (!def || s.isCustom) return { ...s, fields: s.fields || [] };
    // Keep the user's settings, but surface fields introduced after the template was saved.
    const have = new Set((s.fields || []).map((x) => x.key));
    const extra = def.fields.filter((x) => !have.has(x.key)).map((x) => ({ ...x, order: (s.fields?.length || 0) + x.order }));
    return { ...s, fields: [...(s.fields || []), ...extra] };
  });
  // Built-in sections added after the template was saved are appended, disabled, so layouts never change silently.
  const maxOrder = Math.max(0, ...merged.map((s) => s.order || 0));
  DEFAULT_PDF_TEMPLATE.sections.forEach((d, i) => {
    if (!savedIds.has(d.id)) merged.push({ ...d, enabled: false, order: maxOrder + 1 + i });
  });
  return merged;
}

/** Fully normalised template (every field present, values clamped, sections ordered). */
export function resolveTemplate(raw: Partial<PDFTemplateConfig> | undefined | null, docType: PdfDocType): PDFTemplateConfig & { sections: PDFSectionItem[] } {
  const d = DEFAULT_PDF_TEMPLATE;
  const colors = { ...d.colors, ...(raw?.colors || {}) };
  const font = (raw?.typography?.fontFamily as string) || d.typography.fontFamily;
  const sections = mergeSections(sectionsFor(raw, docType))
    .map((s) => ({ ...s, style: cleanSectionStyle(s.style), fields: [...(s.fields || [])].sort((a, b) => (a.order || 0) - (b.order || 0)) }))
    .sort((a, b) => (a.order || 0) - (b.order || 0));

  return {
    ...d,
    ...(raw || {}),
    headerStyle: (['solid', 'gradient', 'minimal', 'boxed'] as const).includes(raw?.headerStyle as any) ? (raw!.headerStyle as any) : d.headerStyle,
    colors: {
      primary: safeColor(colors.primary, d.colors.primary),
      headerBgStart: safeColor(colors.headerBgStart, d.colors.headerBgStart),
      headerBgEnd: safeColor(colors.headerBgEnd, d.colors.headerBgEnd),
      headerText: safeColor(colors.headerText, d.colors.headerText),
      tableHeaderBg: safeColor(colors.tableHeaderBg, d.colors.tableHeaderBg),
      tableHeaderText: safeColor(colors.tableHeaderText, d.colors.tableHeaderText),
      zebraRowBg: safeColor(colors.zebraRowBg, d.colors.zebraRowBg),
      accentBorder: safeColor(colors.accentBorder, d.colors.accentBorder)
    },
    tableColumns: { ...d.tableColumns, ...(raw?.tableColumns || {}) },
    typography: {
      // Legacy values (Outfit / Inter / Geist) were never embeddable; map them to the Arabic-capable default.
      fontFamily: (font === 'Tajawal' || BUILTIN_FONTS.has(font) ? font : 'Tajawal') as any,
      bodyFontSize: clamp(raw?.typography?.bodyFontSize, 6, 14, d.typography.bodyFontSize),
      titleFontSize: clamp(raw?.typography?.titleFontSize, 12, 40, d.typography.titleFontSize)
    },
    watermark: {
      enabled: !!(raw?.watermark?.enabled ?? d.watermark.enabled),
      text: String(raw?.watermark?.text ?? d.watermark.text).slice(0, 40),
      opacity: clamp(raw?.watermark?.opacity, 0.02, 0.5, d.watermark.opacity),
      angle: clamp(raw?.watermark?.angle, -90, 90, d.watermark.angle)
    },
    page: {
      size: raw?.page?.size === 'LETTER' ? 'LETTER' : 'A4',
      margins: (['compact', 'normal', 'spacious'] as const).includes(raw?.page?.margins as any) ? raw!.page!.margins : 'normal'
    },
    customFields: raw?.customFields || d.customFields || [],
    sections
  };
}

export const MARGIN_PT: Record<'compact' | 'normal' | 'spacious', number> = { compact: 20, normal: 32, spacious: 48 };

/** Sample document used by the Studio live preview. */
export function sampleDocument(docType: PdfDocType) {
  const invoice = docType === 'invoice';
  const lines = [
    { type: 'section' as const, description: 'Surveillance System', descriptionAr: 'نظام المراقبة', quantity: 0, unit: '', unitPrice: 0 },
    { type: 'item' as const, description: 'IP Camera 4MP Outdoor', descriptionAr: 'كاميرا مراقبة خارجية 4 ميجابكسل', quantity: 8, unit: 'pc', unitPrice: 450, discount: 5, itemCode: 'CAM-4MP' },
    { type: 'item' as const, description: 'NVR 16 Channel 4TB', descriptionAr: 'جهاز تسجيل 16 قناة', quantity: 1, unit: 'pc', unitPrice: 2300, discount: 0, itemCode: 'NVR-16' },
    { type: 'item' as const, description: 'Installation & configuration', descriptionAr: 'التركيب والإعداد', quantity: 1, unit: 'lot', unitPrice: 1500, discount: 0 }
  ];
  const sub = lines.reduce((s, l) => s + (l.type === 'item' ? l.quantity * l.unitPrice : 0), 0);
  const disc = lines.reduce((s, l) => s + (l.type === 'item' ? l.quantity * l.unitPrice * ((l as any).discount || 0) / 100 : 0), 0);
  const tax = (sub - disc) * 0.15;
  return {
    number: invoice ? 'INV-2026-0042' : 'QT-2026-0089',
    createdAt: new Date().toISOString(),
    validUntil: new Date(Date.now() + 15 * 86400000).toISOString(),
    currency: 'SAR',
    subject: 'Supply and installation of CCTV system',
    subjectAr: 'توريد وتركيب نظام كاميرات المراقبة',
    notes: 'Prices are valid for 15 days.\nAny additional work will be considered a change order.',
    notesAr: 'الأسعار سارية لمدة 15 يوماً.\nأي عمل إضافي يعتبر أمر تغيير.',
    payment: '50% downpayment, balance upon delivery',
    paymentAr: '50% دفعة مقدمة والباقي عند التسليم',
    warranty: '2 YEARS limited warranty',
    warrantyAr: 'ضمان محدود لمدة عامين',
    subtotal: sub,
    discountTotal: disc,
    taxTotal: tax,
    total: sub - disc + tax,
    customer: { company: 'Al Noor Trading Co.', contactName: 'Omar Khalid', email: 'omar@alnoor.sa', phone: '+966 50 000 0001', address: 'King Fahd Rd, Al Olaya', city: 'Riyadh', country: 'SA', vatNumber: '310000000000003' },
    lines,
    customFieldValues: { purchase_order: 'PO-77812', project_ref: 'Warehouse 3 upgrade', site_contact: 'Eng. Saad' } as Record<string, string>,
    printMode: invoice ? ('zatca' as const) : ('standard' as const)
  };
}
