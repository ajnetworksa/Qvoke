import React from "react";
import { Document, Page, Text, View, StyleSheet, Image, Font, Svg, Defs, LinearGradient, Stop, Rect } from "@react-pdf/renderer";

Font.register({
  family: "Tajawal",
  fonts: [
    { src: "https://cdn.jsdelivr.net/gh/googlefonts/tajawal@main/fonts/ttf/Tajawal-Regular.ttf", fontWeight: "normal" },
    { src: "https://cdn.jsdelivr.net/gh/googlefonts/tajawal@main/fonts/ttf/Tajawal-Bold.ttf", fontWeight: "bold" },
  ],
});

export type PdfLine = {
  type?: 'item' | 'section' | 'note';
  description: string;
  descriptionAr?: string | null;
  quantity: number;
  unit: string;
  unitPrice: number;
  discount?: number;
};

export type PdfCustomer = {
  company: string;
  contactName?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  city?: string | null;
  country?: string | null;
};

export type PdfSettings = {
  companyName: string;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  logoUrl?: string | null;
  footerImageUrl?: string | null;
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
};

export function lineNetPrice(line: PdfLine): number {
  return line.quantity * line.unitPrice * (1 - (line.discount || 0) / 100);
}

// ── BILINGUAL TRANSLATION HELPERS ──────────────────────────────────────────────
// NOTE: Do NOT use U+200E (LTR mark) — @react-pdf/renderer renders it as a
// visible glyph (&) in the Tajawal font. Arabic bidi is handled natively.

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
  // Both sides supplied — use as-is
  if (en && ar) return { en: en.trim(), ar: ar.trim() };
  const value = (en || ar || "").trim();
  // "|" as bilingual separator (only when ar is absent)
  if (!ar && value.includes("|")) {
    const parts = value.split("|");
    return { en: parts[0].trim(), ar: parts[1]?.trim() ?? "" };
  }
  // Lookup translation table
  if (!ar && standardTranslations[value]) {
    return { en: value, ar: standardTranslations[value] };
  }
  return { en: en || value, ar: ar || "" };
}

export function getBilingualNotes(notes: string | null | undefined, notesAr?: string | null) {
  // Prefer separately stored Arabic notes
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
    // Check if the line itself is a "|" bilingual pair (not the word "work|device")
    const pipeIdx = cleanLine.indexOf("|");
    if (pipeIdx !== -1 && pipeIdx > 10) {
      // Only treat as bilingual separator when pipe is not within the first 10 chars
      const parts = cleanLine.split("|");
      return { en: parts[0].trim(), ar: parts[1]?.trim() ?? "" };
    }
    if (standardTranslations[cleanLine]) return { en: cleanLine, ar: standardTranslations[cleanLine] };
    // Fallback: build Arabic from known sub-strings
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
  quote: {
    payment?: string | null; paymentAr?: string | null;
    warranty?: string | null; warrantyAr?: string | null;
    manpower?: string | null; manpowerAr?: string | null;
    mobilization?: string | null; mobilizationAr?: string | null;
    duration?: string | null; durationAr?: string | null;
  },
  settings: {
    pdfPayment?: string | null; pdfWarranty?: string | null;
    pdfManpower?: string | null; pdfMobilization?: string | null;
    pdfDuration?: string | null;
  }
): PdfTermRow[] {
  const rows = [
    { label: "PAYMENT", en: quote.payment ?? settings.pdfPayment, ar: quote.paymentAr },
    { label: "WARRANTY", en: quote.warranty ?? settings.pdfWarranty, ar: quote.warrantyAr },
    { label: "MANPOWER", en: quote.manpower ?? settings.pdfManpower, ar: quote.manpowerAr },
    { label: "MOBILIZATION", en: quote.mobilization ?? settings.pdfMobilization, ar: quote.mobilizationAr },
    { label: "DURATION", en: quote.duration ?? settings.pdfDuration, ar: quote.durationAr },
  ];
  return rows
    .filter((r) => r.en || r.ar)
    .map((r) => {
      const parts = getBilingualParts(r.en, r.ar);
      return { label: r.label, en: parts.en, ar: parts.ar };
    });
}

// ── STYLES ────────────────────────────────────────────────────────────────────
const LABEL_W = 58;

const COL = {
  item: 28,
  qty: 34,
  unit: 34,
  unitPrice: 72,
  netPrice: 76,
};

const styles = StyleSheet.create({
  page: { paddingHorizontal: 12, paddingTop: 85, paddingBottom: 65, fontSize: 9, fontFamily: "Tajawal", color: "#18181b" },
  headerRow: {
    position: "absolute",
    top: 15,
    left: 12,
    right: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    borderBottomWidth: 0.5,
    borderBottomColor: "#d4d4d8",
    paddingBottom: 8
  },
  title: { fontSize: 24, fontWeight: "bold", marginBottom: 4, letterSpacing: 0.5 },
  metaRow: { flexDirection: "row", gap: 6, alignItems: "center", marginBottom: 1 },
  metaLabel: { fontSize: 8.5, fontWeight: "bold", color: "#374151", minWidth: 120 },
  metaValue: { fontSize: 8.5, fontWeight: "bold", color: "#111827" },
  customerBox: { borderWidth: 1, borderColor: "#1f2937", marginBottom: 10 },
  customerHeader: { backgroundColor: "#f3f4f6", paddingVertical: 4, paddingHorizontal: 8, borderBottomWidth: 1, borderBottomColor: "#1f2937" },
  customerHeaderText: { fontSize: 10.5, fontWeight: "bold" },
  customerContent: { paddingHorizontal: 8, paddingVertical: 5 },
  customerRow: { flexDirection: "row", alignItems: "flex-start", marginBottom: 1.5 },
  customerCol: { flexDirection: "row", gap: 3 },
  lbl: { fontWeight: "bold", fontSize: 9, width: LABEL_W },
  val: { fontSize: 9 },
  valBold: { fontSize: 9, fontWeight: "bold" },
  table: { marginBottom: 8 },
  tableHeaderRow: {
    flexDirection: "row",
    borderTopWidth: 0.5,
    borderTopColor: "#18181b",
    borderBottomWidth: 0.5,
    borderBottomColor: "#18181b"
  },
  th: {
    color: "#ffffff",
    fontSize: 7.5,
    fontWeight: "bold",
    padding: 5,
    textAlign: "center"
  },
  thDesc: {
    color: "#ffffff",
    fontSize: 7.5,
    fontWeight: "bold",
    padding: 5,
    textAlign: "center"
  },
  tableRow: {
    flexDirection: "row",
    alignItems: "stretch",
    borderBottomWidth: 0.5,
    borderBottomColor: "#18181b"
  },
  cellContainer: {
    justifyContent: "center",
  },
  cellText: {
    padding: 5,
    fontSize: 7.5,
    color: "#18181b"
  },
  cellCenter: {
    textAlign: "center"
  },
  cellRight: {
    textAlign: "right"
  },
  cellLeft: {
    textAlign: "left"
  },
  cellBold: {
    fontWeight: "bold"
  },
  border: { borderLeftWidth: 0.5, borderLeftColor: "#18181b" },
  borderTop: { borderTopWidth: 0.5, borderTopColor: "#18181b" },
  borderRight: { borderRightWidth: 0.5, borderRightColor: "#18181b" },
  noteBox: { flex: 1, borderWidth: 0.5, borderColor: "#18181b", padding: 6 },
  totalsBox: { width: 158, borderWidth: 0.5, borderColor: "#18181b" },
  totalRow: { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 6, paddingVertical: 3, borderBottomWidth: 0.5, borderColor: "#18181b" },
  totalPkg: { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 6, paddingVertical: 5, fontWeight: "bold", color: "#ffffff" },
  termsSection: { marginTop: 5, gap: 3 },
  termRow: { flexDirection: "row", justifyContent: "space-between" },
  termLeft: { flexDirection: "row", gap: 3, flex: 1 },
  bankSection: { marginTop: 5, borderTopWidth: 0.5, borderTopColor: "#d4d4d8", paddingTop: 4 },
  footerRow: {
    position: "absolute",
    bottom: 15,
    left: 12,
    right: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 0.5,
    borderTopColor: "#d4d4d8",
    paddingTop: 6
  },
  footerText: {
    fontSize: 7,
    fontFamily: "Tajawal",
    color: "#4b5563"
  }
});

const watermarkStyles = StyleSheet.create({
  centerContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
    zIndex: -1,
  },
  centerText: {
    fontSize: 72,
    fontWeight: "bold",
    color: "#6b7280",
    opacity: 0.16,
    transform: "rotate(-35deg)",
    fontFamily: "Tajawal",
  },
  multiContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "space-around",
    paddingVertical: 100,
    zIndex: -1,
  },
  multiRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
  },
  multiText: {
    fontSize: 26,
    fontWeight: "bold",
    color: "#6b7280",
    opacity: 0.15,
    transform: "rotate(-30deg)",
    fontFamily: "Tajawal",
  },
});

function Watermark({ text, type }: { text?: string | null; type?: string | null }) {
  if (!type || type === "none" || !text) return null;

  if (type === "center") {
    return (
      <View fixed style={watermarkStyles.centerContainer} pointerEvents="none">
        <Text style={watermarkStyles.centerText}>{text.toUpperCase()}</Text>
      </View>
    );
  }

  if (type === "multi") {
    return (
      <View fixed style={watermarkStyles.multiContainer} pointerEvents="none">
        <View style={watermarkStyles.multiRow}>
          <Text style={watermarkStyles.multiText}>{text.toUpperCase()}</Text>
          <Text style={watermarkStyles.multiText}>{text.toUpperCase()}</Text>
          <Text style={watermarkStyles.multiText}>{text.toUpperCase()}</Text>
        </View>
        <View style={watermarkStyles.multiRow}>
          <Text style={watermarkStyles.multiText}>{text.toUpperCase()}</Text>
          <Text style={watermarkStyles.multiText}>{text.toUpperCase()}</Text>
          <Text style={watermarkStyles.multiText}>{text.toUpperCase()}</Text>
        </View>
        <View style={watermarkStyles.multiRow}>
          <Text style={watermarkStyles.multiText}>{text.toUpperCase()}</Text>
          <Text style={watermarkStyles.multiText}>{text.toUpperCase()}</Text>
          <Text style={watermarkStyles.multiText}>{text.toUpperCase()}</Text>
        </View>
      </View>
    );
  }

  return null;
}

function fmt(n: number) {
  return new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}
function fmtDate(d: Date | string | null | undefined) {
  if (!d) return "—";
  const dt = typeof d === "string" ? new Date(d) : d;
  return dt.toISOString().slice(0, 10);
}

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
  const isInvoice = type === "invoice";

  // Ensure brand color is never so dark it appears black in the PDF
  const ensureVisibleColor = (hex: string): string => {
    const h = hex.replace("#", "");
    const r = parseInt(h.substring(0, 2), 16);
    const g = parseInt(h.substring(2, 4), 16);
    const b = parseInt(h.substring(4, 6), 16);
    // Calculate relative luminance (0 = black, 255 = white)
    const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
    // If too dark (< 40), brighten each channel proportionally
    if (luminance < 40) {
      const boost = 60;
      const nr = Math.min(255, r + boost);
      const ng = Math.min(255, g + boost);
      const nb = Math.min(255, b + boost);
      return `#${nr.toString(16).padStart(2, "0")}${ng.toString(16).padStart(2, "0")}${nb.toString(16).padStart(2, "0")}`;
    }
    return hex;
  };

  const brand = ensureVisibleColor(settings.brandColor || "#039737");
  const headerBgType = settings.pdfHeaderBgType || "solid";
  const headerBgColorStart = settings.pdfHeaderBgColorStart || brand;
  const headerBgColorEnd = settings.pdfHeaderBgColorEnd || brand;
  const headerTextColor = settings.pdfHeaderTextColor || "#ffffff";
  const tableBgColor = settings.pdfTableBgColor || brand;
  const tableTextColor = settings.pdfTableTextColor || "#ffffff";

  const customerAddress = [
    quote.customer.address,
    [quote.customer.city, quote.customer.country].filter(Boolean).join(", "),
  ].filter(Boolean).join(", ");

  const termsRows = buildPdfTermRows(quote, settings);
  const noteItems = getBilingualNotes(quote.notes, quote.notesAr);
  const bank = getBilingualParts(quote.bankDetails, quote.bankDetailsAr);

  const cellBorder = [styles.border];
  const cellBorderRight = [styles.border, styles.borderRight];

  return (
    <Document>
      <Page size="A4" style={styles.page}>

        {/* ── HEADER ─────────────────────────────────────────────────── */}
        <View fixed style={styles.headerRow}>
          <View>
            <Text style={styles.title}>{isInvoice ? "TAX INVOICE" : "QUOTATION"}</Text>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>{isInvoice ? "Invoice ID / رقم الفاتورة:" : "Quote ID / رقم العرض:"}</Text>
              <Text style={styles.metaValue}>{quote.number}</Text>
            </View>

            {/* Dynamic Date Row - Only visible on Page 1 */}
            <View style={styles.metaRow} render={({ pageNumber }) => pageNumber === 1 ? (
              <View style={{ flexDirection: "row", width: "100%" }}>
                <Text style={styles.metaLabel}>Date / التاريخ:</Text>
                <Text style={styles.metaValue}>{fmtDate(quote.createdAt)}</Text>
              </View>
            ) : <View style={{ width: 0, height: 0 }} />} />

            {/* Dynamic Valid Until / Due Date Row - Only visible on Page 1 if present */}
            {quote.validUntil ? (
              <View style={styles.metaRow} render={({ pageNumber }) => pageNumber === 1 ? (
                <View style={{ flexDirection: "row", width: "100%" }}>
                  <Text style={styles.metaLabel}>{isInvoice ? "Due Date / تاريخ الاستحقاق:" : "Valid Until / صالح لغاية:"}</Text>
                  <Text style={styles.metaValue}>{fmtDate(quote.validUntil)}</Text>
                </View>
              ) : <View style={{ width: 0, height: 0 }} />} />
            ) : null}
          </View>
          <View style={{ alignItems: "flex-end" }}>
            {settings.logoUrl ? (
              <Image src={settings.logoUrl} style={{ width: 130, height: 50, objectFit: "contain" }} />
            ) : (
              <Text style={{ fontSize: 12, fontWeight: "bold", color: brand, textAlign: "right", maxWidth: 150 }}>
                {settings.companyName}
              </Text>
            )}
          </View>
        </View>

        {/* ── CUSTOMER INFO ───────────────────────────────────────────── */}
        <View wrap={false} style={styles.customerBox}>
          <View style={styles.customerHeader}>
            <Text style={styles.customerHeaderText}>CUSTOMER INFO</Text>
          </View>
          <View style={styles.customerContent}>
            {/* Row 1: Customer + Mobile */}
            <View style={styles.customerRow}>
              <View style={{ flexDirection: "row", flex: 1 }}>
                <Text style={styles.lbl}>Customer:</Text>
                <Text style={styles.valBold}>{quote.customer.company}</Text>
              </View>
              <View style={{ flexDirection: "row", width: 200 }}>
                <Text style={[styles.lbl, { width: 46 }]}>Mobile:</Text>
                <Text style={styles.val}>{quote.customer.phone || ""}</Text>
              </View>
            </View>
            {/* Row 2: Address (full width) */}
            <View style={styles.customerRow}>
              <Text style={styles.lbl}>Address:</Text>
              <Text style={[styles.val, { flex: 1 }]}>{customerAddress}</Text>
            </View>
            {/* Row 3: Contact + Email */}
            <View style={styles.customerRow}>
              <View style={{ flexDirection: "row", flex: 1 }}>
                <Text style={styles.lbl}>Contact:</Text>
                <Text style={styles.val}>{quote.customer.contactName || ""}</Text>
              </View>
              <View style={{ flexDirection: "row", width: 200 }}>
                <Text style={[styles.lbl, { width: 46 }]}>E-mail:</Text>
                <Text style={styles.val}>{quote.customer.email || ""}</Text>
              </View>
            </View>
            {(quote.subject || quote.subjectAr) ? (
              <View style={{ marginTop: 3 }}>
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <Text style={styles.lbl}>Subject:</Text>
                  <View style={{ flex: 1, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                    <Text style={[styles.val, { flex: 1 }]}>{quote.subject || ""}</Text>
                    {quote.subjectAr ? <Text style={[styles.val, { flex: 1, textAlign: "right" }]}>{quote.subjectAr}</Text> : null}
                  </View>
                </View>
              </View>
            ) : null}
          </View>
        </View>

        {/* ── ITEMS TABLE ─────────────────────────────────────────────── */}
        <View style={styles.table}>
          {/* Header */}
          <View fixed style={[styles.tableHeaderRow, { position: "relative", minHeight: 18 }]}>
            {headerBgType === "gradient" ? (
              <Svg style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, zIndex: -1 }}>
                <Defs>
                  <LinearGradient id="tableHeaderGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                    <Stop offset="0%" stopColor={headerBgColorStart} />
                    <Stop offset="100%" stopColor={headerBgColorEnd} />
                  </LinearGradient>
                </Defs>
                <Rect x="0" y="0" width="100%" height="100%" fill="url(#tableHeaderGrad)" />
              </Svg>
            ) : (
              <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: tableBgColor, zIndex: -1 }} />
            )}
            <View style={[{ width: COL.item }, styles.border]}>
              <Text style={[styles.th, { color: tableTextColor }]}>ITEM</Text>
            </View>
            <View style={[{ flex: 1 }, styles.border]}>
              <Text style={[styles.thDesc, { color: tableTextColor }]}>DESCRIPTION</Text>
            </View>
            <View style={[{ width: COL.qty }, styles.border]}>
              <Text style={[styles.th, { color: tableTextColor }]}>QTY</Text>
            </View>
            <View style={[{ width: COL.unit }, quote.hidePrices ? cellBorderRight : styles.border]}>
              <Text style={[styles.th, { color: tableTextColor }]}>UNIT</Text>
            </View>
            {!quote.hidePrices ? (
              <>
                <View style={[{ width: COL.unitPrice }, styles.border]}>
                  <Text style={[styles.th, { color: tableTextColor }]}>UNIT PRICE</Text>
                </View>
                <View style={[{ width: COL.netPrice }, ...cellBorderRight]}>
                  <Text style={[styles.th, { color: tableTextColor }]}>NET PRICE</Text>
                </View>
              </>
            ) : null}
          </View>

          {/* Rows */}
          {quote.lines.map((line, i) => {
            // Section rows render as full-width branded headers
            if (line.type === 'section') {
              return (
                <View key={i} wrap={false} style={[styles.tableRow, { backgroundColor: 'rgba(240, 253, 250, 0.85)' }]}>
                  <View style={[{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingLeft: 8, paddingRight: 8, paddingTop: 4, paddingBottom: 4 }, styles.cellContainer, ...cellBorder, ...cellBorderRight]}>
                    <Text style={[styles.cellText, styles.cellLeft, { fontWeight: 'bold', color: brand, fontSize: 8.5 }]}>
                      {line.description}
                    </Text>
                    {line.descriptionAr ? (
                      <Text style={[styles.cellText, styles.cellRight, { fontWeight: 'bold', color: brand, fontSize: 8.5 }]}>
                        {line.descriptionAr}
                      </Text>
                    ) : null}
                  </View>
                </View>
              );
            }

            // Sequential numbering excluding section rows
            let serialNum = 0;
            for (let k = 0; k <= i; k++) {
              if (quote.lines[k]?.type !== 'section') serialNum++;
            }

            return (
              <View key={i} wrap={false} style={[styles.tableRow, { backgroundColor: i % 2 === 1 ? 'rgba(244, 244, 245, 0.8)' : 'transparent' }]}>

                {/* ITEM Column */}
                <View style={[{ width: COL.item }, styles.cellContainer, ...cellBorder]}>
                  <Text style={[styles.cellText, styles.cellCenter]}>{serialNum}</Text>
                </View>

                {/* DESCRIPTION Column */}
                <View style={[{ flex: 1 }, styles.cellContainer, ...cellBorder]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Text style={[styles.cellText, styles.cellLeft, { flex: 1 }]}>{line.description}</Text>
                    {line.descriptionAr ? (
                      <Text style={[styles.cellText, styles.cellRight, { flex: 1 }]}>{line.descriptionAr}</Text>
                    ) : null}
                  </View>
                </View>

                {/* QTY Column */}
                <View style={[{ width: COL.qty }, styles.cellContainer, ...cellBorder]}>
                  <Text style={[styles.cellText, styles.cellCenter]}>{line.quantity}</Text>
                </View>

                {/* UNIT Column */}
                <View style={[{ width: COL.unit }, styles.cellContainer, ...(quote.hidePrices ? cellBorderRight : cellBorder)]}>
                  <Text style={[styles.cellText, styles.cellCenter]}>{line.unit}</Text>
                </View>

                {!quote.hidePrices ? (
                  <>
                    {/* UNIT PRICE Column */}
                    <View style={[{ width: COL.unitPrice }, styles.cellContainer, ...cellBorder]}>
                      <Text style={[styles.cellText, styles.cellCenter]}>{fmt(line.unitPrice)}</Text>
                    </View>

                    {/* NET PRICE Column */}
                    <View style={[{ width: COL.netPrice }, styles.cellContainer, ...cellBorderRight]}>
                      <Text style={[styles.cellText, styles.cellCenter, styles.cellBold]}>{fmt(lineNetPrice(line))}</Text>
                    </View>
                  </>
                ) : null}

              </View>
            );
          })}
        </View>

        {/* ── NOTE + TOTALS ───────────────────────────────────────────── */}
        <View style={{ marginTop: 6 }}>
          <View style={{ flexDirection: "row", gap: 10 }}>
            {/* Note box */}
            <View style={styles.noteBox}>
              <View style={{ flexDirection: "row", gap: 4 }}>
                <Text style={{ fontWeight: "bold", minWidth: 38 }}>NOTE:</Text>
                <View style={{ flex: 1, flexDirection: "row", gap: 6 }}>
                  {/* English lines */}
                  <View style={{ flex: 1 }}>
                    {noteItems.map((item, idx) => (
                      <Text key={idx} style={{ fontSize: 7.5, marginBottom: 1 }}>{item.en}</Text>
                    ))}
                  </View>
                  {/* Arabic lines */}
                  {noteItems.some((n) => n.ar) ? (
                    <View style={{ flex: 1 }}>
                      {noteItems.map((item, idx) => (
                        <Text key={idx} style={{ fontSize: 7.5, textAlign: "right", marginBottom: 1 }}>{item.ar}</Text>
                      ))}
                    </View>
                  ) : null}
                </View>
              </View>
            </View>

            {/* Totals box */}
            <View style={styles.totalsBox}>
              <View style={styles.totalRow}>
                <Text style={{ fontWeight: "bold" }}>SUBTOTAL</Text>
                <Text>{quote.currency} {fmt(quote.subtotal)}</Text>
              </View>
              {quote.discountTotal > 0 ? (
                <View style={styles.totalRow}>
                  <Text style={{ fontWeight: "bold" }}>DISCOUNT</Text>
                  <Text>-{quote.currency} {fmt(quote.discountTotal)}</Text>
                </View>
              ) : null}
              <View style={styles.totalRow}>
                <Text style={{ fontWeight: "bold" }}>{settings.taxLabel}</Text>
                <Text>{quote.currency} {fmt(quote.taxTotal)}</Text>
              </View>
              <View style={[styles.totalPkg, { position: "relative", minHeight: 18, borderBottomWidth: 0, backgroundColor: "#18181b" }]}>
                <Text style={{ fontWeight: "bold", color: "#ffffff" }}>TOTAL PACKAGE</Text>
                <Text style={{ color: "#ffffff", fontWeight: "bold" }}>{quote.currency} {fmt(quote.manualTotal !== undefined && quote.manualTotal !== null ? quote.manualTotal : quote.total)}</Text>
              </View>
              {(isInvoice && amountPaid > 0) ? (
                <>
                  <View style={styles.totalRow}>
                    <Text style={{ fontWeight: "bold", color: "#16a34a" }}>PAID</Text>
                    <Text>{quote.currency} {fmt(amountPaid)}</Text>
                  </View>
                  <View style={[styles.totalRow, { borderBottomWidth: 0, paddingTop: 4 }]}>
                    <Text style={{ fontWeight: "bold", color: "#ef4444" }}>DUE</Text>
                    <Text style={{ fontWeight: "bold", color: "#ef4444" }}>{quote.currency} {fmt(amountDue)}</Text>
                  </View>
                </>
              ) : null}
            </View>
          </View>

          {/* ── TERMS ───────────────────────────────────────────────── */}
          {termsRows.length > 0 ? (
            <View wrap={false} style={styles.termsSection}>
              {termsRows.map((row) => (
                <View key={row.label} style={styles.termRow}>
                  <View style={styles.termLeft}>
                    <Text style={{ fontWeight: "bold" }}>{row.label}:</Text>
                    <Text style={{ flex: 1 }}>{row.en}</Text>
                  </View>
                  {row.ar ? (
                    <Text style={{ flex: 1, textAlign: "right" }}>{row.ar}</Text>
                  ) : null}
                </View>
              ))}
            </View>
          ) : null}

          {/* ── BANK DETAILS ─────────────────────────────────────────── */}
          {(bank.en || bank.ar) ? (
            <View style={styles.bankSection}>
              <Text style={{ fontWeight: "bold", marginBottom: 2 }}>BANK DETAILS</Text>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={{ flex: 1 }}>{bank.en || ""}</Text>
                {bank.ar ? <Text style={{ flex: 1, textAlign: "right" }}>{bank.ar}</Text> : null}
              </View>
            </View>
          ) : null}
        </View>

        {/* ── DYNAMIC FOOTER ───────────────────────────────────────── */}
        <View fixed style={styles.footerRow}>
          <Text style={styles.footerText}>
            {settings.companyName || "Qvoke"} | Tel: +966 920002087 | info@ajnetworksa.com
          </Text>
          <Text style={styles.footerText} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>

        {settings.footerImageUrl ? (
          <View fixed style={{ position: "absolute", bottom: 25, left: 0, right: 0, alignItems: "center" }}>
            <Image src={settings.footerImageUrl} style={{ width: "100%", height: 30, objectFit: "contain" }} />
          </View>
        ) : null}

        <Watermark text={quote.watermarkText} type={quote.watermarkType} />

      </Page>
    </Document>
  );
}
