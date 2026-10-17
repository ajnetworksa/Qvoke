export interface Company {
  id: string;
  name: string;
  logo?: string;
  siteLogo?: string;
  address: SaudiAddress;
  phone: string;
  email: string;
  vatNumber?: string;
  crNumber?: string;
  currency: 'SAR' | 'USD' | 'EUR';
  defaultTax: number;
  brandColor: string;
  pdfHeaderBgType?: 'solid' | 'gradient';
  pdfHeaderBgColorStart?: string;
  pdfHeaderBgColorEnd?: string;
  pdfHeaderTextColor?: string;
  pdfTableBgColor?: string;
  pdfTableTextColor?: string;
  /** How line items are numbered in quotes & invoices */
  lineNumberFormat?: 'sequential' | 'sectioned' | 'per-section' | 'none';
  pdfTemplate?: PDFTemplateConfig;
  footerImageUrl?: string;
  pdfWarranty?: string;
  pdfManpower?: string;
  pdfMobilization?: string;
  pdfDuration?: string;
  bankName?: string;
  bankAccount?: string;
  bankIban?: string;
}

export interface CustomFieldDefinition {
  id: string;
  name: string;
  key: string;
  type: 'text' | 'number' | 'select' | 'checkbox' | 'date' | 'textarea';
  appliesTo: 'all' | 'quotation' | 'invoice';
  options?: string[];
  defaultValue?: any;
  sectionId?: string;
  sectionName?: string;
}

export interface PDFSectionField {
  id: string;
  key: string;
  label: string;
  labelAr?: string;
  enabled: boolean;
  isCustom?: boolean;
  isLocked?: boolean;
  type?: 'text' | 'number' | 'select' | 'checkbox' | 'date' | 'textarea';
  order: number;
}

export type PDFSectionId =
  | 'header'
  | 'meta'
  | 'customer'
  | 'vehicle'
  | 'line_items'
  | 'summary'
  | 'zatca_qr'
  | 'payment_terms'
  | 'bank_details'
  | 'signatures'
  | 'custom_notes'
  | 'footer'
  | string;

/** Per-section visual overrides; every field is optional and falls back to the template defaults. */
export interface PDFSectionStyle {
  bg?: string;          // block background colour
  text?: string;        // body text colour
  titleColor?: string;  // heading / box-title colour
  headBg?: string;      // box header (or table header / totals highlight) background
  border?: string;      // border colour
  altBg?: string;       // alternate row colour (line items)
  fontSize?: number;    // body font size in pt
  fontFamily?: 'Tajawal' | 'Helvetica' | 'Times-Roman' | 'Courier';
  radius?: number;      // corner radius in pt
}

export interface PDFSectionItem {
  id: PDFSectionId;
  name: string;
  nameAr: string;
  enabled: boolean;
  width: 'full' | 'half';
  order: number;
  isCustom?: boolean;
  customTitle?: string;
  customTitleAr?: string;
  customContent?: string;
  style?: PDFSectionStyle;
  fields: PDFSectionField[];
}

export interface PDFTableColumnsConfig {
  showIndex: boolean;
  showItemCode: boolean;
  showDescEn: boolean;
  showDescAr: boolean;
  showQty: boolean;
  showUnit: boolean;
  showUnitPrice: boolean;
  showDiscount: boolean;
  showTax: boolean;
  showTotal: boolean;
}

export interface PDFTemplateConfig {
  preset: 'executive' | 'zatca_official' | 'corporate_blue' | 'luxury_gold' | 'monochrome' | string;
  name: string;
  sections: PDFSectionItem[];
  invoiceSections?: PDFSectionItem[];
  quoteSections?: PDFSectionItem[];
  customFields?: CustomFieldDefinition[];
  headerStyle: 'solid' | 'gradient' | 'minimal' | 'boxed';
  colors: {
    primary: string;
    headerBgStart: string;
    headerBgEnd: string;
    headerText: string;
    tableHeaderBg: string;
    tableHeaderText: string;
    zebraRowBg: string;
    accentBorder: string;
  };
  tableColumns: PDFTableColumnsConfig;
  typography: {
    fontFamily: 'Tajawal' | 'Helvetica' | 'Times-Roman' | 'Courier' | 'Outfit' | 'Inter' | 'Geist';
    bodyFontSize: number;
    titleFontSize: number;
  };
  watermark: {
    enabled: boolean;
    text: string;
    opacity: number;
    angle: number;
  };
  page: {
    size: 'A4' | 'LETTER';
    margins: 'compact' | 'normal' | 'spacious';
  };
}

export interface SaudiAddress {
  street: string;
  district?: string;
  city: string;
  postalCode?: string;
  country: 'SA';
}

export interface Customer {
  id: string;
  companyName: string;
  contactPerson?: string;
  email: string;
  phone: string;
  vatNumber?: string;
  billingAddress: SaudiAddress;
  createdAt: Date;
}

export interface Product {
  id: string;
  name: string;
  description?: string;
  type: 'product' | 'service';
  unitPrice: number;
  unit: string;
  taxRate: number;
  categoryId?: string;
  itemCode?: string;
  supplierName?: string;
  stockQuantity?: number;
  minStockLevel?: number;
  trackStock?: boolean;
}

export interface Expense {
  id: string;
  number: string;
  companyId: string;
  category: 'rent' | 'utilities' | 'software' | 'supplies' | 'salaries' | 'travel' | 'inventory' | 'marketing' | 'maintenance' | 'other';
  vendor?: string;
  description: string;
  amount: number;
  taxAmount: number;
  taxRate: number;
  total: number;
  currency: string;
  date: string;
  paymentMethod: 'cash' | 'bank_transfer' | 'card' | 'cheque';
  reference?: string;
  receiptUrl?: string;
  status: 'paid' | 'pending' | 'reimbursed';
  taxDeductible: boolean;
  notes?: string;
  createdBy?: string;
  createdByName?: string;
  createdAt: string;
  updatedAt: string;
}

export interface RecurringInvoice {
  id: string;
  number: string;
  companyId: string;
  customerId: string;
  customerName?: string;
  customerEmail?: string;
  profileName: string;
  frequency: 'weekly' | 'monthly' | 'quarterly' | 'semi_annual' | 'yearly';
  startDate: string;
  nextRunDate: string;
  endDate?: string | null;
  status: 'active' | 'paused' | 'completed';
  autoSendEmail: boolean;
  currency: string;
  lineItems: LineItem[] | string;
  notes?: string;
  terms?: string;
  total: number;
  lastGeneratedInvoiceId?: string | null;
  lastGeneratedAt?: string | null;
  generationCount: number;
  createdBy?: string;
  createdByName?: string;
  createdAt: string;
  updatedAt: string;
}

export interface InventoryTransaction {
  id: string;
  companyId: string;
  productId: string;
  productName?: string;
  itemCode?: string;
  unit?: string;
  type: 'in' | 'out' | 'adjustment' | 'pos_sale' | 'invoice_sale';
  quantity: number;
  previousStock: number;
  newStock: number;
  unitCost?: number;
  referenceDocType?: string;
  referenceDocId?: string;
  notes?: string;
  createdBy?: string;
  createdByName?: string;
  createdAt: string;
}

export interface PublicShare {
  id: string;
  token: string;
  companyId: string;
  docType: 'quotation' | 'invoice';
  docId: string;
  expiresAt?: string;
  status: 'active' | 'accepted' | 'declined' | 'expired';
  viewsCount: number;
  lastViewedAt?: string;
  acceptedAt?: string;
  acceptedByName?: string;
  acceptedSignature?: string;
  feedbackNote?: string;
  createdAt: string;
}

export interface CurrencyRateInfo {
  base: string;
  timestamp: string;
  rates: Record<string, number>;
}

export interface Permissions {
  canUseRFQ?: boolean;
  canUseAI?: boolean;
  canManageUsers?: boolean;
  canManageSettings?: boolean;
  canDeleteData?: boolean;
  canDatabaseMaintenance?: boolean;
  canOverridePrice?: boolean;
  canViewRevenue?: boolean;
  canViewAllQuotes?: boolean;
  canViewCreatedBy?: boolean;
  canViewHistory?: boolean;
  canChangePassword?: boolean;
  canConvertInvoice?: boolean;
  canSaveTemplate?: boolean;
  canEmailQuote?: boolean;
  canPrintQuote?: boolean;
  canViewFeatureAccess?: boolean;
  canUsePriceSync?: boolean;
  canUndoQuote?: boolean;
  canChangeAuthor?: boolean;
  canShareQuote?: boolean;
  canEditSharedQuote?: boolean;
  canUseKanban?: boolean;
  canUseWatermark?: boolean;
  canUsePricingControls?: boolean;
  canUseMarkup?: boolean;
  canUsePOS?: boolean;
  canManageExpenses?: boolean;
  canManageInventory?: boolean;
  canManageSubscriptions?: boolean;
  canManagePublicPortals?: boolean;
}

export interface LineItem {
  id: string;
  type: 'item' | 'section' | 'note';
  productId?: string;
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  discountPercent: number;
  taxPercent: number;
  originalPrice?: number;
  manualPrice?: number;
  ruleOverride?: 'EXCL' | 'INCL';
  subtotal: number; // computed
}

export interface Quotation {
  id: string;
  number: string; // QT-2025-0001
  customerId: string;
  date: Date;
  validUntil: Date;
  status: 'draft' | 'sent' | 'confirmed' | 'expired' | 'cancelled';
  lineItems: LineItem[];
  notes?: string;
  terms?: string;
  subject?: string;
  subjectAr?: string;
  currency: string;
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  total: number;
  linkedInvoiceId?: string;
  createdAt: Date;
  updatedAt: Date;
  salespersonId?: string;
  watermarkText?: string;
  watermarkType?: 'none' | 'center' | 'multi';
  hidePrices?: boolean;
  manualTotal?: number;
  followUpDate?: string | null;
  followUpNote?: string | null;
  /** Values for template custom fields, keyed by CustomFieldDefinition.key */
  customFieldValues?: Record<string, string>;
}

export interface Invoice {
  id: string;
  number: string; // INV-2025-0001
  customerId: string;
  date: Date;
  dueDate: Date;
  status: 'draft' | 'posted' | 'partial' | 'paid' | 'overdue' | 'cancelled';
  paymentTerms: string;
  lineItems: LineItem[];
  notes?: string;
  terms?: string;
  subject?: string;
  subjectAr?: string;
  currency: string;
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  total: number;
  linkedQuoteId?: string;
  payments: Payment[];
  amountPaid: number;
  amountDue: number;
  createdAt: Date;
  updatedAt: Date;
  salespersonId?: string;
  watermarkText?: string;
  watermarkType?: 'none' | 'center' | 'multi';
  hidePrices?: boolean;
  manualTotal?: number;
  followUpDate?: string | null;
  followUpNote?: string | null;
  /** Values for template custom fields, keyed by CustomFieldDefinition.key */
  customFieldValues?: Record<string, string>;
}

export interface Payment {
  id: string;
  date: Date;
  amount: number;
  method: 'cash' | 'bank_transfer' | 'cheque' | 'card';
  reference?: string;
  note?: string;
}

// User role definition for RBAC
export type UserRole = 'admin' | 'accountant' | 'sales_manager' | 'salesperson';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  permissions?: Record<string, boolean>;
  avatar?: string;
  isSuperAdmin?: boolean;
}

export interface AdminCompany {
  id: string;
  name: string;
  slug?: string | null;
  status: 'active' | 'suspended';
  activePlan: string;
  createdAt: string;
  isDefault: boolean;
  setupComplete?: boolean;
  locale?: string;
  currency?: string;
  owner?: { name: string; email: string } | null;
  features?: Record<string, boolean>;
  counts: { users: number; customers: number; quotations: number; invoices: number };
}

export interface DocumentActivity {
  id: number;
  docType: string;
  docId: string;
  docNumber?: string;
  action: 'created' | 'updated' | 'status_changed' | 'deleted';
  changes: { field: string; from: string; to: string }[];
  actorId?: string;
  actorName?: string;
  timestamp: string;
}

export interface AppNotification {
  id: number;
  userId?: string | null;
  type: string;
  title: string;
  body?: string;
  link?: string;
  isRead: boolean;
  createdAt: string;
}

export interface DashboardStats {
  totalRevenue: number;
  revenueChangePercent: number;
  openQuotes: number;
  openQuotesChangePercent: number;
  unpaidInvoices: number;
  unpaidInvoicesChangePercent: number;
  overdueInvoices: number;
  overdueInvoicesChangePercent: number;
}

export interface Supplier {
  id: string;
  name: string;
}

export interface CompanyMembership {
  id: string;
  name: string;
  slug?: string | null;
  activePlan: string;
  role: 'owner' | 'admin' | 'member';
  createdAt?: string;
  theme?: { preset?: string | null; color?: string | null } | null;
}

export interface PersonalTask {
  id: string;
  userId: string;
  title: string;
  notes?: string | null;
  status: 'open' | 'in_progress' | 'done';
  priority: 'low' | 'normal' | 'high';
  dueDate?: string | null;
  link?: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt?: string | null;
}

