import React from "react";
import { resolveTemplate, MARGIN_PT } from "./template";
import { Document, Page, Text, View, StyleSheet, Image, Font, Svg, Defs, LinearGradient, Stop, Rect } from "@react-pdf/renderer";

export type PdfLine = {
  type?: 'item' | 'section' | 'note';
  description: string;
  descriptionAr?: string | null;
  quantity: number;
  unit: string;
  unitPrice: number;
  discount?: number;
  taxPercent?: number;
  itemCode?: string | null;
};

export type PdfCustomer = {
  company: string;
  contactName?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  city?: string | null;
  country?: string | null;
  vatNumber?: string | null;
};

export type PdfSettings = {
  companyName: string;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  logoUrl?: string | null;
  logoSize?: number | null;
  termsFontSize?: number | null;
  footerImageUrl?: string | null;
  footerSize?: number | null;
  brandColor: string;
  taxLabel: string;
  pdfPayment?: string | null;
  pdfWarranty?: string | null;
  pdfManpower?: string | null;
  pdfMobilization?: string | null;
  pdfDuration?: string | null;
  bankName?: string | null;
  bankAccount?: string | null;
  bankIban?: string | null;
  bankAccountName?: string | null;
  footerText?: string | null;
  pdfHeaderBgType?: string | null;
  pdfHeaderBgColorStart?: string | null;
  pdfHeaderBgColorEnd?: string | null;
  pdfHeaderTextColor?: string | null;
  pdfTableBgColor?: string | null;
  pdfTableTextColor?: string | null;
  pdfTemplate?: any;
  vatNumber?: string | null;
  crNumber?: string | null;
};

export type PdfQuote = {
  number: string;
  createdAt: Date | string;
  validUntil: Date | string | null;
  currency: string;
  subject?: string | null;
  subjectAr?: string | null;
  notes?: string | null;
  notesAr?: string | null;
  payment?: string | null;
  paymentAr?: string | null;
  warranty?: string | null;
  warrantyAr?: string | null;
  manpower?: string | null;
  manpowerAr?: string | null;
  mobilization?: string | null;
  mobilizationAr?: string | null;
  duration?: string | null;
  durationAr?: string | null;
  bankDetails?: string | null;
  bankDetailsAr?: string | null;
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  total: number;
  customer: PdfCustomer;
  lines: PdfLine[];
  watermarkText?: string | null;
  watermarkType?: string | null;
  hidePrices?: boolean;
  manualTotal?: number;
  zatcaQrCodeImage?: string;
  printMode?: 'zatca' | 'standard' | 'novat';
  customFieldValues?: Record<string, string>;
};

export function lineNetPrice(line: PdfLine): number {
  return line.quantity * line.unitPrice * (1 - (line.discount || 0) / 100);
}

// ── BILINGUAL TRANSLATION HELPERS ──────────────────────────────────────────────
export const standardTranslations: Record<string, string> = {
  "Full Payment in ADVANCE": "الدفع الكامل مقدماً",
  "80% Downpayment | Balance before completion.": "80% دفعة مقدمة | الرصيد قبل الإكمال",
  "2 YEARS limited warranty and/or supplier's recommendation": "ضمان محدود لمدة عامين و/أو توصية المورد",
  "2 YEARS limited warranty and/or supplier's recommendation.": "ضمان محدود لمدة عامين و/أو توصية المورد.",
  "1 YEAR limited warranty and/or supplier's recommendation": "ضمان محدود لمدة سنة و/أو توصية المورد",
  "2 Technicians, 1 Supervisor": "2 فنيين، 1 مشرف",
  "2 Technicians, 1 Supervisor.": "2 فنيين، 1 مشرف.",
  "3 Technicians, 1 Supervisor": "3 فنيين، 1 مشرف",
  "3 Technicians, 1 Supervisor.": "3 فنيين، 1 مشرف.",
  "4 Technicians, 1 Supervisor": "4 فنيين، 1 مشرف",
  "4 Technicians, 1 Supervisor.": "4 فنيين، 1 مشرف.",
  "1-2 days upon confirmation of payment": "1-2 أيام بعد تأكيد الدفع",
  "2-3 days upon confirmation of payment": "2-3 أيام بعد تأكيد الدفع",
  "2-3 days upon confirmation of payment.": "2-3 أيام بعد تأكيد الدفع.",
  "3-4 days upon confirmation of payment": "3-4 أيام بعد تأكيد الدفع",
  "3-4 days upon confirmation of payment.": "3-4 أيام بعد تأكيد الدفع.",
  "4-5 days upon confirmation of payment": "4-5 أيام بعد تأكيد الدفع",
  "1-2 Working Days": "1-2 يوم عمل",
  "1-2 Working Days.": "1-2 يوم عمل.",
  "2-3 Working Days": "2-3 يوم عمل",
  "3-4 Working Days": "3-4 يوم عمل",
  "4-5 Working Days": "4-5 يوم عمل",
  "4-5 Working Days.": "4-5 يوم عمل.",
  "5-7 Working Days": "5-7 يوم عمل",
  "10-14 Working Days": "10-14 يوم عمل",
  "25-30 Working Days": "25-30 يوم عمل",
  "25-30 Working Days.": "25-30 يوم عمل.",
  "Any additional work/device will be considered Change Order": "سيتم اعتبار أي عمل إضافي/جهاز بمثابة أمر تغيير",
  "Any additional work/device will be considered Change Order.": "سيتم اعتبار أي عمل إضافي/جهاز بمثابة أمر تغيير.",
  "Any additional work|device will be considered Change Order": "سيتم اعتبار أي عمل إضافي|جهاز بمثابة أمر تغيير",
  "Internet source is provided by the OWNER.": "يتم توفير مصدر الإنترنت من قبل المالك.",
  "Internet source is provided by the OWNER": "يتم توفير مصدر الإنترنت من قبل المالك",
};

export function getBilingualParts(en: string | null | undefined, ar: string | null | undefined) {
  if (!en && !ar) return { en: "", ar: "" };
  if (en && ar) return { en: en.trim(), ar: ar.trim() };
  const value = (en || ar || "").trim();
  if (!ar && value.includes("|")) {
    const parts = value.split("|");
    return { en: parts[0].trim(), ar: parts[1]?.trim() ?? "" };
  }
  if (!ar && standardTranslations[value]) {
    return { en: value, ar: standardTranslations[value] };
  }
  return { en: en || value, ar: ar || "" };
}

export function getBilingualNotes(notes: string | null | undefined, notesAr?: string | null) {
  if (notesAr?.trim()) {
    const enLines = (notes ?? "").split("\n").filter(Boolean);
    const arLines = notesAr.split("\n").filter(Boolean);
    const count = Math.max(enLines.length, arLines.length, 1);
    return Array.from({ length: count }, (_, i) => ({
      en: enLines[i] ?? enLines[0] ?? "",
      ar: arLines[i] ?? arLines[0] ?? "",
    }));
  }
  if (!notes) return [];
  return notes.split("\n").map((line) => {
    const cleanLine = line.trim();
    const pipeIdx = cleanLine.indexOf("|");
    if (pipeIdx !== -1 && pipeIdx > 10) {
      const parts = cleanLine.split("|");
      return { en: parts[0].trim(), ar: parts[1]?.trim() ?? "" };
    }
    if (standardTranslations[cleanLine]) return { en: cleanLine, ar: standardTranslations[cleanLine] };
    let ar = "";
    if (cleanLine.includes("Any additional work") && cleanLine.includes("Change Order"))
      ar += "سيتم اعتبار أي عمل إضافي/جهاز بمثابة أمر تغيير";
    if (cleanLine.includes("Internet source is provided by the OWNER"))
      ar += (ar ? "\n" : "") + "يتم توفير مصدر الإنترنت من قبل المالك";
    return { en: cleanLine, ar };
  });
}

export type PdfTermRow = { label: string; en: string; ar: string };

export function buildPdfTermRows(
  quote: PdfQuote,
  settings: PdfSettings
): PdfTermRow[] {
  const rows = [
    { label: "PAYMENT", en: quote.payment ?? settings.pdfPayment, ar: quote.paymentAr },
    { label: "WARRANTY", en: quote.warranty ?? settings.pdfWarranty, ar: quote.warrantyAr },
    { label: "MANPOWER", en: quote.manpower ?? settings.pdfManpower, ar: quote.manpowerAr },
    { label: "MOBILIZATION", en: quote.mobilization ?? settings.pdfMobilization, ar: quote.mobilizationAr },
    { label: "DURATION", en: quote.duration ?? settings.pdfDuration, ar: quote.durationAr },
  ];
  const mapped = rows
    .filter((r) => r.en || r.ar)
    .map((r) => {
      const parts = getBilingualParts(r.en, r.ar);
      return { label: r.label, en: parts.en, ar: parts.ar };
    });

  const bank = getBilingualParts(quote.bankDetails, quote.bankDetailsAr);
  if (bank.en || bank.ar) {
    mapped.push({
      label: "BANK DETAILS",
      en: bank.en || "",
      ar: bank.ar || "",
    });
  }

  return mapped;
}

// ── RENDERING HELPERS ─────────────────────────────────────────────────────────
function fmt(n: number) {
  return new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number.isFinite(n) ? n : 0);
}
function fmtDate(d: Date | string | null | undefined) {
  if (!d) return "—";
  const dt = typeof d === "string" ? new Date(d) : d;
  return isNaN(dt.getTime()) ? "—" : dt.toISOString().slice(0, 10);
}
const hasArabic = (s: string) => /[؀-ۿ]/.test(s);

/** Readable text colour (dark/light) for an arbitrary background hex. */
function readableOn(bg: string, preferred: string): string {
  const h = bg.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h.substring(0, 6);
  const lum = (0.299 * parseInt(full.substring(0, 2), 16) + 0.587 * parseInt(full.substring(2, 4), 16) + 0.114 * parseInt(full.substring(4, 6), 16));
  const pl = (() => {
    const p = preferred.replace("#", "");
    const pf = p.length === 3 ? p.split("").map((c) => c + c).join("") : p.substring(0, 6);
    return 0.299 * parseInt(pf.substring(0, 2), 16) + 0.587 * parseInt(pf.substring(2, 4), 16) + 0.114 * parseInt(pf.substring(4, 6), 16);
  })();
  // Keep the configured colour unless it would be unreadable (contrast too low).
  return Math.abs(lum - pl) >= 90 ? preferred : lum > 150 ? "#111827" : "#ffffff";
}

let fontsBase: string | null = null;
/**
 * Registers the bundled Tajawal fonts (Arabic + Latin, OFL licensed, shipped in public/fonts so no CDN is needed).
 * The browser uses "/fonts"; the server calls this once with an absolute directory.
 */
export function registerPdfFonts(base: string) {
  if (fontsBase === base) return;
  fontsBase = base;
  const sep = base.endsWith("/") ? "" : "/";
  Font.register({
    family: "Tajawal",
    fonts: [
      { src: `${base}${sep}Tajawal-Regular.ttf`, fontWeight: "normal" },
      { src: `${base}${sep}Tajawal-Bold.ttf`, fontWeight: "bold" },
    ],
  });
  // Avoid ugly mid-word hyphenation in tables.
  Font.registerHyphenationCallback((word) => [word]);
}
function ensureFonts() {
  if (!fontsBase) registerPdfFonts(typeof window !== "undefined" ? "/fonts" : "public/fonts");
}

type Fld = { key: string; label: string; labelAr?: string; enabled: boolean };

// ── COMPONENT ─────────────────────────────────────────────────────────────────

export function QuotePdfDocument({
  quote,
  settings,
  type = "quotation",
  amountPaid = 0,
  amountDue = 0
}: {
  quote: PdfQuote;
  settings: PdfSettings;
  type?: "quotation" | "invoice";
  amountPaid?: number;
  amountDue?: number;
}) {
  ensureFonts();
  const isInvoice = type === "invoice";
  const tpl = resolveTemplate(settings.pdfTemplate, type);
  const C = tpl.colors;
  const body = tpl.typography.bodyFontSize;
  const family = tpl.typography.fontFamily;
  const M = MARGIN_PT[tpl.page.margins];
  const base = { fontFamily: family, fontSize: body, color: "#18181b" } as const;
  const pdfHide = !!quote.hidePrices;

  // Arabic needs the bundled Tajawal font whatever Latin font is chosen; Latin text follows the template font.
  const T = ({ style, children, ...rest }: any) => {
    const flat = React.Children.toArray(children).map((c) => (typeof c === "string" || typeof c === "number" ? String(c) : "")).join("");
    const arabic = hasArabic(flat);
    return (
      <Text style={[style, arabic && family !== "Tajawal" ? { fontFamily: "Tajawal" } : {}]} {...rest}>
        {children}
      </Text>
    );
  };

  const sec = (id: string) => tpl.sections.find((s) => s.id === id);
  const enabled = (id: string) => !!sec(id)?.enabled;
  const fieldOn = (id: string, key: string) => {
    const s = sec(id);
    if (!s || !s.enabled) return false;
    const fld = s.fields.find((x) => x.key === key);
    return fld ? fld.enabled : true; // unknown keys default to visible
  };
  const fieldsOf = (s: { fields: Fld[] }) => s.fields.filter((x) => x.enabled);

  // Custom field rows assigned to a section (only those that apply to this doc type and have a value).
  const customRows = (sectionId: string) =>
    (tpl.customFields || [])
      .filter((cf) => cf.sectionId === sectionId && (cf.appliesTo === "all" || cf.appliesTo === (isInvoice ? "invoice" : "quotation")))
      .map((cf) => ({ label: cf.name, value: String(quote.customFieldValues?.[cf.key] ?? "").trim() }))
      .filter((r) => r.value && r.value !== "false");

  const customerAddress = [quote.customer.address, [quote.customer.city, quote.customer.country].filter(Boolean).join(", ")].filter(Boolean).join(", ");

  const S = StyleSheet.create({
    page: { ...base, paddingHorizontal: M, paddingTop: M + 10, paddingBottom: M + (enabled("footer") ? 40 : 6) },
    boxTitle: { fontWeight: "bold", fontSize: body + 1.5, color: C.primary, marginBottom: 4 },
    box: { borderWidth: 0.8, borderColor: C.accentBorder, borderRadius: 2 },
    boxHead: { backgroundColor: C.zebraRowBg, paddingVertical: 3.5, paddingHorizontal: 7, borderBottomWidth: 0.8, borderBottomColor: C.accentBorder, flexDirection: "row", justifyContent: "space-between" },
    boxHeadText: { fontWeight: "bold", fontSize: body + 0.5 },
    boxBody: { paddingHorizontal: 7, paddingVertical: 5 },
    row: { flexDirection: "row", marginBottom: 2 },
    lbl: { fontWeight: "bold", width: 104, color: "#374151" },
    thText: { fontWeight: "bold", fontSize: body - 1.2, paddingVertical: 5, paddingHorizontal: 3, textAlign: "center" },
    td: { fontSize: body - 1, paddingVertical: 4.5, paddingHorizontal: 3 },
    totalRow: { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 6, paddingVertical: 3, borderBottomWidth: 0.5, borderBottomColor: "#d4d4d8" },
  });

  // ── Section renderers (return null when there is nothing to print) ──────────
  const renderHeader = () => {
    const s = sec("header")!;
    const on = (k: string) => fieldOn("header", k);
    const style = tpl.headerStyle;
    const bandBg = style === "solid" ? C.headerBgStart : null;
    const textColor = style === "minimal" ? C.primary : style === "boxed" ? "#111827" : readableOn(C.headerBgStart, C.headerText);
    const contact = [
      on("address") ? settings.address : null,
      on("phone") ? (settings.phone ? `Tel: ${settings.phone}` : null) : null,
      on("email") ? settings.email : null,
      on("orgNumber") ? [settings.crNumber ? `CR: ${settings.crNumber}` : null, settings.vatNumber ? `VAT: ${settings.vatNumber}` : null].filter(Boolean).join("  |  ") : null,
    ].filter(Boolean) as string[];
    const logo = on("logo") ? settings.logoUrl : null;
    // Explicit height so the gradient SVG (which needs absolute dimensions) always matches the band.
    const logoH = logo ? (settings.logoSize || 24) * 2 : 0;
    const textH = tpl.typography.titleFontSize * 1.25 + (on("companyName") ? body + 5 : 0) + contact.length * (body - 0.3);
    const bandH = Math.max(52, Math.ceil(Math.max(textH, logoH) + (style === "minimal" ? 10 : 22)));
    const bandW = (tpl.page.size === "LETTER" ? 612 : 595.28) - 2 * M;

    return (
      <View
        key="header"
        wrap={false}
        style={{
          marginBottom: 10,
          position: "relative",
          height: bandH,
          justifyContent: "center",
          paddingHorizontal: style === "minimal" ? 0 : 12,
          ...(style === "boxed" ? { borderWidth: 1.2, borderColor: C.accentBorder, borderRadius: 3 } : {}),
          ...(style === "minimal" ? { borderBottomWidth: 1.6, borderBottomColor: C.accentBorder } : {}),
          ...(bandBg ? { backgroundColor: bandBg, borderRadius: 3 } : {}),
        }}
      >
        {style === "gradient" ? (
          <Svg width={bandW} height={bandH} style={{ position: "absolute", top: 0, left: 0 }}>
            <Defs>
              <LinearGradient id="hdrGrad" x1="0" y1="0" x2="1" y2="0">
                <Stop offset="0%" stopColor={C.headerBgStart} />
                <Stop offset="100%" stopColor={C.headerBgEnd} />
              </LinearGradient>
            </Defs>
            <Rect x="0" y="0" width={bandW} height={bandH} rx="3" fill="url(#hdrGrad)" />
          </Svg>
        ) : null}
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <View style={{ flex: 1, paddingRight: 10 }}>
            <T style={{ fontSize: tpl.typography.titleFontSize, fontWeight: "bold", color: textColor, letterSpacing: 0.4 }}>
              {isInvoice ? "TAX INVOICE  |  فاتورة ضريبية" : "QUOTATION  |  عرض سعر"}
            </T>
            {on("companyName") ? (
              <T style={{ fontSize: body + 1.5, fontWeight: "bold", color: textColor, marginTop: 2 }}>{settings.companyName}</T>
            ) : null}
            {contact.map((c, i) => (
              <T key={i} style={{ fontSize: body - 1.3, color: textColor, opacity: 0.92, marginTop: 1 }}>{c}</T>
            ))}
          </View>
          {logo ? (
            <Image src={logo} style={{ width: (settings.logoSize || 24) * 4.2, height: (settings.logoSize || 24) * 2, objectFit: "contain" }} />
          ) : null}
        </View>
      </View>
    );
  };

  const renderMeta = () => {
    const s = sec("meta")!;
    const items: [string, string][] = [];
    if (fieldOn("meta", "number")) items.push([isInvoice ? "Invoice No. / رقم الفاتورة" : "Quote No. / رقم العرض", quote.number]);
    if (fieldOn("meta", "date")) items.push(["Date / التاريخ", fmtDate(quote.createdAt)]);
    if (fieldOn("meta", "dueDate") && quote.validUntil) items.push([isInvoice ? "Due Date / تاريخ الاستحقاق" : "Valid Until / صالح لغاية", fmtDate(quote.validUntil)]);
    customRows("meta").forEach((r) => items.push([r.label, r.value]));
    if (!items.length) return null;
    return (
      <View key="meta" wrap={false} style={[S.box, { flexDirection: "row", marginBottom: 10 }]}>
        {items.map(([l, v], i) => (
          <View key={i} style={{ flex: 1, paddingVertical: 5, paddingHorizontal: 8, borderLeftWidth: i ? 0.8 : 0, borderLeftColor: C.accentBorder }}>
            <T style={{ fontSize: body - 1.5, color: "#6b7280" }}>{l}</T>
            <T style={{ fontWeight: "bold", fontSize: body + 0.5 }}>{v}</T>
          </View>
        ))}
      </View>
    );
  };

  const titled = (s: { name: string; nameAr: string; customTitle?: string; customTitleAr?: string }) => ({
    en: s.customTitle || s.name,
    ar: s.customTitleAr || s.nameAr,
  });

  const kvBox = (id: string, rows: { label: string; value: string }[], widthStyle: Record<string, any> = {}) => {
    const s = sec(id)!;
    if (!rows.length) return null;
    const t = titled(s as any);
    return (
      <View key={id} wrap={false} style={[S.box, { marginBottom: 10 }, widthStyle]}>
        <View style={S.boxHead}>
          <T style={S.boxHeadText}>{t.en}</T>
          <T style={S.boxHeadText}>{t.ar}</T>
        </View>
        <View style={S.boxBody}>
          {rows.map((r, i) => (
            <View key={i} style={S.row}>
              <T style={S.lbl}>{r.label}:</T>
              <T style={{ flex: 1 }}>{r.value}</T>
            </View>
          ))}
        </View>
      </View>
    );
  };

  const renderCustomer = () => {
    const c = quote.customer;
    const map: Record<string, string> = {
      customerName: c.company,
      customerContact: c.contactName || "",
      customerAddress,
      customerEmail: c.email || "",
      customerPhone: c.phone || "",
      customerTaxId: c.vatNumber || "",
      subject: [quote.subject, quote.subjectAr].filter(Boolean).join("\n"),
    };
    const rows = fieldsOf(sec("customer")! as any)
      .filter((f) => map[f.key])
      .map((f) => ({ label: f.label, value: map[f.key] }));
    return kvBox("customer", [...rows, ...customRows("customer")]);
  };

  // Generic key/value box for sections that only host custom fields (e.g. "Project / Service Specs").
  const renderCustomFieldSection = (id: string) => kvBox(id, customRows(id));

  const renderLineItems = () => {
    const tc = tpl.tableColumns;
    const showPrice = !pdfHide;
    const cols = {
      index: tc.showIndex,
      code: tc.showItemCode && quote.lines.some((l) => l.itemCode),
      descEn: tc.showDescEn,
      descAr: tc.showDescAr,
      qty: tc.showQty,
      unit: tc.showUnit,
      unitPrice: tc.showUnitPrice && showPrice,
      discount: tc.showDiscount && showPrice,
      tax: tc.showTax && showPrice,
      total: tc.showTotal && showPrice,
    };
    const headBg = C.tableHeaderBg;
    const headTx = readableOn(headBg, C.tableHeaderText);
    const W = { index: 22, code: 52, qty: 34, unit: 34, unitPrice: 58, discount: 38, tax: 36, total: 66 };
    const cell = (w: number | undefined, children: React.ReactNode, key: string, last = false) => (
      <View key={key} style={[w ? { width: w } : { flex: 1 }, { justifyContent: "center", borderLeftWidth: 0.5, borderLeftColor: "#a1a1aa", ...(last ? { borderRightWidth: 0.5, borderRightColor: "#a1a1aa" } : {}) }]}>
        {children}
      </View>
    );
    const order: string[] = [];
    if (cols.index) order.push("index");
    if (cols.code) order.push("code");
    if (cols.descEn || cols.descAr) order.push("desc");
    if (cols.qty) order.push("qty");
    if (cols.unit) order.push("unit");
    if (cols.unitPrice) order.push("unitPrice");
    if (cols.discount) order.push("discount");
    if (cols.tax) order.push("tax");
    if (cols.total) order.push("total");
    const lastKey = order[order.length - 1];
    const head: Record<string, string> = { index: "#", code: "CODE", desc: "DESCRIPTION / الوصف", qty: "QTY", unit: "UNIT", unitPrice: "UNIT PRICE", discount: "DISC %", tax: "VAT %", total: tpl.tableColumns.showTax ? "TOTAL" : "NET PRICE" };

    let serial = 0;
    return (
      <View key="line_items" style={{ marginBottom: 10 }}>
        <View fixed style={{ flexDirection: "row", position: "relative", minHeight: 18, backgroundColor: headBg }}>
          {order.map((k) =>
            cell(k === "desc" ? undefined : (W as any)[k], <T style={[S.thText, { color: headTx }]}>{head[k]}</T>, k, k === lastKey)
          )}
        </View>
        {quote.lines.map((line, i) => {
          if (line.type === "section") {
            return (
              <View key={i} wrap={false} style={{ backgroundColor: C.zebraRowBg, borderBottomWidth: 0.5, borderBottomColor: "#a1a1aa", borderLeftWidth: 0.5, borderLeftColor: "#a1a1aa", borderRightWidth: 0.5, borderRightColor: "#a1a1aa", flexDirection: "row", justifyContent: "space-between", paddingVertical: 4, paddingHorizontal: 7 }}>
                <T style={{ fontWeight: "bold", color: C.primary, fontSize: body + 0.3 }}>{line.description}</T>
                {line.descriptionAr ? <T style={{ fontWeight: "bold", color: C.primary, fontSize: body + 0.3, textAlign: "right" }}>{line.descriptionAr}</T> : null}
              </View>
            );
          }
          serial += 1;
          const net = lineNetPrice(line);
          const bg = serial % 2 === 0 ? C.zebraRowBg : "#ffffff";
          const val: Record<string, React.ReactNode> = {
            index: <T style={[S.td, { textAlign: "center" }]}>{serial}</T>,
            code: <T style={[S.td, { textAlign: "center" }]}>{line.itemCode || ""}</T>,
            desc: (
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                {cols.descEn ? <T style={[S.td, { flex: 1 }]}>{line.description}</T> : null}
                {cols.descAr && line.descriptionAr ? <T style={[S.td, { flex: 1, textAlign: "right" }]}>{line.descriptionAr}</T> : null}
                {!cols.descEn && cols.descAr && !line.descriptionAr ? <T style={[S.td, { flex: 1 }]}>{line.description}</T> : null}
              </View>
            ),
            qty: <T style={[S.td, { textAlign: "center" }]}>{line.quantity}</T>,
            unit: <T style={[S.td, { textAlign: "center" }]}>{line.unit}</T>,
            unitPrice: <T style={[S.td, { textAlign: "center" }]}>{fmt(line.unitPrice)}</T>,
            discount: <T style={[S.td, { textAlign: "center" }]}>{line.discount ? `${line.discount}%` : "–"}</T>,
            tax: <T style={[S.td, { textAlign: "center" }]}>{line.taxPercent !== undefined ? `${line.taxPercent}%` : "–"}</T>,
            total: <T style={[S.td, { textAlign: "center", fontWeight: "bold" }]}>{fmt(tpl.tableColumns.showTax && line.taxPercent ? net * (1 + line.taxPercent / 100) : net)}</T>,
          };
          return (
            <View key={i} wrap={false} style={{ flexDirection: "row", alignItems: "stretch", backgroundColor: bg, borderBottomWidth: 0.5, borderBottomColor: "#a1a1aa" }}>
              {order.map((k) => cell(k === "desc" ? undefined : (W as any)[k], val[k], k, k === lastKey))}
            </View>
          );
        })}
      </View>
    );
  };

  const renderSummary = () => {
    const noteItems = fieldOn("summary", "notes") ? getBilingualNotes(quote.notes, quote.notesAr) : [];
    const noVat = quote.printMode === "novat";
    const total = quote.manualTotal !== undefined && quote.manualTotal !== null ? quote.manualTotal : quote.total;
    const totalsBg = C.tableHeaderBg;
    const totalsTx = readableOn(totalsBg, C.tableHeaderText);
    const showTotals = !pdfHide;
    if (!noteItems.length && !showTotals) return null;
    return (
      <View key="summary" wrap={false} style={{ marginBottom: 10 }}>
        <View style={{ flexDirection: "row", gap: 10 }}>
          <View style={{ flex: 1 }}>
            {noteItems.length ? (
              <View style={{ flexDirection: "row", gap: 4 }}>
                <T style={{ fontWeight: "bold" }}>NOTE:</T>
                <View style={{ flex: 1, flexDirection: "row", gap: 6 }}>
                  <View style={{ flex: 1 }}>
                    {noteItems.map((n, i) => <T key={i} style={{ fontSize: body - 1.3, marginBottom: 1 }}>{n.en}</T>)}
                  </View>
                  {noteItems.some((n) => n.ar) ? (
                    <View style={{ flex: 1 }}>
                      {noteItems.map((n, i) => <T key={i} style={{ fontSize: body - 1.3, textAlign: "right", marginBottom: 1 }}>{n.ar}</T>)}
                    </View>
                  ) : null}
                </View>
              </View>
            ) : null}
          </View>
          {showTotals ? (
            <View style={[S.box, { width: 172 }]}>
              {fieldOn("summary", "subtotal") ? (
                <View style={S.totalRow}><T style={{ fontWeight: "bold" }}>SUBTOTAL</T><T>{quote.currency} {fmt(quote.subtotal)}</T></View>
              ) : null}
              {quote.discountTotal > 0 && fieldOn("summary", "discount") ? (
                <View style={S.totalRow}><T style={{ fontWeight: "bold" }}>DISCOUNT</T><T>-{quote.currency} {fmt(quote.discountTotal)}</T></View>
              ) : null}
              {!noVat && fieldOn("summary", "taxTotal") ? (
                <View style={S.totalRow}><T style={{ fontWeight: "bold" }}>{settings.taxLabel}</T><T>{quote.currency} {fmt(quote.taxTotal)}</T></View>
              ) : null}
              <View style={{ flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 6, paddingVertical: 5, backgroundColor: totalsBg }}>
                <T style={{ color: totalsTx, fontWeight: "bold" }}>{isInvoice ? "TOTAL" : "TOTAL PACKAGE"}</T>
                <T style={{ color: totalsTx, fontWeight: "bold" }}>{quote.currency} {fmt(total)}</T>
              </View>
              {isInvoice && amountPaid > 0 && fieldOn("summary", "balanceDue") ? (
                <>
                  <View style={S.totalRow}><T style={{ fontWeight: "bold", color: "#16a34a" }}>PAID</T><T>{quote.currency} {fmt(amountPaid)}</T></View>
                  <View style={[S.totalRow, { borderBottomWidth: 0 }]}><T style={{ fontWeight: "bold", color: "#dc2626" }}>DUE</T><T style={{ fontWeight: "bold", color: "#dc2626" }}>{quote.currency} {fmt(amountDue)}</T></View>
                </>
              ) : null}
            </View>
          ) : null}
        </View>
      </View>
    );
  };

  const renderQr = () => {
    if (!isInvoice || !quote.zatcaQrCodeImage) return null;
    const t = titled(sec("zatca_qr") as any);
    return (
      <View key="zatca_qr" wrap={false} style={[S.box, { marginBottom: 10, alignItems: "center", paddingVertical: 8 }]}>
        <Image src={quote.zatcaQrCodeImage} style={{ width: 84, height: 84 }} />
        <T style={{ fontSize: body - 1.5, color: "#6b7280", marginTop: 3 }}>{t.en} / {t.ar}</T>
      </View>
    );
  };

  const renderBank = () => {
    const bank = getBilingualParts(quote.bankDetails, quote.bankDetailsAr);
    const rows = [
      fieldOn("bank_details", "bankName") && settings.bankName ? { label: "Bank", value: settings.bankName } : null,
      fieldOn("bank_details", "bankAccount") && settings.bankAccount ? { label: "Account", value: settings.bankAccount } : null,
      fieldOn("bank_details", "bankIban") && settings.bankIban ? { label: "IBAN", value: settings.bankIban } : null,
      fieldOn("bank_details", "bankDetails") && (bank.en || bank.ar) ? { label: "Details", value: [bank.en, bank.ar].filter(Boolean).join("   |   ") } : null,
    ].filter(Boolean) as { label: string; value: string }[];
    return kvBox("bank_details", rows);
  };

  const renderTerms = () => {
    const keyOf: Record<string, string> = { PAYMENT: "paymentTerms", WARRANTY: "warrantyTerms", MANPOWER: "manpowerTerms", MOBILIZATION: "mobilizationTerms", DURATION: "durationTerms" };
    const rows = buildPdfTermRows(quote, settings).filter((r) => keyOf[r.label] && fieldOn("payment_terms", keyOf[r.label]));
    if (!rows.length) return null;
    const t = titled(sec("payment_terms") as any);
    const fs = (settings.termsFontSize ? settings.termsFontSize * 0.53 : body - 0.5);
    return (
      <View key="payment_terms" wrap={false} style={{ marginBottom: 10 }}>
        <T style={S.boxTitle}>{t.en} / {t.ar}</T>
        {rows.map((r) => (
          <View key={r.label} style={{ flexDirection: "row", alignItems: "flex-start", marginBottom: 3.5 }}>
            <T style={{ fontWeight: "bold", width: 84, fontSize: fs }}>{r.label}:</T>
            <T style={{ flex: 1, fontSize: fs, lineHeight: 1.25 }}>{r.en}</T>
            {r.ar ? <T style={{ flex: 1, fontSize: fs, textAlign: "right", lineHeight: 1.25 }}>{r.ar}</T> : null}
          </View>
        ))}
      </View>
    );
  };

  const renderSignatures = () => {
    const s = sec("signatures")!;
    const boxes = fieldsOf(s as any);
    if (!boxes.length) return null;
    return (
      <View key="signatures" wrap={false} style={{ flexDirection: "row", gap: 24, marginTop: 14, marginBottom: 10 }}>
        {boxes.map((b) => (
          <View key={b.key} style={{ flex: 1 }}>
            <View style={{ height: 42, borderBottomWidth: 0.8, borderBottomColor: "#111827" }} />
            <T style={{ fontSize: body - 1, fontWeight: "bold", marginTop: 3 }}>{b.label}</T>
            {b.labelAr ? <T style={{ fontSize: body - 1, color: "#4b5563", textAlign: "right" }}>{b.labelAr}</T> : null}
          </View>
        ))}
      </View>
    );
  };

  const renderCustomSection = (id: string) => {
    const s = sec(id)!;
    const t = titled(s as any);
    const content = (s.customContent || "").trim();
    const rows = customRows(id);
    if (!content && !rows.length) return null;
    return (
      <View key={id} wrap={false} style={{ marginBottom: 10 }}>
        <T style={S.boxTitle}>{t.en}{t.ar ? ` / ${t.ar}` : ""}</T>
        {content.split("\n").map((ln, i) => (
          <T key={i} style={{ marginBottom: 1.5, textAlign: hasArabic(ln) ? "right" : "left" }}>{ln}</T>
        ))}
        {rows.map((r, i) => (
          <View key={`r${i}`} style={S.row}><T style={S.lbl}>{r.label}:</T><T style={{ flex: 1 }}>{r.value}</T></View>
        ))}
      </View>
    );
  };

  const renderers: Record<string, () => React.ReactNode> = {
    header: renderHeader,
    meta: renderMeta,
    customer: renderCustomer,
    vehicle: () => renderCustomFieldSection("vehicle"),
    line_items: renderLineItems,
    summary: renderSummary,
    zatca_qr: renderQr,
    bank_details: renderBank,
    payment_terms: renderTerms,
    signatures: renderSignatures,
  };

  // Build the body: ordered, enabled sections; consecutive "half" sections share a row.
  const built = tpl.sections
    .filter((s) => s.enabled && s.id !== "footer")
    .map((s) => ({
      s,
      node: s.isCustom ? renderCustomSection(s.id) : renderers[s.id] ? renderers[s.id]() : renderCustomFieldSection(s.id),
    }))
    .filter((x) => x.node);

  const blocks: React.ReactNode[] = [];
  for (let i = 0; i < built.length; i++) {
    const cur = built[i];
    const next = built[i + 1];
    const halfable = (x?: { s: { id: string; width: string } }) => !!x && x.s.width === "half" && x.s.id !== "line_items" && x.s.id !== "header";
    if (halfable(cur) && halfable(next)) {
      blocks.push(
        <View key={`row-${cur.s.id}`} wrap={false} style={{ flexDirection: "row", gap: 10 }}>
          <View style={{ flex: 1 }}>{cur.node}</View>
          <View style={{ flex: 1 }}>{next!.node}</View>
        </View>
      );
      i++;
    } else {
      blocks.push(<React.Fragment key={`blk-${cur.s.id}`}>{cur.node}</React.Fragment>);
    }
  }

  // Watermark: a document-level stamp (set in the editor) wins over the template default.
  const docWm = quote.watermarkType && quote.watermarkType !== "none" && quote.watermarkText ? quote.watermarkText : null;
  const wmText = docWm || (tpl.watermark.enabled ? tpl.watermark.text : "");
  const wmMulti = !!docWm && quote.watermarkType === "multi";
  const wmOpacity = docWm ? 0.1 : tpl.watermark.opacity;
  const wmAngle = docWm ? 35 : tpl.watermark.angle;

  const pageSize = tpl.page.size === "LETTER" ? "LETTER" : "A4";
  const pageH = pageSize === "LETTER" ? 792 : 842;
  const footerOn = enabled("footer");

  return (
    <Document title={`${isInvoice ? "Invoice" : "Quotation"} ${quote.number}`} author={settings.companyName}>
      <Page size={pageSize} style={S.page}>
        {/* Watermark (behind content) */}
        {wmText ? (
          <View fixed style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: wmMulti ? "space-around" : "center" }}>
            {(wmMulti ? [0, 1, 2] : [0]).map((k) => (
              <T key={k} style={{ fontSize: 84, fontWeight: "bold", color: "#000000", opacity: wmOpacity, transform: `rotate(${-wmAngle}deg)` }}>
                {wmText}
              </T>
            ))}
          </View>
        ) : null}

        {/* Running header on pages 2+ (document id + customer) */}
        <View
          fixed
          style={{ position: "absolute", top: Math.max(8, M - 18), left: M, right: M, flexDirection: "row", justifyContent: "space-between" }}
          render={({ pageNumber }) =>
            pageNumber > 1 ? (
              <>
                <T style={{ fontSize: body - 1.5, fontWeight: "bold", color: C.primary }}>{isInvoice ? "Invoice" : "Quotation"} {quote.number}</T>
                <T style={{ fontSize: body - 1.5, color: "#4b5563" }}>{quote.customer.company}</T>
              </>
            ) : null
          }
        />

        {blocks}

        {/* Footer (fixed on every page) */}
        {footerOn && fieldOn("footer", "footerImage") && settings.footerImageUrl ? (
          <View fixed style={{ position: "absolute", bottom: M + 12, left: M, right: M, alignItems: "center" }}>
            <Image src={settings.footerImageUrl} style={{ width: "100%", height: settings.footerSize || 28, objectFit: "contain" }} />
          </View>
        ) : null}
        {footerOn ? (
          <View fixed style={{ position: "absolute", bottom: Math.max(10, M - 14), left: M, right: M, flexDirection: "row", justifyContent: "space-between", borderTopWidth: 0.5, borderTopColor: "#d4d4d8", paddingTop: 4 }}>
            <T style={{ fontSize: body - 2, color: "#4b5563" }}>
              {fieldOn("footer", "footerContact")
                ? [settings.footerText || settings.companyName, settings.phone ? `Tel: ${settings.phone}` : null, settings.email].filter(Boolean).join(" | ")
                : ""}
            </T>
            {fieldOn("footer", "pageNumbers") ? (
              <Text style={{ fontSize: body - 2, color: "#4b5563" }} render={({ pageNumber, totalPages }: { pageNumber: number; totalPages: number }) => `Page ${pageNumber} of ${totalPages}`} />
            ) : null}
          </View>
        ) : null}
      </Page>
    </Document>
  );
}
