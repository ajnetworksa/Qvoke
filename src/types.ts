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
  avatar?: string;
  permissions?: Record<string, boolean>;
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

